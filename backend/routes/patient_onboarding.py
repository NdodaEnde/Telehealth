"""Patient Onboarding and Profile Routes"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
from healthbridge_service import (
    healthbridge, 
    validate_sa_id_number, 
    get_medical_aid_schemes,
    MedicalAidVerificationResult,
    PatientLookupResult
)
from patient_models import (
    PatientOnboardingCreate,
    PatientOnboardingResponse,
    MedicalAidDetails
)
from schemas import APIResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/patient", tags=["Patient Onboarding"])


@router.get("/medical-aid-schemes")
async def list_medical_aid_schemes():
    """Get list of supported South African medical aid schemes"""
    schemes = get_medical_aid_schemes()
    return {"schemes": schemes}


@router.post("/validate-id")
async def validate_id_number(id_number: str):
    """
    Validate South African ID number and extract information.
    Returns date of birth, gender, and citizenship status.
    """
    result = validate_sa_id_number(id_number)
    return result


@router.post("/lookup-existing")
async def lookup_existing_patient(
    id_number: str,
    user: AuthenticatedUser = Depends(get_current_user)
) -> PatientLookupResult:
    """
    Look up existing patient in HealthBridge EHR by ID number.
    If found, returns patient data to pre-fill forms.
    
    Note: Requires HealthBridge integration to be configured.
    """
    # Validate ID first
    validation = validate_sa_id_number(id_number)
    if not validation.get("valid"):
        raise HTTPException(status_code=400, detail=validation.get("error", "Invalid ID number"))
    
    # Look up in HealthBridge
    result = await healthbridge.lookup_patient(id_number)
    
    # Add validated info
    if not result.found:
        result.date_of_birth = validation.get("date_of_birth")
        result.gender = validation.get("gender")
    
    return result


@router.post("/verify-medical-aid")
async def verify_medical_aid(
    scheme: str,
    membership_number: str,
    dependent_code: str = "00",
    user: AuthenticatedUser = Depends(get_current_user)
) -> MedicalAidVerificationResult:
    """
    Verify medical aid membership via HealthBridge switching.
    Returns verification status and available benefits.
    
    Note: Requires HealthBridge integration to be configured.
    """
    result = await healthbridge.verify_medical_aid(
        scheme=scheme,
        membership_number=membership_number,
        dependent_code=dependent_code
    )
    return result


@router.post("/onboarding", response_model=PatientOnboardingResponse)
async def complete_patient_onboarding(
    data: PatientOnboardingCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Complete patient onboarding with full profile data.
    Validates ID, optionally verifies medical aid, and syncs to HealthBridge.
    """
    # Validate ID number
    id_validation = validate_sa_id_number(data.id_number)
    if not id_validation.get("valid"):
        raise HTTPException(status_code=400, detail=id_validation.get("error", "Invalid ID number"))
    
    # Check consent
    if not data.consent_telehealth or not data.consent_data_processing:
        raise HTTPException(status_code=400, detail="Telehealth and data processing consent required")
    
    # Update main profile
    profile_data = {
        "first_name": data.first_name,
        "last_name": data.last_name,
        "phone": data.phone,
        "date_of_birth": data.date_of_birth or id_validation.get("date_of_birth"),
        "id_number": data.id_number,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await supabase.update("profiles", profile_data, {"id": user.id})
    
    # Create/update patient extended profile
    extended_profile = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "gender": data.gender.value,
        "alternative_phone": data.alternative_phone,
        "address_line_1": data.address_line_1,
        "address_line_2": data.address_line_2,
        "city": data.city,
        "province": data.province,
        "postal_code": data.postal_code,
        "emergency_contact_name": data.emergency_contact.name if data.emergency_contact else None,
        "emergency_contact_relationship": data.emergency_contact.relationship if data.emergency_contact else None,
        "emergency_contact_phone": data.emergency_contact.phone if data.emergency_contact else None,
        "has_medical_aid": data.has_medical_aid,
        "medical_aid_scheme": data.medical_aid.scheme if data.medical_aid else None,
        "medical_aid_number": data.medical_aid.membership_number if data.medical_aid else None,
        "medical_aid_plan": data.medical_aid.plan if data.medical_aid else None,
        "medical_aid_dependent_code": data.medical_aid.dependent_code if data.medical_aid else None,
        "consent_telehealth": data.consent_telehealth,
        "consent_data_processing": data.consent_data_processing,
        "consent_marketing": data.consent_marketing,
        "onboarding_completed_at": datetime.utcnow().isoformat(),
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Store medical history if provided
    if data.medical_history:
        extended_profile["allergies"] = [a.dict() for a in data.medical_history.allergies]
        extended_profile["chronic_conditions"] = [c.dict() for c in data.medical_history.chronic_conditions]
        extended_profile["current_medications"] = [m.dict() for m in data.medical_history.current_medications]
        extended_profile["past_surgeries"] = data.medical_history.past_surgeries
        extended_profile["family_history"] = data.medical_history.family_history
        extended_profile["blood_type"] = data.medical_history.blood_type.value if data.medical_history.blood_type else None
        extended_profile["smoking_status"] = data.medical_history.smoking_status
        extended_profile["alcohol_use"] = data.medical_history.alcohol_use
    
    # Check if extended profile exists
    existing = await supabase.select("patient_profiles", "id", {"user_id": user.id})
    
    if existing:
        await supabase.update("patient_profiles", extended_profile, {"user_id": user.id})
    else:
        await supabase.insert("patient_profiles", extended_profile)
    
    # Verify medical aid if provided
    medical_aid_verified = False
    if data.has_medical_aid and data.medical_aid:
        verification = await healthbridge.verify_medical_aid(
            scheme=data.medical_aid.scheme,
            membership_number=data.medical_aid.membership_number,
            dependent_code=data.medical_aid.dependent_code
        )
        medical_aid_verified = verification.verified
    
    # Sync to HealthBridge EHR
    healthbridge_synced = False
    healthbridge_patient_id = None
    
    sync_result = await healthbridge.sync_patient_to_ehr({
        "id_number": data.id_number,
        "first_name": data.first_name,
        "last_name": data.last_name,
        "date_of_birth": data.date_of_birth,
        "gender": data.gender.value,
        "email": data.email,
        "phone": data.phone,
        "medical_aid": data.medical_aid.dict() if data.medical_aid else None,
        "medical_history": data.medical_history.dict() if data.medical_history else None
    })
    
    if sync_result.success:
        healthbridge_synced = True
        healthbridge_patient_id = sync_result.healthbridge_record_id
    
    return PatientOnboardingResponse(
        id=extended_profile["id"],
        user_id=user.id,
        created_at=extended_profile["created_at"],
        id_verified=id_validation.get("valid", False),
        medical_aid_verified=medical_aid_verified,
        healthbridge_synced=healthbridge_synced,
        healthbridge_patient_id=healthbridge_patient_id,
        onboarding_complete=True
    )


@router.get("/profile")
async def get_patient_profile(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get complete patient profile including medical history"""
    # Get base profile
    profiles = await supabase.select("profiles", "*", {"id": user.id})
    if not profiles:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile = profiles[0]
    
    # Get extended profile
    extended = await supabase.select("patient_profiles", "*", {"user_id": user.id})
    extended_data = extended[0] if extended else None
    
    return {
        "profile": profile,
        "extended": extended_data,
        "onboarding_complete": bool(extended_data and extended_data.get("onboarding_completed_at"))
    }


@router.patch("/medical-history")
async def update_medical_history(
    allergies: Optional[List[dict]] = None,
    chronic_conditions: Optional[List[dict]] = None,
    current_medications: Optional[List[dict]] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update patient medical history"""
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    
    if allergies is not None:
        update_data["allergies"] = allergies
    if chronic_conditions is not None:
        update_data["chronic_conditions"] = chronic_conditions
    if current_medications is not None:
        update_data["current_medications"] = current_medications
    
    result = await supabase.update("patient_profiles", update_data, {"user_id": user.id})
    
    if not result:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    return APIResponse(success=True, message="Medical history updated")
