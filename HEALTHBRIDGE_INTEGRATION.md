# HealthBridge Integration Architecture

## Understanding HealthBridge's Dual Role

HealthBridge is not just an EHR system - it's also a **medical aid switching company**. This means it acts as a central hub for both clinical data AND financial/claims processing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HEALTHBRIDGE DUAL ROLE                                 │
├─────────────────────────────────┬───────────────────────────────────────────┤
│         EHR FUNCTIONS           │         SWITCH FUNCTIONS                  │
├─────────────────────────────────┼───────────────────────────────────────────┤
│ • Patient demographics          │ • Real-time benefit eligibility           │
│ • Medical history access        │ • Authorization requests (pre-auth)       │
│ • Consultation notes storage    │ • Claims submission (electronic)          │
│ • Prescription history          │ • Claims status tracking                  │
│ • Lab results                   │ • Remittance advice (payment confirm)     │
│ • Clinical documentation sync   │ • Member validation                       │
└─────────────────────────────────┴───────────────────────────────────────────┘
```

---

## Simplified Integration Architecture

### Before (What We Assumed):
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  HCF Platform   │────▶│   HealthBridge  │     │  Discovery      │
│                 │     │   (EHR Only)    │     │  Medical Aid    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        │               ┌─────────────────┐            │
        └──────────────▶│   Momentum      │◀───────────┘
                        │   Medical Aid    │
        │               └─────────────────┘
        │               ┌─────────────────┐
        └──────────────▶│   Bonitas       │
                        │   Medical Aid    │
        │               └─────────────────┘
        │               ┌─────────────────┐
        └──────────────▶│   PayGate       │
                        │   (Payments)    │
                        └─────────────────┘

❌ Complex - Multiple integrations needed
```

### After (Actual Architecture):
```
┌─────────────────────────────────────────────────────────────────┐
│                        HCF TELEHEALTH PLATFORM                  │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   HealthBridge  │  │   HealthBridge  │  │    PayGate      │
│   (EHR)         │  │   (Switch)      │  │   (Card Only)   │
│                 │  │                 │  │                 │
│ • Patient Lookup│  │ • Benefit Check │  │ • Cash patients │
│ • History Sync  │  │ • Claims Submit │  │ • Co-payments   │
│ • Notes Storage │  │ • Pre-auth      │  │ • Self-pay      │
│ • Prescriptions │  │ • Remittance    │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        │                    │
        │    ┌───────────────┘
        │    │
        ▼    ▼
┌──────────────────────────────────────────────────────────┐
│              HEALTHBRIDGE BACKEND                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Discovery  │  │ Momentum   │  │ Bonitas            │ │
│  │ Medscheme  │  │ GEMS       │  │ Fedhealth          │ │
│  │ etc...     │  │ etc...     │  │ etc...             │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────────────┘

✅ Simple - HealthBridge handles all medical aid communication
```

---

## Integration Points (Updated)

### 1. Patient Registration/Lookup (EHR)
```
POST /healthbridge/patient/lookup
{
  "id_number": "8001015009087",
  "id_type": "sa_id"
}

Response:
{
  "found": true,
  "healthbridge_id": "HB-123456",
  "demographics": {
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1980-01-01",
    "gender": "male"
  },
  "medical_aid": {
    "scheme": "Discovery Health",
    "plan": "Classic Comprehensive",
    "membership_number": "1234567890",
    "dependent_code": "00",
    "status": "active"
  },
  "medical_history": {
    "allergies": ["Penicillin"],
    "chronic_conditions": ["Hypertension"],
    "current_medications": ["Amlodipine 5mg"]
  }
}
```

### 2. Benefit Check (Switch)
```
POST /healthbridge/benefits/check
{
  "membership_number": "1234567890",
  "dependent_code": "00",
  "service_type": "telehealth_consultation",
  "provider_practice_number": "PR12345"
}

Response:
{
  "eligible": true,
  "benefit_type": "day_to_day",
  "available_amount": 2500.00,
  "co_payment_required": false,
  "co_payment_amount": 0,
  "authorization_required": false,
  "tariff_code": "0190",
  "approved_amount": 450.00
}
```

### 3. Pre-Authorization (Switch) - If Required
```
POST /healthbridge/preauth/request
{
  "membership_number": "1234567890",
  "dependent_code": "00",
  "diagnosis_code": "J06.9",  // Upper respiratory infection
  "procedure_codes": ["0190"],
  "provider_practice_number": "PR12345",
  "clinical_motivation": "Patient presenting with acute symptoms..."
}

Response:
{
  "authorization_number": "AUTH-2025-123456",
  "status": "approved",
  "valid_from": "2025-01-18",
  "valid_until": "2025-01-25",
  "approved_services": ["0190"],
  "approved_amount": 450.00
}
```

### 4. Claims Submission (Switch)
```
POST /healthbridge/claims/submit
{
  "authorization_number": "AUTH-2025-123456",  // if applicable
  "membership_number": "1234567890",
  "dependent_code": "00",
  "date_of_service": "2025-01-18",
  "provider_practice_number": "PR12345",
  "diagnosis_codes": ["J06.9"],
  "line_items": [
    {
      "tariff_code": "0190",
      "description": "Telehealth consultation",
      "quantity": 1,
      "amount": 450.00
    }
  ],
  "total_amount": 450.00
}

Response:
{
  "claim_reference": "CLM-2025-789012",
  "status": "submitted",
  "submission_timestamp": "2025-01-18T10:30:00Z",
  "expected_processing_time": "24-48 hours"
}
```

### 5. Claims Status Check (Switch)
```
GET /healthbridge/claims/{claim_reference}/status

Response:
{
  "claim_reference": "CLM-2025-789012",
  "status": "paid",
  "amount_claimed": 450.00,
  "amount_approved": 450.00,
  "amount_paid": 450.00,
  "patient_liability": 0.00,
  "payment_date": "2025-01-20",
  "remittance_reference": "REM-2025-456789"
}
```

### 6. Clinical Notes Sync (EHR)
```
POST /healthbridge/encounters/sync
{
  "healthbridge_patient_id": "HB-123456",
  "consultation_id": "uuid",
  "encounter_date": "2025-01-18T10:00:00Z",
  "provider": {
    "practice_number": "PR12345",
    "name": "Dr. Smith"
  },
  "clinical_notes": {
    "chief_complaint": "Sore throat and fever",
    "history": "3 days of symptoms...",
    "examination": "Throat erythematous...",
    "assessment": "Acute pharyngitis",
    "plan": "Symptomatic treatment..."
  },
  "diagnosis": [
    {"code": "J02.9", "description": "Acute pharyngitis"}
  ],
  "prescriptions": [
    {
      "medication": "Paracetamol 500mg",
      "dosage": "2 tablets",
      "frequency": "every 6 hours",
      "duration": "5 days"
    }
  ]
}

Response:
{
  "encounter_id": "ENC-2025-123456",
  "synced": true,
  "sync_timestamp": "2025-01-18T10:35:00Z"
}
```

---

## Updated Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PAYMENT FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Patient Books Consultation
          │
          ▼
┌─────────────────────┐
│ Check Payment Type  │
└─────────────────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
Medical Aid   Cash/Card
    │           │
    ▼           │
┌─────────────────────┐    │
│ HealthBridge        │    │
│ Benefit Check       │    │
└─────────────────────┘    │
    │                      │
    ├── Eligible ──────────┤
    │                      │
    ▼                      ▼
┌─────────────────────┐   ┌─────────────────────┐
│ Pre-auth if needed  │   │ PayGate             │
│ (HealthBridge)      │   │ Card Payment        │
└─────────────────────┘   └─────────────────────┘
    │                      │
    ▼                      │
┌─────────────────────┐    │
│ Consultation        │◀───┘
│ Happens             │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Submit Claim        │
│ (HealthBridge)      │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Receive Payment     │
│ (Medical Aid → HCF) │
└─────────────────────┘
```

---

## What This Means for Development

### Reduced Integration Complexity
| Before | After |
|--------|-------|
| HealthBridge (EHR) | HealthBridge (EHR + Switch) |
| Discovery API | ❌ Not needed |
| Momentum API | ❌ Not needed |
| Bonitas API | ❌ Not needed |
| GEMS API | ❌ Not needed |
| PayGate (Cards) | PayGate (Cards) |
| **6+ integrations** | **2 integrations** |

### Single API for Medical Aid Functions
- ✅ One API endpoint for benefit checks (all schemes)
- ✅ One API endpoint for claims submission (all schemes)
- ✅ One API endpoint for authorization (all schemes)
- ✅ Standardized response format
- ✅ HealthBridge handles scheme-specific logic

### Required HealthBridge Credentials
To fully integrate, you need from HealthBridge:
1. **API Base URL** (prod/staging)
2. **API Key or OAuth credentials**
3. **Practice Number** (for provider identification)
4. **Merchant ID** (for claims)
5. **API Documentation** (endpoint specifications)

---

## Updated Placeholder Services

I'll update the `healthbridge_service.py` to reflect this dual-role architecture:

```python
# HealthBridge Service - Dual Role (EHR + Switch)

class HealthBridgeService:
    """
    HealthBridge Integration Service
    
    HealthBridge serves dual roles:
    1. EHR (Electronic Health Records) - Patient data, clinical notes
    2. Medical Aid Switch - Benefit checks, claims processing
    """
    
    # EHR Functions
    async def lookup_patient(self, id_number: str) -> PatientLookupResult
    async def get_medical_history(self, patient_id: str) -> MedicalHistory
    async def sync_encounter(self, encounter_data: dict) -> SyncResult
    
    # Switch Functions  
    async def check_benefits(self, membership: str, service_type: str) -> BenefitResult
    async def request_preauth(self, auth_request: dict) -> AuthResult
    async def submit_claim(self, claim_data: dict) -> ClaimResult
    async def get_claim_status(self, claim_ref: str) -> ClaimStatus
```

---

## Next Steps

1. **Get HealthBridge API documentation** - Request full API specs
2. **Get API credentials** - Staging/production keys
3. **Update placeholder service** - Implement real API calls
4. **Test benefit checks** - Verify with test medical aid numbers
5. **Test claims submission** - Submit test claims

---

*Document updated: January 2025*
*Understanding: HealthBridge = EHR + Medical Aid Switch*
