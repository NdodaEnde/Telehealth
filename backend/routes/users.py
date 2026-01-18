from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
from schemas import (
    UserProfile, UserProfileUpdate, UserWithRole,
    ClinicianProfile, ClinicianAvailability, ClinicianAvailabilityCreate,
    APIResponse
)
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["Users"])


# ============ User Profile Routes ============

@router.get("/me", response_model=UserWithRole)
async def get_current_user_profile(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get current user's profile"""
    profiles = await supabase.select('profiles', '*', {'id': user.id})
    
    if not profiles:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile = profiles[0]
    profile['role'] = user.role
    
    return UserWithRole(**profile)


@router.patch("/me", response_model=UserProfile)
async def update_current_user_profile(
    data: UserProfileUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update current user's profile"""
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await supabase.update('profiles', update_data, {'id': user.id})
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    return UserProfile(**result)


# ============ Clinician Routes ============

@router.get("/clinicians", response_model=List[ClinicianProfile])
async def list_clinicians(
    specialization: Optional[str] = None,
    available_for_emergency: Optional[bool] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """List available clinicians"""
    # Get clinician user IDs
    role_filters = {'role': {'in': ['doctor', 'nurse']}}
    user_roles = await supabase.select('user_roles', 'user_id', role_filters)
    
    if not user_roles:
        return []
    
    clinician_ids = [r['user_id'] for r in user_roles]
    
    # Get clinician profiles
    clinician_profiles = await supabase.select(
        'clinician_profiles',
        '*',
        filters={'id': {'in': clinician_ids}}
    )
    
    # Get base profiles
    profiles = await supabase.select(
        'profiles',
        'id,first_name,last_name,profile_image_url',
        filters={'id': {'in': clinician_ids}}
    )
    profile_map = {p['id']: p for p in profiles}
    
    # Merge data
    result = []
    for cp in clinician_profiles:
        if specialization and cp.get('specialization') != specialization:
            continue
        if available_for_emergency is not None and cp.get('available_for_emergency') != available_for_emergency:
            continue
            
        base = profile_map.get(cp['id'], {})
        clinician = ClinicianProfile(
            id=cp['id'],
            specialization=cp.get('specialization'),
            qualification=cp.get('qualification'),
            hpcsa_number=cp.get('hpcsa_number'),
            years_experience=cp.get('years_experience'),
            bio=cp.get('bio'),
            consultation_fee=cp.get('consultation_fee'),
            available_for_emergency=cp.get('available_for_emergency', False),
            first_name=base.get('first_name'),
            last_name=base.get('last_name'),
            profile_image_url=base.get('profile_image_url')
        )
        result.append(clinician)
    
    return result


@router.get("/clinicians/{clinician_id}", response_model=ClinicianProfile)
async def get_clinician(
    clinician_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific clinician's profile"""
    clinician_profiles = await supabase.select(
        'clinician_profiles',
        '*',
        filters={'id': clinician_id}
    )
    
    if not clinician_profiles:
        raise HTTPException(status_code=404, detail="Clinician not found")
    
    cp = clinician_profiles[0]
    
    # Get base profile
    profiles = await supabase.select('profiles', '*', {'id': clinician_id})
    base = profiles[0] if profiles else {}
    
    return ClinicianProfile(
        id=cp['id'],
        specialization=cp.get('specialization'),
        qualification=cp.get('qualification'),
        hpcsa_number=cp.get('hpcsa_number'),
        years_experience=cp.get('years_experience'),
        bio=cp.get('bio'),
        consultation_fee=cp.get('consultation_fee'),
        available_for_emergency=cp.get('available_for_emergency', False),
        first_name=base.get('first_name'),
        last_name=base.get('last_name'),
        profile_image_url=base.get('profile_image_url')
    )


# ============ Clinician Availability Routes ============

@router.get("/clinicians/{clinician_id}/availability", response_model=List[ClinicianAvailability])
async def get_clinician_availability(
    clinician_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a clinician's weekly availability"""
    availability = await supabase.select(
        'clinician_availability',
        '*',
        filters={'clinician_id': clinician_id},
        order='day_of_week.asc,start_time.asc'
    )
    
    return [ClinicianAvailability(**a) for a in availability]


@router.post("/me/availability", response_model=ClinicianAvailability)
async def set_availability(
    data: ClinicianAvailabilityCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Set availability slot (clinician only)"""
    if user.role not in ['nurse', 'doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Only clinicians can set availability")
    
    # Check if slot exists for this day
    existing = await supabase.select(
        'clinician_availability',
        '*',
        filters={'clinician_id': user.id, 'day_of_week': data.day_of_week}
    )
    
    if existing:
        # Update existing
        result = await supabase.update(
            'clinician_availability',
            {
                'start_time': data.start_time,
                'end_time': data.end_time,
                'is_available': data.is_available
            },
            {'id': existing[0]['id']}
        )
    else:
        # Create new
        result = await supabase.insert(
            'clinician_availability',
            {
                'id': str(uuid.uuid4()),
                'clinician_id': user.id,
                'day_of_week': data.day_of_week,
                'start_time': data.start_time,
                'end_time': data.end_time,
                'is_available': data.is_available
            }
        )
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to set availability")
    
    return ClinicianAvailability(**result)


@router.delete("/me/availability/{slot_id}")
async def delete_availability_slot(
    slot_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete an availability slot"""
    if user.role not in ['nurse', 'doctor', 'admin']:
        raise HTTPException(status_code=403, detail="Only clinicians can manage availability")
    
    # Verify ownership
    slots = await supabase.select('clinician_availability', '*', {'id': slot_id})
    if not slots:
        raise HTTPException(status_code=404, detail="Slot not found")
    
    if slots[0]['clinician_id'] != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    await supabase.delete('clinician_availability', {'id': slot_id})
    
    return APIResponse(success=True, message="Availability slot deleted")
