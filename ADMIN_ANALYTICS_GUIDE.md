# Quadcare Admin Analytics & Reporting Guide

> **Version:** 1.0  
> **Last Updated:** January 2026  
> **Audience:** Executive Committee, Clinic Administrators

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Accessing the Admin Dashboard](#accessing-the-admin-dashboard)
3. [Analytics Tab](#analytics-tab)
4. [Reports Tab](#reports-tab)
   - [Booking Overview](#1-booking-overview)
   - [Peak Times Analysis](#2-peak-times-analysis)
   - [Service Type Breakdown](#3-service-type-breakdown)
   - [Clinician Performance](#4-clinician-performance)
   - [Conversion Funnel](#5-conversion-funnel)
   - [No-Show Analysis](#6-no-show-analysis)
   - [Receptionist Workload](#7-receptionist-workload)
   - [Consultation Time Trends](#8-consultation-time-trends)
5. [Exporting Data](#exporting-data)
6. [Business Value & Actionable Insights](#business-value--actionable-insights)
7. [Future Enhancements](#future-enhancements)

---

## Executive Summary

The Quadcare Admin Dashboard provides comprehensive analytics and reporting capabilities designed to help clinic administrators make data-driven decisions. The platform tracks the entire patient journey from initial chat contact through to completed consultations, providing insights into:

- **Operational Efficiency** - Receptionist performance, response times, conversion rates
- **Patient Behavior** - When patients book, no-show patterns, peak demand periods
- **Resource Optimization** - Clinician workload, service distribution, capacity planning
- **Business Health** - Conversion funnels, abandonment rates, completion rates

---

## Accessing the Admin Dashboard

1. Navigate to the Quadcare platform
2. Log in with an **Admin** account
3. You will be directed to the Admin Dashboard
4. Use the tabs at the top to switch between **Analytics**, **Reports**, **Management**, and **Settings**

---

## Analytics Tab

The Analytics tab provides a real-time overview of platform performance with the following components:

### Quick Insights
- Total patients registered
- Active appointments
- Consultations completed
- Average wait time

### Visual Charts
- **Appointment Trends** - Line chart showing booking patterns over time
- **Consultation Types** - Distribution of service types
- **Status Distribution** - Breakdown by appointment status
- **Patient Growth** - New patient registrations over time
- **Clinician Performance** - Comparative performance metrics

---

## Reports Tab

The Reports tab provides detailed, filterable analytics with export capabilities.

### Time Period Filters
Select from predefined periods or custom date ranges:
- **Today** - Current day's data
- **Last 7 Days** - Weekly view
- **Last 30 Days** - Monthly view (default)
- **Last 90 Days** - Quarterly view
- **Last Year** - Annual view

---

### 1. Booking Overview

Four key metrics cards showing:

| Metric | Description | Business Value |
|--------|-------------|----------------|
| **Total Bookings** | All appointments in period | Volume indicator |
| **Completed** | Successfully finished consultations | Service delivery metric |
| **Cancelled** | Appointments cancelled | Identify issues |
| **Pending** | Awaiting consultation | Pipeline visibility |

**Key Insight:** Completion rate = Completed / Total Bookings

---

### 2. Peak Times Analysis

Identifies when consultations are most requested:

#### Metrics Displayed
- **Busiest Day** - Day of week with most bookings
- **Peak Hour** - Time of day with highest demand
- **Quietest Day** - Lowest demand day
- **Off-Peak Hour** - Time with least bookings

#### Visualization
- Bar chart showing bookings by day of week
- Helps with staffing and resource allocation

**Example Insight:** *"Mondays see 40% more bookings than Fridays - consider additional receptionist coverage on Mondays."*

---

### 3. Service Type Breakdown

Distribution of consultation types:

| Service Type | Description |
|--------------|-------------|
| Teleconsultation | Standard video consultation (R260) |
| Follow-up (0-3 days) | Free follow-up within 3 days (R0) |
| Follow-up (4-7 days) | Follow-up within a week (R300) |
| Script 1 month | Prescription for 1 month (R160) |
| Script 3 months | Prescription for 3 months (R300) |
| Script 6 months | Prescription for 6 months (R400) |
| Medical Forms | Medical documentation (R400) |

**Visual:** Horizontal bar chart with percentages

**Business Value:** Understanding service mix helps with:
- Revenue forecasting
- Resource planning
- Service promotion strategies

---

### 4. Clinician Performance

Table showing performance metrics per clinician:

| Column | Description |
|--------|-------------|
| **Clinician** | Name of clinical associate |
| **Total** | All appointments assigned |
| **Completed** | Successfully finished |
| **Cancelled** | Cancelled appointments |
| **Rate** | Completion percentage |

**Business Value:** 
- Identify top performers
- Balance workload distribution
- Training needs assessment

---

### 5. Conversion Funnel

Tracks patient journey from first contact to completed consultation:

```
┌─────────────────────────────────────────┐
│  Chats Initiated                    100%│ ████████████████████
├─────────────────────────────────────────┤
│  Bookings Created                    75%│ ███████████████
├─────────────────────────────────────────┤
│  Consultations Confirmed             60%│ ████████████
├─────────────────────────────────────────┤
│  Consultations Completed             50%│ ██████████
└─────────────────────────────────────────┘
```

#### Key Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| **Chat → Booking** | Bookings / Chats × 100 | >70% |
| **Booking → Completed** | Completed / Bookings × 100 | >80% |
| **Overall Conversion** | Completed / Chats × 100 | >50% |
| **Abandonment Rate** | Chats without booking / Total Chats × 100 | <30% |

**Business Value:**
- Identify drop-off points in patient journey
- Optimize receptionist training
- Improve booking process

---

### 6. No-Show Analysis

Tracks appointments where patients didn't attend:

#### Summary Metrics
- **Total No-Shows** - Count of missed appointments
- **No-Show Rate** - Percentage of total appointments

#### Day of Week Breakdown
Visual showing which days have highest no-show rates

**Business Value:**
- Implement reminder strategies (WhatsApp notifications)
- Overbooking strategies for high no-show days
- Identify patterns (e.g., Monday mornings)

**Recommended Actions:**
- No-show rate >15%: Implement SMS/WhatsApp reminders
- Specific day pattern: Adjust scheduling or send targeted reminders

---

### 7. Receptionist Workload

Distribution of work among reception staff:

#### Summary
- **Total Receptionists Active** - Staff who handled chats
- **Total Chats Handled** - All patient conversations
- **Total Bookings Created** - Successful bookings
- **Average per Receptionist** - Workload indicator

#### Per-Receptionist Breakdown
| Metric | Description |
|--------|-------------|
| **Name** | Receptionist identifier |
| **Chats Handled** | Conversations managed |
| **Bookings Created** | Successful conversions |
| **Conversion Rate** | Bookings / Chats × 100 |

**Business Value:**
- Balanced workload distribution
- Performance benchmarking
- Training needs identification
- Staffing optimization

---

### 8. Consultation Time Trends

**The most granular view of when students seek consultations.**

#### Summary Cards
| Card | Shows | Business Use |
|------|-------|--------------|
| **Peak Hour** | Busiest time (e.g., 10:00) | Staffing schedule |
| **Busiest Day** | Day with most bookings | Resource allocation |
| **Total Consultations** | Volume in period | Capacity planning |

#### Hourly Distribution Chart
24-bar chart showing bookings per hour (00:00 - 23:00)

```
Bookings
    │     ██
    │     ██  ██
    │  ██ ██  ██ ██
    │  ██ ██  ██ ██ ██
    └──────────────────────
       08 09 10 11 12 13 14 (Hour)
```

**Insight Example:** *"Peak consultation requests occur between 09:00-11:00 SAST"*

#### Day of Week Distribution
Grid showing relative booking volume per day:

```
Mon  Tue  Wed  Thu  Fri  Sat  Sun
[45] [38] [42] [35] [28] [12] [8]
████ ███  ███  ███  ██   █    █
```

#### Weekly Heatmap (Day × Hour)

A color-coded grid showing booking intensity:

```
        00  03  06  09  12  15  18  21
Mon     ░   ░   ░   ██  ██  █   ░   ░
Tue     ░   ░   ░   ██  █   █   ░   ░
Wed     ░   ░   ░   ██  ██  ██  ░   ░
Thu     ░   ░   ░   █   █   █   ░   ░
Fri     ░   ░   ░   █   █   ░   ░   ░
Sat     ░   ░   ░   ░   ░   ░   ░   ░
Sun     ░   ░   ░   ░   ░   ░   ░   ░

Legend: ░ = Low  █ = Medium  ██ = High
```

**Business Value:**
- **Staffing Optimization** - Schedule more staff during peak hours
- **Clinician Scheduling** - Ensure availability during high-demand periods
- **Marketing** - Promote off-peak slots for non-urgent consultations
- **Capacity Planning** - Prepare for predictable demand patterns

#### Daily Booking Trend
Scrollable timeline showing bookings per day with completion status:

```
2026-01-20  ████████████  28 (24✓)
2026-01-21  ██████████    25 (22✓)
2026-01-22  ████████████  30 (28✓)
2026-01-23  ██████        15 (12✓)
...
```

---

## Exporting Data

### CSV Export
Click the **"Export CSV"** button to download appointment data including:
- Appointment ID
- Scheduled Date & Time (SAST)
- Status
- Service Type
- Clinician Name
- Patient ID
- Created Date

**Use Cases:**
- External analysis in Excel
- Board reporting
- Compliance audits
- Custom visualizations

---

## Business Value & Actionable Insights

### For Campus Africa Soft Launch

| Insight | Action | Expected Outcome |
|---------|--------|------------------|
| Peak hours identified | Staff appropriately | Reduced wait times |
| High no-show days | Send reminders | Improved attendance |
| Low conversion rate | Receptionist training | More bookings |
| Service mix analysis | Promote underutilized services | Revenue optimization |
| Clinician workload imbalance | Redistribute appointments | Better efficiency |

### Sample Executive Dashboard Summary

```
┌────────────────────────────────────────────────────────────┐
│  QUADCARE - CAMPUS AFRICA MONTHLY REPORT - JANUARY 2026   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📊 KEY METRICS                                            │
│  ├── Total Consultations: 847                              │
│  ├── Completion Rate: 78%                                  │
│  ├── No-Show Rate: 8%                                      │
│  └── Avg. Chat-to-Booking Conversion: 72%                  │
│                                                            │
│  ⏰ PEAK TIMES                                              │
│  ├── Busiest Day: Tuesday                                  │
│  ├── Peak Hour: 10:00 SAST                                 │
│  └── Quietest: Sunday                                      │
│                                                            │
│  👥 RECEPTIONIST PERFORMANCE                               │
│  ├── Sarah: 245 chats, 82% conversion                      │
│  ├── Thabo: 198 chats, 75% conversion                      │
│  └── Lerato: 156 chats, 79% conversion                     │
│                                                            │
│  🏥 TOP SERVICES                                           │
│  ├── Teleconsultation: 65%                                 │
│  ├── Script (1 month): 18%                                 │
│  └── Follow-up: 12%                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements

### Phase 2 (Planned)
- **Chat Response Times** - Average time for receptionist to respond
- **Patient Wait Times** - Time from booking to consultation
- **Video Quality Metrics** - Connection success rates, call duration

### Phase 3 (Multi-Clinic)
- **Clinic Comparison** - Performance across locations
- **System Uptime Monitoring** - Per-clinic availability
- **Revenue Analytics** - Financial reporting by clinic

---

## Technical Notes

### API Endpoints (Admin Only)

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/analytics/summary` | Booking statistics |
| `GET /api/admin/analytics/peak-times` | Peak time analysis |
| `GET /api/admin/analytics/cancellation-reasons` | Cancellation stats |
| `GET /api/admin/analytics/conversion-funnel` | Patient journey metrics |
| `GET /api/admin/analytics/no-show-rates` | No-show analysis |
| `GET /api/admin/analytics/receptionist-workload` | Staff performance |
| `GET /api/admin/analytics/timestamp-trends` | Time-based analytics |
| `GET /api/admin/analytics/export/csv` | Data export |

### Data Refresh
- Analytics update in real-time as bookings are created/updated
- Select different time periods using the dropdown filter
- Click "Refresh" to manually reload data

---

## Support

For questions about analytics or reporting features, contact:
- **Technical Support:** [support@quadcare.co.za]
- **Documentation:** This guide is available in the project repository

---

*© 2026 Quadcare Health Services. All rights reserved.*
