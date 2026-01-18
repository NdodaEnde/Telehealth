"""Enhanced Patient and Triage Models"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


# ============ Patient Onboarding Models ============

class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


class BloodType(str, Enum):
    A_positive = "A+"
    A_negative = "A-"
    B_positive = "B+"
    B_negative = "B-"
    O_positive = "O+"
    O_negative = "O-"
    AB_positive = "AB+"
    AB_negative = "AB-"
    unknown = "unknown"


class EmergencyContact(BaseModel):
    name: str
    relationship: str
    phone: str
    alternative_phone: Optional[str] = None


class MedicalAidDetails(BaseModel):
    scheme: str  # e.g., "discovery", "gems"
    scheme_name: Optional[str] = None
    membership_number: str
    plan: Optional[str] = None
    dependent_code: str = "00"  # 00 = main member
    main_member_name: Optional[str] = None
    main_member_id: Optional[str] = None
    verified: bool = False
    verified_at: Optional[str] = None
    verification_message: Optional[str] = None


class Allergy(BaseModel):
    allergen: str  # e.g., "Penicillin", "Peanuts"
    reaction: str  # e.g., "Rash", "Anaphylaxis"
    severity: str  # mild, moderate, severe


class ChronicCondition(BaseModel):
    condition: str  # e.g., "Diabetes Type 2", "Hypertension"
    diagnosed_date: Optional[str] = None
    managed_by: Optional[str] = None  # Specialist name
    medications: Optional[List[str]] = None
    notes: Optional[str] = None


class CurrentMedication(BaseModel):
    name: str
    dosage: str
    frequency: str
    prescribing_doctor: Optional[str] = None
    start_date: Optional[str] = None


class MedicalHistory(BaseModel):
    allergies: List[Allergy] = []
    chronic_conditions: List[ChronicCondition] = []
    current_medications: List[CurrentMedication] = []
    past_surgeries: List[str] = []
    family_history: Optional[str] = None
    immunizations_up_to_date: bool = True
    last_checkup_date: Optional[str] = None
    blood_type: Optional[BloodType] = None
    smoking_status: Optional[str] = None  # never, former, current
    alcohol_use: Optional[str] = None  # none, occasional, moderate, heavy


class PatientOnboardingCreate(BaseModel):
    """Complete patient onboarding data"""
    # Basic Info
    first_name: str
    last_name: str
    id_number: str  # SA ID number
    date_of_birth: str
    gender: Gender
    email: str
    phone: str
    alternative_phone: Optional[str] = None
    
    # Address
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    
    # Emergency Contact
    emergency_contact: Optional[EmergencyContact] = None
    
    # Medical Aid
    has_medical_aid: bool = False
    medical_aid: Optional[MedicalAidDetails] = None
    
    # Medical History
    medical_history: Optional[MedicalHistory] = None
    
    # Consent
    consent_telehealth: bool = False
    consent_data_processing: bool = False
    consent_marketing: bool = False


class PatientOnboardingResponse(BaseModel):
    id: str
    user_id: str
    created_at: str
    id_verified: bool = False
    medical_aid_verified: bool = False
    healthbridge_synced: bool = False
    healthbridge_patient_id: Optional[str] = None
    onboarding_complete: bool = False


# ============ Nurse Triage Models ============

class VitalSigns(BaseModel):
    """Vital signs captured during triage"""
    blood_pressure_systolic: Optional[int] = None  # mmHg
    blood_pressure_diastolic: Optional[int] = None  # mmHg
    heart_rate: Optional[int] = None  # bpm
    respiratory_rate: Optional[int] = None  # breaths per minute
    temperature: Optional[float] = None  # Celsius
    oxygen_saturation: Optional[int] = None  # SpO2 %
    weight: Optional[float] = None  # kg
    height: Optional[float] = None  # cm
    bmi: Optional[float] = None
    blood_glucose: Optional[float] = None  # mmol/L
    pain_score: Optional[int] = None  # 0-10 scale
    
    def calculate_bmi(self) -> Optional[float]:
        if self.weight and self.height and self.height > 0:
            height_m = self.height / 100
            return round(self.weight / (height_m ** 2), 1)
        return None


class TriagePriority(str, Enum):
    RED = "red"  # Immediate - life threatening
    ORANGE = "orange"  # Very urgent - 10 mins
    YELLOW = "yellow"  # Urgent - 60 mins
    GREEN = "green"  # Standard - 120 mins
    BLUE = "blue"  # Non-urgent - 240 mins


class NurseTriageCreate(BaseModel):
    """Nurse triage assessment"""
    appointment_id: str
    patient_id: str
    
    # Vital Signs
    vital_signs: VitalSigns
    
    # Chief Complaint
    chief_complaint: str
    symptom_duration: Optional[str] = None  # e.g., "2 days"
    symptom_onset: Optional[str] = None  # sudden, gradual
    
    # AI Assessment (from symptom checker)
    ai_urgency: Optional[str] = None
    ai_urgency_score: Optional[int] = None
    ai_care_pathway: Optional[str] = None
    ai_assessment_summary: Optional[str] = None
    
    # Nurse Assessment
    triage_priority: TriagePriority
    nurse_notes: str
    allergies_confirmed: bool = False
    medications_confirmed: bool = False
    
    # Pre-consultation Checklist
    identity_verified: bool = False
    consent_obtained: bool = False
    medical_aid_verified: bool = False
    patient_education_provided: bool = False
    
    # Recommendations
    recommended_action: str  # "proceed_to_doctor", "refer_to_emergency", "specialist_referral", "follow_up"
    referral_reason: Optional[str] = None
    doctor_notes: Optional[str] = None  # Notes for the doctor


class NurseTriageResponse(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    nurse_id: str
    triage_priority: TriagePriority
    vital_signs: VitalSigns
    chief_complaint: str
    nurse_notes: str
    recommended_action: str
    created_at: str
    ready_for_doctor: bool = False


# ============ AI Symptom Assessment Request/Response ============

class AISymptomAssessmentRequest(BaseModel):
    """Request for AI symptom assessment"""
    symptoms: List[str]
    severity: str  # mild, moderate, severe
    description: Optional[str] = None
    duration: Optional[str] = None  # e.g., "2 days", "1 week"
    
    # Optional patient context
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    chronic_conditions: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    allergies: Optional[List[str]] = None


class AISymptomAssessmentResponse(BaseModel):
    """Response from AI symptom assessment"""
    urgency: str
    urgency_score: int
    care_pathway: str
    recommended_specialization: Optional[str] = None
    assessment_summary: str
    warning_signs: List[str] = []
    self_care_advice: Optional[str] = None
    follow_up_questions: List[str] = []
    disclaimer: str
