"""
Chat Routes for Patient-Receptionist Communication (Supabase Version)
Handles chat conversations, messages, and real-time updates
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
import uuid
import logging
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])

# ============ Enums ============

class ChatStatus(str, Enum):
    NEW = "new"
    ACTIVE = "active"
    BOOKING_PENDING = "booking_pending"
    BOOKED = "booked"
    CONSULTATION_COMPLETE = "consultation_complete"
    CLOSED = "closed"

class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"
    BOOKING_CONFIRMATION = "booking_confirmation"

class PatientType(str, Enum):
    MEDICAL_AID = "medical_aid"
    CAMPUS_AFRICA = "campus_africa"
    UNIVERSITY_STUDENT = "university_student"
    CASH = "cash"

# ============ Models ============

class ConversationCreate(BaseModel):
    initial_message: str
    
class ConversationResponse(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    receptionist_id: Optional[str] = None
    receptionist_name: Optional[str] = None
    status: str
    patient_type: Optional[str] = None
    booking_id: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

class MessageCreate(BaseModel):
    content: str
    message_type: MessageType = MessageType.TEXT
    file_url: Optional[str] = None
    file_name: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: Optional[str] = None
    sender_role: str
    content: str
    message_type: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

class ConversationAssign(BaseModel):
    receptionist_id: str

class ConversationStatusUpdate(BaseModel):
    status: ChatStatus

class PatientTypeUpdate(BaseModel):
    patient_type: PatientType

# ============ Helper Functions ============

async def get_user_profile(user_id: str, access_token: str = None):
    """Get user profile from Supabase"""
    # Use full select to avoid column-level RLS issues
    profiles = await supabase.select(
        "profiles",
        columns="*",
        filters={"id": user_id},
        access_token=access_token
    )
    
    # If no results with user token, try without token (uses anon key)
    if not profiles:
        logger.warning(f"Profile not found with user token for {user_id}, trying without token")
        profiles = await supabase.select(
            "profiles",
            columns="*",
            filters={"id": user_id}
        )
    
    if profiles:
        profile = profiles[0]
        logger.info(f"Found profile for {user_id}: {profile.get('first_name')} {profile.get('last_name')}")
        return profile
    
    logger.warning(f"Profile not found for user_id: {user_id}")
    return {"id": user_id, "first_name": "Unknown", "last_name": "User"}

async def get_user_role(user_id: str, access_token: str = None) -> str:
    """Get user role from Supabase"""
    roles = await supabase.select(
        "user_roles",
        columns="role",
        filters={"user_id": user_id},
        access_token=access_token
    )
    
    # If no results with user token, try without token
    if not roles:
        roles = await supabase.select(
            "user_roles",
            columns="role",
            filters={"user_id": user_id}
        )
    
    if roles:
        logger.info(f"Found role for {user_id}: {roles[0].get('role')}")
        return roles[0].get("role", "patient")
    
    logger.warning(f"Role not found for user_id: {user_id}, defaulting to patient")
    return "patient"

def format_name(profile: dict) -> str:
    """Format user's full name"""
    if not profile:
        return "Unknown"
    first = profile.get('first_name', '') or ''
    last = profile.get('last_name', '') or ''
    name = f"{first} {last}".strip()
    return name if name else "Unknown"

# ============ Conversation Routes ============

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new chat conversation (patient initiates)"""
    profile = await get_user_profile(user.id, user.access_token)
    patient_name = format_name(profile)
    
    conversation_id = str(uuid.uuid4())
    
    conversation_data = {
        "id": conversation_id,
        "patient_id": user.id,
        "status": ChatStatus.NEW.value,
        "last_message": data.initial_message[:100] if data.initial_message else None,
        "last_message_at": datetime.utcnow().isoformat(),
        "unread_count": 1
    }
    
    result = await supabase.insert("chat_conversations", conversation_data, user.access_token)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    
    # Create the initial message
    message_data = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user.id,
        "sender_role": "patient",
        "content": data.initial_message,
        "message_type": MessageType.TEXT.value
    }
    
    await supabase.insert("chat_messages", message_data, user.access_token)
    
    logger.info(f"New conversation created: {conversation_id} by patient {user.id}")
    
    return ConversationResponse(
        id=conversation_id,
        patient_id=user.id,
        patient_name=patient_name,
        status=ChatStatus.NEW.value,
        last_message=data.initial_message[:100],
        last_message_at=datetime.utcnow(),
        unread_count=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    status: Optional[ChatStatus] = None,
    assigned_to_me: bool = False,
    unassigned_only: bool = False,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get conversations based on user role and filters"""
    role = await get_user_role(user.id, user.access_token)
    
    filters = {}
    
    if role == "patient":
        filters["patient_id"] = user.id
    elif role in ["admin", "nurse", "doctor", "receptionist"]:
        if assigned_to_me:
            filters["receptionist_id"] = user.id
        elif unassigned_only:
            filters["receptionist_id"] = {"is": "null"}
    
    if status:
        filters["status"] = status.value
    
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters=filters,
        order="updated_at.desc",
        limit=limit,
        access_token=user.access_token
    )
    
    # Enrich with user names
    result = []
    for conv in conversations:
        patient_profile = await get_user_profile(conv["patient_id"], user.access_token)
        receptionist_name = None
        if conv.get("receptionist_id"):
            receptionist_profile = await get_user_profile(conv["receptionist_id"], user.access_token)
            receptionist_name = format_name(receptionist_profile)
        
        result.append(ConversationResponse(
            id=conv["id"],
            patient_id=conv["patient_id"],
            patient_name=format_name(patient_profile),
            receptionist_id=conv.get("receptionist_id"),
            receptionist_name=receptionist_name,
            status=conv["status"],
            patient_type=conv.get("patient_type"),
            booking_id=conv.get("booking_id"),
            last_message=conv.get("last_message"),
            last_message_at=conv.get("last_message_at"),
            unread_count=conv.get("unread_count", 0),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"]
        ))
    
    return result

@router.get("/conversations/unassigned", response_model=List[ConversationResponse])
async def get_unassigned_conversations(
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get unassigned conversations (for receptionist queue)"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized to view unassigned chats")
    
    # Build URL with proper null filter
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"receptionist_id": {"is": "null"}, "status": {"neq": ChatStatus.CLOSED.value}},
        order="created_at.asc",
        limit=limit,
        access_token=user.access_token
    )
    
    result = []
    for conv in conversations:
        patient_profile = await get_user_profile(conv["patient_id"], user.access_token)
        result.append(ConversationResponse(
            id=conv["id"],
            patient_id=conv["patient_id"],
            patient_name=format_name(patient_profile),
            receptionist_id=None,
            receptionist_name=None,
            status=conv["status"],
            patient_type=conv.get("patient_type"),
            booking_id=conv.get("booking_id"),
            last_message=conv.get("last_message"),
            last_message_at=conv.get("last_message_at"),
            unread_count=conv.get("unread_count", 0),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"]
        ))
    
    return result

@router.get("/conversations/my-chats", response_model=List[ConversationResponse])
async def get_my_assigned_conversations(
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get conversations assigned to current user (receptionist)"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"receptionist_id": user.id, "status": {"neq": ChatStatus.CLOSED.value}},
        order="updated_at.desc",
        limit=limit,
        access_token=user.access_token
    )
    
    # Get current user's profile for receptionist_name
    receptionist_profile = await get_user_profile(user.id, user.access_token)
    receptionist_name = format_name(receptionist_profile)
    
    result = []
    for conv in conversations:
        patient_profile = await get_user_profile(conv["patient_id"], user.access_token)
        result.append(ConversationResponse(
            id=conv["id"],
            patient_id=conv["patient_id"],
            patient_name=format_name(patient_profile),
            receptionist_id=user.id,
            receptionist_name=receptionist_name,
            status=conv["status"],
            patient_type=conv.get("patient_type"),
            booking_id=conv.get("booking_id"),
            last_message=conv.get("last_message"),
            last_message_at=conv.get("last_message_at"),
            unread_count=conv.get("unread_count", 0),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"]
        ))
    
    return result

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific conversation"""
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"id": conversation_id},
        access_token=user.access_token
    )
    
    if not conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[0]
    role = await get_user_role(user.id, user.access_token)
    
    if role == "patient" and conv["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
    
    patient_profile = await get_user_profile(conv["patient_id"], user.access_token)
    receptionist_name = None
    if conv.get("receptionist_id"):
        receptionist_profile = await get_user_profile(conv["receptionist_id"], user.access_token)
        receptionist_name = format_name(receptionist_profile)
    
    return ConversationResponse(
        id=conv["id"],
        patient_id=conv["patient_id"],
        patient_name=format_name(patient_profile),
        receptionist_id=conv.get("receptionist_id"),
        receptionist_name=receptionist_name,
        status=conv["status"],
        patient_type=conv.get("patient_type"),
        booking_id=conv.get("booking_id"),
        last_message=conv.get("last_message"),
        last_message_at=conv.get("last_message_at"),
        unread_count=conv.get("unread_count", 0),
        created_at=conv["created_at"],
        updated_at=conv["updated_at"]
    )

@router.post("/conversations/{conversation_id}/claim")
async def claim_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Receptionist claims an unassigned conversation"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized to claim chats")
    
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"id": conversation_id},
        access_token=user.access_token
    )
    
    if not conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[0]
    if conv.get("receptionist_id"):
        raise HTTPException(status_code=400, detail="Conversation already assigned")
    
    profile = await get_user_profile(user.id, user.access_token)
    receptionist_name = format_name(profile)
    
    await supabase.update(
        "chat_conversations",
        {
            "receptionist_id": user.id,
            "status": ChatStatus.ACTIVE.value
        },
        {"id": conversation_id},
        user.access_token
    )
    
    # Add system message
    system_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user.id,
        "sender_role": "system",
        "sender_name": "System",
        "content": f"{receptionist_name} has joined the conversation",
        "message_type": MessageType.SYSTEM.value
    }
    await supabase.insert("chat_messages", system_message, user.access_token)
    
    logger.info(f"Conversation {conversation_id} claimed by {user.id}")
    
    return {"message": "Conversation claimed successfully", "receptionist_name": receptionist_name}

@router.post("/conversations/{conversation_id}/reassign")
async def reassign_conversation(
    conversation_id: str,
    data: ConversationAssign,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Reassign a conversation to another receptionist"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can reassign chats")
    
    new_profile = await get_user_profile(data.receptionist_id, user.access_token)
    new_name = format_name(new_profile)
    
    await supabase.update(
        "chat_conversations",
        {"receptionist_id": data.receptionist_id},
        {"id": conversation_id},
        user.access_token
    )
    
    # Add system message
    system_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user.id,
        "sender_role": "system",
        "content": f"Conversation reassigned to {new_name}",
        "message_type": MessageType.SYSTEM.value
    }
    await supabase.insert("chat_messages", system_message, user.access_token)
    
    return {"message": "Conversation reassigned successfully"}

@router.patch("/conversations/{conversation_id}/status")
async def update_conversation_status(
    conversation_id: str,
    data: ConversationStatusUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update conversation status"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized to update status")
    
    await supabase.update(
        "chat_conversations",
        {"status": data.status.value},
        {"id": conversation_id},
        user.access_token
    )
    
    return {"message": "Status updated successfully"}

@router.patch("/conversations/{conversation_id}/patient-type")
async def update_patient_type(
    conversation_id: str,
    data: PatientTypeUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update patient type for billing purposes"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await supabase.update(
        "chat_conversations",
        {"patient_type": data.patient_type.value},
        {"id": conversation_id},
        user.access_token
    )
    
    return {"message": "Patient type updated successfully"}

# ============ Message Routes ============

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=500),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get messages for a conversation"""
    # Verify access
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"id": conversation_id},
        access_token=user.access_token
    )
    
    if not conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[0]
    role = await get_user_role(user.id, user.access_token)
    
    if role == "patient" and conv["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    messages = await supabase.select(
        "chat_messages",
        columns="*",
        filters={"conversation_id": conversation_id},
        order="created_at.asc",
        limit=limit,
        access_token=user.access_token
    )
    
    # Enrich with sender names
    result = []
    sender_cache = {}
    
    for msg in messages:
        sender_id = msg["sender_id"]
        if sender_id not in sender_cache:
            if msg["sender_role"] == "system":
                sender_cache[sender_id] = "System"
            else:
                profile = await get_user_profile(sender_id, user.access_token)
                sender_cache[sender_id] = format_name(profile)
        
        result.append(MessageResponse(
            id=msg["id"],
            conversation_id=msg["conversation_id"],
            sender_id=sender_id,
            sender_name=sender_cache[sender_id],
            sender_role=msg["sender_role"],
            content=msg["content"],
            message_type=msg["message_type"],
            file_url=msg.get("file_url"),
            file_name=msg.get("file_name"),
            read_at=msg.get("read_at"),
            created_at=msg["created_at"]
        ))
    
    return result

@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Send a message in a conversation"""
    # Verify access
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"id": conversation_id},
        access_token=user.access_token
    )
    
    if not conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[0]
    role = await get_user_role(user.id, user.access_token)
    
    if role == "patient" and conv["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    profile = await get_user_profile(user.id, user.access_token)
    sender_name = format_name(profile)
    
    logger.info(f"Sending message as {sender_name} (role: {role})")
    
    message_id = str(uuid.uuid4())
    message_data = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": user.id,
        "sender_role": role,
        "sender_name": sender_name,  # Store name in DB for real-time updates
        "content": data.content,
        "message_type": data.message_type.value,
        "file_url": data.file_url,
        "file_name": data.file_name
    }
    
    result = await supabase.insert("chat_messages", message_data, user.access_token)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to send message")
    
    logger.info(f"Message sent in conversation {conversation_id} by {user.id}")
    
    return MessageResponse(
        id=message_id,
        conversation_id=conversation_id,
        sender_id=user.id,
        sender_name=sender_name,
        sender_role=role,
        content=data.content,
        message_type=data.message_type.value,
        file_url=data.file_url,
        file_name=data.file_name,
        read_at=None,
        created_at=datetime.utcnow()
    )

@router.post("/conversations/{conversation_id}/read")
async def mark_messages_read(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Mark all messages in conversation as read"""
    conversations = await supabase.select(
        "chat_conversations",
        columns="*",
        filters={"id": conversation_id},
        access_token=user.access_token
    )
    
    if not conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Reset unread count
    await supabase.update(
        "chat_conversations",
        {"unread_count": 0},
        {"id": conversation_id},
        user.access_token
    )
    
    return {"message": "Messages marked as read"}

# ============ Stats for Dashboard ============

@router.get("/stats")
async def get_chat_stats(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get chat statistics for receptionist dashboard"""
    role = await get_user_role(user.id, user.access_token)
    if role not in ["admin", "nurse", "doctor", "receptionist"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get unassigned count
    unassigned = await supabase.select(
        "chat_conversations",
        columns="id",
        filters={"receptionist_id": {"is": "null"}, "status": {"neq": ChatStatus.CLOSED.value}},
        access_token=user.access_token
    )
    
    # Get my chats count
    my_chats = await supabase.select(
        "chat_conversations",
        columns="id",
        filters={"receptionist_id": user.id, "status": {"neq": ChatStatus.CLOSED.value}},
        access_token=user.access_token
    )
    
    # Get total active
    total_active = await supabase.select(
        "chat_conversations",
        columns="id",
        filters={"status": {"neq": ChatStatus.CLOSED.value}},
        access_token=user.access_token
    )
    
    return {
        "unassigned_count": len(unassigned) if unassigned else 0,
        "my_chats_count": len(my_chats) if my_chats else 0,
        "total_active": len(total_active) if total_active else 0
    }
