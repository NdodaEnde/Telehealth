"""
Booking Routes for Receptionist-Created Bookings
Handles booking creation, management, and invoicing
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
import uuid
import logging
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["Bookings"])

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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
    clinician_id: str
    conversation_id: Optional[str] = None
    scheduled_at: datetime
    service_type: ServiceType
    billing_type: PatientBillingType
    notes: Optional[str] = None
    duration_minutes: int = 30

class BookingResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    clinician_id: str
    clinician_name: str
    conversation_id: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int
    service_type: ServiceType
    service_name: str
    service_price: float
    billing_type: PatientBillingType
    status: BookingStatus
    notes: Optional[str] = None
    created_by: str
    created_by_name: str
    invoice_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class BookingUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    status: Optional[BookingStatus] = None
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: str
    booking_id: str
    patient_id: str
    patient_name: str
    patient_email: Optional[str] = None
    patient_phone: Optional[str] = None
    service_name: str
    service_description: str
    consultation_date: datetime
    clinician_name: str
    amount: float
    status: InvoiceStatus
    payment_instructions: str
    created_at: datetime
    updated_at: datetime

class FeeScheduleItem(BaseModel):
    service_type: ServiceType
    name: str
    price: float
    description: str

# ============ Helper Functions ============

async def get_user_profile(user_id: str):
    """Get user profile from Supabase"""
    profiles = await supabase.select(
        "profiles",
        columns="id, first_name, last_name, phone",
        filters={"id": user_id}
    )
    if profiles:
        return profiles[0]
    return None

async def get_user_email(user_id: str):
    """Get user email from Supabase auth"""
    # This would require service key access
    return None

async def get_user_role(user_id: str) -> str:
    """Get user role from Supabase"""
    roles = await supabase.select(
        "user_roles",
        columns="role",
        filters={"user_id": user_id}
    )
    if roles:
        return roles[0].get("role", "patient")
    return "patient"

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

@router.post("", response_model=BookingResponse)
async def create_booking(
    data: BookingCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new booking (receptionist action)"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized to create bookings")
    
    # Get patient info
    patient_profile = await get_user_profile(data.patient_id)
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient_name = f"{patient_profile.get('first_name', '')} {patient_profile.get('last_name', '')}".strip()
    
    # Get clinician info
    clinician_profile = await get_user_profile(data.clinician_id)
    if not clinician_profile:
        raise HTTPException(status_code=404, detail="Clinician not found")
    clinician_name = f"{clinician_profile.get('first_name', '')} {clinician_profile.get('last_name', '')}".strip()
    
    # Get creator info
    creator_profile = await get_user_profile(user.id)
    creator_name = f"{creator_profile.get('first_name', '')} {creator_profile.get('last_name', '')}".strip() if creator_profile else "Unknown"
    
    # Get service details
    service_details = FEE_SCHEDULE.get(data.service_type, {})
    
    booking = {
        "id": str(uuid.uuid4()),
        "patient_id": data.patient_id,
        "patient_name": patient_name,
        "clinician_id": data.clinician_id,
        "clinician_name": clinician_name,
        "conversation_id": data.conversation_id,
        "scheduled_at": data.scheduled_at,
        "duration_minutes": data.duration_minutes,
        "service_type": data.service_type.value,
        "service_name": service_details.get("name", ""),
        "service_price": service_details.get("price", 0),
        "billing_type": data.billing_type.value,
        "status": BookingStatus.CONFIRMED.value,
        "notes": data.notes,
        "created_by": user.id,
        "created_by_name": creator_name,
        "invoice_id": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.bookings.insert_one(booking)
    
    # Also create appointment in Supabase for consistency
    appointment_data = {
        "patient_id": data.patient_id,
        "clinician_id": data.clinician_id,
        "scheduled_at": data.scheduled_at.isoformat(),
        "duration_minutes": data.duration_minutes,
        "consultation_type": "video",
        "status": "confirmed",
        "notes": data.notes
    }
    
    await supabase.insert("appointments", appointment_data)
    
    # Update conversation status if linked
    if data.conversation_id:
        from routes.chat import ChatStatus
        await db.chat_conversations.update_one(
            {"id": data.conversation_id},
            {
                "$set": {
                    "status": ChatStatus.BOOKED.value,
                    "booking_id": booking["id"],
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Add system message to conversation
        system_message = {
            "id": str(uuid.uuid4()),
            "conversation_id": data.conversation_id,
            "sender_id": "system",
            "sender_name": "System",
            "sender_role": "system",
            "content": f"Booking confirmed with {clinician_name} on {data.scheduled_at.strftime('%B %d, %Y at %H:%M')}",
            "message_type": "booking_confirmation",
            "created_at": datetime.utcnow()
        }
        await db.chat_messages.insert_one(system_message)
    
    # Generate invoice for cash patients
    if data.billing_type == PatientBillingType.CASH and service_details.get("price", 0) > 0:
        invoice = await generate_invoice(booking, patient_profile)
        booking["invoice_id"] = invoice["id"]
        await db.bookings.update_one(
            {"id": booking["id"]},
            {"$set": {"invoice_id": invoice["id"]}}
        )
    
    logger.info(f"Booking created: {booking['id']} for patient {data.patient_id}")
    
    return BookingResponse(**booking)

@router.get("", response_model=List[BookingResponse])
async def get_bookings(
    patient_id: Optional[str] = None,
    clinician_id: Optional[str] = None,
    status: Optional[BookingStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get bookings with optional filters"""
    role = await get_user_role(user.id)
    
    query = {}
    
    if role == "patient":
        # Patients only see their own bookings
        query["patient_id"] = user.id
    else:
        if patient_id:
            query["patient_id"] = patient_id
        if clinician_id:
            query["clinician_id"] = clinician_id
    
    if status:
        query["status"] = status.value
    
    if date_from:
        query["scheduled_at"] = {"$gte": datetime.combine(date_from, datetime.min.time())}
    if date_to:
        if "scheduled_at" in query:
            query["scheduled_at"]["$lte"] = datetime.combine(date_to, datetime.max.time())
        else:
            query["scheduled_at"] = {"$lte": datetime.combine(date_to, datetime.max.time())}
    
    bookings = await db.bookings.find(query).sort("scheduled_at", -1).limit(limit).to_list(limit)
    
    return [BookingResponse(**booking) for booking in bookings]

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific booking"""
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and booking["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return BookingResponse(**booking)

@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: str,
    data: BookingUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update a booking"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {"updated_at": datetime.utcnow()}
    
    if data.scheduled_at:
        update_data["scheduled_at"] = data.scheduled_at
    if data.status:
        update_data["status"] = data.status.value
    if data.notes is not None:
        update_data["notes"] = data.notes
    
    await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    # Update conversation status if linked
    if booking.get("conversation_id"):
        from routes.chat import ChatStatus
        new_conv_status = None
        if data.status == BookingStatus.COMPLETED:
            new_conv_status = ChatStatus.CONSULTATION_COMPLETE.value
        elif data.status == BookingStatus.CANCELLED:
            new_conv_status = ChatStatus.ACTIVE.value
        
        if new_conv_status:
            await db.chat_conversations.update_one(
                {"id": booking["conversation_id"]},
                {"$set": {"status": new_conv_status, "updated_at": datetime.utcnow()}}
            )
    
    updated_booking = await db.bookings.find_one({"id": booking_id})
    return BookingResponse(**updated_booking)

@router.delete("/{booking_id}")
async def cancel_booking(
    booking_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Cancel a booking"""
    role = await get_user_role(user.id)
    
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Patients can cancel their own bookings, staff can cancel any
    if role == "patient" and booking["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "status": BookingStatus.CANCELLED.value,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Cancel related invoice if exists
    if booking.get("invoice_id"):
        await db.invoices.update_one(
            {"id": booking["invoice_id"]},
            {"$set": {"status": InvoiceStatus.CANCELLED.value, "updated_at": datetime.utcnow()}}
        )
    
    # Update conversation if linked
    if booking.get("conversation_id"):
        from routes.chat import ChatStatus
        await db.chat_conversations.update_one(
            {"id": booking["conversation_id"]},
            {
                "$set": {
                    "status": ChatStatus.ACTIVE.value,
                    "booking_id": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Add system message
        system_message = {
            "id": str(uuid.uuid4()),
            "conversation_id": booking["conversation_id"],
            "sender_id": "system",
            "sender_name": "System",
            "sender_role": "system",
            "content": "Booking has been cancelled",
            "message_type": "system",
            "created_at": datetime.utcnow()
        }
        await db.chat_messages.insert_one(system_message)
    
    return {"message": "Booking cancelled successfully"}

# ============ Invoice Functions ============

async def generate_invoice(booking: dict, patient_profile: dict) -> dict:
    """Generate an invoice for a cash patient"""
    invoice = {
        "id": str(uuid.uuid4()),
        "booking_id": booking["id"],
        "patient_id": booking["patient_id"],
        "patient_name": booking["patient_name"],
        "patient_email": None,  # Would need to fetch from auth
        "patient_phone": patient_profile.get("phone"),
        "service_name": booking["service_name"],
        "service_description": FEE_SCHEDULE.get(ServiceType(booking["service_type"]), {}).get("description", ""),
        "consultation_date": booking["scheduled_at"],
        "clinician_name": booking["clinician_name"],
        "amount": booking["service_price"],
        "status": InvoiceStatus.PENDING.value,
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
        """.strip(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.invoices.insert_one(invoice)
    logger.info(f"Invoice generated: {invoice['id']} for booking {booking['id']}")
    
    return invoice

@router.get("/invoices/patient", response_model=List[InvoiceResponse])
async def get_patient_invoices(
    status: Optional[InvoiceStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get invoices for the current patient"""
    query = {"patient_id": user.id}
    if status:
        query["status"] = status.value
    
    invoices = await db.invoices.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [InvoiceResponse(**inv) for inv in invoices]

@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and invoice["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return InvoiceResponse(**invoice)

@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Generate and return invoice as PDF"""
    from fastapi.responses import Response
    from pdf_generator import generate_invoice_pdf
    
    invoice = await db.invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and invoice["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate PDF
    pdf_content = await generate_invoice_pdf(invoice)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="invoice_{invoice_id}.pdf"'
        }
    )

@router.patch("/invoices/{invoice_id}/status")
async def update_invoice_status(
    invoice_id: str,
    status: InvoiceStatus,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update invoice status (admin only)"""
    role = await get_user_role(user.id)
    if role not in ["admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": status.value, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Invoice status updated"}

# ============ Clinician List for Booking ============

@router.get("/clinicians/available")
async def get_available_clinicians(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get list of available clinicians for booking"""
    # Get clinicians from Supabase
    clinicians = await supabase.select(
        "clinician_profiles",
        columns="id, specialization, is_available"
    )
    
    if not clinicians:
        return []
    
    # Get profiles for names
    clinician_ids = [c["id"] for c in clinicians]
    profiles = await supabase.select(
        "profiles",
        columns="id, first_name, last_name",
        filters={"id": {"in": f"({','.join(clinician_ids)})"}} if clinician_ids else {}
    )
    
    profile_map = {p["id"]: p for p in (profiles or [])}
    
    result = []
    for clinician in clinicians:
        profile = profile_map.get(clinician["id"], {})
        result.append({
            "id": clinician["id"],
            "name": f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip() or "Unknown",
            "specialization": clinician.get("specialization"),
            "is_available": clinician.get("is_available", False)
        })
    
    return result
