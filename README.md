# Quadcare Telehealth Platform

> A comprehensive telehealth platform for South African healthcare providers, enabling video consultations, appointment management, and patient care coordination.

![Quadcare Logo](frontend/public/quadcare-logo.png)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Getting Started](#getting-started)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)

---

## Overview

Quadcare is a receptionist-mediated telehealth platform designed for the South African healthcare market. The platform facilitates:

1. **Patient-Receptionist Chat** - Patients initiate conversations with receptionists to request appointments
2. **Appointment Booking** - Receptionists create bookings for patients with available clinicians
3. **Video Consultations** - Patients and clinicians connect via Daily.co video calls
4. **Clinical Documentation** - Clinicians record notes and prescriptions
5. **Billing & Invoicing** - Automatic invoice generation for cash-paying patients

### Target Market
- Private clinics and medical practices
- Corporate health services (e.g., Campus Africa student accommodation)
- Telehealth-first healthcare providers

---

## Key Features

### For Patients
- 💬 Real-time chat with receptionists
- 📅 View upcoming consultations
- 📹 Join video consultations
- 💊 Access prescription history with PDF downloads
- 🧾 View and download invoices

### For Receptionists
- 📥 Chat queue management (Unassigned/My Chats/All)
- 📋 Create and manage bookings
- ❌ Cancel bookings with audit trail
- 📊 View all bookings in dedicated tab

### For Clinicians (Nurses/Doctors)
- 👥 Patient queue overview
- 📹 Join video consultations
- 📝 Clinical notes documentation
- 💊 Prescription management with PDF generation
- 📆 Availability management

### For Administrators
- 📊 Comprehensive analytics dashboard
- 📈 Conversion funnel analysis
- ⏰ Peak times and timestamp trends
- 👥 Receptionist workload metrics
- 📥 CSV data export

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      QUADCARE PLATFORM                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Patient    │  │ Receptionist │  │  Clinician   │       │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └────────────┬────┴────────────────┘                │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │  React + Vite │                              │
│              │   Frontend    │                              │
│              └───────┬───────┘                              │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │   FastAPI     │                              │
│              │   Backend     │                              │
│              └───────┬───────┘                              │
│                      │                                       │
│    ┌─────────────────┼─────────────────┐                    │
│    │                 │                 │                    │
│    ▼                 ▼                 ▼                    │
│ ┌──────┐      ┌──────────┐      ┌──────────┐               │
│ │Supa- │      │ Daily.co │      │  Twilio  │               │
│ │base  │      │  Video   │      │ WhatsApp │               │
│ └──────┘      └──────────┘      └──────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy
The platform is designed for multi-clinic deployment:
- `clinics` table as primary entity
- All records linked via `clinic_id`
- Row-Level Security (RLS) policies for data isolation

---

## User Roles

| Role | Access Level | Key Capabilities |
|------|--------------|------------------|
| **Patient** | Own data only | Chat, view appointments, join consultations, view prescriptions |
| **Receptionist** | Clinic-wide | Manage chats, create/cancel bookings, view all patients |
| **Nurse** | Clinic-wide | Consultations, prescriptions, clinical notes |
| **Doctor** | Clinic-wide | Full clinical access, prescription authority |
| **Admin** | System-wide | Analytics, user management, settings |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account
- Daily.co account (for video)
- Twilio account (for WhatsApp - optional)

### Environment Variables

#### Backend (`/backend/.env`)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
DAILY_API_KEY=your_daily_api_key
DAILY_DOMAIN=your-domain.daily.co
```

#### Frontend (`/frontend/.env`)
```env
REACT_APP_BACKEND_URL=https://your-backend-url
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

### Database Setup
Execute the migration script in Supabase SQL Editor:
```sql
-- See /supabase_migration_v2_multi_tenant.sql
```

### Running Locally
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
yarn install
yarn dev
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Admin Analytics Guide](ADMIN_ANALYTICS_GUIDE.md) | Comprehensive guide to analytics and reporting features |
| [Production Roadmap](PRODUCTION_ROADMAP.md) | Future development phases |
| [Database Migration](supabase_migration_v2_multi_tenant.sql) | SQL schema with multi-tenancy |

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **shadcn/ui** component library
- **Daily.co SDK** for video

### Backend
- **FastAPI** (Python)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **ReportLab** for PDF generation

### Third-Party Services
| Service | Purpose |
|---------|---------|
| **Supabase** | Database, Authentication, Realtime |
| **Daily.co** | Video consultations |
| **Twilio** | WhatsApp notifications (planned) |

---

## API Reference

### Core Endpoints

#### Authentication
- `POST /api/auth/reset-password-request` - Request password reset
- `POST /api/auth/reset-password` - Complete password reset

#### Bookings
- `GET /api/bookings/fee-schedule` - Service pricing
- `POST /api/bookings/` - Create booking
- `GET /api/bookings/` - List bookings
- `DELETE /api/bookings/{id}` - Cancel booking

#### Chat
- `GET /api/chat/conversations` - List conversations
- `POST /api/chat/conversations` - Create conversation
- `GET /api/chat/conversations/{id}/messages` - Get messages
- `POST /api/chat/conversations/{id}/messages` - Send message

#### Video
- `POST /api/video/room` - Create Daily.co room
- `POST /api/video/token` - Generate meeting token
- `GET /api/video/health` - Check Daily.co connection

#### Admin Analytics
- `GET /api/admin/analytics/summary` - Booking statistics
- `GET /api/admin/analytics/conversion-funnel` - Patient journey
- `GET /api/admin/analytics/timestamp-trends` - Time patterns
- `GET /api/admin/analytics/export/csv` - Export data

---

## License

© 2026 Quadcare Health Services. All rights reserved.

---

## Contact

- **Website:** [quadcare.co.za](https://quadcare.co.za)
- **Support:** support@quadcare.co.za
