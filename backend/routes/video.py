"""
Daily.co Video Consultation Routes
Handles room creation and meeting token generation
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
import httpx
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video", tags=["Video Consultation"])

# Daily.co Configuration
DAILY_API_KEY = os.environ.get("DAILY_API_KEY", "")
DAILY_DOMAIN = os.environ.get("DAILY_DOMAIN", "")
DAILY_API_URL = "https://api.daily.co/v1"

# ============ Models ============

class CreateRoomRequest(BaseModel):
    appointment_id: str
    
class CreateRoomResponse(BaseModel):
    room_name: str
    room_url: str
    expires_at: Optional[str] = None

class CreateTokenRequest(BaseModel):
    room_name: str
    user_name: str
    is_owner: bool = False

class CreateTokenResponse(BaseModel):
    token: str
    room_url: str

class RoomInfo(BaseModel):
    name: str
    url: str
    created_at: str
    privacy: str

# ============ Helper Functions ============

async def daily_request(method: str, endpoint: str, data: dict = None) -> dict:
    """Make a request to Daily.co API"""
    if not DAILY_API_KEY:
        raise HTTPException(status_code=500, detail="Daily.co API key not configured")
    
    headers = {
        "Authorization": f"Bearer {DAILY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{DAILY_API_URL}{endpoint}"
    
    async with httpx.AsyncClient() as client:
        try:
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            if response.status_code >= 400:
                logger.error(f"Daily.co API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Daily.co API error: {response.text}"
                )
            
            return response.json()
        except httpx.RequestError as e:
            logger.error(f"Daily.co request failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to connect to Daily.co")

async def get_user_profile(user_id: str, access_token: str = None) -> dict:
    """Get user profile from Supabase"""
    profiles = await supabase.select(
        "profiles",
        columns="id, first_name, last_name",
        filters={"id": user_id},
        access_token=access_token
    )
    if profiles:
        return profiles[0]
    return None

async def get_user_role(user_id: str, access_token: str = None) -> str:
    """Get user role from Supabase"""
    roles = await supabase.select(
        "user_roles",
        columns="role",
        filters={"user_id": user_id},
        access_token=access_token
    )
    if roles:
        return roles[0].get("role", "patient")
    return "patient"

# ============ Routes ============

@router.post("/room", response_model=CreateRoomResponse)
async def create_room(
    data: CreateRoomRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Create a Daily.co room for an appointment.
    Room names are based on appointment ID for consistency.
    """
    role = await get_user_role(user.id, user.access_token)
    
    # Get appointment details
    appointments = await supabase.select(
        "appointments",
        columns="*",
        filters={"id": data.appointment_id},
        access_token=user.access_token
    )
    
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment = appointments[0]
    
    # Verify user is part of this appointment
    if role == "patient" and appointment["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if role in ["nurse", "doctor"] and appointment["clinician_id"] != user.id:
        if role not in ["admin", "receptionist"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create room name from appointment ID (sanitized)
    room_name = f"consult-{data.appointment_id[:8]}"
    
    # Room expires 2 hours after scheduled time
    scheduled_at = datetime.fromisoformat(appointment["scheduled_at"].replace('Z', '+00:00'))
    expires_at = scheduled_at + timedelta(hours=2)
    exp_timestamp = int(expires_at.timestamp())
    
    # Check if room already exists
    try:
        existing_room = await daily_request("GET", f"/rooms/{room_name}")
        logger.info(f"Room {room_name} already exists")
        return CreateRoomResponse(
            room_name=room_name,
            room_url=existing_room.get("url", f"https://{DAILY_DOMAIN}/{room_name}"),
            expires_at=expires_at.isoformat()
        )
    except HTTPException as e:
        if e.status_code != 404:
            raise
        # Room doesn't exist, create it
    
    # Create Daily.co room
    room_config = {
        "name": room_name,
        "privacy": "private",  # Requires token to join
        "properties": {
            "exp": exp_timestamp,
            "eject_at_room_exp": True,
            "enable_chat": True,
            "enable_screenshare": True,
            "enable_prejoin_ui": True,
            "enable_knocking": False,
            "enable_people_ui": True,
            "enable_pip_ui": True,
            "enable_emoji_reactions": False,  # Keep it professional
            "enable_hand_raising": False,
            "enable_network_ui": True,
            "enable_noise_cancellation_ui": True,
            "enable_video_processing_ui": True,  # Background blur
            "start_video_off": False,
            "start_audio_off": False,
            "lang": "en",
            "max_participants": 4,  # Patient, clinician, + possible interpreter/observer
        }
    }
    
    room = await daily_request("POST", "/rooms", room_config)
    
    logger.info(f"Created Daily.co room: {room_name} for appointment {data.appointment_id}")
    
    # Update appointment with room info (optional - for tracking)
    await supabase.update(
        "appointments",
        {"notes": f"Daily room: {room_name}"},
        {"id": data.appointment_id},
        user.access_token
    )
    
    return CreateRoomResponse(
        room_name=room_name,
        room_url=room.get("url", f"https://{DAILY_DOMAIN}/{room_name}"),
        expires_at=expires_at.isoformat()
    )

@router.post("/token", response_model=CreateTokenResponse)
async def create_meeting_token(
    data: CreateTokenRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Create a meeting token for a user to join a Daily.co room.
    Tokens include user info and permissions.
    """
    # Get user profile for display name
    profile = await get_user_profile(user.id, user.access_token)
    role = await get_user_role(user.id, user.access_token)
    
    user_name = data.user_name
    if not user_name and profile:
        user_name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
    if not user_name:
        user_name = "Participant"
    
    # Clinicians are owners (can control recording, etc.)
    is_owner = data.is_owner or role in ["nurse", "doctor", "admin"]
    
    # Token expires in 2 hours
    exp_timestamp = int((datetime.utcnow() + timedelta(hours=2)).timestamp())
    
    token_config = {
        "properties": {
            "room_name": data.room_name,
            "user_name": user_name,
            "user_id": user.id,
            "is_owner": is_owner,
            "exp": exp_timestamp,
            "enable_screenshare": True,
            "enable_recording_ui": False,  # Recording disabled for now
            "start_video_off": False,
            "start_audio_off": False,
            "enable_prejoin_ui": True,
        }
    }
    
    token_response = await daily_request("POST", "/meeting-tokens", token_config)
    
    token = token_response.get("token")
    if not token:
        raise HTTPException(status_code=500, detail="Failed to generate meeting token")
    
    room_url = f"https://{DAILY_DOMAIN}/{data.room_name}"
    
    logger.info(f"Generated token for user {user.id} ({user_name}) to join room {data.room_name}")
    
    return CreateTokenResponse(
        token=token,
        room_url=room_url
    )

@router.get("/room/{room_name}", response_model=RoomInfo)
async def get_room(
    room_name: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get information about a Daily.co room"""
    room = await daily_request("GET", f"/rooms/{room_name}")
    
    return RoomInfo(
        name=room.get("name", room_name),
        url=room.get("url", f"https://{DAILY_DOMAIN}/{room_name}"),
        created_at=room.get("created_at", ""),
        privacy=room.get("privacy", "private")
    )

@router.delete("/room/{room_name}")
async def delete_room(
    room_name: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Delete a Daily.co room (admin only)"""
    role = await get_user_role(user.id, user.access_token)
    
    if role not in ["admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await daily_request("DELETE", f"/rooms/{room_name}")
    
    return {"message": f"Room {room_name} deleted"}

@router.get("/health")
async def check_daily_health():
    """Check Daily.co API connectivity"""
    if not DAILY_API_KEY:
        return {"status": "error", "message": "API key not configured"}
    
    try:
        # Try to list rooms (limited to 1) to verify connectivity
        await daily_request("GET", "/rooms?limit=1")
        return {
            "status": "ok", 
            "domain": DAILY_DOMAIN,
            "message": "Daily.co API connected"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
