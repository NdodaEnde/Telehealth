"""
Booking Routes for Receptionist-Created Bookings (Supabase Version)
Handles booking creation, management, and invoicing
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
from pdf_generator import generate_invoice_pdf
import uuid
import logging
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["Bookings"])

# ============ Enums ============

class ServiceType(str, Enum):
    TELECONSULTATION = "teleconsultation"
    FOLLOW_UP_0_3 = "follow_up_0_3"
    FOLLOW_UP_4_7 = "follow_up_4_7"
    SCRIPT_1_MONTH = "script_1_month"
    SCRIPT_3_MONTHS = "script_3_months"
    SCRIPT_6_MONTHS = "script_6_months"
    MEDICAL_FORMS = "medical_forms"

class PatientBillingType(str, Enum):
    MEDICAL_AID = "medical_aid"
    CAMPUS_AFRICA = "campus_africa"
    UNIVERSITY_STUDENT = "university_student"
    CASH = "cash"

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class InvoiceStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"

# ============ Fee Schedule ============

FEE_SCHEDULE = {
    ServiceType.TELECONSULTATION: {
        "name": "Tele-consultation (excl. medication)",
        "price": 260.00,
        "description": "Video consultation with Clinical Associate"
    },
    ServiceType.FOLLOW_UP_0_3: {
        "name": "Follow-up consultation (day 0 to 3)",
        "price": 0.00,
        "description": "Free follow-up within 3 days of initial consultation"
    },
    ServiceType.FOLLOW_UP_4_7: {
        "name": "Follow-up consultation (day 4 to 7)",
        "price": 300.00,
        "description": "Follow-up consultation 4-7 days after initial consultation"
    },
    ServiceType.SCRIPT_1_MONTH: {
        "name": "Script (excl. tele-consultation) - 1 month",
        "price": 160.00,
        "description": "Prescription only - 1 month supply"
    },
    ServiceType.SCRIPT_3_MONTHS: {
        "name": "Script (excl. tele-consultation) - 3 months",
        "price": 300.00,
        "description": "Prescription only - 3 month supply"
    },
    ServiceType.SCRIPT_6_MONTHS: {
        "name": "Script (excl. tele-consultation) - 6 months",
        "price": 400.00,
        "description": "Prescription only - 6 month supply"
    },
    ServiceType.MEDICAL_FORMS: {
        "name": "Standard Medical Forms",
        "price": 400.00,
        "description": "Medical certificates, forms, and documentation"
    }
}

# ============ Models ============

class BookingCreate(BaseModel):
    patient_id: str
    clinician_id: str  # Foreign key to user with nurse/doctor role
    conversation_id: Optional[str] = None
    scheduled_at: datetime
    service_type: ServiceType
    billing_type: PatientBillingType
    notes: Optional[str] = None
    duration_minutes: int = 30

class BookingResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    clinician_id: str
    clinician_name: Optional[str] = None
    conversation_id: Optional[str] = None
    appointment_id: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int
    service_type: str
    service_name: str
    service_price: float
    billing_type: str
    status: str
    notes: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    invoice_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class BookingUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    status: Optional[BookingStatus] = None
    clinician_id: Optional[str] = None
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: str
    booking_id: str
    patient_id: str
    patient_name: Optional[str] = None
    service_type: str
    service_name: str
    service_description: Optional[str] = None
    amount: float
    consultation_date: datetime
    clinician_id: str
    clinician_name: Optional[str] = None
    status: str
    payment_reference: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class FeeScheduleItem(BaseModel):
    service_type: ServiceType
    name: str
    price: float
    description: str

# ============ Helper Functions ============

async def get_user_profile(user_id: str, access_token: str = None):
    """Get user profile from Supabase"""
    profiles = await supabase.select(
        "profiles",
        columns="id, first_name, last_name, phone",
        filters={"id": user_id},
        access_token=access_token
    )
    if profiles:
        return profiles[0]
    return None

async def get_user_role(user_id: str, access_token: str = None) -> str:
    """Get user role from Supabase"""
    roles = await supabase.select(
        "user_roles",
        columns="role",
        filters={"user_id": user_id},
        access_token=access_token
    )
    if roles:
        return roles[0].get("role", "patient")
    return "patient"

def format_name(profile: dict) -> str:
    """Format user's full name"""
    if not profile:
        return "Unknown"
    return f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip() or "Unknown"

# ============ Routes ============

@router.get("/fee-schedule", response_model=List[FeeScheduleItem])
async def get_fee_schedule():
    """Get the fee schedule for telehealth services"""
    return [
        FeeScheduleItem(
            service_type=service_type,
            name=details["name"],
            price=details["price"],
            description=details["description"]
        )
        for service_type, details in FEE_SCHEDULE.items()
    ]

# ============ Clinician List for Booking ============

@router.get("/clinicians/available")
async def get_available_clinicians(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Get list of available clinicians (nurses/doctors) for booking.
    This queries users with nurse/doctor roles from user_roles table.
    """
    try:
        # Get all users with nurse or doctor roles
        # Using raw query approach since we need to join tables
        nurse_roles = await supabase.select(
            "user_roles",
            columns="user_id, role",
            access_token=user.access_token
        )
        
        if not nurse_roles:
            logger.info("No user_roles found")
            return []
        
        # Filter for nurses and doctors
        clinician_user_ids = [
            r["user_id"] for r in nurse_roles 
            if r.get("role") in ["nurse", "doctor"]
        ]
        
        if not clinician_user_ids:
            logger.info("No clinicians found in user_roles")
            return []
        
        logger.info(f"Found {len(clinician_user_ids)} clinician user IDs: {clinician_user_ids}")
        
        # Get profiles for these users
        result = []
        for user_id in clinician_user_ids:
            profile = await get_user_profile(user_id, user.access_token)
            if profile:
                # Get the role for this user
                role = next((r["role"] for r in nurse_roles if r["user_id"] == user_id), "nurse")
                result.append({
                    "id": user_id,
                    "name": format_name(profile),
                    "role": role,
                    "specialization": "Clinical Associate" if role == "nurse" else "Doctor",
                    "is_available": True
                })
            else:
                logger.warning(f"No profile found for clinician user_id: {user_id}")
        
        logger.info(f"Returning {len(result)} available clinicians")
        return result
        
    except Exception as e:
        logger.error(f"Error fetching clinicians: {e}")
        return []

@router.post("/", response_model=BookingResponse)
@router.post("", response_model=BookingResponse, include_in_schema=False)
async def create_booking(
    data: BookingCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new booking (receptionist action)"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized to create bookings")
    
    # Get patient info
    patient_profile = await get_user_profile(data.patient_id, user.access_token)
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient_name = format_name(patient_profile)
    
    # Get clinician info
    clinician_profile = await get_user_profile(data.clinician_id, user.access_token)
    if not clinician_profile:
        raise HTTPException(status_code=404, detail="Clinician not found")
    clinician_name = format_name(clinician_profile)
    
    # Verify clinician has appropriate role
    clinician_role = await get_user_role(data.clinician_id, user.access_token)
    if clinician_role not in ["nurse", "doctor"]:
        raise HTTPException(status_code=400, detail="Selected user is not a clinician")
    
    # Get creator info
    creator_profile = await get_user_profile(user.id, user.access_token)
    creator_name = format_name(creator_profile)
    
    # Get service details
    service_details = FEE_SCHEDULE.get(data.service_type, {})
    
    booking_id = str(uuid.uuid4())
    
    # Create appointment in Supabase first (for video consultation flow)
    appointment_data = {
        "patient_id": data.patient_id,
        "clinician_id": data.clinician_id,
        "scheduled_at": data.scheduled_at.isoformat(),
        "duration_minutes": data.duration_minutes,
        "consultation_type": "video",
        "status": "confirmed",
        "notes": data.notes,
        "clinic_id": "00000000-0000-0000-0000-000000000001"  # Default clinic
    }
    
    appointment_result = await supabase.insert("appointments", appointment_data, user.access_token)
    appointment_id = appointment_result.get("id") if appointment_result else None
    logger.info(f"Created appointment: {appointment_id} for booking")
    
    # Create booking
    booking_data = {
        "id": booking_id,
        "patient_id": data.patient_id,
        "clinician_id": data.clinician_id,
        "conversation_id": data.conversation_id,
        "appointment_id": appointment_id,
        "scheduled_at": data.scheduled_at.isoformat(),
        "duration_minutes": data.duration_minutes,
        "service_type": data.service_type.value,
        "billing_type": data.billing_type.value,
        "status": BookingStatus.CONFIRMED.value,
        "notes": data.notes,
        "created_by": user.id,
        "clinic_id": "00000000-0000-0000-0000-000000000001"  # Default clinic
    }
    
    result = await supabase.insert("bookings", booking_data, user.access_token)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create booking")
    
    # Update conversation status if linked
    if data.conversation_id:
        await supabase.update(
            "chat_conversations",
            {
                "status": "booked",
                "booking_id": booking_id
            },
            {"id": data.conversation_id},
            user.access_token
        )
        
        # Add system message to conversation
        system_message = {
            "id": str(uuid.uuid4()),
            "conversation_id": data.conversation_id,
            "sender_id": user.id,
            "sender_role": "system",
            "sender_name": "System",
            "content": f"✅ Booking confirmed with {clinician_name} on {data.scheduled_at.strftime('%B %d, %Y at %H:%M')}",
            "message_type": "system"
        }
        await supabase.insert("chat_messages", system_message, user.access_token)
    
    # Generate invoice for cash patients
    invoice_id = None
    if data.billing_type == PatientBillingType.CASH and service_details.get("price", 0) > 0:
        invoice_id = await create_invoice(
            booking_id=booking_id,
            patient_id=data.patient_id,
            clinician_id=data.clinician_id,
            service_type=data.service_type,
            service_details=service_details,
            consultation_date=data.scheduled_at,
            access_token=user.access_token
        )
        
        # Update booking with invoice_id
        await supabase.update(
            "bookings",
            {"invoice_id": invoice_id},
            {"id": booking_id},
            user.access_token
        )
    
    logger.info(f"Booking created: {booking_id} for patient {data.patient_id} with clinician {data.clinician_id}")
    
    return BookingResponse(
        id=booking_id,
        patient_id=data.patient_id,
        patient_name=patient_name,
        clinician_id=data.clinician_id,
        clinician_name=clinician_name,
        conversation_id=data.conversation_id,
        appointment_id=appointment_id,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        service_type=data.service_type.value,
        service_name=service_details.get("name", ""),
        service_price=service_details.get("price", 0),
        billing_type=data.billing_type.value,
        status=BookingStatus.CONFIRMED.value,
        notes=data.notes,
        created_by=user.id,
        created_by_name=creator_name,
        invoice_id=invoice_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

async def create_invoice(
    booking_id: str,
    patient_id: str,
    clinician_id: str,
    service_type: ServiceType,
    service_details: dict,
    consultation_date: datetime,
    access_token: str
) -> str:
    """Create an invoice for a cash patient"""
    invoice_id = str(uuid.uuid4())
    
    invoice_data = {
        "id": invoice_id,
        "booking_id": booking_id,
        "patient_id": patient_id,
        "service_type": service_type.value,
        "service_name": service_details.get("name", ""),
        "service_description": service_details.get("description", ""),
        "amount": service_details.get("price", 0),
        "consultation_date": consultation_date.isoformat(),
        "clinician_id": clinician_id,
        "status": InvoiceStatus.PENDING.value,
        "clinic_id": "00000000-0000-0000-0000-000000000001"  # Default clinic
    }
    
    await supabase.insert("invoices", invoice_data, access_token)
    logger.info(f"Invoice created: {invoice_id} for booking {booking_id}")
    
    return invoice_id

@router.get("/", response_model=List[BookingResponse])
async def get_bookings(
    patient_id: Optional[str] = None,
    clinician_id: Optional[str] = None,
    status: Optional[BookingStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get bookings with optional filters"""
    role = await get_user_role(user.id, user.access_token)
    
    filters = {}
    
    if role == "patient":
        filters["patient_id"] = user.id
    else:
        if patient_id:
            filters["patient_id"] = patient_id
        if clinician_id:
            filters["clinician_id"] = clinician_id
    
    if status:
        filters["status"] = status.value
    
    bookings = await supabase.select(
        "bookings",
        columns="*",
        filters=filters,
        order="scheduled_at.desc",
        limit=limit,
        access_token=user.access_token
    )
    
    result = []
    for booking in bookings:
        patient_profile = await get_user_profile(booking["patient_id"], user.access_token)
        clinician_profile = await get_user_profile(booking.get("clinician_id"), user.access_token) if booking.get("clinician_id") else None
        creator_profile = await get_user_profile(booking["created_by"], user.access_token)
        
        service_details = FEE_SCHEDULE.get(ServiceType(booking["service_type"]), {})
        
        result.append(BookingResponse(
            id=booking["id"],
            patient_id=booking["patient_id"],
            patient_name=format_name(patient_profile),
            clinician_id=booking.get("clinician_id", ""),
            clinician_name=format_name(clinician_profile) if clinician_profile else "Unknown",
            conversation_id=booking.get("conversation_id"),
            appointment_id=booking.get("appointment_id"),
            scheduled_at=booking["scheduled_at"],
            duration_minutes=booking["duration_minutes"],
            service_type=booking["service_type"],
            service_name=service_details.get("name", ""),
            service_price=service_details.get("price", 0),
            billing_type=booking["billing_type"],
            status=booking["status"],
            notes=booking.get("notes"),
            created_by=booking["created_by"],
            created_by_name=format_name(creator_profile),
            invoice_id=booking.get("invoice_id"),
            created_at=booking["created_at"],
            updated_at=booking["updated_at"]
        ))
    
    return result

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific booking"""
    bookings = await supabase.select(
        "bookings",
        columns="*",
        filters={"id": booking_id},
        access_token=user.access_token
    )
    
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = bookings[0]
    role = await get_user_role(user.id, user.access_token)
    
    if role == "patient" and booking["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    patient_profile = await get_user_profile(booking["patient_id"], user.access_token)
    clinician_profile = await get_user_profile(booking.get("clinician_id"), user.access_token) if booking.get("clinician_id") else None
    creator_profile = await get_user_profile(booking["created_by"], user.access_token)
    service_details = FEE_SCHEDULE.get(ServiceType(booking["service_type"]), {})
    
    return BookingResponse(
        id=booking["id"],
        patient_id=booking["patient_id"],
        patient_name=format_name(patient_profile),
        clinician_id=booking.get("clinician_id", ""),
        clinician_name=format_name(clinician_profile) if clinician_profile else "Unknown",
        conversation_id=booking.get("conversation_id"),
        appointment_id=booking.get("appointment_id"),
        scheduled_at=booking["scheduled_at"],
        duration_minutes=booking["duration_minutes"],
        service_type=booking["service_type"],
        service_name=service_details.get("name", ""),
        service_price=service_details.get("price", 0),
        billing_type=booking["billing_type"],
        status=booking["status"],
        notes=booking.get("notes"),
        created_by=booking["created_by"],
        created_by_name=format_name(creator_profile),
        invoice_id=booking.get("invoice_id"),
        created_at=booking["created_at"],
        updated_at=booking["updated_at"]
    )

@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    data: BookingUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update a booking"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    bookings = await supabase.select(
        "bookings",
        columns="*",
        filters={"id": booking_id},
        access_token=user.access_token
    )
    
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = bookings[0]
    update_data = {}
    
    if data.scheduled_at:
        update_data["scheduled_at"] = data.scheduled_at.isoformat()
    if data.status:
        update_data["status"] = data.status.value
    if data.clinician_id:
        update_data["clinician_id"] = data.clinician_id
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    if update_data:
        await supabase.update("bookings", update_data, {"id": booking_id}, user.access_token)
        
        # Update linked appointment if exists
        if booking.get("appointment_id"):
            apt_update = {}
            if data.scheduled_at:
                apt_update["scheduled_at"] = data.scheduled_at.isoformat()
            if data.status:
                apt_update["status"] = data.status.value
            if data.clinician_id:
                apt_update["clinician_id"] = data.clinician_id
            if apt_update:
                await supabase.update("appointments", apt_update, {"id": booking["appointment_id"]}, user.access_token)
    
    # Fetch updated booking
    return await get_booking(booking_id, user)

@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Cancel a booking"""
    role = await get_user_role(user.id, user.access_token)
    
    bookings = await supabase.select(
        "bookings",
        columns="*",
        filters={"id": booking_id},
        access_token=user.access_token
    )
    
    if not bookings:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = bookings[0]
    
    # Patients can cancel their own bookings, staff can cancel any
    if role == "patient" and booking["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await supabase.update(
        "bookings",
        {"status": BookingStatus.CANCELLED.value},
        {"id": booking_id},
        user.access_token
    )
    
    # Cancel linked appointment
    if booking.get("appointment_id"):
        await supabase.update(
            "appointments",
            {"status": "cancelled"},
            {"id": booking["appointment_id"]},
            user.access_token
        )
    
    # Cancel related invoice if exists
    if booking.get("invoice_id"):
        await supabase.update(
            "invoices",
            {"status": InvoiceStatus.CANCELLED.value},
            {"id": booking["invoice_id"]},
            user.access_token
        )
    
    # Update conversation if linked
    if booking.get("conversation_id"):
        await supabase.update(
            "chat_conversations",
            {"status": "active", "booking_id": None},
            {"id": booking["conversation_id"]},
            user.access_token
        )
        
        # Add system message
        system_message = {
            "id": str(uuid.uuid4()),
            "conversation_id": booking["conversation_id"],
            "sender_id": user.id,
            "sender_role": "system",
            "sender_name": "System",
            "content": "❌ Booking has been cancelled",
            "message_type": "system"
        }
        await supabase.insert("chat_messages", system_message, user.access_token)
    
    return {"message": "Booking cancelled successfully"}

# ============ Invoice Routes ============

@router.get("/invoices/my-invoices", response_model=List[InvoiceResponse])
async def get_patient_invoices(
    status: Optional[InvoiceStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get invoices for the current patient"""
    filters = {"patient_id": user.id}
    if status:
        filters["status"] = status.value
    
    invoices = await supabase.select(
        "invoices",
        columns="*",
        filters=filters,
        order="created_at.desc",
        limit=limit,
        access_token=user.access_token
    )
    
    result = []
    for inv in invoices:
        patient_profile = await get_user_profile(inv["patient_id"], user.access_token)
        clinician_profile = await get_user_profile(inv.get("clinician_id"), user.access_token) if inv.get("clinician_id") else None
        
        result.append(InvoiceResponse(
            id=inv["id"],
            booking_id=inv["booking_id"],
            patient_id=inv["patient_id"],
            patient_name=format_name(patient_profile),
            service_type=inv["service_type"],
            service_name=inv["service_name"],
            service_description=inv.get("service_description"),
            amount=float(inv["amount"]),
            consultation_date=inv["consultation_date"],
            clinician_id=inv.get("clinician_id", ""),
            clinician_name=format_name(clinician_profile) if clinician_profile else "Unknown",
            status=inv["status"],
            payment_reference=inv.get("payment_reference"),
            paid_at=inv.get("paid_at"),
            created_at=inv["created_at"],
            updated_at=inv["updated_at"]
        ))
    
    return result

@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific invoice"""
    invoices = await supabase.select(
        "invoices",
        columns="*",
        filters={"id": invoice_id},
        access_token=user.access_token
    )
    
    if not invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    inv = invoices[0]
    role = await get_user_role(user.id, user.access_token)
    
    if role == "patient" and inv["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    patient_profile = await get_user_profile(inv["patient_id"], user.access_token)
    clinician_profile = await get_user_profile(inv.get("clinician_id"), user.access_token) if inv.get("clinician_id") else None
    
    return InvoiceResponse(
        id=inv["id"],
        booking_id=inv["booking_id"],
        patient_id=inv["patient_id"],
        patient_name=format_name(patient_profile),
        service_type=inv["service_type"],
        service_name=inv["service_name"],
        service_description=inv.get("service_description"),
        amount=float(inv["amount"]),
        consultation_date=inv["consultation_date"],
        clinician_id=inv.get("clinician_id", ""),
        clinician_name=format_name(clinician_profile) if clinician_profile else "Unknown",
        status=inv["status"],
        payment_reference=inv.get("payment_reference"),
        paid_at=inv.get("paid_at"),
        created_at=inv["created_at"],
        updated_at=inv["updated_at"]
    )

@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Generate and return invoice as PDF"""
    invoices = await supabase.select(
        "invoices",
        columns="*",
        filters={"id": invoice_id},
        access_token=user.access_token
    )
    
    if not invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    inv = invoices[0]
    role = await get_user_role(user.id, user.access_token)
    
    if role == "patient" and inv["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get names for PDF
    patient_profile = await get_user_profile(inv["patient_id"], user.access_token)
    clinician_profile = await get_user_profile(inv.get("clinician_id"), user.access_token) if inv.get("clinician_id") else None
    
    # Prepare invoice data for PDF
    invoice_data = {
        **inv,
        "patient_name": format_name(patient_profile),
        "clinician_name": format_name(clinician_profile) if clinician_profile else "Clinical Associate",
        "patient_phone": patient_profile.get("phone") if patient_profile else None,
        "payment_instructions": """
Payment Methods:
1. EFT Transfer:
   Bank: Standard Bank
   Account Name: Quadcare Health Services
   Account Number: 123456789
   Branch Code: 051001
   Reference: Your ID Number

2. Cash Payment at Clinic

Please bring proof of payment to your consultation.
        """.strip()
    }
    
    # Generate PDF
    pdf_content = await generate_invoice_pdf(invoice_data)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="invoice_{invoice_id[:8]}.pdf"'
        }
    )

@router.patch("/invoices/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status: InvoiceStatus,
    payment_reference: Optional[str] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update invoice status (admin only)"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {"status": status.value}
    if payment_reference:
        update_data["payment_reference"] = payment_reference
    if status == InvoiceStatus.PAID:
        update_data["paid_at"] = datetime.utcnow().isoformat()
    
    await supabase.update("invoices", update_data, {"id": invoice_id}, user.access_token)
    
    return {"message": "Invoice status updated"}
