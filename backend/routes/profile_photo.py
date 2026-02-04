"""
Profile Photo Upload API
Handles selfie/photo uploads to Supabase Storage
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
import logging
import httpx
import base64
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile-photo", tags=["Profile Photo"])

STORAGE_BUCKET = "profile-photos"


class PhotoUploadRequest(BaseModel):
    image_data: str  # Base64 encoded image data (data:image/jpeg;base64,...)


class PhotoUploadResponse(BaseModel):
    success: bool
    photo_url: Optional[str] = None
    message: str


async def ensure_bucket_exists():
    """Create the storage bucket if it doesn't exist"""
    url = f"{SUPABASE_URL}/storage/v1/bucket/{STORAGE_BUCKET}"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }
    
    async with httpx.AsyncClient() as client:
        # Check if bucket exists
        response = await client.get(url, headers=headers)
        
        if response.status_code == 404:
            # Create bucket
            create_url = f"{SUPABASE_URL}/storage/v1/bucket"
            bucket_data = {
                "id": STORAGE_BUCKET,
                "name": STORAGE_BUCKET,
                "public": False,  # Private bucket - requires auth to access
                "file_size_limit": 5242880,  # 5MB max
                "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"]
            }
            create_response = await client.post(create_url, json=bucket_data, headers=headers)
            
            if create_response.status_code not in [200, 201]:
                logger.error(f"Failed to create bucket: {create_response.text}")
            else:
                logger.info(f"Created storage bucket: {STORAGE_BUCKET}")


@router.post("/upload", response_model=PhotoUploadResponse)
async def upload_profile_photo(
    data: PhotoUploadRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Upload a profile photo (selfie) for the current user.
    Accepts base64 encoded image data.
    """
    try:
        # Parse base64 data
        if not data.image_data.startswith('data:image/'):
            raise HTTPException(status_code=400, detail="Invalid image data format")
        
        # Extract mime type and base64 content
        header, base64_content = data.image_data.split(',', 1)
        mime_type = header.split(':')[1].split(';')[0]
        
        if mime_type not in ['image/jpeg', 'image/png', 'image/webp']:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")
        
        # Decode base64
        try:
            image_bytes = base64.b64decode(base64_content)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        
        # Check file size (max 5MB)
        if len(image_bytes) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image size must be less than 5MB")
        
        # Generate unique filename
        extension = mime_type.split('/')[1]
        filename = f"{user.id}/{uuid.uuid4()}.{extension}"
        
        # Ensure bucket exists
        await ensure_bucket_exists()
        
        # Upload to Supabase Storage
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{filename}"
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': mime_type,
            'x-upsert': 'true'  # Overwrite if exists
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(upload_url, content=image_bytes, headers=headers)
            
            if response.status_code not in [200, 201]:
                logger.error(f"Storage upload failed: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Failed to upload photo")
        
        # Generate public URL (signed URL for private bucket)
        # For simplicity, we'll store the path and generate signed URLs when needed
        photo_path = f"{STORAGE_BUCKET}/{filename}"
        
        # Update user profile with photo path
        update_result = await supabase.update(
            'profiles',
            {'id': user.id},
            {
                'profile_photo_path': photo_path,
                'profile_photo_updated_at': datetime.utcnow().isoformat()
            },
            user.access_token
        )
        
        if not update_result:
            logger.warning(f"Failed to update profile with photo path for user {user.id}")
        
        # Generate signed URL for immediate use
        signed_url = await get_signed_url(photo_path)
        
        logger.info(f"Profile photo uploaded for user {user.id}: {filename}")
        
        return PhotoUploadResponse(
            success=True,
            photo_url=signed_url,
            message="Photo uploaded successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload photo")


async def get_signed_url(photo_path: str, expires_in: int = 3600) -> str:
    """Generate a signed URL for accessing a private photo"""
    if not photo_path:
        return None
    
    # Extract bucket and filename from path
    parts = photo_path.split('/', 1)
    if len(parts) != 2:
        return None
    
    bucket, filename = parts
    
    url = f"{SUPABASE_URL}/storage/v1/object/sign/{bucket}/{filename}"
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json'
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json={'expiresIn': expires_in},
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            signed_path = data.get('signedURL', '')
            if signed_path:
                return f"{SUPABASE_URL}/storage/v1{signed_path}"
    
    return None


@router.get("/url/{user_id}")
async def get_profile_photo_url(
    user_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a signed URL for a user's profile photo"""
    # Get user's profile to find photo path
    profile = await supabase.select('profiles', 'profile_photo_path', {'id': user_id})
    
    if not profile or not profile[0].get('profile_photo_path'):
        return {"success": True, "photo_url": None, "message": "No photo found"}
    
    photo_path = profile[0]['profile_photo_path']
    signed_url = await get_signed_url(photo_path)
    
    return {
        "success": True,
        "photo_url": signed_url,
        "message": "Photo URL generated"
    }


@router.delete("/")
async def delete_profile_photo(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete the current user's profile photo"""
    # Get current photo path
    profile = await supabase.select('profiles', 'profile_photo_path', {'id': user.id})
    
    if not profile or not profile[0].get('profile_photo_path'):
        return {"success": True, "message": "No photo to delete"}
    
    photo_path = profile[0]['profile_photo_path']
    parts = photo_path.split('/', 1)
    
    if len(parts) == 2:
        bucket, filename = parts
        
        # Delete from storage
        delete_url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{filename}"
        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
        }
        
        async with httpx.AsyncClient() as client:
            await client.delete(delete_url, headers=headers)
    
    # Clear profile photo path
    await supabase.update(
        'profiles',
        {'id': user.id},
        {'profile_photo_path': None, 'profile_photo_updated_at': None},
        user.access_token
    )
    
    return {"success": True, "message": "Photo deleted"}
