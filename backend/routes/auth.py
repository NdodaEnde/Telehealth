from fastapi import APIRouter, HTTPException
from schemas import PasswordResetRequest, PasswordResetConfirm, APIResponse
from supabase_client import supabase
from config import SUPABASE_URL, SUPABASE_ANON_KEY
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


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
