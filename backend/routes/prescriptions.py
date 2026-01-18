from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from auth import get_current_user, require_clinician, AuthenticatedUser
from supabase_client import supabase
from schemas import (
    Prescription, PrescriptionCreate, PrescriptionUpdate, PrescriptionList,
    PrescriptionStatus, APIResponse
)
from models import PrescriptionPDFRequest, PrescriptionPDFResponse
from pdf_generator import generate_prescription_pdf
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])


@router.get("", response_model=PrescriptionList)
async def list_prescriptions(
    status: Optional[PrescriptionStatus] = None,
    patient_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """List prescriptions for the current user"""
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
    
    if status:
        filters['status'] = status.value
    
    prescriptions = await supabase.select(
        'prescriptions',
        '*',
        filters=filters,
        order='prescribed_at.desc',
        limit=limit
    )
    
    # Enrich with names
    enriched = []
    for rx in prescriptions:
        patient = await supabase.select('profiles', 'first_name,last_name', {'id': rx['patient_id']})
        clinician = await supabase.select('profiles', 'first_name,last_name', {'id': rx['clinician_id']})
        
        rx['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
        rx['clinician_name'] = f"{clinician[0]['first_name']} {clinician[0]['last_name']}" if clinician else 'Unknown'
        enriched.append(Prescription(**rx))
    
    return PrescriptionList(prescriptions=enriched, total=len(enriched))


@router.get("/{prescription_id}", response_model=Prescription)
async def get_prescription(
    prescription_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific prescription"""
    prescriptions = await supabase.select(
        'prescriptions',
        '*',
        filters={'id': prescription_id}
    )
    
    if not prescriptions:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    rx = prescriptions[0]
    
    # Check access
    if user.role == 'patient' and rx['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Enrich with names
    patient = await supabase.select('profiles', 'first_name,last_name', {'id': rx['patient_id']})
    clinician = await supabase.select('profiles', 'first_name,last_name', {'id': rx['clinician_id']})
    
    rx['patient_name'] = f"{patient[0]['first_name']} {patient[0]['last_name']}" if patient else 'Unknown'
    rx['clinician_name'] = f"{clinician[0]['first_name']} {clinician[0]['last_name']}" if clinician else 'Unknown'
    
    return Prescription(**rx)


@router.post("", response_model=Prescription)
async def create_prescription(
    data: PrescriptionCreate,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Create a new prescription (clinician only)"""
    # Calculate expiry date (default 6 months)
    prescribed_at = datetime.utcnow()
    expires_at = prescribed_at + timedelta(days=180)
    
    prescription_data = {
        'id': str(uuid.uuid4()),
        'appointment_id': data.appointment_id,
        'patient_id': data.patient_id,
        'clinician_id': user.id,
        'medication_name': data.medication_name,
        'dosage': data.dosage,
        'frequency': data.frequency,
        'duration': data.duration,
        'quantity': data.quantity,
        'refills': data.refills,
        'instructions': data.instructions,
        'pharmacy_notes': data.pharmacy_notes,
        'status': 'active',
        'prescribed_at': prescribed_at.isoformat(),
        'expires_at': expires_at.isoformat(),
    }
    
    result = await supabase.insert('prescriptions', prescription_data)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create prescription")
    
    return Prescription(**result)


@router.patch("/{prescription_id}", response_model=Prescription)
async def update_prescription(
    prescription_id: str,
    data: PrescriptionUpdate,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Update a prescription (status change, notes)"""
    # Get existing prescription
    prescriptions = await supabase.select('prescriptions', '*', {'id': prescription_id})
    if not prescriptions:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    rx = prescriptions[0]
    
    # Only the prescribing clinician or admin can update
    if user.role != 'admin' and rx['clinician_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {}
    if data.status:
        update_data['status'] = data.status.value
    if data.pharmacy_notes is not None:
        update_data['pharmacy_notes'] = data.pharmacy_notes
    
    result = await supabase.update('prescriptions', update_data, {'id': prescription_id})
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update prescription")
    
    return Prescription(**result)


@router.post("/{prescription_id}/cancel")
async def cancel_prescription(
    prescription_id: str,
    user: AuthenticatedUser = Depends(require_clinician)
):
    """Cancel a prescription"""
    prescriptions = await supabase.select('prescriptions', '*', {'id': prescription_id})
    if not prescriptions:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    rx = prescriptions[0]
    
    if user.role != 'admin' and rx['clinician_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await supabase.update(
        'prescriptions',
        {'status': 'cancelled'},
        {'id': prescription_id}
    )
    
    return APIResponse(success=True, message="Prescription cancelled")


@router.post("/generate-pdf", response_model=PrescriptionPDFResponse)
async def generate_pdf(
    data: PrescriptionPDFRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Generate a PDF for a prescription"""
    try:
        pdf_base64 = generate_prescription_pdf(data)
        return PrescriptionPDFResponse(success=True, pdf_base64=pdf_base64)
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        return PrescriptionPDFResponse(success=False, error=str(e))


@router.get("/{prescription_id}/pdf", response_model=PrescriptionPDFResponse)
async def get_prescription_pdf(
    prescription_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get PDF for a specific prescription"""
    # Get prescription
    prescriptions = await supabase.select('prescriptions', '*', {'id': prescription_id})
    if not prescriptions:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    rx = prescriptions[0]
    
    # Check access
    if user.role == 'patient' and rx['patient_id'] != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get patient info
    patient = await supabase.select('profiles', '*', {'id': rx['patient_id']})
    patient_data = patient[0] if patient else {}
    
    # Get clinician info
    clinician = await supabase.select('profiles', '*', {'id': rx['clinician_id']})
    clinician_data = clinician[0] if clinician else {}
    
    # Get clinician profile for HPCSA number
    clinician_profile = await supabase.select('clinician_profiles', '*', {'id': rx['clinician_id']})
    clinician_ext = clinician_profile[0] if clinician_profile else {}
    
    # Build PDF data
    pdf_data = PrescriptionPDFRequest(
        prescription_id=rx['id'],
        patient_name=f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}",
        patient_dob=patient_data.get('date_of_birth'),
        patient_id_number=patient_data.get('id_number'),
        clinician_name=f"{clinician_data.get('first_name', '')} {clinician_data.get('last_name', '')}",
        clinician_qualification=clinician_ext.get('qualification'),
        clinician_hpcsa=clinician_ext.get('hpcsa_number'),
        medication_name=rx['medication_name'],
        dosage=rx['dosage'],
        frequency=rx['frequency'],
        duration=rx['duration'],
        quantity=rx.get('quantity'),
        refills=rx.get('refills', 0),
        instructions=rx.get('instructions'),
        pharmacy_notes=rx.get('pharmacy_notes'),
        prescribed_at=rx['prescribed_at'],
        expires_at=rx.get('expires_at')
    )
    
    try:
        pdf_base64 = generate_prescription_pdf(pdf_data)
        return PrescriptionPDFResponse(success=True, pdf_base64=pdf_base64)
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        return PrescriptionPDFResponse(success=False, error=str(e))
