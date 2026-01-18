from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from auth import get_current_user, require_clinician, AuthenticatedUser
from supabase_client import supabase
from schemas import (
    ClinicalNote, ClinicalNoteCreate, ClinicalNoteUpdate,
    ClinicalNoteStatus, APIResponse
)
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/clinical-notes", tags=["Clinical Notes"])


@router.get("")
async def list_clinical_notes(
    appointment_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    status: Optional[ClinicalNoteStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """List clinical notes"""
    filters = {}
    
    # Filter by user role
    if user.role == 'patient':
        filters['patient_id'] = user.id
    elif user.role in ['nurse', 'doctor']:
        filters['clinician_id'] = user.id
        if patient_id:
            filters['patient_id'] = patient_id
    elif user.role == 'admin' and patient_id:
        filters['patient_id'] = patient_id
    
    if appointment_id:
        filters['appointment_id'] = appointment_id
    if status:
        filters['status'] = status.value
    
    notes = await supabase.select(
        'clinical_notes',
        '*',
        filters=filters,
        order='created_at.desc',
        limit=limit
    )
    
    return {'notes': notes, 'total': len(notes)}


@router.get("/{note_id}", response_model=ClinicalNote)
async def get_clinical_note(
    note_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific clinical note"""
    notes = await supabase.select('clinical_notes', '*', {'id': note_id})
    
    if not notes:
        raise HTTPException(status_code=404, detail="Clinical note not found")
    
    note = notes[0]
    
    # Check access
    if user.role == 'patient' and note['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if user.role in ['nurse', 'doctor'] and note['clinician_id'] != user.id:
        # Clinicians can view notes for their patients
        pass
    
    return ClinicalNote(**note)


@router.get("/appointment/{appointment_id}")
async def get_notes_for_appointment(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get clinical notes for a specific appointment"""
    # Verify user has access to this appointment
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    if user.role == 'patient' and apt['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if user.role in ['nurse', 'doctor'] and apt['clinician_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    notes = await supabase.select(
        'clinical_notes',
        '*',
        filters={'appointment_id': appointment_id},
        order='created_at.desc'
    )
    
    return {'notes': notes, 'total': len(notes)}


@router.post("", response_model=ClinicalNote)
async def create_clinical_note(
    data: ClinicalNoteCreate,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Create a new clinical note (clinician only)"""
    # Verify appointment exists and belongs to this clinician
    appointments = await supabase.select('appointments', '*', {'id': data.appointment_id})
    if not appointments:
        raise HTTPException(status_code=400, detail="Invalid appointment ID")
    
    apt = appointments[0]
    if apt['clinician_id'] != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Cannot create notes for another clinician's appointment")
    
    note_data = {
        'id': str(uuid.uuid4()),
        'appointment_id': data.appointment_id,
        'patient_id': data.patient_id,
        'clinician_id': user.id,
        'chief_complaint': data.chief_complaint,
        'history_of_present_illness': data.history_of_present_illness,
        'past_medical_history': data.past_medical_history,
        'current_medications': data.current_medications,
        'allergies': data.allergies,
        'examination_findings': data.examination_findings,
        'vital_signs': data.vital_signs,
        'diagnosis': data.diagnosis,
        'diagnosis_codes': data.diagnosis_codes,
        'treatment_plan': data.treatment_plan,
        'follow_up_instructions': data.follow_up_instructions,
        'follow_up_date': data.follow_up_date,
        'referral_required': data.referral_required,
        'referral_details': data.referral_details,
        'status': data.status.value,
        'created_at': datetime.utcnow().isoformat(),
    }
    
    result = await supabase.insert('clinical_notes', note_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create clinical note")
    
    return ClinicalNote(**result)


@router.patch("/{note_id}", response_model=ClinicalNote)
async def update_clinical_note(
    note_id: str,
    data: ClinicalNoteUpdate,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Update a clinical note"""
    notes = await supabase.select('clinical_notes', '*', {'id': note_id})
    if not notes:
        raise HTTPException(status_code=404, detail="Clinical note not found")
    
    note = notes[0]
    
    # Only the authoring clinician or admin can update
    if user.role != 'admin' and note['clinician_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Can't update finalized notes (except admin)
    if note['status'] == 'final' and user.role != 'admin':
        raise HTTPException(status_code=400, detail="Cannot modify finalized notes")
    
    update_data = {'updated_at': datetime.utcnow().isoformat()}
    
    # Only include provided fields
    for field in ['chief_complaint', 'history_of_present_illness', 'past_medical_history',
                  'current_medications', 'allergies', 'examination_findings', 'vital_signs',
                  'diagnosis', 'diagnosis_codes', 'treatment_plan', 'follow_up_instructions',
                  'follow_up_date', 'referral_required', 'referral_details']:
        value = getattr(data, field, None)
        if value is not None:
            update_data[field] = value
    
    if data.status:
        update_data['status'] = data.status.value
    
    result = await supabase.update('clinical_notes', update_data, {'id': note_id})
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update clinical note")
    
    return ClinicalNote(**result)


@router.post("/{note_id}/finalize")
async def finalize_clinical_note(
    note_id: str,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Finalize a clinical note (makes it read-only)"""
    notes = await supabase.select('clinical_notes', '*', {'id': note_id})
    if not notes:
        raise HTTPException(status_code=404, detail="Clinical note not found")
    
    note = notes[0]
    
    if note['clinician_id'] != user.id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    await supabase.update(
        'clinical_notes',
        {'status': 'final', 'updated_at': datetime.utcnow().isoformat()},
        {'id': note_id}
    )
    
    return APIResponse(success=True, message="Clinical note finalized")
