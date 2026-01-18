from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from supabase_client import supabase
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    """Represents an authenticated user"""
    def __init__(self, user_id: str, email: str, role: Optional[str] = None, profile: Optional[Dict] = None, access_token: Optional[str] = None):
        self.id = user_id
        self.email = email
        self.role = role
        self.profile = profile or {}
        self.access_token = access_token  # Store the user's JWT for making authenticated requests


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> AuthenticatedUser:
    """Extract and validate user from JWT token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    
    try:
        # Verify token with Supabase
        user_data = await supabase.get_user_from_token(token)
        
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_id = user_data.get('id')
        email = user_data.get('email', '')
        
        # Get user role from user_roles table
        roles = await supabase.select(
            'user_roles',
            'role',
            filters={'user_id': user_id},
            access_token=token
        )
        role = roles[0]['role'] if roles else 'patient'
        
        # Get user profile
        profiles = await supabase.select(
            'profiles',
            '*',
            filters={'id': user_id},
            access_token=token
        )
        profile = profiles[0] if profiles else {}
        
        return AuthenticatedUser(
            user_id=user_id,
            email=email,
            role=role,
            profile=profile
        )
        
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Optional[AuthenticatedUser]:
    """Get user if authenticated, None otherwise"""
    if not credentials:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(*allowed_roles: str):
    """Dependency to require specific roles"""
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return user
    return role_checker


# Convenience dependencies
require_patient = require_role('patient', 'nurse', 'doctor', 'admin')
require_clinician = require_role('nurse', 'doctor', 'admin')
require_doctor = require_role('doctor', 'admin')
require_admin = require_role('admin')
