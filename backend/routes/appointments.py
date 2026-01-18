"""Appointment Routes - Full Booking Features

Features:
- Standard scheduled appointments
- Walk-in bookings (immediate queue)
- Emergency bookings (priority queue)
- Booking cancellation with reason
- Image/Video uploads for symptoms
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
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
import os
import base64
from pydantic import BaseModel
from enum import Enum

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/appointments", tags=["Appointments"])

# Upload directory for symptom media
UPLOAD_DIR = "/tmp/hcf_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ============ Additional Models ============

class BookingType(str, Enum):
    SCHEDULED = "scheduled"
    WALK_IN = "walk_in"
    EMERGENCY = "emergency"


class CancellationReason(str, Enum):
    PATIENT_REQUEST = "patient_request"
    FEELING_BETTER = "feeling_better"
    SCHEDULING_CONFLICT = "scheduling_conflict"
    FOUND_ALTERNATIVE = "found_alternative"
    FINANCIAL = "financial"
    CLINICIAN_UNAVAILABLE = "clinician_unavailable"
    EMERGENCY = "emergency"
    OTHER = "other"


class WalkInBookingCreate(BaseModel):
    """Walk-in booking - immediate queue placement"""
    clinician_id: Optional[str] = None  # Optional - can be assigned later
    consultation_type: str = "in_person"
    chief_complaint: str
    symptoms: List[str] = []
    severity: str = "moderate"
    notes: Optional[str] = None


class EmergencyBookingCreate(BaseModel):
    """Emergency booking - priority queue placement"""
    chief_complaint: str
    symptoms: List[str] = []
    severity: str = "severe"
    notes: Optional[str] = None
    emergency_contact_notified: bool = False


class CancellationRequest(BaseModel):
    """Appointment cancellation with reason"""
    reason: CancellationReason
    reason_details: Optional[str] = None
    notify_clinician: bool = True


class MediaUpload(BaseModel):
    """Symptom media upload response"""
    id: str
    filename: str
    content_type: str
    size_bytes: int
    upload_url: str
    created_at: str


# ============ Standard Appointment Routes ============

@router.get("", response_model=AppointmentList)
async def list_appointments(
    status: Optional[AppointmentStatus] = None,
    booking_type: Optional[BookingType] = None,
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
    
    # Filter by booking_type if specified (in-memory since it may not be in DB yet)
    if booking_type and appointments:
        appointments = [a for a in appointments if a.get('booking_type') == booking_type.value]
    
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


@router.get("/queue/walk-ins")
async def get_walkin_queue(
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Get today's walk-in queue for clinicians"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    appointments = await supabase.select(
        'appointments',
        '*',
        filters={'status': 'pending'},
        order='created_at.asc'
    )
    
    # Filter walk-ins created today
    walk_ins = []
    for apt in appointments or []:
        if apt.get('booking_type') == 'walk_in':
            created = apt.get('created_at', '')
            if created.startswith(today):
                patient = await supabase.select('profiles', 'first_name,last_name', {'id': apt['patient_id']})
                apt['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
                walk_ins.append(apt)
    
    return {"queue": walk_ins, "total": len(walk_ins)}


@router.get("/queue/emergency")
async def get_emergency_queue(
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Get emergency queue - highest priority"""
    appointments = await supabase.select(
        'appointments',
        '*',
        filters={'status': 'pending'},
        order='created_at.asc'
    )
    
    # Filter emergencies
    emergencies = []
    for apt in appointments or []:
        if apt.get('booking_type') == 'emergency' or apt.get('priority') == 'emergency':
            patient = await supabase.select('profiles', 'first_name,last_name', {'id': apt['patient_id']})
            apt['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
            emergencies.append(apt)
    
    return {"queue": emergencies, "total": len(emergencies), "priority": "EMERGENCY"}


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
    if user.role in ['nurse', 'doctor'] and apt['clinician_id'] != user.id and user.role != 'admin':
        # Clinicians can view appointments in their queue
        pass
    
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
    """Create a new scheduled appointment (patient booking)"""
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
        'booking_type': 'scheduled',
        'notes': data.notes,
        'symptom_assessment_id': data.symptom_assessment_id,
        'created_at': datetime.utcnow().isoformat(),
    }
    
    result = await supabase.insert('appointments', appointment_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create appointment")
    
    logger.info(f"Scheduled appointment created: {result['id']} for patient {user.id}")
    return Appointment(**result)


# ============ Walk-In Booking ============

@router.post("/walk-in", response_model=Appointment)
async def create_walkin_booking(
    data: WalkInBookingCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Create a walk-in booking - patient arrives without appointment.
    
    Walk-ins are added to the queue immediately and seen in order of arrival.
    No specific time slot is assigned.
    """
    if user.role not in ['patient', 'admin', 'nurse']:
        raise HTTPException(status_code=403, detail="Invalid role for walk-in booking")
    
    patient_id = user.id if user.role == 'patient' else None
    
    # For nurses creating walk-ins, patient_id should be provided
    # For now, assume patient is creating their own walk-in
    
    appointment_data = {
        'id': str(uuid.uuid4()),
        'patient_id': patient_id or user.id,
        'clinician_id': data.clinician_id,  # Can be None - assigned later
        'scheduled_at': datetime.utcnow().isoformat(),  # Now
        'consultation_type': data.consultation_type,
        'duration_minutes': 30,  # Default
        'status': 'pending',
        'booking_type': 'walk_in',
        'priority': 'normal',
        'chief_complaint': data.chief_complaint,
        'symptoms': data.symptoms,
        'severity': data.severity,
        'notes': data.notes,
        'created_at': datetime.utcnow().isoformat(),
        'queue_position': await _get_next_queue_position('walk_in'),
    }
    
    result = await supabase.insert('appointments', appointment_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create walk-in booking")
    
    logger.info(f"Walk-in booking created: {result['id']} - Queue position: {appointment_data['queue_position']}")
    
    return Appointment(**result)


# ============ Emergency Booking ============

@router.post("/emergency", response_model=Appointment)
async def create_emergency_booking(
    data: EmergencyBookingCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Create an emergency booking - highest priority.
    
    Emergency bookings jump to the front of the queue and alert all available clinicians.
    Use for: chest pain, difficulty breathing, severe bleeding, etc.
    """
    if user.role not in ['patient', 'admin', 'nurse', 'doctor']:
        raise HTTPException(status_code=403, detail="Invalid role for emergency booking")
    
    appointment_data = {
        'id': str(uuid.uuid4()),
        'patient_id': user.id if user.role == 'patient' else user.id,
        'clinician_id': None,  # First available
        'scheduled_at': datetime.utcnow().isoformat(),  # Now
        'consultation_type': 'video',  # Emergency telehealth
        'duration_minutes': 30,
        'status': 'pending',
        'booking_type': 'emergency',
        'priority': 'emergency',
        'chief_complaint': data.chief_complaint,
        'symptoms': data.symptoms,
        'severity': 'severe',
        'notes': data.notes,
        'emergency_contact_notified': data.emergency_contact_notified,
        'created_at': datetime.utcnow().isoformat(),
        'queue_position': 0,  # Front of queue
    }
    
    result = await supabase.insert('appointments', appointment_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create emergency booking")
    
    logger.warning(f"🚨 EMERGENCY BOOKING CREATED: {result['id']} - {data.chief_complaint}")
    
    # TODO: Send alerts to all available clinicians
    # TODO: Send SMS/push notification
    
    return Appointment(**result)


# ============ Booking Cancellation ============

@router.post("/{appointment_id}/cancel")
async def cancel_appointment_with_reason(
    appointment_id: str,
    cancellation: CancellationRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Cancel an appointment with a reason.
    
    Patients can cancel their own appointments.
    Clinicians can cancel appointments assigned to them.
    Admins can cancel any appointment.
    """
    # Get existing appointment
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    
    # Check if already cancelled or completed
    if apt['status'] in ['cancelled', 'completed']:
        raise HTTPException(status_code=400, detail=f"Appointment already {apt['status']}")
    
    # Check permission
    can_cancel = (
        user.role == 'admin' or
        apt['patient_id'] == user.id or
        apt['clinician_id'] == user.id
    )
    if not can_cancel:
        raise HTTPException(status_code=403, detail="You don't have permission to cancel this appointment")
    
    # Calculate if within cancellation window (e.g., 2 hours before)
    scheduled_time = datetime.fromisoformat(apt['scheduled_at'].replace('Z', '+00:00'))
    now = datetime.now(scheduled_time.tzinfo) if scheduled_time.tzinfo else datetime.now()
    time_until = (scheduled_time - now).total_seconds() / 3600  # hours
    
    late_cancellation = time_until < 2  # Less than 2 hours notice
    
    # Update appointment
    update_data = {
        'status': 'cancelled',
        'cancelled_at': datetime.utcnow().isoformat(),
        'cancelled_by': user.id,
        'cancellation_reason': cancellation.reason.value,
        'cancellation_details': cancellation.reason_details,
        'late_cancellation': late_cancellation,
        'updated_at': datetime.utcnow().isoformat()
    }
    
    result = await supabase.update('appointments', update_data, {'id': appointment_id})
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to cancel appointment")
    
    logger.info(f"Appointment {appointment_id} cancelled by {user.id}. Reason: {cancellation.reason.value}")
    
    # TODO: Send notification to clinician if requested
    if cancellation.notify_clinician and apt['clinician_id']:
        logger.info(f"TODO: Notify clinician {apt['clinician_id']} of cancellation")
    
    return {
        "success": True,
        "message": "Appointment cancelled successfully",
        "appointment_id": appointment_id,
        "reason": cancellation.reason.value,
        "late_cancellation": late_cancellation,
        "late_cancellation_notice": "Less than 2 hours notice - may affect future bookings" if late_cancellation else None
    }


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
async def delete_appointment(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete/cancel an appointment (legacy - use /cancel for better tracking)"""
    # Get existing appointment
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    
    # Only allow soft delete (status change)
    can_delete = (
        user.role == 'admin' or
        apt['patient_id'] == user.id
    )
    if not can_delete:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Soft delete - change status to cancelled
    result = await supabase.update(
        'appointments',
        {'status': 'cancelled', 'updated_at': datetime.utcnow().isoformat()},
        {'id': appointment_id}
    )
    
    return APIResponse(success=True, message="Appointment cancelled")


# ============ Image/Video Upload for Symptoms ============

@router.post("/{appointment_id}/media")
async def upload_symptom_media(
    appointment_id: str,
    file: UploadFile = File(...),
    description: str = Form(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Upload an image or video related to symptoms.
    
    Useful for: rashes, wounds, swelling, etc.
    Supported formats: JPEG, PNG, MP4, MOV
    Max size: 10MB
    """
    # Verify appointment exists and belongs to user
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    if user.role == 'patient' and apt['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file.content_type} not allowed. Use JPEG, PNG, WebP, MP4, or MOV"
        )
    
    # Read and validate file size (10MB max)
    content = await file.read()
    max_size = 10 * 1024 * 1024  # 10MB
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    media_id = str(uuid.uuid4())
    filename = f"{appointment_id}_{media_id}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, 'wb') as f:
        f.write(content)
    
    # Store metadata in database (or return directly)
    media_record = {
        'id': media_id,
        'appointment_id': appointment_id,
        'filename': filename,
        'original_filename': file.filename,
        'content_type': file.content_type,
        'size_bytes': len(content),
        'description': description,
        'uploaded_by': user.id,
        'created_at': datetime.utcnow().isoformat()
    }
    
    # TODO: Store in database table 'appointment_media'
    # For now, update appointment notes
    existing_media = apt.get('media_attachments', []) or []
    existing_media.append(media_record)
    
    await supabase.update(
        'appointments',
        {'media_attachments': existing_media, 'updated_at': datetime.utcnow().isoformat()},
        {'id': appointment_id}
    )
    
    logger.info(f"Media uploaded for appointment {appointment_id}: {filename}")
    
    return {
        "success": True,
        "media": MediaUpload(
            id=media_id,
            filename=filename,
            content_type=file.content_type,
            size_bytes=len(content),
            upload_url=f"/api/appointments/{appointment_id}/media/{media_id}",
            created_at=media_record['created_at']
        )
    }


@router.get("/{appointment_id}/media/{media_id}")
async def get_symptom_media(
    appointment_id: str,
    media_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get uploaded media file"""
    from fastapi.responses import FileResponse
    
    # Verify access
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    can_view = (
        user.role == 'admin' or
        apt['patient_id'] == user.id or
        apt['clinician_id'] == user.id
    )
    if not can_view:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Find media file
    media_list = apt.get('media_attachments', []) or []
    media = next((m for m in media_list if m['id'] == media_id), None)
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    filepath = os.path.join(UPLOAD_DIR, media['filename'])
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Media file not found")
    
    return FileResponse(filepath, media_type=media['content_type'])


@router.delete("/{appointment_id}/media/{media_id}")
async def delete_symptom_media(
    appointment_id: str,
    media_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete uploaded media"""
    # Verify ownership
    appointments = await supabase.select('appointments', '*', {'id': appointment_id})
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    apt = appointments[0]
    if user.role == 'patient' and apt['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Remove from list
    media_list = apt.get('media_attachments', []) or []
    media = next((m for m in media_list if m['id'] == media_id), None)
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Delete file
    filepath = os.path.join(UPLOAD_DIR, media['filename'])
    if os.path.exists(filepath):
        os.remove(filepath)
    
    # Update appointment
    new_media_list = [m for m in media_list if m['id'] != media_id]
    await supabase.update(
        'appointments',
        {'media_attachments': new_media_list, 'updated_at': datetime.utcnow().isoformat()},
        {'id': appointment_id}
    )
    
    return {"success": True, "message": "Media deleted"}


# ============ Queue Management ============

@router.get("/queue/today")
async def get_today_queue(
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Get today's appointment queue for clinicians"""
    today = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    appointments = await supabase.select(
        'appointments',
        '*',
        filters={'clinician_id': user.id, 'status': 'pending'}
    )
    
    # Filter today's appointments and sort by priority
    today_queue = []
    for apt in appointments or []:
        scheduled = apt.get('scheduled_at', '')
        if scheduled.startswith(today) or apt.get('booking_type') in ['walk_in', 'emergency']:
            patient = await supabase.select('profiles', 'first_name,last_name', {'id': apt['patient_id']})
            apt['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
            today_queue.append(apt)
    
    # Sort: emergencies first, then by scheduled time
    today_queue.sort(key=lambda x: (
        0 if x.get('booking_type') == 'emergency' else 1,
        x.get('scheduled_at', '')
    ))
    
    return {
        "queue": today_queue,
        "total": len(today_queue),
        "emergencies": len([a for a in today_queue if a.get('booking_type') == 'emergency']),
        "walk_ins": len([a for a in today_queue if a.get('booking_type') == 'walk_in']),
        "scheduled": len([a for a in today_queue if a.get('booking_type') == 'scheduled'])
    }


# ============ Helper Functions ============

async def _get_next_queue_position(booking_type: str) -> int:
    """Get the next queue position for walk-ins/emergencies"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Count today's bookings of the same type
    appointments = await supabase.select('appointments', 'id', filters={'booking_type': booking_type})
    
    today_count = 0
    for apt in appointments or []:
        # This is a simplification - in production, filter by date in query
        today_count += 1
    
    return today_count + 1
