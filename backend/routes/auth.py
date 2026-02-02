from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from schemas import PasswordResetRequest, PasswordResetConfirm, APIResponse
from supabase_client import supabase
from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
import httpx
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

# Environment toggle for sending emails (disabled during testing)
SEND_VERIFICATION_EMAILS = os.environ.get('SEND_VERIFICATION_EMAILS', 'false').lower() == 'true'


class CheckAccountRequest(BaseModel):
    email: EmailStr


class SendSetupLinkRequest(BaseModel):
    email: EmailStr


@router.post("/check-account")
async def check_account(data: CheckAccountRequest):
    """
    Check if an account exists and its status.
    Used by login page to detect bulk-imported users who need to set password.
    """
    try:
        email = data.email.lower().strip()
        logger.info(f"Checking account for email: {email}")
        
        # Use Supabase Admin API to get user by email directly
        # This is more efficient than fetching all users
        url = f"{SUPABASE_URL}/auth/v1/admin/users"
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
        }
        
        user = None
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Search through pages to find the user
            page = 1
            per_page = 1000  # Fetch more users per page for efficiency
            
            while True:
                response = await client.get(
                    url, 
                    params={'page': page, 'per_page': per_page},
                    headers=headers
                )
                
                if response.status_code != 200:
                    logger.error(f"Failed to fetch users: {response.status_code} - {response.text}")
                    break
                
                users_data = response.json()
                users = users_data.get('users', [])
                
                if not users:
                    break
                
                # Find user by email in this page
                user = next((u for u in users if u.get('email', '').lower() == email), None)
                
                if user:
                    logger.info(f"Found user {email} on page {page}")
                    break
                
                # If we got fewer users than requested, we've reached the end
                if len(users) < per_page:
                    break
                    
                page += 1
                
                # Safety limit to prevent infinite loops
                if page > 10:
                    logger.warning(f"Reached page limit while searching for {email}")
                    break
        
        if not user:
            logger.info(f"No account found for email: {email}")
            return APIResponse(
                success=True,
                data={
                    'exists': False,
                    'needs_password_setup': False
                }
            )
        
        # Check if this is a bulk-imported user (has metadata flag and no password set)
        metadata = user.get('user_metadata', {})
        is_bulk_imported = metadata.get('imported_from') == 'campus_africa_bulk'
        
        # Get user's profile to retrieve their name
        profile = await supabase.select('profiles', 'first_name,last_name', {'id': user['id']})
        first_name = profile[0].get('first_name', '') if profile else ''
        
        # Check if user has ever signed in (indicates password was set)
        last_sign_in = user.get('last_sign_in_at')
        needs_password = is_bulk_imported and last_sign_in is None
        
        logger.info(f"Account check result for {email}: exists=True, needs_password={needs_password}, is_bulk={is_bulk_imported}")
        
        return APIResponse(
            success=True,
            data={
                'exists': True,
                'needs_password_setup': needs_password,
                'first_name': first_name,
                'is_bulk_imported': is_bulk_imported
            }
        )
            
    except Exception as e:
        logger.error(f"Check account error: {e}")
        return APIResponse(
            success=True,
            data={'exists': False, 'needs_password_setup': False}
        )


@router.post("/send-setup-link")
async def send_setup_link(data: SendSetupLinkRequest):
    """
    Send a password setup link to a bulk-imported user.
    Uses Supabase's password recovery flow which sends a magic link.
    """
    try:
        email = data.email.lower().strip()
        
        if not SEND_VERIFICATION_EMAILS:
            # During testing, don't actually send emails
            logger.info(f"[TEST MODE] Would send setup link to {email}")
            return APIResponse(
                success=True,
                message="Setup link will be sent when the system goes live. For testing, please contact admin.",
                data={'email_sent': False, 'test_mode': True}
            )
        
        # Use Supabase password recovery to send magic link
        url = f"{SUPABASE_URL}/auth/v1/recover"
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                json={'email': email},
                headers=headers
            )
            
            if response.status_code in [200, 204]:
                return APIResponse(
                    success=True,
                    message="A link to set your password has been sent to your email.",
                    data={'email_sent': True}
                )
            else:
                logger.error(f"Send setup link failed: {response.text}")
                return APIResponse(
                    success=False,
                    message="Failed to send setup link. Please try again."
                )
                
    except Exception as e:
        logger.error(f"Send setup link error: {e}")
        return APIResponse(
            success=False,
            message="Failed to send setup link. Please try again."
        )


@router.post("/password/reset-request")
async def request_password_reset(data: PasswordResetRequest):
    """
    Request a password reset email.
    Uses Supabase's built-in password reset functionality.
    """
    try:
        # Call Supabase password reset endpoint
        url = f"{SUPABASE_URL}/auth/v1/recover"
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={'email': data.email},
                headers=headers
            )
            
            # Supabase returns 200 even if email doesn't exist (security)
            if response.status_code in [200, 204]:
                return APIResponse(
                    success=True,
                    message="If an account exists with this email, a password reset link has been sent."
                )
            else:
                logger.error(f"Password reset request failed: {response.text}")
                return APIResponse(
                    success=True,  # Don't reveal if email exists
                    message="If an account exists with this email, a password reset link has been sent."
                )
                
    except Exception as e:
        logger.error(f"Password reset error: {e}")
        # Don't reveal errors to prevent email enumeration
        return APIResponse(
            success=True,
            message="If an account exists with this email, a password reset link has been sent."
        )


@router.post("/password/reset-confirm")
async def confirm_password_reset(data: PasswordResetConfirm):
    """
    Confirm password reset with token.
    Note: Supabase handles this via their hosted UI typically.
    This endpoint is for custom implementations.
    """
    try:
        # Verify token and update password via Supabase
        url = f"{SUPABASE_URL}/auth/v1/user"
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {data.token}',
            'Content-Type': 'application/json'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                json={'password': data.new_password},
                headers=headers
            )
            
            if response.status_code == 200:
                return APIResponse(
                    success=True,
                    message="Password has been reset successfully."
                )
            else:
                logger.error(f"Password reset confirm failed: {response.text}")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired reset token."
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset confirm error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to reset password."
        )


@router.get("/verify-token")
async def verify_token(token: str):
    """
    Verify if a JWT token is valid.
    Returns user info if valid.
    """
    try:
        user_data = await supabase.get_user_from_token(token)
        
        if user_data:
            return APIResponse(
                success=True,
                data={
                    'id': user_data.get('id'),
                    'email': user_data.get('email'),
                    'valid': True
                }
            )
        else:
            return APIResponse(
                success=False,
                message="Invalid or expired token",
                data={'valid': False}
            )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return APIResponse(
            success=False,
            message="Token verification failed",
            data={'valid': False}
        )
