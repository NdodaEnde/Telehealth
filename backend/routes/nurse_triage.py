"""Nurse Triage Routes"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from auth import get_current_user, require_clinician, AuthenticatedUser
from supabase_client import supabase
from patient_models import (
    NurseTriageCreate,
    NurseTriageResponse,
    VitalSigns,
    TriagePriority
)
from schemas import APIResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/triage", tags=["Nurse Triage"])


# Vital sign reference ranges
VITAL_REFERENCE_RANGES = {
    "blood_pressure_systolic": {"low": 90, "normal_low": 100, "normal_high": 130, "high": 140, "unit": "mmHg"},
    "blood_pressure_diastolic": {"low": 60, "normal_low": 65, "normal_high": 85, "high": 90, "unit": "mmHg"},
    "heart_rate": {"low": 50, "normal_low": 60, "normal_high": 100, "high": 110, "unit": "bpm"},
    "respiratory_rate": {"low": 10, "normal_low": 12, "normal_high": 20, "high": 24, "unit": "breaths/min"},
    "temperature": {"low": 35.5, "normal_low": 36.1, "normal_high": 37.2, "high": 38.0, "unit": "°C"},
    "oxygen_saturation": {"low": 92, "normal_low": 95, "normal_high": 100, "high": 100, "unit": "%"},
}


@router.get("/reference-ranges")
async def get_vital_reference_ranges():
    """Get reference ranges for vital signs"""
    return {"reference_ranges": VITAL_REFERENCE_RANGES}


@router.get("/queue")
async def get_triage_queue(
    user: AuthenticatedUser = Depends(require_clinician)
):
    """
    Get patients waiting for nurse triage.
    Shows appointments that are confirmed but not yet triaged.
    """
    # Get confirmed appointments without triage
    appointments = await supabase.select(
        "appointments",
        "*",
        filters={
            "status": {"in": ["pending", "confirmed"]}
        },
        order="scheduled_at.asc"
    )
    
    # Get existing triages to filter out
    triaged_apt_ids = []
    if appointments:
        apt_ids = [a["id"] for a in appointments]
        triages = await supabase.select(
            "nurse_triages",
            "appointment_id",
            filters={"appointment_id": {"in": apt_ids}}
        )
        triaged_apt_ids = [t["appointment_id"] for t in triages]
    
    # Filter to untriaged appointments
    untriaged = [a for a in appointments if a["id"] not in triaged_apt_ids]
    
    # Enrich with patient info
    enriched_queue = []
    for apt in untriaged:
        patient = await supabase.select("profiles", "first_name,last_name", {"id": apt["patient_id"]})
        patient_profile = await supabase.select("patient_profiles", "*", {"user_id": apt["patient_id"]})
        symptom_assessment = await supabase.select(
            "symptom_assessments", "*", 
            {"patient_id": apt["patient_id"]},
            order="created_at.desc",
            limit=1
        )
        
        enriched_queue.append({
            "appointment": apt,
            "patient_name": f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else "Unknown",
            "patient_profile": patient_profile[0] if patient_profile else None,
            "latest_symptom_assessment": symptom_assessment[0] if symptom_assessment else None
        })
    
    return {"queue": enriched_queue, "total": len(enriched_queue)}


@router.post("", response_model=NurseTriageResponse)
async def create_triage_assessment(
    data: NurseTriageCreate,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """
    Create nurse triage assessment for an appointment.
    Records vital signs, chief complaint, and triage priority.
    """
    if user.role not in ["nurse", "doctor", "admin"]:
        raise HTTPException(status_code=403, detail="Only nurses can perform triage")
    
    # Verify appointment exists
    appointments = await supabase.select("appointments", "*", {"id": data.appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if already triaged
    existing = await supabase.select("nurse_triages", "id", {"appointment_id": data.appointment_id})
    if existing:
        raise HTTPException(status_code=400, detail="Appointment already triaged. Use PATCH to update.")
    
    # Calculate BMI if weight and height provided
    vital_signs = data.vital_signs.dict()
    if data.vital_signs.weight and data.vital_signs.height:
        vital_signs["bmi"] = data.vital_signs.calculate_bmi()
    
    # Create triage record
    triage_record = {
        "id": str(uuid.uuid4()),
        "appointment_id": data.appointment_id,
        "patient_id": data.patient_id,
        "nurse_id": user.id,
        "vital_signs": vital_signs,
        "chief_complaint": data.chief_complaint,
        "symptom_duration": data.symptom_duration,
        "symptom_onset": data.symptom_onset,
        "ai_urgency": data.ai_urgency,
        "ai_urgency_score": data.ai_urgency_score,
        "ai_care_pathway": data.ai_care_pathway,
        "ai_assessment_summary": data.ai_assessment_summary,
        "triage_priority": data.triage_priority.value,
        "nurse_notes": data.nurse_notes,
        "allergies_confirmed": data.allergies_confirmed,
        "medications_confirmed": data.medications_confirmed,
        "identity_verified": data.identity_verified,
        "consent_obtained": data.consent_obtained,
        "medical_aid_verified": data.medical_aid_verified,
        "patient_education_provided": data.patient_education_provided,
        "recommended_action": data.recommended_action,
        "referral_reason": data.referral_reason,
        "doctor_notes": data.doctor_notes,
        "ready_for_doctor": data.recommended_action == "proceed_to_doctor",
        "created_at": datetime.utcnow().isoformat()
    }
    
    result = await supabase.insert("nurse_triages", triage_record)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create triage record")
    
    # Update appointment status if ready for doctor
    if data.recommended_action == "proceed_to_doctor":
        await supabase.update(
            "appointments",
            {"status": "confirmed", "updated_at": datetime.utcnow().isoformat()},
            {"id": data.appointment_id}
        )
    
    return NurseTriageResponse(
        id=result["id"],
        appointment_id=data.appointment_id,
        patient_id=data.patient_id,
        nurse_id=user.id,
        triage_priority=data.triage_priority,
        vital_signs=data.vital_signs,
        chief_complaint=data.chief_complaint,
        nurse_notes=data.nurse_notes,
        recommended_action=data.recommended_action,
        created_at=result["created_at"],
        ready_for_doctor=data.recommended_action == "proceed_to_doctor"
    )


@router.get("/{appointment_id}")
async def get_triage_for_appointment(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get triage assessment for an appointment"""
    triages = await supabase.select(
        "nurse_triages",
        "*",
        filters={"appointment_id": appointment_id}
    )
    
    if not triages:
        raise HTTPException(status_code=404, detail="Triage not found for this appointment")
    
    triage = triages[0]
    
    # Get nurse info
    nurse = await supabase.select("profiles", "first_name,last_name", {"id": triage["nurse_id"]})
    triage["nurse_name"] = f"{nurse[0]['first_name']} {nurse[0]['last_name']}" if nurse else "Unknown"
    
    return triage


@router.patch("/{triage_id}")
async def update_triage_assessment(
    triage_id: str,
    nurse_notes: Optional[str] = None,
    triage_priority: Optional[TriagePriority] = None,
    recommended_action: Optional[str] = None,
    doctor_notes: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Update triage assessment"""
    triages = await supabase.select("nurse_triages", "*", {"id": triage_id})
    if not triages:
        raise HTTPException(status_code=404, detail="Triage not found")
    
    triage = triages[0]
    
    # Only the triaging nurse or admin can update
    if user.role not in ["admin"] and triage["nurse_id"] != user.id:
        raise HTTPException(status_code=403, detail="Only the triaging nurse can update")
    
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    if nurse_notes is not None:
        update_data["nurse_notes"] = nurse_notes
    if triage_priority is not None:
        update_data["triage_priority"] = triage_priority.value
    if recommended_action is not None:
        update_data["recommended_action"] = recommended_action
        update_data["ready_for_doctor"] = recommended_action == "proceed_to_doctor"
    if doctor_notes is not None:
        update_data["doctor_notes"] = doctor_notes
    
    result = await supabase.update("nurse_triages", update_data, {"id": triage_id})
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update triage")
    
    return APIResponse(success=True, message="Triage updated")


@router.get("/ready-for-doctor/list")
async def get_patients_ready_for_doctor(
    user: AuthenticatedUser = Depends(require_clinician)
):
    """
    Get list of triaged patients ready for doctor consultation.
    Used by doctors to see their prepared queue.
    """
    triages = await supabase.select(
        "nurse_triages",
        "*",
        filters={"ready_for_doctor": True},
        order="created_at.asc"
    )
    
    # Enrich with patient and appointment info
    enriched = []
    for triage in triages:
        appointment = await supabase.select("appointments", "*", {"id": triage["appointment_id"]})
        patient = await supabase.select("profiles", "first_name,last_name", {"id": triage["patient_id"]})
        
        if appointment and appointment[0]["status"] not in ["completed", "cancelled"]:
            enriched.append({
                "triage": triage,
                "appointment": appointment[0],
                "patient_name": f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else "Unknown"
            })
    
    return {"ready_for_doctor": enriched, "total": len(enriched)}
