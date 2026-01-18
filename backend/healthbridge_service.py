"""HealthBridge Integration Service

HealthBridge serves DUAL ROLES:
1. EHR (Electronic Health Records) - Patient data, medical history, clinical notes
2. Medical Aid Switch - Benefit checks, claims submission, authorization

This simplifies our integration:
- NO need to integrate with individual medical aid schemes
- HealthBridge handles all scheme-specific communication
- Single API for both clinical and financial functions

CURRENT STATUS: PLACEHOLDER - Returns mock data
TODO: Replace with real API calls once credentials are provided
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from enum import Enum

logger = logging.getLogger(__name__)

# ============ Configuration ============

# TODO: Replace with actual HealthBridge API credentials
HEALTHBRIDGE_CONFIG = {
    "base_url": "https://api.healthbridge.co.za/v1",  # Placeholder
    "api_key": "",  # TODO: Get from HealthBridge
    "practice_number": "",  # TODO: Your practice number
    "merchant_id": "",  # TODO: For claims
}


# ============ Enums ============

class ClaimStatus(str, Enum):
    SUBMITTED = "submitted"
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"
    REJECTED = "rejected"
    PARTIALLY_PAID = "partially_paid"


class BenefitType(str, Enum):
    DAY_TO_DAY = "day_to_day"
    HOSPITAL = "hospital"
    CHRONIC = "chronic"
    MATERNITY = "maternity"
    SAVINGS = "savings"


# ============ Response Models ============

class MedicalAidInfo(BaseModel):
    """Medical aid information from HealthBridge"""
    scheme: str
    plan: Optional[str] = None
    membership_number: str
    dependent_code: str = "00"
    status: str = "active"
    effective_date: Optional[str] = None


class PatientDemographics(BaseModel):
    """Patient demographics from HealthBridge EHR"""
    first_name: str
    last_name: str
    date_of_birth: str
    gender: str
    id_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class MedicalHistory(BaseModel):
    """Patient medical history from HealthBridge EHR"""
    allergies: List[str] = []
    chronic_conditions: List[str] = []
    current_medications: List[str] = []
    past_consultations: List[Dict] = []


class PatientLookupResult(BaseModel):
    """Complete patient lookup result"""
    found: bool
    healthbridge_id: Optional[str] = None
    demographics: Optional[PatientDemographics] = None
    medical_aid: Optional[MedicalAidInfo] = None
    medical_history: Optional[MedicalHistory] = None
    message: Optional[str] = None


class BenefitCheckResult(BaseModel):
    """Medical aid benefit check result"""
    eligible: bool
    benefit_type: Optional[str] = None
    available_amount: Optional[float] = None
    co_payment_required: bool = False
    co_payment_amount: float = 0.0
    authorization_required: bool = False
    tariff_code: Optional[str] = None
    approved_amount: Optional[float] = None
    message: Optional[str] = None


class PreAuthResult(BaseModel):
    """Pre-authorization request result"""
    authorization_number: Optional[str] = None
    status: str
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    approved_amount: Optional[float] = None
    message: Optional[str] = None


class ClaimSubmissionResult(BaseModel):
    """Claims submission result"""
    claim_reference: Optional[str] = None
    status: ClaimStatus
    submission_timestamp: Optional[str] = None
    expected_processing_time: Optional[str] = None
    message: Optional[str] = None


class ClaimStatusResult(BaseModel):
    """Claim status check result"""
    claim_reference: str
    status: ClaimStatus
    amount_claimed: float
    amount_approved: Optional[float] = None
    amount_paid: Optional[float] = None
    patient_liability: Optional[float] = None
    payment_date: Optional[str] = None
    rejection_reason: Optional[str] = None


class EHRSyncResult(BaseModel):
    """Result of syncing data to HealthBridge EHR"""
    encounter_id: Optional[str] = None
    synced: bool
    sync_timestamp: Optional[str] = None
    message: Optional[str] = None


class MedicalAidVerificationResult(BaseModel):
    """Medical aid verification result (legacy compatibility)"""
    verified: bool
    scheme: str
    membership_number: str
    member_name: Optional[str] = None
    status: str = "active"
    available_benefits: Optional[Dict] = None
    message: Optional[str] = None


# ============ Medical Aid Schemes ============

MEDICAL_AID_SCHEMES = [
    {"code": "DISC", "name": "Discovery Health", "plans": ["KeyCare", "Coastal", "Classic", "Executive"]},
    {"code": "MOME", "name": "Momentum Health", "plans": ["Ingwe", "Evolve", "Summit"]},
    {"code": "BONI", "name": "Bonitas", "plans": ["BonFit", "BonSave", "BonComplete"]},
    {"code": "MEDS", "name": "Medscheme", "plans": ["Various"]},
    {"code": "GEMS", "name": "GEMS (Government)", "plans": ["Emerald", "Ruby", "Sapphire"]},
    {"code": "FEDH", "name": "Fedhealth", "plans": ["Flexifed", "Maxima"]},
    {"code": "BEST", "name": "Bestmed", "plans": ["Beat", "Pace", "Pulse"]},
    {"code": "PROF", "name": "Profmed", "plans": ["ProSecure", "ProActive"]},
    {"code": "BANK", "name": "Bankmed", "plans": ["Traditional", "Comprehensive"]},
    {"code": "LIBI", "name": "Liberty Medical Scheme", "plans": ["Standard", "Premium"]},
    {"code": "ANGLO", "name": "Anglo Medical Scheme", "plans": ["Standard"]},
    {"code": "SIZWE", "name": "Sizwe Hosmed", "plans": ["Various"]},
    {"code": "WOOLT", "name": "Woolworths Medical", "plans": ["Standard"]},
]


# ============ HealthBridge Service Class ============

class HealthBridgeService:
    """
    HealthBridge Integration Service
    
    DUAL ROLE:
    - EHR Functions: Patient lookup, medical history, encounter sync
    - Switch Functions: Benefit checks, pre-auth, claims submission
    
    CURRENT STATUS: PLACEHOLDER
    All methods return mock data until real API credentials are configured.
    """
    
    def __init__(self):
        self.base_url = HEALTHBRIDGE_CONFIG["base_url"]
        self.api_key = HEALTHBRIDGE_CONFIG["api_key"]
        self.practice_number = HEALTHBRIDGE_CONFIG["practice_number"]
        self._is_configured = bool(self.api_key)
    
    # ==================== EHR FUNCTIONS ====================
    
    async def lookup_patient(self, id_number: str, id_type: str = "sa_id") -> PatientLookupResult:
        """
        Look up patient in HealthBridge EHR by ID number.
        
        Returns patient demographics, medical aid info, and medical history
        if found in the system.
        
        PLACEHOLDER: Returns mock "not found" response
        TODO: Implement real API call
        """
        logger.info(f"HealthBridge EHR: Looking up patient with {id_type}: {id_number[:4]}****")
        
        if not self._is_configured:
            logger.warning("HealthBridge not configured - returning mock response")
            return PatientLookupResult(
                found=False,
                message="HealthBridge integration not configured - patient lookup unavailable"
            )
        
        # TODO: Real API call
        # response = await self._call_api("POST", "/patients/lookup", {"id_number": id_number})
        
        # PLACEHOLDER: Return not found
        return PatientLookupResult(
            found=False,
            message="Patient not found in HealthBridge EHR (placeholder response)"
        )
    
    async def get_medical_history(self, healthbridge_patient_id: str) -> MedicalHistory:
        """
        Get patient's full medical history from HealthBridge EHR.
        
        PLACEHOLDER: Returns empty history
        """
        logger.info(f"HealthBridge EHR: Getting medical history for {healthbridge_patient_id}")
        
        return MedicalHistory(
            allergies=[],
            chronic_conditions=[],
            current_medications=[],
            past_consultations=[]
        )
    
    async def sync_encounter(self, encounter_data: Dict[str, Any]) -> EHRSyncResult:
        """
        Sync a consultation encounter to HealthBridge EHR.
        
        This includes clinical notes, diagnoses, and prescriptions.
        
        PLACEHOLDER: Returns mock success
        """
        logger.info(f"HealthBridge EHR: Syncing encounter for patient {encounter_data.get('healthbridge_patient_id', 'unknown')}")
        
        if not self._is_configured:
            return EHRSyncResult(
                synced=False,
                message="HealthBridge not configured - encounter sync unavailable"
            )
        
        # TODO: Real API call
        # PLACEHOLDER: Return success
        return EHRSyncResult(
            encounter_id=f"ENC-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            synced=True,
            sync_timestamp=datetime.utcnow().isoformat(),
            message="Encounter synced to HealthBridge EHR (placeholder)"
        )
    
    # Legacy method for compatibility
    async def sync_patient_to_ehr(self, patient_data: Dict[str, Any]) -> EHRSyncResult:
        """Legacy method - wraps sync_encounter"""
        return await self.sync_encounter(patient_data)
    
    # ==================== SWITCH FUNCTIONS ====================
    
    async def check_benefits(
        self,
        membership_number: str,
        dependent_code: str = "00",
        service_type: str = "telehealth_consultation"
    ) -> BenefitCheckResult:
        """
        Check medical aid benefits via HealthBridge Switch.
        
        HealthBridge handles communication with all medical aid schemes:
        - Discovery, Momentum, Bonitas, GEMS, etc.
        
        PLACEHOLDER: Returns mock eligible response
        """
        logger.info(f"HealthBridge Switch: Checking benefits for member {membership_number[:4]}****")
        
        if not self._is_configured:
            return BenefitCheckResult(
                eligible=False,
                message="HealthBridge not configured - benefit check unavailable"
            )
        
        # TODO: Real API call
        # PLACEHOLDER: Return eligible
        return BenefitCheckResult(
            eligible=True,
            benefit_type="day_to_day",
            available_amount=2500.00,
            co_payment_required=False,
            co_payment_amount=0.0,
            authorization_required=False,
            tariff_code="0190",
            approved_amount=450.00,
            message="Benefits available (placeholder response)"
        )
    
    async def request_preauth(
        self,
        membership_number: str,
        dependent_code: str,
        diagnosis_codes: List[str],
        procedure_codes: List[str],
        clinical_motivation: str
    ) -> PreAuthResult:
        """
        Request pre-authorization via HealthBridge Switch.
        
        Some medical aids require pre-auth for certain services.
        
        PLACEHOLDER: Returns mock approved response
        """
        logger.info(f"HealthBridge Switch: Requesting pre-auth for member {membership_number[:4]}****")
        
        if not self._is_configured:
            return PreAuthResult(
                status="unavailable",
                message="HealthBridge not configured - pre-auth unavailable"
            )
        
        # TODO: Real API call
        # PLACEHOLDER: Return approved
        return PreAuthResult(
            authorization_number=f"AUTH-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            status="approved",
            valid_from=datetime.now().strftime("%Y-%m-%d"),
            valid_until=(datetime.now().replace(day=datetime.now().day + 7)).strftime("%Y-%m-%d"),
            approved_amount=450.00,
            message="Pre-authorization approved (placeholder)"
        )
    
    async def submit_claim(
        self,
        membership_number: str,
        dependent_code: str,
        date_of_service: str,
        diagnosis_codes: List[str],
        line_items: List[Dict],
        authorization_number: Optional[str] = None
    ) -> ClaimSubmissionResult:
        """
        Submit a claim via HealthBridge Switch.
        
        HealthBridge routes the claim to the appropriate medical aid.
        
        PLACEHOLDER: Returns mock submitted response
        """
        total_amount = sum(item.get("amount", 0) for item in line_items)
        logger.info(f"HealthBridge Switch: Submitting claim for R{total_amount:.2f}")
        
        if not self._is_configured:
            return ClaimSubmissionResult(
                status=ClaimStatus.REJECTED,
                message="HealthBridge not configured - claims submission unavailable"
            )
        
        # TODO: Real API call
        # PLACEHOLDER: Return submitted
        return ClaimSubmissionResult(
            claim_reference=f"CLM-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            status=ClaimStatus.SUBMITTED,
            submission_timestamp=datetime.utcnow().isoformat(),
            expected_processing_time="24-48 hours",
            message="Claim submitted to medical aid (placeholder)"
        )
    
    async def get_claim_status(self, claim_reference: str) -> ClaimStatusResult:
        """
        Check claim status via HealthBridge Switch.
        
        PLACEHOLDER: Returns mock paid status
        """
        logger.info(f"HealthBridge Switch: Checking status for claim {claim_reference}")
        
        # PLACEHOLDER: Return paid
        return ClaimStatusResult(
            claim_reference=claim_reference,
            status=ClaimStatus.PAID,
            amount_claimed=450.00,
            amount_approved=450.00,
            amount_paid=450.00,
            patient_liability=0.00,
            payment_date=datetime.now().strftime("%Y-%m-%d")
        )
    
    # ==================== LEGACY METHODS (Compatibility) ====================
    
    async def verify_medical_aid(
        self,
        scheme: str,
        membership_number: str,
        dependent_code: str = "00"
    ) -> MedicalAidVerificationResult:
        """
        Legacy method for medical aid verification.
        Wraps the new check_benefits method.
        """
        logger.info(f"HealthBridge: Verifying medical aid {scheme} - {membership_number[:4]}****")
        
        # Use the new benefits check
        benefits = await self.check_benefits(membership_number, dependent_code)
        
        return MedicalAidVerificationResult(
            verified=benefits.eligible,
            scheme=scheme,
            membership_number=membership_number,
            member_name="Member (placeholder)",
            status="active" if benefits.eligible else "inactive",
            available_benefits={
                "day_to_day": benefits.available_amount,
                "co_payment": benefits.co_payment_amount
            } if benefits.eligible else None,
            message=benefits.message
        )


# ============ Helper Functions ============

def get_medical_aid_schemes() -> List[Dict[str, Any]]:
    """Get list of supported medical aid schemes"""
    return MEDICAL_AID_SCHEMES


def get_countries() -> List[Dict[str, str]]:
    """Get list of countries for passport selection"""
    return [
        {"code": "ZA", "name": "South Africa"},
        {"code": "ZW", "name": "Zimbabwe"},
        {"code": "MZ", "name": "Mozambique"},
        {"code": "MW", "name": "Malawi"},
        {"code": "LS", "name": "Lesotho"},
        {"code": "SZ", "name": "Eswatini (Swaziland)"},
        {"code": "BW", "name": "Botswana"},
        {"code": "NA", "name": "Namibia"},
        {"code": "ZM", "name": "Zambia"},
        {"code": "NG", "name": "Nigeria"},
        {"code": "CD", "name": "DRC (Congo)"},
        {"code": "ET", "name": "Ethiopia"},
        {"code": "SO", "name": "Somalia"},
        {"code": "PK", "name": "Pakistan"},
        {"code": "BD", "name": "Bangladesh"},
        {"code": "IN", "name": "India"},
        {"code": "CN", "name": "China"},
        {"code": "GB", "name": "United Kingdom"},
        {"code": "US", "name": "United States"},
        {"code": "OTHER", "name": "Other"},
    ]


def validate_sa_id_number(id_number: str) -> Dict[str, Any]:
    """
    Validate South African ID number and extract info.
    
    SA ID Format: YYMMDD SSSS C A Z
    - YYMMDD: Date of birth
    - SSSS: Gender (0000-4999 = female, 5000-9999 = male)
    - C: Citizenship (0 = SA citizen, 1 = permanent resident)
    - A: Usually 8
    - Z: Checksum digit
    """
    if not id_number or len(id_number) != 13:
        return {"valid": False, "error": "ID number must be 13 digits"}
    
    if not id_number.isdigit():
        return {"valid": False, "error": "ID number must contain only digits"}
    
    # Extract date of birth
    year = int(id_number[0:2])
    month = int(id_number[2:4])
    day = int(id_number[4:6])
    
    # Determine century
    if year <= 30:
        year += 2000
    else:
        year += 1900
    
    # Validate date
    try:
        dob = datetime(year, month, day)
        dob_str = dob.strftime("%Y-%m-%d")
    except ValueError:
        return {"valid": False, "error": "Invalid date in ID number"}
    
    # Extract gender
    gender_digits = int(id_number[6:10])
    gender = "female" if gender_digits < 5000 else "male"
    
    # Citizenship
    citizenship = "SA Citizen" if id_number[10] == "0" else "Permanent Resident"
    
    # Luhn checksum validation
    total = 0
    for i, digit in enumerate(id_number):
        d = int(digit)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    
    if total % 10 != 0:
        return {"valid": False, "error": "Invalid ID number checksum"}
    
    return {
        "valid": True,
        "id_type": "sa_id",
        "date_of_birth": dob_str,
        "gender": gender,
        "citizenship": citizenship,
        "age": (datetime.now() - dob).days // 365
    }


def validate_passport(passport_number: str, country_code: str, date_of_birth: str = None) -> Dict[str, Any]:
    """Validate passport number (basic validation)."""
    if not passport_number:
        return {"valid": False, "error": "Passport number is required"}
    
    passport_number = passport_number.replace(" ", "").upper()
    
    if len(passport_number) < 5 or len(passport_number) > 20:
        return {"valid": False, "error": "Passport number must be 5-20 characters"}
    
    if not passport_number.isalnum():
        return {"valid": False, "error": "Passport number must contain only letters and numbers"}
    
    if not country_code:
        return {"valid": False, "error": "Country of issue is required"}
    
    age = None
    if date_of_birth:
        try:
            dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
            age = (datetime.now() - dob).days // 365
        except ValueError:
            pass
    
    return {
        "valid": True,
        "id_type": "passport",
        "passport_number": passport_number,
        "country_code": country_code,
        "date_of_birth": date_of_birth,
        "age": age
    }


def validate_identification(
    id_type: str,
    id_number: str = None,
    passport_number: str = None,
    country_code: str = None,
    date_of_birth: str = None
) -> Dict[str, Any]:
    """Validate identification based on type."""
    if id_type == "sa_id":
        if not id_number:
            return {"valid": False, "error": "SA ID number is required"}
        return validate_sa_id_number(id_number)
    elif id_type == "passport":
        if not passport_number:
            return {"valid": False, "error": "Passport number is required"}
        if not date_of_birth:
            return {"valid": False, "error": "Date of birth is required for passport holders"}
        return validate_passport(passport_number, country_code, date_of_birth)
    else:
        return {"valid": False, "error": "Invalid identification type"}


# ============ Global Instance ============

healthbridge = HealthBridgeService()
