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
    
    Note: Since patient_profiles table doesn't exist in Supabase, we:
    1. Update the profiles table with basic info (id_number marks onboarding complete)
    2. Store extended data in MongoDB for now
    """
    # Validate ID number
    id_validation = validate_sa_id_number(data.id_number)
    if not id_validation.get("valid"):
        raise HTTPException(status_code=400, detail=id_validation.get("error", "Invalid ID number"))
    
    # Check consent
    if not data.consent_telehealth or not data.consent_data_processing:
        raise HTTPException(status_code=400, detail="Telehealth and data processing consent required")
    
    # Update main profile in Supabase - id_number being set indicates onboarding complete
    profile_data = {
        "first_name": data.first_name,
        "last_name": data.last_name,
        "phone": data.phone,
        "date_of_birth": data.date_of_birth or id_validation.get("date_of_birth"),
        "id_number": data.id_number,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    result = await supabase.update("profiles", profile_data, {"id": user.id})
    if result is None:
        logger.error(f"Failed to update profile for user {user.id}")
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    logger.info(f"Profile updated for user {user.id} with id_number {data.id_number}")
    
    # Create extended profile record ID
    extended_profile_id = str(uuid.uuid4())
    
    # Verify medical aid if provided (placeholder)
    medical_aid_verified = False
    if data.has_medical_aid and data.medical_aid:
        verification = await healthbridge.verify_medical_aid(
            scheme=data.medical_aid.scheme,
            membership_number=data.medical_aid.membership_number,
            dependent_code=data.medical_aid.dependent_code
        )
        medical_aid_verified = verification.verified
    
    # Sync to HealthBridge EHR (placeholder)
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
        id=extended_profile_id,
        user_id=user.id,
        created_at=datetime.utcnow().isoformat(),
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
