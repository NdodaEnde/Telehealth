from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from auth import get_current_user, require_clinician, require_admin, AuthenticatedUser
from supabase_client import supabase
from schemas import (
    Appointment, AppointmentCreate, AppointmentUpdate, AppointmentList,
    AppointmentStatus, SymptomAssessment, SymptomAssessmentCreate,
    APIResponse
)
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("", response_model=AppointmentList)
async def list_appointments(
    status: Optional[AppointmentStatus] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """List appointments for the current user"""
    filters = {}
    
    # Filter by user role
    if user.role == 'patient':
        filters['patient_id'] = user.id
    elif user.role in ['nurse', 'doctor']:
        filters['clinician_id'] = user.id
    # Admin sees all
    
    if status:
        filters['status'] = status.value
    
    appointments = await supabase.select(
        'appointments',
        '*',
        filters=filters,
        order='scheduled_at.desc',
        limit=limit
    )
    
    # Get related data
    enriched = []
    for apt in appointments:
        # Get patient name
        patient = await supabase.select('profiles', 'first_name,last_name', {'id': apt['patient_id']})
        # Get clinician name
        clinician = await supabase.select('profiles', 'first_name,last_name', {'id': apt['clinician_id']})
        
        apt['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
        apt['clinician_name'] = f"Dr. {clinician[0]['first_name']} {clinician[0]['last_name']}" if clinician else 'Unknown'
        enriched.append(Appointment(**apt))
    
    return AppointmentList(appointments=enriched, total=len(enriched))


@router.get("/{appointment_id}", response_model=Appointment)
async def get_appointment(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific appointment"""
    appointments = await supabase.select(
        'appointments',
        '*',
        filters={'id': appointment_id}
    )
    
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    
    # Check access
    if user.role == 'patient' and apt['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if user.role in ['nurse', 'doctor'] and apt['clinician_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich with names
    patient = await supabase.select('profiles', 'first_name,last_name', {'id': apt['patient_id']})
    clinician = await supabase.select('profiles', 'first_name,last_name', {'id': apt['clinician_id']})
    
    apt['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
    apt['clinician_name'] = f"Dr. {clinician[0]['first_name']} {clinician[0]['last_name']}" if clinician else 'Unknown'
    
    return Appointment(**apt)


@router.post("", response_model=Appointment)
async def create_appointment(
    data: AppointmentCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new appointment (patient booking)"""
    if user.role not in ['patient', 'admin']:
        raise HTTPException(status_code=403, detail="Only patients can book appointments")
    
    # Verify clinician exists
    clinicians = await supabase.select('profiles', 'id', {'id': data.clinician_id})
    if not clinicians:
        raise HTTPException(status_code=400, detail="Invalid clinician ID")
    
    # Create appointment
    appointment_data = {
        'id': str(uuid.uuid4()),
        'patient_id': user.id,
        'clinician_id': data.clinician_id,
        'scheduled_at': data.scheduled_at,
        'consultation_type': data.consultation_type.value,
        'duration_minutes': data.duration_minutes,
        'status': 'pending',
        'notes': data.notes,
        'symptom_assessment_id': data.symptom_assessment_id,
        'created_at': datetime.utcnow().isoformat(),
    }
    
    result = await supabase.insert('appointments', appointment_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create appointment")
    
    return Appointment(**result)


@router.patch("/{appointment_id}", response_model=Appointment)
async def update_appointment(
    appointment_id: str,
    data: AppointmentUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update an appointment (status change, reschedule)"""
    # Get existing appointment
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    
    # Check access
    can_update = (
        user.role == 'admin' or
        apt['patient_id'] == user.id or
        apt['clinician_id'] == user.id
    )
    if not can_update:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build update data
    update_data = {'updated_at': datetime.utcnow().isoformat()}
    if data.status:
        update_data['status'] = data.status.value
    if data.scheduled_at:
        update_data['scheduled_at'] = data.scheduled_at
    if data.notes is not None:
        update_data['notes'] = data.notes
    
    result = await supabase.update('appointments', update_data, {'id': appointment_id})
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update appointment")
    
    return Appointment(**result)


@router.delete("/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Cancel an appointment"""
    # Get existing appointment
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    
    # Check access
    can_cancel = (
        user.role == 'admin' or
        apt['patient_id'] == user.id or
        apt['clinician_id'] == user.id
    )
    if not can_cancel:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update status to cancelled
    await supabase.update(
        'appointments',
        {'status': 'cancelled', 'updated_at': datetime.utcnow().isoformat()},
        {'id': appointment_id}
    )
    
    return APIResponse(success=True, message="Appointment cancelled")


# ============ Symptom Assessment ============

@router.post("/symptom-assessment", response_model=SymptomAssessment)
async def create_symptom_assessment(
    data: SymptomAssessmentCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a symptom assessment before booking"""
    assessment_data = {
        'id': str(uuid.uuid4()),
        'patient_id': user.id,
        'symptoms': data.symptoms,
        'severity': data.severity.value,
        'description': data.description,
        'recommended_specialization': data.recommended_specialization,
        'created_at': datetime.utcnow().isoformat(),
    }
    
    result = await supabase.insert('symptom_assessments', assessment_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create assessment")
    
    return SymptomAssessment(**result)


@router.get("/queue/today")
async def get_today_queue(
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Get today's patient queue for clinician"""
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    
    appointments = await supabase.select(
        'appointments',
        '*',
        filters={
            'clinician_id': user.id,
            'scheduled_at': {'gte': today.isoformat(), 'lt': tomorrow.isoformat()},
            'status': {'in': ['pending', 'confirmed', 'in_progress']}
        },
        order='scheduled_at.asc'
    )
    
    # Enrich with patient names
    enriched = []
    for apt in appointments:
        patient = await supabase.select('profiles', 'first_name,last_name', {'id': apt['patient_id']})
        apt['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
        enriched.append(apt)
    
    return {'queue': enriched, 'total': len(enriched)}
