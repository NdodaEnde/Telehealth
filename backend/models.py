from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

# Analytics Models
class DateRangeFilter(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class AnalyticsOverview(BaseModel):
    total_users: int = 0
    total_patients: int = 0
    total_clinicians: int = 0
    total_appointments: int = 0
    total_consultations: int = 0
    total_prescriptions: int = 0
    appointments_today: int = 0
    appointments_this_week: int = 0
    appointments_this_month: int = 0
    completion_rate: float = 0.0
    average_consultation_duration: float = 0.0

class AppointmentTrend(BaseModel):
    date: str
    count: int
    completed: int
    cancelled: int

class ConsultationTypeStats(BaseModel):
    video: int = 0
    phone: int = 0
    in_person: int = 0

class ClinicianPerformance(BaseModel):
    clinician_id: str
    clinician_name: str
    total_appointments: int
    completed_appointments: int
    completion_rate: float
    average_rating: Optional[float] = None

class PatientGrowth(BaseModel):
    date: str
    total_patients: int
    new_patients: int

class AnalyticsDashboard(BaseModel):
    overview: AnalyticsOverview
    appointment_trends: List[AppointmentTrend] = []
    consultation_types: ConsultationTypeStats
    clinician_performance: List[ClinicianPerformance] = []
    patient_growth: List[PatientGrowth] = []
    status_distribution: Dict[str, int] = {}

# Prescription PDF Models
class PrescriptionPDFRequest(BaseModel):
    prescription_id: str
    patient_name: str
    patient_dob: Optional[str] = None
    patient_id_number: Optional[str] = None
    clinician_name: str
    clinician_qualification: Optional[str] = None
    clinician_hpcsa: Optional[str] = None
    clinic_name: str = "HCF Telehealth"
    clinic_address: str = "South Africa"
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    quantity: Optional[int] = None
    refills: int = 0
    instructions: Optional[str] = None
    pharmacy_notes: Optional[str] = None
    prescribed_at: str
    expires_at: Optional[str] = None

class PrescriptionPDFResponse(BaseModel):
    success: bool
    pdf_base64: Optional[str] = None
    error: Optional[str] = None

# Appointment Models for Backend
class AppointmentCreate(BaseModel):
    patient_id: str
    clinician_id: str
    scheduled_at: str
    consultation_type: str = "video"
    duration_minutes: int = 30
    notes: Optional[str] = None
    symptom_assessment_id: Optional[str] = None

class AppointmentUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    scheduled_at: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: str
    patient_id: str
    clinician_id: str
    scheduled_at: str
    consultation_type: str
    duration_minutes: int
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str

# Clinical Note Models
class ClinicalNoteCreate(BaseModel):
    appointment_id: str
    patient_id: str
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    examination_findings: Optional[str] = None
    diagnosis: Optional[List[str]] = None
    treatment_plan: Optional[str] = None
    follow_up_instructions: Optional[str] = None
    follow_up_date: Optional[str] = None
    referral_required: bool = False
    referral_details: Optional[str] = None

class ClinicalNoteResponse(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    clinician_id: str
    status: str
    chief_complaint: Optional[str] = None
    diagnosis: Optional[List[str]] = None
    treatment_plan: Optional[str] = None
    created_at: str
    updated_at: str
