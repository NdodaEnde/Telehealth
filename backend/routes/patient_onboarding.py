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
    validate_passport,
    validate_identification,
    get_medical_aid_schemes,
    get_countries,
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


@router.get("/countries")
async def list_countries():
    """Get list of countries for passport selection"""
    countries = get_countries()
    return {"countries": countries}


@router.post("/validate-id")
async def validate_id_number(
    id_type: str = Query("sa_id", description="Type of ID: 'sa_id' or 'passport'"),
    id_number: Optional[str] = Query(None, description="SA ID number (13 digits)"),
    passport_number: Optional[str] = Query(None, description="Passport number"),
    country_code: Optional[str] = Query(None, description="Country code for passport"),
    date_of_birth: Optional[str] = Query(None, description="Date of birth (YYYY-MM-DD) for passport")
):
    """
    Validate identification document.
    
    For SA ID: Validates format, checksum, extracts DOB/gender.
    For Passport: Validates format, requires DOB separately.
    """
    result = validate_identification(
        id_type=id_type,
        id_number=id_number,
        passport_number=passport_number,
        country_code=country_code,
        date_of_birth=date_of_birth
    )
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
    
    Note: Uses the user's own JWT token to update their profile (RLS compliant)
    """
    # Validate ID number
    id_validation = validate_sa_id_number(data.id_number)
    if not id_validation.get("valid"):
        raise HTTPException(status_code=400, detail=id_validation.get("error", "Invalid ID number"))
    
    # Check consent
    if not data.consent_telehealth or not data.consent_data_processing:
        raise HTTPException(status_code=400, detail="Telehealth and data processing consent required")
    
    # Update main profile in Supabase using user's own token (RLS will allow)
    profile_data = {
        "first_name": data.first_name,
        "last_name": data.last_name,
        "phone": data.phone,
        "date_of_birth": data.date_of_birth or id_validation.get("date_of_birth"),
        "id_number": data.id_number,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    logger.info(f"Updating profile for user {user.id} with data: {profile_data}")
    
    # Use the user's access token to update - this respects RLS
    result = await supabase.update(
        "profiles", 
        profile_data, 
        {"id": user.id},
        access_token=user.access_token  # Use user's own token
    )
    
    if result is None:
        logger.error(f"Failed to update profile for user {user.id}")
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    logger.info(f"Profile updated successfully for user {user.id}, result: {result}")
    
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
    """Get complete patient profile"""
    # Get base profile
    profiles = await supabase.select("profiles", "*", {"id": user.id})
    if not profiles:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile = profiles[0]
    
    # Check if onboarding is complete by presence of id_number
    onboarding_complete = bool(profile.get("id_number"))
    
    return {
        "profile": profile,
        "extended": None,  # Extended profile not available (table doesn't exist)
        "onboarding_complete": onboarding_complete
    }


@router.patch("/medical-history")
async def update_medical_history(
    allergies: Optional[List[dict]] = None,
    chronic_conditions: Optional[List[dict]] = None,
    current_medications: Optional[List[dict]] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update patient medical history - Currently not implemented as patient_profiles table doesn't exist"""
    # Note: This endpoint would need the patient_profiles table to work
    # For now, return a message indicating the limitation
    return APIResponse(success=False, message="Medical history storage not available - database table needs to be created")
