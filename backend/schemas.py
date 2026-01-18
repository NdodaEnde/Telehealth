from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


# ============ Enums ============

class AppRole(str, Enum):
    patient = "patient"
    nurse = "nurse"
    doctor = "doctor"
    admin = "admin"


class AppointmentStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class ConsultationType(str, Enum):
    video = "video"
    phone = "phone"
    in_person = "in_person"


class PrescriptionStatus(str, Enum):
    active = "active"
    cancelled = "cancelled"
    expired = "expired"
    completed = "completed"


class ClinicalNoteStatus(str, Enum):
    draft = "draft"
    final = "final"
    amended = "amended"


class Severity(str, Enum):
    mild = "mild"
    moderate = "moderate"
    severe = "severe"


# ============ Base Response ============

class APIResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None


# ============ User Schemas ============

class UserProfile(BaseModel):
    id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    id_number: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_at: Optional[str] = None


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    id_number: Optional[str] = None
    profile_image_url: Optional[str] = None


class UserWithRole(UserProfile):
    role: AppRole


# ============ Appointment Schemas ============

class AppointmentCreate(BaseModel):
    clinician_id: str
    scheduled_at: str  # ISO datetime
    consultation_type: ConsultationType = ConsultationType.video
    duration_minutes: int = 30
    notes: Optional[str] = None
    symptom_assessment_id: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None


class Appointment(BaseModel):
    id: str
    patient_id: str
    clinician_id: str
    scheduled_at: str
    consultation_type: ConsultationType
    duration_minutes: int = 30
    status: AppointmentStatus
    notes: Optional[str] = None
    symptom_assessment_id: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    # Joined fields
    patient_name: Optional[str] = None
    clinician_name: Optional[str] = None


class AppointmentList(BaseModel):
    appointments: List[Appointment]
    total: int


# ============ Symptom Assessment Schemas ============

class SymptomAssessmentCreate(BaseModel):
    symptoms: List[str]
    severity: Severity
    description: Optional[str] = None
    recommended_specialization: Optional[str] = None


class SymptomAssessment(BaseModel):
    id: str
    patient_id: str
    symptoms: List[str]
    severity: Severity
    description: Optional[str] = None
    recommended_specialization: Optional[str] = None
    created_at: str


# ============ Clinical Notes Schemas ============

class ClinicalNoteCreate(BaseModel):
    appointment_id: str
    patient_id: str
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    past_medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    examination_findings: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    diagnosis: Optional[List[str]] = None
    diagnosis_codes: Optional[List[str]] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[str] = None
    referral_required: bool = False
    referral_details: Optional[str] = None
    status: ClinicalNoteStatus = ClinicalNoteStatus.draft


class ClinicalNoteUpdate(BaseModel):
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    past_medical_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    examination_findings: Optional[str] = None
    vital_signs: Optional[Dict[str, Any]] = None
    diagnosis: Optional[List[str]] = None
    diagnosis_codes: Optional[List[str]] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[str] = None
    referral_required: Optional[bool] = None
    referral_details: Optional[str] = None
    status: Optional[ClinicalNoteStatus] = None


class ClinicalNote(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    clinician_id: str
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    examination_findings: Optional[str] = None
    diagnosis: Optional[List[str]] = None
    diagnosis_codes: Optional[List[str]] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[str] = None
    referral_required: bool = False
    referral_details: Optional[str] = None
    status: ClinicalNoteStatus
    created_at: str
    updated_at: Optional[str] = None


# ============ Prescription Schemas ============

class PrescriptionCreate(BaseModel):
    appointment_id: str
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    quantity: Optional[int] = None
    refills: int = 0
    instructions: Optional[str] = None
    pharmacy_notes: Optional[str] = None


class PrescriptionUpdate(BaseModel):
    status: Optional[PrescriptionStatus] = None
    pharmacy_notes: Optional[str] = None


class Prescription(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    clinician_id: str
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    quantity: Optional[int] = None
    refills: int = 0
    instructions: Optional[str] = None
    pharmacy_notes: Optional[str] = None
    status: PrescriptionStatus
    prescribed_at: str
    expires_at: Optional[str] = None
    # Joined fields
    patient_name: Optional[str] = None
    clinician_name: Optional[str] = None


class PrescriptionList(BaseModel):
    prescriptions: List[Prescription]
    total: int


# ============ Clinician Schemas ============

class ClinicianProfile(BaseModel):
    id: str
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    hpcsa_number: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    consultation_fee: Optional[float] = None
    available_for_emergency: bool = False
    # From profiles table
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None


class ClinicianAvailability(BaseModel):
    id: str
    clinician_id: str
    day_of_week: int  # 0=Sunday, 1=Monday, etc.
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format
    is_available: bool = True


class ClinicianAvailabilityCreate(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    is_available: bool = True


# ============ Password Reset Schemas ============

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
