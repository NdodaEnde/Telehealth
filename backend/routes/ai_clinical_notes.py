"""
AI Clinical Notes Service
Handles transcription of consultation audio and AI-generated SOAP notes
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
import logging
import os
import uuid
import tempfile
import asyncio
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-clinical-notes", tags=["AI Clinical Notes"])

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')


class SOAPNotes(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str


class TranscriptionRequest(BaseModel):
    appointment_id: str


class SaveNotesRequest(BaseModel):
    appointment_id: str
    transcript: str
    soap_subjective: str
    soap_objective: str
    soap_assessment: str
    soap_plan: str
    additional_notes: Optional[str] = None


async def transcribe_audio(audio_data: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio using OpenAI Whisper via Emergent integrations"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        
        # Write audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name
        
        try:
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="text",
                    language="en",
                    prompt="This is a medical consultation between a healthcare provider and a patient. Medical terminology may be used."
                )
            
            transcript = response if isinstance(response, str) else response.text
            logger.info(f"Transcription completed: {len(transcript)} characters")
            return transcript
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


async def generate_soap_notes(transcript: str) -> SOAPNotes:
    """Generate SOAP notes from transcript using GPT"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    if not transcript or len(transcript.strip()) < 50:
        # Return empty SOAP notes for very short/empty transcripts
        return SOAPNotes(
            subjective="[No audio recorded or transcript too short]",
            objective="",
            assessment="",
            plan=""
        )
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        system_prompt = """You are a medical documentation assistant helping clinicians create SOAP notes from consultation transcripts.

Generate structured SOAP notes from the following consultation transcript. Be concise but thorough.

Format your response EXACTLY as follows (include the headers):

SUBJECTIVE:
[Patient's chief complaint, history of present illness, symptoms as described by patient, relevant medical history mentioned]

OBJECTIVE:
[Any vital signs, physical examination findings, or observable clinical data mentioned in the consultation]

ASSESSMENT:
[Clinical impression, diagnosis or differential diagnoses discussed]

PLAN:
[Treatment plan, medications prescribed, follow-up instructions, referrals, patient education provided]

If any section has no relevant information from the transcript, write "Not documented in this consultation."
"""
        
        # Initialize LlmChat with emergent key
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"soap-{uuid.uuid4()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")  # Using gpt-4o for medical accuracy
        
        # Create user message
        user_message = UserMessage(
            text=f"Please generate SOAP notes from this consultation transcript:\n\n{transcript}"
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Parse the response into SOAP sections
        soap_text = response if isinstance(response, str) else str(response)
        
        # Parse sections
        sections = {
            'subjective': '',
            'objective': '',
            'assessment': '',
            'plan': ''
        }
        
        current_section = None
        lines = soap_text.split('\n')
        
        for line in lines:
            line_upper = line.strip().upper()
            if line_upper.startswith('SUBJECTIVE:'):
                current_section = 'subjective'
                content = line.split(':', 1)[1].strip() if ':' in line else ''
                if content:
                    sections['subjective'] = content
            elif line_upper.startswith('OBJECTIVE:'):
                current_section = 'objective'
                content = line.split(':', 1)[1].strip() if ':' in line else ''
                if content:
                    sections['objective'] = content
            elif line_upper.startswith('ASSESSMENT:'):
                current_section = 'assessment'
                content = line.split(':', 1)[1].strip() if ':' in line else ''
                if content:
                    sections['assessment'] = content
            elif line_upper.startswith('PLAN:'):
                current_section = 'plan'
                content = line.split(':', 1)[1].strip() if ':' in line else ''
                if content:
                    sections['plan'] = content
            elif current_section and line.strip():
                sections[current_section] += ('\n' if sections[current_section] else '') + line.strip()
        
        logger.info("SOAP notes generated successfully")
        
        return SOAPNotes(
            subjective=sections['subjective'] or "Not documented in this consultation.",
            objective=sections['objective'] or "Not documented in this consultation.",
            assessment=sections['assessment'] or "Not documented in this consultation.",
            plan=sections['plan'] or "Not documented in this consultation."
        )
        
    except Exception as e:
        logger.error(f"SOAP generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate SOAP notes: {str(e)}")


@router.post("/transcribe")
async def transcribe_consultation_audio(
    audio: UploadFile = File(...),
    appointment_id: str = Form(...),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Upload and transcribe consultation audio.
    Returns the transcript and AI-generated SOAP notes.
    """
    # Verify user is the clinician for this appointment
    appointments = await supabase.select(
        'appointments',
        'id,clinician_id,patient_id,status',
        {'id': appointment_id}
    )
    
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment = appointments[0]
    
    # Only the clinician or admin can transcribe
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    user_role = roles[0].get('role') if roles else None
    
    if appointment['clinician_id'] != user.id and user_role != 'admin':
        raise HTTPException(status_code=403, detail="Only the assigned clinician can generate notes")
    
    # Read audio data
    audio_data = await audio.read()
    
    if len(audio_data) < 1000:
        raise HTTPException(status_code=400, detail="Audio file too small or empty")
    
    logger.info(f"Received audio file: {len(audio_data)} bytes, type: {audio.content_type}")
    
    # Transcribe the audio
    transcript = await transcribe_audio(audio_data, audio.filename or "recording.webm")
    
    # Generate SOAP notes from transcript
    soap_notes = await generate_soap_notes(transcript)
    
    return {
        "success": True,
        "transcript": transcript,
        "soap_notes": {
            "subjective": soap_notes.subjective,
            "objective": soap_notes.objective,
            "assessment": soap_notes.assessment,
            "plan": soap_notes.plan
        }
    }


@router.post("/generate-soap")
async def generate_soap_from_text(
    appointment_id: str,
    transcript: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Generate SOAP notes from provided transcript text.
    For cases where audio was already transcribed or notes are typed manually.
    """
    # Verify access
    appointments = await supabase.select(
        'appointments',
        'id,clinician_id',
        {'id': appointment_id}
    )
    
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    user_role = roles[0].get('role') if roles else None
    
    if appointments[0]['clinician_id'] != user.id and user_role != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    soap_notes = await generate_soap_notes(transcript)
    
    return {
        "success": True,
        "soap_notes": {
            "subjective": soap_notes.subjective,
            "objective": soap_notes.objective,
            "assessment": soap_notes.assessment,
            "plan": soap_notes.plan
        }
    }


@router.post("/save")
async def save_clinical_notes(
    data: SaveNotesRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Save the finalized clinical notes (transcript + SOAP) to the database.
    """
    # Verify access
    appointments = await supabase.select(
        'appointments',
        'id,clinician_id,patient_id',
        {'id': data.appointment_id}
    )
    
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment = appointments[0]
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    user_role = roles[0].get('role') if roles else None
    
    if appointment['clinician_id'] != user.id and user_role != 'admin':
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create clinical note record
    note_data = {
        'id': str(uuid.uuid4()),
        'appointment_id': data.appointment_id,
        'patient_id': appointment['patient_id'],
        'clinician_id': appointment['clinician_id'],
        'note_type': 'consultation',
        'content': f"""TRANSCRIPT:
{data.transcript}

---

SOAP NOTES:

SUBJECTIVE:
{data.soap_subjective}

OBJECTIVE:
{data.soap_objective}

ASSESSMENT:
{data.soap_assessment}

PLAN:
{data.soap_plan}

{f"ADDITIONAL NOTES:{chr(10)}{data.additional_notes}" if data.additional_notes else ""}
""",
        'soap_subjective': data.soap_subjective,
        'soap_objective': data.soap_objective,
        'soap_assessment': data.soap_assessment,
        'soap_plan': data.soap_plan,
        'transcript': data.transcript,
        'is_ai_generated': True,
        'created_by': user.id,
    }
    
    result = await supabase.insert('clinical_notes', note_data, user.access_token)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save clinical notes")
    
    # Update appointment status to completed if not already
    await supabase.update(
        'appointments',
        {'id': data.appointment_id},
        {'status': 'completed'},
        user.access_token
    )
    
    logger.info(f"Clinical notes saved for appointment {data.appointment_id}")
    
    return {
        "success": True,
        "note_id": note_data['id'],
        "message": "Clinical notes saved successfully"
    }


@router.get("/notes/{appointment_id}")
async def get_clinical_notes(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get clinical notes for an appointment"""
    # Verify access
    appointments = await supabase.select(
        'appointments',
        'id,clinician_id,patient_id',
        {'id': appointment_id}
    )
    
    if not appointments:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    appointment = appointments[0]
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    user_role = roles[0].get('role') if roles else None
    
    # Clinicians can see their notes, patients can see notes from their appointments, admins can see all
    is_clinician = appointment['clinician_id'] == user.id
    is_patient = appointment['patient_id'] == user.id
    is_admin = user_role == 'admin'
    
    if not (is_clinician or is_patient or is_admin):
        raise HTTPException(status_code=403, detail="Access denied")
    
    notes = await supabase.select(
        'clinical_notes',
        '*',
        {'appointment_id': appointment_id}
    )
    
    return {
        "success": True,
        "notes": notes[0] if notes else None
    }
