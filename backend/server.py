from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

from models import (
    PrescriptionPDFRequest,
    PrescriptionPDFResponse,
    AnalyticsDashboard,
    AnalyticsOverview,
    DateRangeFilter
)
from pdf_generator import generate_prescription_pdf
from analytics_service import (
    get_analytics_overview,
    get_appointment_trends,
    get_consultation_type_stats,
    get_status_distribution,
    get_clinician_performance,
    get_patient_growth,
    get_full_analytics_dashboard
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'hcf_telehealth')]

# Create the main app without a prefix
app = FastAPI(
    title="HCF Telehealth API",
    description="Backend API for HCF Telehealth Platform",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str


# ============ Health Check Routes ============

@api_router.get("/")
async def root():
    return {"message": "HCF Telehealth API", "version": "1.0.0", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "api": "running",
            "database": "connected"
        }
    }

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ============ Prescription PDF Routes ============

@api_router.post("/prescriptions/generate-pdf", response_model=PrescriptionPDFResponse)
async def generate_prescription_pdf_endpoint(data: PrescriptionPDFRequest):
    """Generate a PDF for a prescription"""
    try:
        pdf_base64 = generate_prescription_pdf(data)
        
        # Log PDF generation
        await db.pdf_generation_logs.insert_one({
            "id": str(uuid.uuid4()),
            "prescription_id": data.prescription_id,
            "patient_name": data.patient_name,
            "clinician_name": data.clinician_name,
            "generated_at": datetime.utcnow().isoformat(),
            "success": True
        })
        
        return PrescriptionPDFResponse(success=True, pdf_base64=pdf_base64)
    except Exception as e:
        logging.error(f"PDF generation failed: {str(e)}")
        
        # Log failure
        await db.pdf_generation_logs.insert_one({
            "id": str(uuid.uuid4()),
            "prescription_id": data.prescription_id,
            "generated_at": datetime.utcnow().isoformat(),
            "success": False,
            "error": str(e)
        })
        
        return PrescriptionPDFResponse(success=False, error=str(e))


# ============ Analytics Routes ============

@api_router.get("/analytics/overview", response_model=AnalyticsOverview)
async def get_overview_analytics(
    start_date: Optional[str] = Query(None, description="Start date for filtering"),
    end_date: Optional[str] = Query(None, description="End date for filtering")
):
    """Get overview analytics metrics"""
    try:
        return await get_analytics_overview(start_date, end_date)
    except Exception as e:
        logging.error(f"Analytics overview failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/appointment-trends")
async def get_appointment_trends_endpoint(
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze")
):
    """Get appointment trends over time"""
    try:
        trends = await get_appointment_trends(days)
        return {"trends": trends}
    except Exception as e:
        logging.error(f"Appointment trends failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/consultation-types")
async def get_consultation_types_endpoint():
    """Get breakdown by consultation type"""
    try:
        stats = await get_consultation_type_stats()
        return stats
    except Exception as e:
        logging.error(f"Consultation types failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/status-distribution")
async def get_status_distribution_endpoint():
    """Get appointment status distribution"""
    try:
        distribution = await get_status_distribution()
        return {"distribution": distribution}
    except Exception as e:
        logging.error(f"Status distribution failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/clinician-performance")
async def get_clinician_performance_endpoint():
    """Get clinician performance metrics"""
    try:
        performance = await get_clinician_performance()
        return {"clinicians": performance}
    except Exception as e:
        logging.error(f"Clinician performance failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/patient-growth")
async def get_patient_growth_endpoint(
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze")
):
    """Get patient growth over time"""
    try:
        growth = await get_patient_growth(days)
        return {"growth": growth}
    except Exception as e:
        logging.error(f"Patient growth failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/dashboard", response_model=AnalyticsDashboard)
async def get_analytics_dashboard(
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze")
):
    """Get complete analytics dashboard data"""
    try:
        return await get_full_analytics_dashboard(days)
    except Exception as e:
        logging.error(f"Analytics dashboard failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Audit Log Routes ============

class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AuditLogCreate(BaseModel):
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None

@api_router.post("/audit-logs", response_model=AuditLogEntry)
async def create_audit_log(data: AuditLogCreate):
    """Create an audit log entry"""
    log_entry = AuditLogEntry(**data.dict())
    await db.audit_logs.insert_one(log_entry.dict())
    return log_entry

@api_router.get("/audit-logs", response_model=List[AuditLogEntry])
async def get_audit_logs(
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get audit logs with optional filtering"""
    query = {}
    if user_id:
        query["user_id"] = user_id
    if resource_type:
        query["resource_type"] = resource_type
    
    logs = await db.audit_logs.find(query).sort("timestamp", -1).to_list(limit)
    return [AuditLogEntry(**log) for log in logs]


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
