"""AI Symptom Assessment Routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
from symptom_assessment import assess_symptoms, SymptomAssessmentResult
from patient_models import AISymptomAssessmentRequest, AISymptomAssessmentResponse
from schemas import APIResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/symptoms", tags=["Symptom Assessment"])


# Common symptoms for selection
COMMON_SYMPTOMS = [
    # General
    {"category": "General", "symptoms": [
        "Fever", "Fatigue", "Weakness", "Weight loss", "Weight gain", 
        "Night sweats", "Chills", "Loss of appetite"
    ]},
    # Head & Neurological
    {"category": "Head & Neurological", "symptoms": [
        "Headache", "Dizziness", "Fainting", "Confusion", "Memory problems",
        "Numbness", "Tingling", "Tremor", "Seizure"
    ]},
    # Eyes, Ears, Nose, Throat
    {"category": "Eyes, Ears, Nose, Throat", "symptoms": [
        "Eye pain", "Vision changes", "Red eyes", "Ear pain", "Hearing loss",
        "Ringing in ears", "Runny nose", "Sore throat", "Difficulty swallowing"
    ]},
    # Respiratory
    {"category": "Respiratory", "symptoms": [
        "Cough", "Shortness of breath", "Wheezing", "Chest tightness",
        "Coughing blood", "Rapid breathing"
    ]},
    # Cardiovascular
    {"category": "Cardiovascular", "symptoms": [
        "Chest pain", "Palpitations", "Rapid heartbeat", "Slow heartbeat",
        "Swelling in legs", "Leg pain when walking"
    ]},
    # Gastrointestinal
    {"category": "Gastrointestinal", "symptoms": [
        "Nausea", "Vomiting", "Diarrhea", "Constipation", "Abdominal pain",
        "Bloating", "Heartburn", "Blood in stool", "Black stool"
    ]},
    # Urinary
    {"category": "Urinary", "symptoms": [
        "Painful urination", "Frequent urination", "Blood in urine",
        "Difficulty urinating", "Incontinence"
    ]},
    # Musculoskeletal
    {"category": "Musculoskeletal", "symptoms": [
        "Joint pain", "Back pain", "Neck pain", "Muscle pain", "Stiffness",
        "Swelling of joints", "Limited mobility"
    ]},
    # Skin
    {"category": "Skin", "symptoms": [
        "Rash", "Itching", "Skin discoloration", "Wounds", "Bruising",
        "Hair loss", "Nail changes"
    ]},
    # Mental Health
    {"category": "Mental Health", "symptoms": [
        "Anxiety", "Depression", "Insomnia", "Mood changes", "Stress",
        "Panic attacks", "Suicidal thoughts"
    ]},
]


@router.get("/common")
async def get_common_symptoms():
    """Get categorized list of common symptoms for selection"""
    return {"symptom_categories": COMMON_SYMPTOMS}


@router.post("/assess", response_model=AISymptomAssessmentResponse)
async def perform_symptom_assessment(
    request: AISymptomAssessmentRequest,
    user: AuthenticatedUser = Depends(get_current_user)
) -> AISymptomAssessmentResponse:
    """
    Perform AI-powered symptom assessment.
    
    Returns urgency level, care pathway recommendation, and preliminary guidance.
    
    Note: This is an AI-assisted assessment and NOT a medical diagnosis.
    Always consult a healthcare professional for proper evaluation.
    """
    if not request.symptoms:
        raise HTTPException(status_code=400, detail="At least one symptom is required")
    
    if request.severity not in ["mild", "moderate", "severe"]:
        raise HTTPException(status_code=400, detail="Severity must be mild, moderate, or severe")
    
    # Get patient context if available
    patient_profile = await supabase.select("patient_profiles", "*", {"user_id": user.id})
    profile_data = patient_profile[0] if patient_profile else None
    
    # Extract chronic conditions and medications if available
    chronic_conditions = None
    current_medications = None
    allergies = None
    
    if profile_data:
        if profile_data.get("chronic_conditions"):
            chronic_conditions = [c.get("condition") for c in profile_data["chronic_conditions"]]
        if profile_data.get("current_medications"):
            current_medications = [m.get("name") for m in profile_data["current_medications"]]
        if profile_data.get("allergies"):
            allergies = [a.get("allergen") for a in profile_data["allergies"]]
    
    # Use request context if provided, otherwise use profile
    assessment_context = {
        "patient_age": request.patient_age,
        "patient_gender": request.patient_gender,
        "chronic_conditions": request.chronic_conditions or chronic_conditions,
        "current_medications": request.current_medications or current_medications,
    }
    
    # Perform assessment
    result = await assess_symptoms(
        symptoms=request.symptoms,
        severity=request.severity,
        description=request.description,
        **assessment_context
    )
    
    # Store assessment for reference
    assessment_record = {
        "id": str(uuid.uuid4()),
        "patient_id": user.id,
        "symptoms": request.symptoms,
        "severity": request.severity,
        "description": request.description,
        "duration": request.duration,
        "urgency": result.urgency.value,
        "urgency_score": result.urgency_score,
        "care_pathway": result.care_pathway.value,
        "recommended_specialization": result.recommended_specialization,
        "assessment_summary": result.assessment_summary,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await supabase.insert("symptom_assessments", assessment_record)
    
    return AISymptomAssessmentResponse(
        urgency=result.urgency.value,
        urgency_score=result.urgency_score,
        care_pathway=result.care_pathway.value,
        recommended_specialization=result.recommended_specialization,
        assessment_summary=result.assessment_summary,
        warning_signs=result.warning_signs,
        self_care_advice=result.self_care_advice,
        follow_up_questions=result.follow_up_questions,
        disclaimer=result.disclaimer
    )


@router.get("/history")
async def get_symptom_assessment_history(
    limit: int = 10,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get patient's past symptom assessments"""
    assessments = await supabase.select(
        "symptom_assessments",
        "*",
        filters={"patient_id": user.id},
        order="created_at.desc",
        limit=limit
    )
    
    return {"assessments": assessments, "total": len(assessments)}


@router.get("/{assessment_id}")
async def get_symptom_assessment(
    assessment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific symptom assessment"""
    assessments = await supabase.select(
        "symptom_assessments",
        "*",
        filters={"id": assessment_id}
    )
    
    if not assessments:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    assessment = assessments[0]
    
    # Verify access
    if assessment["patient_id"] != user.id and user.role not in ["nurse", "doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return assessment
