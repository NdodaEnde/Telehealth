"""
Admin Analytics Routes
Provides reporting and analytics for admin dashboard
Restricted to admin role only
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone
from auth import get_current_user, AuthenticatedUser
from supabase_client import supabase
import logging
import io
import csv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics"])

# South African Standard Time (SAST) is UTC+2
SAST = timezone(timedelta(hours=2))

def to_sast(dt: datetime) -> datetime:
    """Convert datetime to South African Standard Time (UTC+2)"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(SAST)


# Response Models
class BookingStats(BaseModel):
    total_bookings: int
    confirmed: int
    pending: int
    cancelled: int
    completed: int
    period_start: str
    period_end: str


class DailyBookingTrend(BaseModel):
    date: str
    bookings: int
    cancellations: int
    completed: int


class HourlyTrend(BaseModel):
    hour: int
    hour_label: str
    count: int


class ServiceTypeStats(BaseModel):
    service_type: str
    count: int
    percentage: float


class ClinicianStats(BaseModel):
    clinician_name: str
    total_appointments: int
    completed: int
    cancelled: int


class AnalyticsSummary(BaseModel):
    booking_stats: BookingStats
    daily_trends: List[DailyBookingTrend]
    hourly_distribution: List[HourlyTrend]
    service_breakdown: List[ServiceTypeStats]
    top_clinicians: List[ClinicianStats]


async def verify_admin(user: AuthenticatedUser):
    """Verify that the user has admin role"""
    # Get user role from user_roles table
    result = await supabase.select(
        "user_roles",
        "role",
        {"user_id": user.id},
        access_token=user.access_token
    )
    
    if not result or result[0].get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return True


def parse_date_range(period: str, start_date: Optional[str], end_date: Optional[str]):
    """Parse date range from period or custom dates"""
    now = datetime.now(SAST)
    
    if period == "custom" and start_date and end_date:
        start = datetime.fromisoformat(start_date).replace(tzinfo=SAST)
        end = datetime.fromisoformat(end_date).replace(tzinfo=SAST)
    elif period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "week":
        start = now - timedelta(days=7)
        end = now
    elif period == "month":
        start = now - timedelta(days=30)
        end = now
    elif period == "quarter":
        start = now - timedelta(days=90)
        end = now
    elif period == "year":
        start = now - timedelta(days=365)
        end = now
    else:
        # Default to last 30 days
        start = now - timedelta(days=30)
        end = now
    
    return start, end


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(
    period: str = Query("month", description="Period: today, week, month, quarter, year, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get comprehensive analytics summary for admin dashboard"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        # Fetch all appointments in the date range using our supabase client
        # The supabase client uses service key by default, bypassing RLS
        appointments = await supabase.select(
            "appointments",
            "*",
            access_token=user.access_token
        )
        
        # Filter appointments by date range
        appointments = [
            a for a in appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat()
        ]
        
        # Calculate booking stats
        total = len(appointments)
        confirmed = len([a for a in appointments if a.get("status") == "confirmed"])
        pending = len([a for a in appointments if a.get("status") == "pending"])
        cancelled = len([a for a in appointments if a.get("status") == "cancelled"])
        completed = len([a for a in appointments if a.get("status") == "completed"])
        
        booking_stats = BookingStats(
            total_bookings=total,
            confirmed=confirmed,
            pending=pending,
            cancelled=cancelled,
            completed=completed,
            period_start=start.strftime("%Y-%m-%d"),
            period_end=end.strftime("%Y-%m-%d")
        )
        
        # Calculate daily trends
        daily_data = {}
        for apt in appointments:
            apt_date = apt.get("scheduled_at", "")[:10]  # Get YYYY-MM-DD
            if apt_date not in daily_data:
                daily_data[apt_date] = {"bookings": 0, "cancellations": 0, "completed": 0}
            daily_data[apt_date]["bookings"] += 1
            if apt.get("status") == "cancelled":
                daily_data[apt_date]["cancellations"] += 1
            if apt.get("status") == "completed":
                daily_data[apt_date]["completed"] += 1
        
        daily_trends = [
            DailyBookingTrend(
                date=d,
                bookings=data["bookings"],
                cancellations=data["cancellations"],
                completed=data["completed"]
            )
            for d, data in sorted(daily_data.items())
        ]
        
        # Calculate hourly distribution
        hourly_counts = {h: 0 for h in range(24)}
        for apt in appointments:
            try:
                apt_time = datetime.fromisoformat(apt.get("scheduled_at", "").replace("Z", "+00:00"))
                apt_sast = to_sast(apt_time)
                hourly_counts[apt_sast.hour] += 1
            except:
                pass
        
        hourly_distribution = [
            HourlyTrend(
                hour=h,
                hour_label=f"{h:02d}:00",
                count=count
            )
            for h, count in hourly_counts.items()
        ]
        
        # Calculate service type breakdown
        service_counts = {}
        for apt in appointments:
            service = apt.get("service_type", "Unknown")
            service_counts[service] = service_counts.get(service, 0) + 1
        
        service_breakdown = [
            ServiceTypeStats(
                service_type=service,
                count=count,
                percentage=round((count / total * 100) if total > 0 else 0, 1)
            )
            for service, count in sorted(service_counts.items(), key=lambda x: -x[1])
        ]
        
        # Calculate top clinicians
        clinician_data = {}
        for apt in appointments:
            clinician = apt.get("clinician_name", "Unknown")
            if clinician not in clinician_data:
                clinician_data[clinician] = {"total": 0, "completed": 0, "cancelled": 0}
            clinician_data[clinician]["total"] += 1
            if apt.get("status") == "completed":
                clinician_data[clinician]["completed"] += 1
            if apt.get("status") == "cancelled":
                clinician_data[clinician]["cancelled"] += 1
        
        top_clinicians = [
            ClinicianStats(
                clinician_name=name,
                total_appointments=data["total"],
                completed=data["completed"],
                cancelled=data["cancelled"]
            )
            for name, data in sorted(clinician_data.items(), key=lambda x: -x[1]["total"])[:10]
        ]
        
        return AnalyticsSummary(
            booking_stats=booking_stats,
            daily_trends=daily_trends,
            hourly_distribution=hourly_distribution,
            service_breakdown=service_breakdown,
            top_clinicians=top_clinicians
        )
        
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/csv")
async def export_analytics_csv(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Export analytics data as CSV"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        appointments = await supabase.select(
            "appointments",
            "id, scheduled_at, status, service_type, clinician_name, patient_id, created_at",
            access_token=user.access_token
        )
        
        # Filter by date range
        appointments = [
            a for a in appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat()
        ]
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "Appointment ID",
            "Scheduled Date",
            "Scheduled Time (SAST)",
            "Status",
            "Service Type",
            "Clinician",
            "Patient ID",
            "Created At"
        ])
        
        # Write data rows
        for apt in appointments:
            try:
                apt_time = datetime.fromisoformat(apt.get("scheduled_at", "").replace("Z", "+00:00"))
                apt_sast = to_sast(apt_time)
                scheduled_date = apt_sast.strftime("%Y-%m-%d")
                scheduled_time = apt_sast.strftime("%H:%M")
            except:
                scheduled_date = apt.get("scheduled_at", "")[:10]
                scheduled_time = ""
            
            writer.writerow([
                apt.get("id", ""),
                scheduled_date,
                scheduled_time,
                apt.get("status", ""),
                apt.get("service_type", ""),
                apt.get("clinician_name", ""),
                apt.get("patient_id", ""),
                apt.get("created_at", "")[:10] if apt.get("created_at") else ""
            ])
        
        output.seek(0)
        
        # Generate filename with date range
        filename = f"quadcare_analytics_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error exporting CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/peak-times")
async def get_peak_times(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get peak and off-peak time analysis"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        appointments = await supabase.select(
            "appointments",
            "scheduled_at",
            access_token=user.access_token
        )
        
        # Filter by date range
        appointments = [
            a for a in appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat()
        ]
        
        # Analyze by day of week
        day_counts = {i: 0 for i in range(7)}  # 0=Monday, 6=Sunday
        hour_counts = {h: 0 for h in range(24)}
        
        for apt in appointments:
            try:
                apt_time = datetime.fromisoformat(apt.get("scheduled_at", "").replace("Z", "+00:00"))
                apt_sast = to_sast(apt_time)
                day_counts[apt_sast.weekday()] += 1
                hour_counts[apt_sast.hour] += 1
            except:
                pass
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        # Find peak and off-peak
        peak_day = max(day_counts.items(), key=lambda x: x[1])
        offpeak_day = min(day_counts.items(), key=lambda x: x[1])
        peak_hour = max(hour_counts.items(), key=lambda x: x[1])
        offpeak_hour = min([h for h in hour_counts.items() if h[1] > 0], key=lambda x: x[1], default=(0, 0))
        
        return {
            "period": {
                "start": start.strftime("%Y-%m-%d"),
                "end": end.strftime("%Y-%m-%d")
            },
            "by_day_of_week": [
                {"day": day_names[i], "count": day_counts[i]}
                for i in range(7)
            ],
            "by_hour": [
                {"hour": f"{h:02d}:00", "count": hour_counts[h]}
                for h in range(24)
            ],
            "insights": {
                "peak_day": {
                    "day": day_names[peak_day[0]],
                    "bookings": peak_day[1]
                },
                "offpeak_day": {
                    "day": day_names[offpeak_day[0]],
                    "bookings": offpeak_day[1]
                },
                "peak_hour": {
                    "time": f"{peak_hour[0]:02d}:00",
                    "bookings": peak_hour[1]
                },
                "offpeak_hour": {
                    "time": f"{offpeak_hour[0]:02d}:00" if offpeak_hour[1] > 0 else "N/A",
                    "bookings": offpeak_hour[1]
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error analyzing peak times: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cancellation-reasons")
async def get_cancellation_stats(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get cancellation statistics and reasons"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        # Get all appointments
        all_appointments = await supabase.select(
            "appointments",
            "*",
            access_token=user.access_token
        )
        
        # Filter by date range
        appointments_in_range = [
            a for a in all_appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat()
        ]
        
        # Get cancelled ones
        cancelled = [a for a in appointments_in_range if a.get("status") == "cancelled"]
        total = len(appointments_in_range)
        
        # Analyze cancellation reasons (from notes field)
        reason_counts = {}
        for apt in cancelled:
            reason = apt.get("cancellation_reason", apt.get("notes", "Not specified")) or "Not specified"
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        
        cancellation_rate = round((len(cancelled) / total * 100) if total > 0 else 0, 1)
        
        return {
            "period": {
                "start": start.strftime("%Y-%m-%d"),
                "end": end.strftime("%Y-%m-%d")
            },
            "total_appointments": total,
            "total_cancellations": len(cancelled),
            "cancellation_rate": cancellation_rate,
            "by_reason": [
                {"reason": reason, "count": count}
                for reason, count in sorted(reason_counts.items(), key=lambda x: -x[1])
            ]
        }
        
    except Exception as e:
        logger.error(f"Error analyzing cancellations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversion-funnel")
async def get_conversion_funnel(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get booking conversion funnel metrics"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        # Get all conversations in the period
        conversations = await supabase.select(
            "chat_conversations",
            "*",
            access_token=user.access_token
        )
        
        # Filter by date range
        conversations_in_range = [
            c for c in conversations 
            if c.get("created_at") and 
               start.isoformat() <= c["created_at"] <= end.isoformat()
        ]
        
        # Get all appointments in the period
        appointments = await supabase.select(
            "appointments",
            "*",
            access_token=user.access_token
        )
        
        appointments_in_range = [
            a for a in appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat()
        ]
        
        # Calculate funnel stages
        total_chats = len(conversations_in_range)
        chats_with_booking = len([c for c in conversations_in_range if c.get("booking_id")])
        
        # Appointments by status
        confirmed = len([a for a in appointments_in_range if a.get("status") in ["confirmed", "in_progress"]])
        completed = len([a for a in appointments_in_range if a.get("status") == "completed"])
        cancelled = len([a for a in appointments_in_range if a.get("status") == "cancelled"])
        
        # Calculate conversion rates
        chat_to_booking_rate = round((chats_with_booking / total_chats * 100) if total_chats > 0 else 0, 1)
        booking_to_completed_rate = round((completed / chats_with_booking * 100) if chats_with_booking > 0 else 0, 1)
        overall_conversion_rate = round((completed / total_chats * 100) if total_chats > 0 else 0, 1)
        
        return {
            "period": {
                "start": start.strftime("%Y-%m-%d"),
                "end": end.strftime("%Y-%m-%d")
            },
            "funnel": {
                "chats_initiated": total_chats,
                "bookings_created": chats_with_booking,
                "consultations_confirmed": confirmed,
                "consultations_completed": completed,
                "consultations_cancelled": cancelled
            },
            "conversion_rates": {
                "chat_to_booking": chat_to_booking_rate,
                "booking_to_completed": booking_to_completed_rate,
                "overall": overall_conversion_rate
            },
            "abandonment": {
                "chats_without_booking": total_chats - chats_with_booking,
                "abandonment_rate": round(((total_chats - chats_with_booking) / total_chats * 100) if total_chats > 0 else 0, 1)
            }
        }
        
    except Exception as e:
        logger.error(f"Error calculating conversion funnel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/no-show-rates")
async def get_no_show_rates(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get no-show rate analysis"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    now = datetime.now(SAST)
    
    try:
        appointments = await supabase.select(
            "appointments",
            "*",
            access_token=user.access_token
        )
        
        # Filter by date range - only past appointments
        past_appointments = [
            a for a in appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat() and
               datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00")) < now
        ]
        
        # No-shows: past appointments that are still "confirmed" or "pending" (never started)
        no_shows = [
            a for a in past_appointments 
            if a.get("status") in ["confirmed", "pending"]
        ]
        
        completed = [a for a in past_appointments if a.get("status") == "completed"]
        cancelled = [a for a in past_appointments if a.get("status") == "cancelled"]
        
        total_past = len(past_appointments)
        no_show_count = len(no_shows)
        
        no_show_rate = round((no_show_count / total_past * 100) if total_past > 0 else 0, 1)
        
        # Analyze no-shows by day of week
        no_show_by_day = {i: 0 for i in range(7)}
        for apt in no_shows:
            try:
                apt_time = datetime.fromisoformat(apt.get("scheduled_at", "").replace("Z", "+00:00"))
                no_show_by_day[apt_time.weekday()] += 1
            except:
                pass
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        return {
            "period": {
                "start": start.strftime("%Y-%m-%d"),
                "end": end.strftime("%Y-%m-%d")
            },
            "summary": {
                "total_past_appointments": total_past,
                "completed": len(completed),
                "cancelled": len(cancelled),
                "no_shows": no_show_count,
                "no_show_rate": no_show_rate
            },
            "by_day_of_week": [
                {"day": day_names[i], "no_shows": no_show_by_day[i]}
                for i in range(7)
            ],
            "no_show_details": [
                {
                    "patient_name": apt.get("patient_name", "Unknown"),
                    "scheduled_at": apt.get("scheduled_at"),
                    "service_type": apt.get("service_type"),
                    "clinician_name": apt.get("clinician_name")
                }
                for apt in no_shows[:20]  # Limit to 20 most recent
            ]
        }
        
    except Exception as e:
        logger.error(f"Error calculating no-show rates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/receptionist-workload")
async def get_receptionist_workload(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get receptionist workload distribution"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        # Get conversations with receptionist info
        conversations = await supabase.select(
            "chat_conversations",
            "*",
            access_token=user.access_token
        )
        
        conversations_in_range = [
            c for c in conversations 
            if c.get("created_at") and 
               start.isoformat() <= c["created_at"] <= end.isoformat()
        ]
        
        # Get bookings
        bookings = await supabase.select(
            "bookings",
            "*",
            access_token=user.access_token
        )
        
        bookings_in_range = [
            b for b in bookings 
            if b.get("created_at") and 
               start.isoformat() <= b["created_at"] <= end.isoformat()
        ]
        
        # Get receptionist profiles
        receptionist_roles = await supabase.select(
            "user_roles",
            "*",
            {"role": "receptionist"},
            access_token=user.access_token
        )
        
        receptionist_ids = [r["user_id"] for r in receptionist_roles]
        
        # Get profiles for receptionists
        profiles = await supabase.select(
            "profiles",
            "id, first_name, last_name",
            access_token=user.access_token
        )
        
        profile_map = {p["id"]: f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Unknown" for p in profiles}
        
        # Calculate workload per receptionist
        workload = {}
        
        for conv in conversations_in_range:
            rec_id = conv.get("receptionist_id")
            if rec_id:
                if rec_id not in workload:
                    workload[rec_id] = {
                        "name": profile_map.get(rec_id, "Unknown"),
                        "chats_handled": 0,
                        "bookings_created": 0,
                        "chats_with_booking": 0
                    }
                workload[rec_id]["chats_handled"] += 1
                if conv.get("booking_id"):
                    workload[rec_id]["chats_with_booking"] += 1
        
        # Count bookings per receptionist (from created_by if available)
        for booking in bookings_in_range:
            created_by = booking.get("created_by")
            if created_by and created_by in workload:
                workload[created_by]["bookings_created"] += 1
        
        # Calculate conversion rates per receptionist
        receptionist_stats = []
        for rec_id, data in workload.items():
            conversion_rate = round((data["chats_with_booking"] / data["chats_handled"] * 100) if data["chats_handled"] > 0 else 0, 1)
            receptionist_stats.append({
                "receptionist_id": rec_id,
                "receptionist_name": data["name"],
                "chats_handled": data["chats_handled"],
                "bookings_created": data["chats_with_booking"],
                "conversion_rate": conversion_rate
            })
        
        # Sort by chats handled
        receptionist_stats.sort(key=lambda x: -x["chats_handled"])
        
        # Calculate totals
        total_chats = sum(r["chats_handled"] for r in receptionist_stats)
        total_bookings = sum(r["bookings_created"] for r in receptionist_stats)
        
        return {
            "period": {
                "start": start.strftime("%Y-%m-%d"),
                "end": end.strftime("%Y-%m-%d")
            },
            "summary": {
                "total_receptionists_active": len(receptionist_stats),
                "total_chats_handled": total_chats,
                "total_bookings_created": total_bookings,
                "average_chats_per_receptionist": round(total_chats / len(receptionist_stats), 1) if receptionist_stats else 0
            },
            "by_receptionist": receptionist_stats
        }
        
    except Exception as e:
        logger.error(f"Error calculating receptionist workload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timestamp-trends")
async def get_timestamp_trends(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get detailed timestamp trends for bookings - hourly, daily, and heatmap data"""
    await verify_admin(user)
    
    start, end = parse_date_range(period, start_date, end_date)
    
    try:
        appointments = await supabase.select(
            "appointments",
            "*",
            access_token=user.access_token
        )
        
        # Filter by date range
        appointments_in_range = [
            a for a in appointments 
            if a.get("scheduled_at") and 
               start.isoformat() <= a["scheduled_at"] <= end.isoformat()
        ]
        
        # Initialize data structures
        hourly_distribution = {h: 0 for h in range(24)}
        daily_distribution = {i: 0 for i in range(7)}  # 0=Monday, 6=Sunday
        
        # Heatmap: day of week (rows) x hour (columns)
        heatmap = {day: {hour: 0 for hour in range(24)} for day in range(7)}
        
        # Daily trend (date -> count)
        daily_trend = {}
        
        for apt in appointments_in_range:
            try:
                apt_time = datetime.fromisoformat(apt.get("scheduled_at", "").replace("Z", "+00:00"))
                apt_sast = to_sast(apt_time)
                
                hour = apt_sast.hour
                day_of_week = apt_sast.weekday()
                date_str = apt_sast.strftime("%Y-%m-%d")
                
                hourly_distribution[hour] += 1
                daily_distribution[day_of_week] += 1
                heatmap[day_of_week][hour] += 1
                
                if date_str not in daily_trend:
                    daily_trend[date_str] = {"total": 0, "completed": 0, "cancelled": 0}
                daily_trend[date_str]["total"] += 1
                if apt.get("status") == "completed":
                    daily_trend[date_str]["completed"] += 1
                if apt.get("status") == "cancelled":
                    daily_trend[date_str]["cancelled"] += 1
                    
            except Exception as e:
                logger.warning(f"Error parsing appointment time: {e}")
                continue
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        # Find peak patterns
        peak_hour = max(hourly_distribution.items(), key=lambda x: x[1])
        peak_day = max(daily_distribution.items(), key=lambda x: x[1])
        
        # Find peak hour per day
        peak_hours_by_day = {}
        for day in range(7):
            day_hours = heatmap[day]
            if any(day_hours.values()):
                peak_h = max(day_hours.items(), key=lambda x: x[1])
                peak_hours_by_day[day_names[day]] = {
                    "hour": f"{peak_h[0]:02d}:00",
                    "count": peak_h[1]
                }
        
        # Format hourly distribution for chart
        hourly_chart_data = [
            {
                "hour": f"{h:02d}:00",
                "hour_numeric": h,
                "count": hourly_distribution[h],
                "is_peak": h == peak_hour[0]
            }
            for h in range(24)
        ]
        
        # Format daily distribution
        daily_chart_data = [
            {
                "day": day_names[d],
                "day_short": day_names[d][:3],
                "count": daily_distribution[d],
                "is_peak": d == peak_day[0]
            }
            for d in range(7)
        ]
        
        # Format heatmap data (for visualization)
        heatmap_data = []
        for day in range(7):
            for hour in range(24):
                count = heatmap[day][hour]
                if count > 0:  # Only include non-zero entries for efficiency
                    heatmap_data.append({
                        "day": day_names[day],
                        "day_index": day,
                        "hour": f"{hour:02d}:00",
                        "hour_index": hour,
                        "count": count
                    })
        
        # Format daily trend for time series chart
        daily_trend_data = [
            {
                "date": date,
                "total": data["total"],
                "completed": data["completed"],
                "cancelled": data["cancelled"]
            }
            for date, data in sorted(daily_trend.items())
        ]
        
        # Calculate max values for scaling
        max_hourly = max(hourly_distribution.values()) if hourly_distribution else 0
        max_daily = max(daily_distribution.values()) if daily_distribution else 0
        max_heatmap = max(heatmap[d][h] for d in range(7) for h in range(24)) if heatmap else 0
        
        return {
            "period": {
                "start": start.strftime("%Y-%m-%d"),
                "end": end.strftime("%Y-%m-%d")
            },
            "summary": {
                "total_appointments": len(appointments_in_range),
                "peak_hour": {
                    "time": f"{peak_hour[0]:02d}:00",
                    "count": peak_hour[1]
                },
                "peak_day": {
                    "day": day_names[peak_day[0]],
                    "count": peak_day[1]
                },
                "busiest_time_slot": {
                    "description": f"{day_names[peak_day[0]]}s at {peak_hour[0]:02d}:00",
                    "typical_load": max_heatmap
                }
            },
            "hourly_distribution": hourly_chart_data,
            "daily_distribution": daily_chart_data,
            "heatmap": {
                "data": heatmap_data,
                "max_value": max_heatmap,
                "days": day_names,
                "hours": [f"{h:02d}:00" for h in range(24)]
            },
            "daily_trend": daily_trend_data,
            "peak_hours_by_day": peak_hours_by_day,
            "scaling": {
                "max_hourly": max_hourly,
                "max_daily": max_daily,
                "max_heatmap": max_heatmap
            }
        }
        
    except Exception as e:
        logger.error(f"Error calculating timestamp trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))
