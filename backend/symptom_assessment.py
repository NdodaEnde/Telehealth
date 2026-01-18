"""AI Symptom Assessment Service

Uses LLM to analyze patient symptoms and determine:
- Urgency level (emergency/urgent/routine)
- Recommended care pathway
- Suggested specialization
- Preliminary assessment questions
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

logger = logging.getLogger(__name__)

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-cD64dDb326d73D2Bf1')


class UrgencyLevel(str, Enum):
    EMERGENCY = "emergency"  # Go to ER immediately
    URGENT = "urgent"  # See doctor within 24 hours
    SOON = "soon"  # See doctor within 48-72 hours
    ROUTINE = "routine"  # Schedule at convenience


class CarePathway(str, Enum):
    EMERGENCY_SERVICES = "emergency_services"  # Call ambulance / go to ER
    URGENT_CONSULTATION = "urgent_consultation"  # Immediate telehealth
    NURSE_TRIAGE = "nurse_triage"  # Nurse assessment first
    DOCTOR_CONSULTATION = "doctor_consultation"  # Direct to doctor
    SPECIALIST_REFERRAL = "specialist_referral"  # Needs specialist
    SELF_CARE = "self_care"  # Home care with monitoring


class SymptomAssessmentResult(BaseModel):
    urgency: UrgencyLevel
    urgency_score: int  # 1-10
    care_pathway: CarePathway
    recommended_specialization: Optional[str] = None
    assessment_summary: str
    warning_signs: List[str] = []
    self_care_advice: Optional[str] = None
    follow_up_questions: List[str] = []
    disclaimer: str = "This is an AI-assisted assessment and not a medical diagnosis. Please consult a healthcare professional for proper evaluation."


# Common symptoms mapped to potential urgency
SYMPTOM_URGENCY_HINTS = {
    # Emergency symptoms
    "chest pain": "emergency",
    "difficulty breathing": "emergency",
    "severe bleeding": "emergency",
    "stroke symptoms": "emergency",
    "loss of consciousness": "emergency",
    "severe allergic reaction": "emergency",
    "seizure": "emergency",
    
    # Urgent symptoms
    "high fever": "urgent",
    "severe pain": "urgent",
    "persistent vomiting": "urgent",
    "signs of dehydration": "urgent",
    "severe headache": "urgent",
    
    # Soon symptoms
    "moderate fever": "soon",
    "persistent cough": "soon",
    "ear pain": "soon",
    "urinary symptoms": "soon",
    
    # Routine symptoms
    "mild cold symptoms": "routine",
    "minor rash": "routine",
    "mild headache": "routine",
    "fatigue": "routine",
}


async def assess_symptoms(
    symptoms: List[str],
    severity: str,
    description: Optional[str] = None,
    patient_age: Optional[int] = None,
    patient_gender: Optional[str] = None,
    chronic_conditions: Optional[List[str]] = None,
    current_medications: Optional[List[str]] = None
) -> SymptomAssessmentResult:
    """
    AI-powered symptom assessment.
    
    Args:
        symptoms: List of reported symptoms
        severity: Patient-reported severity (mild/moderate/severe)
        description: Free-text description of symptoms
        patient_age: Patient's age
        patient_gender: Patient's gender
        chronic_conditions: Known chronic conditions
        current_medications: Current medications
        
    Returns:
        SymptomAssessmentResult with urgency and care pathway
    """
    try:
        # Try LLM assessment first
        result = await _llm_assess_symptoms(
            symptoms=symptoms,
            severity=severity,
            description=description,
            patient_age=patient_age,
            patient_gender=patient_gender,
            chronic_conditions=chronic_conditions,
            current_medications=current_medications
        )
        return result
    except Exception as e:
        logger.error(f"LLM assessment failed: {e}")
        # Fallback to rule-based assessment
        return _rule_based_assessment(symptoms, severity)


async def _llm_assess_symptoms(
    symptoms: List[str],
    severity: str,
    description: Optional[str],
    patient_age: Optional[int],
    patient_gender: Optional[str],
    chronic_conditions: Optional[List[str]],
    current_medications: Optional[List[str]]
) -> SymptomAssessmentResult:
    """Use LLM to assess symptoms"""
    
    from emergentintegrations.llm.chat import chat, LlmConfig
    
    # Build context
    patient_info = []
    if patient_age:
        patient_info.append(f"Age: {patient_age}")
    if patient_gender:
        patient_info.append(f"Gender: {patient_gender}")
    if chronic_conditions:
        patient_info.append(f"Chronic conditions: {', '.join(chronic_conditions)}")
    if current_medications:
        patient_info.append(f"Current medications: {', '.join(current_medications)}")
    
    patient_context = "\n".join(patient_info) if patient_info else "No additional patient information provided."
    
    prompt = f"""You are a medical triage AI assistant helping to assess patient symptoms for a South African telehealth platform. Your role is to determine urgency and recommend the appropriate care pathway.

PATIENT SYMPTOMS:
- Symptoms reported: {', '.join(symptoms)}
- Patient-reported severity: {severity}
- Additional description: {description or 'None provided'}

PATIENT INFORMATION:
{patient_context}

Please analyze these symptoms and provide a JSON response with the following structure:
{{
    "urgency": "emergency|urgent|soon|routine",
    "urgency_score": 1-10,
    "care_pathway": "emergency_services|urgent_consultation|nurse_triage|doctor_consultation|specialist_referral|self_care",
    "recommended_specialization": "general_practice|internal_medicine|pediatrics|gynecology|cardiology|neurology|orthopedics|dermatology|psychiatry|ent|ophthalmology|null",
    "assessment_summary": "Brief 2-3 sentence summary of assessment",
    "warning_signs": ["List of red flag symptoms to watch for"],
    "self_care_advice": "Home care advice if appropriate, or null",
    "follow_up_questions": ["Additional questions to ask the patient"]
}}

IMPORTANT:
- If symptoms suggest a life-threatening emergency, set urgency to "emergency" and care_pathway to "emergency_services"
- Consider the South African healthcare context
- Be conservative - when in doubt, recommend higher urgency
- Always include appropriate warning signs

Respond ONLY with the JSON object, no additional text."""

    config = LlmConfig(
        api_key=EMERGENT_LLM_KEY,
        model="gpt-4o-mini",
        temperature=0.3,
        max_tokens=1000
    )
    
    response = await chat(
        config=config,
        prompt=prompt,
        system_prompt="You are a medical triage AI. Respond only with valid JSON."
    )
    
    # Parse LLM response
    try:
        # Clean response if needed
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        result_data = json.loads(response_text.strip())
        
        return SymptomAssessmentResult(
            urgency=UrgencyLevel(result_data.get("urgency", "routine")),
            urgency_score=result_data.get("urgency_score", 5),
            care_pathway=CarePathway(result_data.get("care_pathway", "nurse_triage")),
            recommended_specialization=result_data.get("recommended_specialization"),
            assessment_summary=result_data.get("assessment_summary", "Assessment completed."),
            warning_signs=result_data.get("warning_signs", []),
            self_care_advice=result_data.get("self_care_advice"),
            follow_up_questions=result_data.get("follow_up_questions", [])
        )
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response: {e}")
        raise


def _rule_based_assessment(
    symptoms: List[str],
    severity: str
) -> SymptomAssessmentResult:
    """Fallback rule-based symptom assessment"""
    
    symptoms_lower = [s.lower() for s in symptoms]
    
    # Check for emergency symptoms
    emergency_keywords = ["chest pain", "breathing", "unconscious", "stroke", "severe bleeding", "seizure"]
    for keyword in emergency_keywords:
        for symptom in symptoms_lower:
            if keyword in symptom:
                return SymptomAssessmentResult(
                    urgency=UrgencyLevel.EMERGENCY,
                    urgency_score=10,
                    care_pathway=CarePathway.EMERGENCY_SERVICES,
                    assessment_summary=f"Symptoms including '{keyword}' require immediate emergency care. Please call emergency services or go to the nearest emergency room.",
                    warning_signs=["This may be a medical emergency", "Do not delay seeking care"],
                    follow_up_questions=[]
                )
    
    # Severity-based routing
    if severity == "severe":
        return SymptomAssessmentResult(
            urgency=UrgencyLevel.URGENT,
            urgency_score=8,
            care_pathway=CarePathway.URGENT_CONSULTATION,
            assessment_summary="Based on the severe symptoms reported, we recommend an urgent consultation with a doctor within the next few hours.",
            warning_signs=["Monitor for worsening symptoms", "Seek emergency care if symptoms become unbearable"],
            follow_up_questions=["How long have you had these symptoms?", "Have you taken any medication?"]
        )
    elif severity == "moderate":
        return SymptomAssessmentResult(
            urgency=UrgencyLevel.SOON,
            urgency_score=5,
            care_pathway=CarePathway.NURSE_TRIAGE,
            assessment_summary="Your symptoms should be evaluated by a nurse who can determine if you need to see a doctor today.",
            warning_signs=["Contact us if symptoms worsen", "Seek emergency care for severe symptoms"],
            follow_up_questions=["Are you experiencing any fever?", "When did symptoms start?"]
        )
    else:
        return SymptomAssessmentResult(
            urgency=UrgencyLevel.ROUTINE,
            urgency_score=3,
            care_pathway=CarePathway.NURSE_TRIAGE,
            assessment_summary="Your symptoms appear to be mild. A nurse will assess your condition to determine the best care pathway.",
            self_care_advice="Rest, stay hydrated, and monitor your symptoms.",
            warning_signs=["Contact us if symptoms persist beyond 48 hours or worsen"],
            follow_up_questions=["How long have you had these symptoms?", "Any allergies we should know about?"]
        )
