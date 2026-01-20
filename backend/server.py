from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import logging
import os

# Configuration
from config import MONGO_URL, DB_NAME, CORS_ORIGINS

# Route imports
from routes.appointments import router as appointments_router
from routes.prescriptions import router as prescriptions_router
from routes.clinical_notes import router as clinical_notes_router
from routes.users import router as users_router
from routes.auth import router as auth_router
from routes.patient_onboarding import router as patient_onboarding_router
from routes.symptom_assessment import router as symptom_assessment_router
from routes.nurse_triage import router as nurse_triage_router
from routes.chat import router as chat_router
from routes.bookings import router as bookings_router

# Analytics (existing)
from analytics_service import get_full_analytics_dashboard, get_analytics_overview

# Auth
from auth import get_current_user, require_admin, AuthenticatedUser

# OpenAI API key is loaded from .env automatically

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Create the main app
app = FastAPI(
    title="HCF Telehealth API",
    description="Backend API for HCF Telehealth Platform - Full REST API with HealthBridge Integration",
    version="2.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Create main API router with /api prefix
api_router = APIRouter(prefix="/api")


# ============ Health Check Routes ============

@api_router.get("/")
async def root():
    return {
        "message": "HCF Telehealth API",
        "version": "2.0.0",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

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


# ============ Analytics Routes ============

@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard(
    days: int = Query(30, ge=7, le=365),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get complete analytics dashboard data"""
    try:
        return await get_full_analytics_dashboard(days)
    except Exception as e:
        logging.error(f"Analytics dashboard failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analytics/overview")
async def get_overview_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get overview analytics metrics"""
    try:
        return await get_analytics_overview(start_date, end_date)
    except Exception as e:
        logging.error(f"Analytics overview failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Audit Log Routes (MongoDB) ============

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
async def create_audit_log(
    data: AuditLogCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create an audit log entry"""
    log_entry = AuditLogEntry(**data.dict())
    await db.audit_logs.insert_one(log_entry.dict())
    return log_entry

@api_router.get("/audit-logs", response_model=List[AuditLogEntry])
async def get_audit_logs(
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    admin: AuthenticatedUser = Depends(require_admin)
):
    """Get audit logs with optional filtering (admin only)"""
    query = {}
    if user_id:
        query["user_id"] = user_id
    if resource_type:
        query["resource_type"] = resource_type
    
    logs = await db.audit_logs.find(query).sort("timestamp", -1).to_list(limit)
    return [AuditLogEntry(**log) for log in logs]


# ============ Status Check Routes (for testing) ============

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

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


# ============ Include All Routers ============

# Main API router
app.include_router(api_router)

# Feature routers (already have /api prefix handled)
app.include_router(appointments_router, prefix="/api")
app.include_router(prescriptions_router, prefix="/api")
app.include_router(clinical_notes_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(auth_router, prefix="/api")

# New feature routers for Phase 1 completion
app.include_router(patient_onboarding_router, prefix="/api")
app.include_router(symptom_assessment_router, prefix="/api")
app.include_router(nurse_triage_router, prefix="/api")

# Phase 2: Chat-based booking system
app.include_router(chat_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")


# ============ Middleware ============

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Logging ============

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============ Startup/Shutdown ============

@app.on_event("startup")
async def startup():
    logger.info("HCF Telehealth API starting up...")
    logger.info(f"API docs available at /api/docs")

@app.on_event("shutdown")
async def shutdown_db_client():
    logger.info("HCF Telehealth API shutting down...")
    client.close()
