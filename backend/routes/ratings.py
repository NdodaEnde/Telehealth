"""
Consultation Ratings API
Handles post-consultation feedback from patients
Ratings are anonymous to clinicians but visible in admin analytics
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ratings", tags=["Consultation Ratings"])


class RatingCreate(BaseModel):
    appointment_id: str
    rating: int = Field(..., ge=1, le=5, description="Star rating from 1 to 5")
    feedback: Optional[str] = Field(None, max_length=1000, description="Optional text feedback")


class RatingResponse(BaseModel):
    id: str
    appointment_id: str
    rating: int
    feedback: Optional[str]
    created_at: datetime


class RatingStats(BaseModel):
    total_ratings: int
    average_rating: float
    rating_distribution: dict  # {1: count, 2: count, ...}
    recent_trend: float  # Average of last 30 days vs previous 30 days


@router.post("/", response_model=dict)
async def submit_rating(
    data: RatingCreate,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Submit a rating for a completed consultation.
    Only patients can rate their consultations.
    """
    try:
        # Verify the appointment exists and belongs to this patient
        appointments = await supabase.select(
            'appointments',
            'id,patient_id,clinician_id,status',
            {'id': data.appointment_id}
        )
        
        if not appointments:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        appointment = appointments[0]
        
        # Verify this is the patient's appointment
        if appointment['patient_id'] != user.id:
            raise HTTPException(status_code=403, detail="You can only rate your own consultations")
        
        # Verify appointment is completed
        if appointment['status'] not in ['completed', 'in_progress']:
            raise HTTPException(status_code=400, detail="Can only rate completed consultations")
        
        # Check if already rated
        existing = await supabase.select(
            'consultation_ratings',
            'id',
            {'appointment_id': data.appointment_id}
        )
        
        if existing:
            raise HTTPException(status_code=400, detail="You have already rated this consultation")
        
        # Create the rating
        rating_data = {
            'id': str(uuid.uuid4()),
            'appointment_id': data.appointment_id,
            'patient_id': user.id,
            'clinician_id': appointment['clinician_id'],
            'rating': data.rating,
            'feedback': data.feedback.strip() if data.feedback else None,
        }
        
        result = await supabase.insert('consultation_ratings', rating_data, user.access_token)
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save rating")
        
        logger.info(f"Rating submitted for appointment {data.appointment_id}: {data.rating} stars")
        
        return {
            "success": True,
            "message": "Thank you for your feedback!",
            "rating_id": rating_data['id']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting rating: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit rating")


@router.get("/check/{appointment_id}")
async def check_rating_exists(
    appointment_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Check if a rating already exists for an appointment"""
    try:
        existing = await supabase.select(
            'consultation_ratings',
            'id,rating',
            {'appointment_id': appointment_id, 'patient_id': user.id}
        )
        
        return {
            "exists": len(existing) > 0,
            "rating": existing[0]['rating'] if existing else None
        }
    except Exception as e:
        logger.error(f"Error checking rating: {e}")
        return {"exists": False, "rating": None}


@router.get("/my-ratings", response_model=List[dict])
async def get_my_ratings(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get all ratings submitted by the current patient"""
    try:
        ratings = await supabase.select(
            'consultation_ratings',
            'id,appointment_id,rating,feedback,created_at',
            {'patient_id': user.id}
        )
        return ratings or []
    except Exception as e:
        logger.error(f"Error fetching ratings: {e}")
        return []


@router.get("/admin/stats")
async def get_rating_stats(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Get aggregate rating statistics for admin dashboard.
    Only accessible by admins.
    """
    # Check admin role
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get all ratings
        all_ratings = await supabase.select(
            'consultation_ratings',
            'rating,created_at,clinician_id',
            {}
        )
        
        if not all_ratings:
            return {
                "success": True,
                "stats": {
                    "total_ratings": 0,
                    "average_rating": 0,
                    "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                    "recent_trend": 0,
                    "by_clinician": []
                }
            }
        
        # Calculate overall stats
        total = len(all_ratings)
        avg = sum(r['rating'] for r in all_ratings) / total
        
        # Rating distribution
        distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for r in all_ratings:
            distribution[r['rating']] = distribution.get(r['rating'], 0) + 1
        
        # Recent trend (last 30 days vs previous 30 days)
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)
        
        recent = [r for r in all_ratings if r.get('created_at') and 
                  datetime.fromisoformat(r['created_at'].replace('Z', '+00:00')) > thirty_days_ago]
        previous = [r for r in all_ratings if r.get('created_at') and 
                    sixty_days_ago < datetime.fromisoformat(r['created_at'].replace('Z', '+00:00')) <= thirty_days_ago]
        
        recent_avg = sum(r['rating'] for r in recent) / len(recent) if recent else 0
        previous_avg = sum(r['rating'] for r in previous) / len(previous) if previous else 0
        trend = recent_avg - previous_avg
        
        # Stats by clinician (aggregate only, not individual ratings)
        clinician_stats = {}
        for r in all_ratings:
            cid = r['clinician_id']
            if cid not in clinician_stats:
                clinician_stats[cid] = {'total': 0, 'sum': 0}
            clinician_stats[cid]['total'] += 1
            clinician_stats[cid]['sum'] += r['rating']
        
        # Get clinician names
        by_clinician = []
        for cid, stats in clinician_stats.items():
            profile = await supabase.select('profiles', 'first_name,last_name', {'id': cid})
            name = f"{profile[0].get('first_name', '')} {profile[0].get('last_name', '')}".strip() if profile else "Unknown"
            by_clinician.append({
                "clinician_id": cid,
                "clinician_name": name,
                "total_ratings": stats['total'],
                "average_rating": round(stats['sum'] / stats['total'], 2)
            })
        
        # Sort by average rating descending
        by_clinician.sort(key=lambda x: x['average_rating'], reverse=True)
        
        return {
            "success": True,
            "stats": {
                "total_ratings": total,
                "average_rating": round(avg, 2),
                "rating_distribution": distribution,
                "recent_trend": round(trend, 2),
                "recent_count": len(recent),
                "by_clinician": by_clinician
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching rating stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch rating statistics")


@router.get("/admin/recent")
async def get_recent_feedback(
    limit: int = 20,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Get recent feedback comments for admin review.
    Shows only ratings with text feedback.
    Patient identity is NOT revealed (anonymous).
    """
    # Check admin role
    roles = await supabase.select('user_roles', 'role', {'user_id': user.id})
    if not roles or roles[0].get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        # Get ratings with feedback
        ratings = await supabase.select(
            'consultation_ratings',
            'id,rating,feedback,created_at,clinician_id',
            {}  # Get all, we'll filter in Python for feedback
        )
        
        # Filter those with feedback and sort by date
        with_feedback = [r for r in ratings if r.get('feedback')]
        with_feedback.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        with_feedback = with_feedback[:limit]
        
        # Add clinician names (but NOT patient names - anonymous!)
        result = []
        for r in with_feedback:
            profile = await supabase.select('profiles', 'first_name,last_name', {'id': r['clinician_id']})
            clinician_name = f"{profile[0].get('first_name', '')} {profile[0].get('last_name', '')}".strip() if profile else "Unknown"
            
            result.append({
                "id": r['id'],
                "rating": r['rating'],
                "feedback": r['feedback'],
                "clinician_name": clinician_name,
                "created_at": r['created_at']
            })
        
        return {
            "success": True,
            "feedback": result
        }
        
    except Exception as e:
        logger.error(f"Error fetching recent feedback: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch feedback")
