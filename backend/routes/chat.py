"""
Chat Routes for Patient-Receptionist Communication
Handles chat conversations, messages, and real-time updates
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URL, DB_NAME
from auth import get_current_user, AuthenticatedUser
import uuid
import logging
import json
import asyncio
from enum import Enum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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
    patient_name: str
    receptionist_id: Optional[str] = None
    receptionist_name: Optional[str] = None
    status: ChatStatus
    patient_type: Optional[PatientType] = None
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
    sender_name: str
    sender_role: str
    content: str
    message_type: MessageType
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

# ============ WebSocket Manager ============

class ConnectionManager:
    """Manages WebSocket connections for real-time chat"""
    
    def __init__(self):
        # Map of conversation_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Map of user_id -> WebSocket for notifications
        self.user_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, conversation_id: str, user_id: str):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []
        self.active_connections[conversation_id].append(websocket)
        self.user_connections[user_id] = websocket
        logger.info(f"User {user_id} connected to conversation {conversation_id}")
    
    def disconnect(self, websocket: WebSocket, conversation_id: str, user_id: str):
        if conversation_id in self.active_connections:
            if websocket in self.active_connections[conversation_id]:
                self.active_connections[conversation_id].remove(websocket)
        if user_id in self.user_connections:
            del self.user_connections[user_id]
        logger.info(f"User {user_id} disconnected from conversation {conversation_id}")
    
    async def broadcast_to_conversation(self, conversation_id: str, message: dict):
        """Send message to all participants in a conversation"""
        if conversation_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[conversation_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message: {e}")
                    disconnected.append(connection)
            # Clean up disconnected sockets
            for conn in disconnected:
                self.active_connections[conversation_id].remove(conn)
    
    async def notify_user(self, user_id: str, notification: dict):
        """Send notification to a specific user"""
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(notification)
            except Exception as e:
                logger.error(f"Error notifying user {user_id}: {e}")
    
    async def broadcast_to_receptionists(self, message: dict):
        """Broadcast to all connected receptionists (for new chat notifications)"""
        # This would need a separate tracking of receptionist connections
        # For now, we'll handle this via polling
        pass

manager = ConnectionManager()

# ============ Helper Functions ============

async def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Get user profile from Supabase via our client"""
    from supabase_client import supabase
    profiles = await supabase.select(
        "profiles",
        columns="id, first_name, last_name",
        filters={"id": user_id}
    )
    if profiles:
        return profiles[0]
    return {"id": user_id, "first_name": "Unknown", "last_name": "User"}

async def get_user_role(user_id: str) -> str:
    """Get user role from Supabase"""
    from supabase_client import supabase
    roles = await supabase.select(
        "user_roles",
        columns="role",
        filters={"user_id": user_id}
    )
    if roles:
        return roles[0].get("role", "patient")
    return "patient"

# ============ Conversation Routes ============

@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new chat conversation (patient initiates)"""
    profile = await get_user_profile(user.id)
    patient_name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
    
    conversation = {
        "id": str(uuid.uuid4()),
        "patient_id": user.id,
        "patient_name": patient_name,
        "receptionist_id": None,
        "receptionist_name": None,
        "status": ChatStatus.NEW.value,
        "patient_type": None,
        "booking_id": None,
        "last_message": data.initial_message[:100],
        "last_message_at": datetime.utcnow(),
        "unread_count": 1,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.chat_conversations.insert_one(conversation)
    
    # Create the initial message
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation["id"],
        "sender_id": user.id,
        "sender_name": patient_name,
        "sender_role": "patient",
        "content": data.initial_message,
        "message_type": MessageType.TEXT.value,
        "file_url": None,
        "file_name": None,
        "read_at": None,
        "created_at": datetime.utcnow()
    }
    
    await db.chat_messages.insert_one(message)
    
    logger.info(f"New conversation created: {conversation['id']} by patient {user.id}")
    
    return ConversationResponse(**conversation)

@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    status: Optional[ChatStatus] = None,
    assigned_to_me: bool = False,
    unassigned_only: bool = False,
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get conversations based on user role and filters"""
    role = await get_user_role(user.id)
    
    query = {}
    
    if role == "patient":
        # Patients only see their own conversations
        query["patient_id"] = user.id
    elif role in ["admin", "nurse", "doctor"]:
        # Receptionists/admins can filter
        if assigned_to_me:
            query["receptionist_id"] = user.id
        elif unassigned_only:
            query["receptionist_id"] = None
        # If neither, show all conversations
    
    if status:
        query["status"] = status.value
    
    conversations = await db.chat_conversations.find(query).sort("updated_at", -1).limit(limit).to_list(limit)
    
    return [ConversationResponse(**conv) for conv in conversations]

@router.get("/conversations/unassigned", response_model=List[ConversationResponse])
async def get_unassigned_conversations(
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get unassigned conversations (for receptionist queue)"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized to view unassigned chats")
    
    conversations = await db.chat_conversations.find({
        "receptionist_id": None,
        "status": {"$ne": ChatStatus.CLOSED.value}
    }).sort("created_at", 1).limit(limit).to_list(limit)
    
    return [ConversationResponse(**conv) for conv in conversations]

@router.get("/conversations/my-chats", response_model=List[ConversationResponse])
async def get_my_assigned_conversations(
    limit: int = Query(50, ge=1, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get conversations assigned to current user (receptionist)"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    conversations = await db.chat_conversations.find({
        "receptionist_id": user.id,
        "status": {"$ne": ChatStatus.CLOSED.value}
    }).sort("updated_at", -1).limit(limit).to_list(limit)
    
    return [ConversationResponse(**conv) for conv in conversations]

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific conversation"""
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    role = await get_user_role(user.id)
    
    # Check access
    if role == "patient" and conversation["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
    
    return ConversationResponse(**conversation)

@router.post("/conversations/{conversation_id}/claim")
async def claim_conversation(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Receptionist claims an unassigned conversation"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized to claim chats")
    
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.get("receptionist_id"):
        raise HTTPException(status_code=400, detail="Conversation already assigned")
    
    profile = await get_user_profile(user.id)
    receptionist_name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
    
    await db.chat_conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "receptionist_id": user.id,
                "receptionist_name": receptionist_name,
                "status": ChatStatus.ACTIVE.value,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Add system message
    system_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": "system",
        "sender_name": "System",
        "sender_role": "system",
        "content": f"{receptionist_name} has joined the conversation",
        "message_type": MessageType.SYSTEM.value,
        "created_at": datetime.utcnow()
    }
    await db.chat_messages.insert_one(system_message)
    
    # Broadcast to conversation participants
    await manager.broadcast_to_conversation(conversation_id, {
        "type": "system",
        "message": system_message
    })
    
    logger.info(f"Conversation {conversation_id} claimed by {user.id}")
    
    return {"message": "Conversation claimed successfully"}

@router.post("/conversations/{conversation_id}/reassign")
async def reassign_conversation(
    conversation_id: str,
    data: ConversationAssign,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Reassign a conversation to another receptionist"""
    role = await get_user_role(user.id)
    if role not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can reassign chats")
    
    new_profile = await get_user_profile(data.receptionist_id)
    new_name = f"{new_profile.get('first_name', '')} {new_profile.get('last_name', '')}".strip()
    
    await db.chat_conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "receptionist_id": data.receptionist_id,
                "receptionist_name": new_name,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Add system message
    system_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": "system",
        "sender_name": "System",
        "sender_role": "system",
        "content": f"Conversation reassigned to {new_name}",
        "message_type": MessageType.SYSTEM.value,
        "created_at": datetime.utcnow()
    }
    await db.chat_messages.insert_one(system_message)
    
    return {"message": "Conversation reassigned successfully"}

@router.patch("/conversations/{conversation_id}/status")
async def update_conversation_status(
    conversation_id: str,
    data: ConversationStatusUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update conversation status"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized to update status")
    
    await db.chat_conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "status": data.status.value,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Status updated successfully"}

@router.patch("/conversations/{conversation_id}/patient-type")
async def update_patient_type(
    conversation_id: str,
    data: PatientTypeUpdate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update patient type for billing purposes"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.chat_conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "patient_type": data.patient_type.value,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": "Patient type updated successfully"}

# ============ Message Routes ============

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=500),
    before: Optional[str] = None,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get messages for a conversation"""
    # Verify access
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and conversation["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"conversation_id": conversation_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.chat_messages.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Return in chronological order
    messages.reverse()
    
    return [MessageResponse(**msg) for msg in messages]

@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    data: MessageCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Send a message in a conversation"""
    # Verify access
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and conversation["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if role != "patient" and conversation.get("receptionist_id") != user.id and role != "admin":
        # Allow if user is the assigned receptionist or an admin
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this conversation")
    
    profile = await get_user_profile(user.id)
    sender_name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
    
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user.id,
        "sender_name": sender_name,
        "sender_role": role,
        "content": data.content,
        "message_type": data.message_type.value,
        "file_url": data.file_url,
        "file_name": data.file_name,
        "read_at": None,
        "created_at": datetime.utcnow()
    }
    
    await db.chat_messages.insert_one(message)
    
    # Update conversation
    await db.chat_conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": data.content[:100],
                "last_message_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            "$inc": {"unread_count": 1}
        }
    )
    
    # Broadcast message via WebSocket
    await manager.broadcast_to_conversation(conversation_id, {
        "type": "new_message",
        "message": {**message, "created_at": message["created_at"].isoformat()}
    })
    
    logger.info(f"Message sent in conversation {conversation_id} by {user.id}")
    
    return MessageResponse(**message)

@router.post("/conversations/{conversation_id}/read")
async def mark_messages_read(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Mark all messages in conversation as read"""
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Mark messages not sent by this user as read
    await db.chat_messages.update_many(
        {
            "conversation_id": conversation_id,
            "sender_id": {"$ne": user.id},
            "read_at": None
        },
        {"$set": {"read_at": datetime.utcnow()}}
    )
    
    # Reset unread count
    await db.chat_conversations.update_one(
        {"id": conversation_id},
        {"$set": {"unread_count": 0}}
    )
    
    return {"message": "Messages marked as read"}

# ============ File Upload Route ============

@router.post("/conversations/{conversation_id}/upload")
async def upload_file(
    conversation_id: str,
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Upload a file/image to a conversation"""
    # Verify access
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and conversation["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Read file content
    content = await file.read()
    
    # Store in MongoDB GridFS or as base64 (for MVP, we'll store metadata and use external storage)
    # For now, we'll return a placeholder - in production, integrate with S3 or Supabase Storage
    file_id = str(uuid.uuid4())
    
    # Store file metadata
    file_record = {
        "id": file_id,
        "conversation_id": conversation_id,
        "uploaded_by": user.id,
        "file_name": file.filename,
        "content_type": file.content_type,
        "size": len(content),
        "created_at": datetime.utcnow()
    }
    
    await db.chat_files.insert_one(file_record)
    
    # In production, upload to cloud storage and return URL
    # For MVP, we'll store in MongoDB (not ideal for large files)
    await db.chat_file_content.insert_one({
        "file_id": file_id,
        "content": content
    })
    
    return {
        "file_id": file_id,
        "file_name": file.filename,
        "file_url": f"/api/chat/files/{file_id}",
        "content_type": file.content_type
    }

@router.get("/files/{file_id}")
async def get_file(
    file_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get an uploaded file"""
    from fastapi.responses import Response
    
    file_record = await db.chat_files.find_one({"id": file_id})
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verify access through conversation
    conversation = await db.chat_conversations.find_one({"id": file_record["conversation_id"]})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    role = await get_user_role(user.id)
    if role == "patient" and conversation["patient_id"] != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    file_content = await db.chat_file_content.find_one({"file_id": file_id})
    if not file_content:
        raise HTTPException(status_code=404, detail="File content not found")
    
    return Response(
        content=file_content["content"],
        media_type=file_record["content_type"],
        headers={
            "Content-Disposition": f'inline; filename="{file_record["file_name"]}"'
        }
    )

# ============ WebSocket Endpoint ============

@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str
):
    """WebSocket endpoint for real-time chat"""
    # Get token from query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return
    
    # Validate token
    from supabase_client import supabase
    user_data = await supabase.get_user_from_token(token)
    if not user_data:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = user_data.get("id")
    
    # Verify conversation access
    conversation = await db.chat_conversations.find_one({"id": conversation_id})
    if not conversation:
        await websocket.close(code=4004, reason="Conversation not found")
        return
    
    role = await get_user_role(user_id)
    if role == "patient" and conversation["patient_id"] != user_id:
        await websocket.close(code=4003, reason="Not authorized")
        return
    
    await manager.connect(websocket, conversation_id, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            
            if message_data.get("type") == "message":
                # Handle incoming message through WebSocket
                profile = await get_user_profile(user_id)
                sender_name = f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip()
                
                message = {
                    "id": str(uuid.uuid4()),
                    "conversation_id": conversation_id,
                    "sender_id": user_id,
                    "sender_name": sender_name,
                    "sender_role": role,
                    "content": message_data.get("content", ""),
                    "message_type": message_data.get("message_type", "text"),
                    "file_url": message_data.get("file_url"),
                    "file_name": message_data.get("file_name"),
                    "read_at": None,
                    "created_at": datetime.utcnow()
                }
                
                await db.chat_messages.insert_one(message)
                
                # Update conversation
                await db.chat_conversations.update_one(
                    {"id": conversation_id},
                    {
                        "$set": {
                            "last_message": message["content"][:100],
                            "last_message_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                
                # Broadcast to all participants
                await manager.broadcast_to_conversation(conversation_id, {
                    "type": "new_message",
                    "message": {**message, "created_at": message["created_at"].isoformat()}
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, conversation_id, user_id)

# ============ Stats for Dashboard ============

@router.get("/stats")
async def get_chat_stats(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get chat statistics for receptionist dashboard"""
    role = await get_user_role(user.id)
    if role not in ["admin", "nurse", "doctor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    unassigned_count = await db.chat_conversations.count_documents({
        "receptionist_id": None,
        "status": {"$ne": ChatStatus.CLOSED.value}
    })
    
    my_chats_count = await db.chat_conversations.count_documents({
        "receptionist_id": user.id,
        "status": {"$ne": ChatStatus.CLOSED.value}
    })
    
    total_active = await db.chat_conversations.count_documents({
        "status": {"$nin": [ChatStatus.CLOSED.value, ChatStatus.CONSULTATION_COMPLETE.value]}
    })
    
    return {
        "unassigned_count": unassigned_count,
        "my_chats_count": my_chats_count,
        "total_active": total_active
    }
