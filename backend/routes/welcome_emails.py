"""
Welcome Email Service for Campus Africa Students
Sends personalized welcome emails using Resend API
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from job_manager import job_manager, JobStatus, ImportJob
import logging
import os
import asyncio
import httpx
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/welcome-emails", tags=["Welcome Emails"])

# Resend Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
RESEND_API_URL = "https://api.resend.com/emails"

# Email Configuration - Update these for production
DEFAULT_FROM_EMAIL = "Quadcare <onboarding@resend.dev>"  # Change to your verified domain
LOGIN_URL = "https://campusafrica-reg.preview.emergentagent.com/auth"  # Update for production


class EmailJobStatus:
    """Track email sending job status"""
    def __init__(self, job_id: str, total: int):
        self.id = job_id
        self.status = "pending"
        self.total = total
        self.sent = 0
        self.failed = 0
        self.processed = 0
        self.started_at = datetime.utcnow()
        self.completed_at = None
        self.errors: List[dict] = []
    
    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "total": self.total,
            "sent": self.sent,
            "failed": self.failed,
            "processed": self.processed,
            "progress_percent": round((self.processed / self.total * 100) if self.total > 0 else 0, 1),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "errors": self.errors[-20:]  # Last 20 errors
        }


# In-memory job storage
email_jobs = {}


def get_welcome_email_html(first_name: str, login_url: str) -> str:
    """Generate the welcome email HTML"""
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Quadcare</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                                Welcome to Quadcare
                            </h1>
                            <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 16px;">
                                Your Student Health Portal
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">
                                Hi {first_name}! 👋
                            </h2>
                            
                            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Great news! Your Quadcare Telehealth account has been set up through 
                                <strong>Campus Africa</strong>. You now have access to quality healthcare 
                                services from anywhere.
                            </p>
                            
                            <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                                <h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 16px;">
                                    🏥 What you can do:
                                </h3>
                                <ul style="color: #475569; margin: 0; padding-left: 20px; line-height: 1.8;">
                                    <li>Book video consultations with qualified doctors</li>
                                    <li>Chat with our healthcare team</li>
                                    <li>Access your medical records securely</li>
                                    <li>Get prescriptions and referrals</li>
                                </ul>
                            </div>
                            
                            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                To get started, click the button below to set your password and access your account:
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="{login_url}" 
                                           style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                                            Sign In to Quadcare →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                                When you sign in for the first time, you'll be prompted to create a secure password.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px; border-top: 1px solid #e2e8f0;">
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td style="text-align: center;">
                                        <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">
                                            Need help? Contact us at 
                                            <a href="mailto:support@quadcare.co.za" style="color: #2563eb; text-decoration: none;">
                                                support@quadcare.co.za
                                            </a>
                                        </p>
                                        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                                            © 2025 Quadcare Telehealth. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


async def send_single_email(email: str, first_name: str, from_email: str, login_url: str) -> dict:
    """Send a single welcome email using Resend"""
    if not RESEND_API_KEY:
        return {"success": False, "error": "Resend API key not configured"}
    
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "from": from_email,
        "to": [email],
        "subject": f"Welcome to Quadcare, {first_name}! 🏥 Set Up Your Account",
        "html": get_welcome_email_html(first_name, login_url)
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(RESEND_API_URL, json=payload, headers=headers)
            
            if response.status_code in [200, 201]:
                return {"success": True, "id": response.json().get("id")}
            else:
                logger.error(f"Resend API error for {email}: {response.status_code} - {response.text}")
                return {"success": False, "error": f"API error: {response.status_code}"}
    except Exception as e:
        logger.error(f"Failed to send email to {email}: {e}")
        return {"success": False, "error": str(e)}


async def process_email_batch(job_id: str, students: List[dict], from_email: str, login_url: str):
    """Background task to send emails in batches"""
    job = email_jobs.get(job_id)
    if not job:
        return
    
    job.status = "running"
    
    # Send emails with rate limiting (100 per minute = ~1.7 per second)
    batch_size = 10
    delay_between_batches = 6  # seconds (10 emails every 6 seconds = 100/minute)
    
    for i in range(0, len(students), batch_size):
        batch = students[i:i + batch_size]
        
        for student in batch:
            email = student.get("email", "")
            first_name = student.get("first_name", "Student")
            
            if not email:
                job.failed += 1
                job.processed += 1
                continue
            
            result = await send_single_email(email, first_name, from_email, login_url)
            
            if result["success"]:
                job.sent += 1
            else:
                job.failed += 1
                job.errors.append({
                    "email": email,
                    "error": result.get("error", "Unknown error")
                })
            
            job.processed += 1
        
        # Rate limiting delay between batches
        if i + batch_size < len(students):
            await asyncio.sleep(delay_between_batches)
    
    job.status = "completed"
    job.completed_at = datetime.utcnow()
    logger.info(f"Email job {job_id} completed: {job.sent} sent, {job.failed} failed")


class SendEmailsRequest(BaseModel):
    from_email: Optional[str] = DEFAULT_FROM_EMAIL
    login_url: Optional[str] = LOGIN_URL
    test_mode: bool = False  # If true, only send to first 5 students
    corporate_client_id: Optional[str] = None  # Filter by corporate client


@router.get("/preview")
async def preview_recipients(
    corporate_client_id: Optional[str] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Preview the list of students who will receive welcome emails.
    Only shows bulk-imported users who haven't logged in yet.
    """
    # Check admin role
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Fetch all profiles that have a corporate_client_id (bulk-imported)
    profiles_url = f"{SUPABASE_URL}/rest/v1/profiles"
    profile_headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    all_profiles = []
    offset = 0
    limit = 1000
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            params = {
                'select': 'id,first_name,last_name,corporate_client_id',
                'corporate_client_id': 'not.is.null',
                'offset': str(offset),
                'limit': str(limit)
            }
            # Filter by specific corporate client if provided
            if corporate_client_id:
                params['corporate_client_id'] = f'eq.{corporate_client_id}'
            
            response = await client.get(profiles_url, params=params, headers=profile_headers)
            
            if response.status_code not in [200, 206]:
                logger.error(f"Failed to fetch profiles: {response.status_code} - {response.text}")
                break
            
            profiles = response.json()
            all_profiles.extend(profiles)
            
            if len(profiles) < limit:
                break
            offset += limit
    
    # Create a lookup dict for profiles
    profile_map = {p['id']: p for p in all_profiles}
    logger.info(f"Found {len(profile_map)} bulk-imported profiles with corporate_client_id")
    
    # Now get auth users who haven't signed in
    auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    eligible_students = []
    page = 1
    per_page = 1000
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            response = await client.get(
                auth_url,
                params={'page': page, 'per_page': per_page},
                headers=headers
            )
            
            if response.status_code != 200:
                break
            
            users = response.json().get('users', [])
            if not users:
                break
            
            for u in users:
                user_id = u['id']
                
                # Check if this user is in our bulk-imported profiles
                if user_id not in profile_map:
                    continue
                
                # Check if user hasn't signed in
                if u.get('last_sign_in_at') is not None:
                    continue
                
                profile = profile_map[user_id]
                eligible_students.append({
                    "id": user_id,
                    "email": u.get('email'),
                    "first_name": profile.get('first_name', ''),
                    "last_name": profile.get('last_name', ''),
                    "created_at": u.get('created_at')
                })
            
            if len(users) < per_page:
                break
            page += 1
    
    logger.info(f"Found {len(eligible_students)} eligible students for welcome emails")
    
    return {
        "success": True,
        "total_eligible": len(eligible_students),
        "preview": eligible_students[:20],  # First 20 for preview
        "message": f"Found {len(eligible_students)} students eligible for welcome emails"
    }


@router.post("/send")
async def send_welcome_emails(
    data: SendEmailsRequest,
    background_tasks: BackgroundTasks,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Send welcome emails to all eligible Campus Africa students.
    Runs in background with progress tracking.
    """
    # Check admin role
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Resend API key not configured")
    
    # First, fetch all profiles with import_status = 'imported' in one query
    profile_query = {'import_status': 'eq.imported'}
    if data.corporate_client_id:
        profile_query['corporate_client_id'] = f'eq.{data.corporate_client_id}'
    
    profiles_url = f"{SUPABASE_URL}/rest/v1/profiles"
    profile_headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    all_profiles = []
    offset = 0
    limit = 1000
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            params = {
                'select': 'id,first_name',
                'import_status': 'eq.imported',
                'offset': offset,
                'limit': limit
            }
            if data.corporate_client_id:
                params['corporate_client_id'] = f'eq.{data.corporate_client_id}'
            
            response = await client.get(profiles_url, params=params, headers=profile_headers)
            
            if response.status_code not in [200, 206]:
                break
            
            profiles = response.json()
            all_profiles.extend(profiles)
            
            if len(profiles) < limit:
                break
            offset += limit
    
    profile_map = {p['id']: p for p in all_profiles}
    
    # Get auth users who haven't signed in
    auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    eligible_students = []
    page = 1
    per_page = 1000
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        while True:
            response = await client.get(
                auth_url,
                params={'page': page, 'per_page': per_page},
                headers=headers
            )
            
            if response.status_code != 200:
                break
            
            users = response.json().get('users', [])
            if not users:
                break
            
            for u in users:
                user_id = u['id']
                
                if user_id not in profile_map:
                    continue
                
                if u.get('last_sign_in_at') is not None:
                    continue
                
                profile = profile_map[user_id]
                eligible_students.append({
                    "email": u.get('email'),
                    "first_name": profile.get('first_name', 'Student'),
                })
            
            if len(users) < per_page:
                break
            page += 1
            page += 1
    
    if not eligible_students:
        return {
            "success": False,
            "message": "No eligible students found for welcome emails"
        }
    
    # In test mode, only send to first 5
    if data.test_mode:
        eligible_students = eligible_students[:5]
        logger.info(f"Test mode: limiting to {len(eligible_students)} students")
    
    # Create job
    job_id = str(uuid.uuid4())
    job = EmailJobStatus(job_id, len(eligible_students))
    email_jobs[job_id] = job
    
    # Start background task
    background_tasks.add_task(
        process_email_batch,
        job_id,
        eligible_students,
        data.from_email,
        data.login_url
    )
    
    return {
        "success": True,
        "job_id": job_id,
        "total_recipients": len(eligible_students),
        "message": f"Started sending welcome emails to {len(eligible_students)} students",
        "test_mode": data.test_mode
    }


@router.get("/jobs/{job_id}")
async def get_email_job_status(
    job_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get the status of an email sending job"""
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    job = email_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "success": True,
        "job": job.to_dict()
    }


@router.get("/jobs")
async def list_email_jobs(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """List all email jobs"""
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    jobs = [job.to_dict() for job in email_jobs.values()]
    jobs.sort(key=lambda x: x['started_at'] or '', reverse=True)
    
    return {
        "success": True,
        "jobs": jobs[:20]  # Last 20 jobs
    }


@router.post("/test")
async def send_test_email(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Send a test email to the admin's email"""
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Resend API key not configured")
    
    # Get admin's profile
    profile = await supabase.select('profiles', 'first_name', {'id': user.id})
    first_name = profile[0].get('first_name', 'Admin') if profile else 'Admin'
    
    # Get admin's email from auth
    url = f"{SUPABASE_URL}/auth/v1/admin/users/{user.id}"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Could not fetch admin email")
        
        admin_email = response.json().get('email')
    
    if not admin_email:
        raise HTTPException(status_code=400, detail="Admin email not found")
    
    # Send test email
    result = await send_single_email(
        admin_email,
        first_name,
        DEFAULT_FROM_EMAIL,
        LOGIN_URL
    )
    
    if result["success"]:
        return {
            "success": True,
            "message": f"Test email sent to {admin_email}",
            "email_id": result.get("id")
        }
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test email: {result.get('error')}"
        )
