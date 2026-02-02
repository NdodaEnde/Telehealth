from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
import os
from models import (
    AnalyticsOverview, 
    AnalyticsDashboard, 
    AppointmentTrend,
    ConsultationTypeStats,
    ClinicianPerformance,
    PatientGrowth
)

# Supabase configuration
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

async def fetch_from_supabase(table: str, query_params: Dict = None, paginate: bool = True) -> List[Dict]:
    """Fetch data from Supabase with pagination support"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'  # Get total count in response headers
    }
    
    all_results = []
    offset = 0
    limit = 1000  # Supabase max per request
    
    async with httpx.AsyncClient() as client:
        while True:
            url = f"{SUPABASE_URL}/rest/v1/{table}"
            params_list = []
            
            if query_params:
                params_list = [f"{k}={v}" for k, v in query_params.items()]
            
            # Add pagination
            if paginate:
                params_list.append(f"offset={offset}")
                params_list.append(f"limit={limit}")
            
            if params_list:
                url = f"{url}?{'&'.join(params_list)}"
            
            try:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    all_results.extend(data)
                    
                    # If we got fewer results than the limit, we've reached the end
                    if not paginate or len(data) < limit:
                        break
                    
                    offset += limit
                else:
                    print(f"Error fetching from Supabase: {response.status_code} - {response.text}")
                    break
            except Exception as e:
                print(f"Error fetching from Supabase: {e}")
                break
    
    return all_results

async def get_analytics_overview(start_date: Optional[str] = None, end_date: Optional[str] = None) -> AnalyticsOverview:
    """Get overview analytics"""
    
    # Fetch all data
    user_roles = await fetch_from_supabase('user_roles', {'select': '*'})
    appointments = await fetch_from_supabase('appointments', {'select': '*'})
    prescriptions = await fetch_from_supabase('prescriptions', {'select': '*'})
    consultations = await fetch_from_supabase('consultation_sessions', {'select': '*'})
    
    # Calculate metrics
    total_users = len(user_roles)
    total_patients = len([u for u in user_roles if u.get('role') == 'patient'])
    total_clinicians = len([u for u in user_roles if u.get('role') in ['doctor', 'nurse']])
    total_appointments = len(appointments)
    total_prescriptions = len(prescriptions)
    total_consultations = len(consultations)
    
    # Date-based calculations
    today = datetime.now().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    appointments_today = 0
    appointments_this_week = 0
    appointments_this_month = 0
    completed_count = 0
    
    for apt in appointments:
        try:
            apt_date = datetime.fromisoformat(apt.get('scheduled_at', '').replace('Z', '+00:00')).date()
            if apt_date == today:
                appointments_today += 1
            if apt_date >= week_start:
                appointments_this_week += 1
            if apt_date >= month_start:
                appointments_this_month += 1
            if apt.get('status') == 'completed':
                completed_count += 1
        except Exception:
            pass
    
    completion_rate = (completed_count / total_appointments * 100) if total_appointments > 0 else 0
    
    # Average consultation duration
    total_duration = 0
    duration_count = 0
    for session in consultations:
        duration = session.get('duration_seconds', 0)
        if duration and duration > 0:
            total_duration += duration
            duration_count += 1
    
    avg_duration = (total_duration / duration_count / 60) if duration_count > 0 else 0  # Convert to minutes
    
    return AnalyticsOverview(
        total_users=total_users,
        total_patients=total_patients,
        total_clinicians=total_clinicians,
        total_appointments=total_appointments,
        total_consultations=total_consultations,
        total_prescriptions=total_prescriptions,
        appointments_today=appointments_today,
        appointments_this_week=appointments_this_week,
        appointments_this_month=appointments_this_month,
        completion_rate=round(completion_rate, 1),
        average_consultation_duration=round(avg_duration, 1)
    )

async def get_appointment_trends(days: int = 30) -> List[AppointmentTrend]:
    """Get appointment trends for the last N days"""
    appointments = await fetch_from_supabase('appointments', {'select': '*'})
    
    # Group by date
    today = datetime.now().date()
    trends = {}
    
    for i in range(days):
        date = today - timedelta(days=i)
        date_str = date.isoformat()
        trends[date_str] = {'count': 0, 'completed': 0, 'cancelled': 0}
    
    for apt in appointments:
        try:
            apt_date = datetime.fromisoformat(apt.get('scheduled_at', '').replace('Z', '+00:00')).date().isoformat()
            if apt_date in trends:
                trends[apt_date]['count'] += 1
                if apt.get('status') == 'completed':
                    trends[apt_date]['completed'] += 1
                elif apt.get('status') == 'cancelled':
                    trends[apt_date]['cancelled'] += 1
        except Exception:
            pass
    
    return [
        AppointmentTrend(date=date, **data)
        for date, data in sorted(trends.items())
    ]

async def get_consultation_type_stats() -> ConsultationTypeStats:
    """Get breakdown by consultation type"""
    appointments = await fetch_from_supabase('appointments', {'select': 'consultation_type'})
    
    stats = ConsultationTypeStats()
    for apt in appointments:
        ctype = apt.get('consultation_type', 'video')
        if ctype == 'video':
            stats.video += 1
        elif ctype == 'phone':
            stats.phone += 1
        elif ctype == 'in_person':
            stats.in_person += 1
    
    return stats

async def get_status_distribution() -> Dict[str, int]:
    """Get appointment status distribution"""
    appointments = await fetch_from_supabase('appointments', {'select': 'status'})
    
    distribution = {}
    for apt in appointments:
        status = apt.get('status', 'unknown')
        distribution[status] = distribution.get(status, 0) + 1
    
    return distribution

async def get_clinician_performance() -> List[ClinicianPerformance]:
    """Get performance metrics for each clinician"""
    appointments = await fetch_from_supabase('appointments', {'select': '*'})
    profiles = await fetch_from_supabase('profiles', {'select': 'id,first_name,last_name'})
    user_roles = await fetch_from_supabase('user_roles', {'select': '*'})
    
    # Get clinician IDs
    clinician_ids = [u.get('user_id') for u in user_roles if u.get('role') in ['doctor', 'nurse']]
    
    # Map profiles
    profile_map = {p.get('id'): f"{p.get('first_name', '')} {p.get('last_name', '')}" for p in profiles}
    
    # Calculate metrics per clinician
    clinician_stats = {}
    for cid in clinician_ids:
        clinician_stats[cid] = {'total': 0, 'completed': 0}
    
    for apt in appointments:
        cid = apt.get('clinician_id')
        if cid in clinician_stats:
            clinician_stats[cid]['total'] += 1
            if apt.get('status') == 'completed':
                clinician_stats[cid]['completed'] += 1
    
    performance = []
    for cid, stats in clinician_stats.items():
        if stats['total'] > 0:
            completion_rate = (stats['completed'] / stats['total'] * 100)
        else:
            completion_rate = 0
        
        performance.append(ClinicianPerformance(
            clinician_id=cid,
            clinician_name=profile_map.get(cid, 'Unknown'),
            total_appointments=stats['total'],
            completed_appointments=stats['completed'],
            completion_rate=round(completion_rate, 1)
        ))
    
    return sorted(performance, key=lambda x: x.total_appointments, reverse=True)

async def get_patient_growth(days: int = 30) -> List[PatientGrowth]:
    """Get patient growth over time"""
    user_roles = await fetch_from_supabase('user_roles', {'select': '*'})
    
    patients = [u for u in user_roles if u.get('role') == 'patient']
    
    today = datetime.now().date()
    growth = []
    
    for i in range(days, -1, -1):
        date = today - timedelta(days=i)
        date_str = date.isoformat()
        
        total = 0
        new = 0
        for p in patients:
            try:
                created = datetime.fromisoformat(p.get('assigned_at', '').replace('Z', '+00:00')).date()
                if created <= date:
                    total += 1
                if created == date:
                    new += 1
            except Exception:
                pass
        
        growth.append(PatientGrowth(date=date_str, total_patients=total, new_patients=new))
    
    return growth

async def get_full_analytics_dashboard(days: int = 30) -> AnalyticsDashboard:
    """Get complete analytics dashboard data"""
    overview = await get_analytics_overview()
    trends = await get_appointment_trends(days)
    types = await get_consultation_type_stats()
    status_dist = await get_status_distribution()
    clinicians = await get_clinician_performance()
    growth = await get_patient_growth(days)
    
    return AnalyticsDashboard(
        overview=overview,
        appointment_trends=trends,
        consultation_types=types,
        clinician_performance=clinicians,
        patient_growth=growth,
        status_distribution=status_dist
    )
