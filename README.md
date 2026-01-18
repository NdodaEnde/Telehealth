# MediConnect - Telehealth Platform

A comprehensive telehealth platform enabling virtual medical consultations between patients and healthcare providers.

## Features

### For Patients
- **Symptom Assessment** - AI-guided symptom checker with severity recommendations
- **Appointment Booking** - Book video, phone, or in-person consultations
- **Video Consultations** - Real-time video calls with healthcare providers
- **Prescription History** - View and track all prescriptions
- **Clinical Records** - Access consultation notes and history

### For Clinicians (Nurses & Doctors)
- **Patient Queue** - Manage daily patient appointments
- **Video Consultations** - Conduct secure video consultations with in-call chat
- **Clinical Notes** - Structured documentation with ICD-10 coding support
- **E-Prescriptions** - Create and manage digital prescriptions
- **Availability Management** - Set weekly availability schedules
- **Demo Mode** - Test video consultations without a second account

### For Administrators
- **User Management** - Manage patients, clinicians, and staff
- **System Analytics** - Monitor platform usage and performance

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security
- **Authentication**: Email-based auth with role management
- **Video**: WebRTC with real-time signaling
- **State Management**: TanStack Query

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or bun

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── appointments/    # Appointment management
│   ├── auth/           # Authentication guards
│   ├── availability/   # Clinician availability
│   ├── booking/        # Patient booking flow
│   ├── clinical/       # Clinical notes & history
│   ├── clinician/      # Clinician dashboard components
│   ├── landing/        # Landing page sections
│   ├── layout/         # Header, navigation
│   ├── prescriptions/  # Prescription management
│   ├── ui/             # shadcn/ui components
│   └── video/          # Video consultation components
├── contexts/           # React contexts (Auth)
├── hooks/              # Custom React hooks
├── pages/              # Route pages
└── integrations/       # Supabase client & types
```

## User Roles

| Role | Access |
|------|--------|
| **Patient** | Book appointments, join consultations, view prescriptions |
| **Nurse** | Triage patients, conduct consultations, create notes |
| **Doctor** | Full clinical access, prescriptions, escalated cases |
| **Admin** | System administration, user management |

## Clinical Workflow

1. **Patient Self-Service** - Symptom assessment and appointment booking
2. **Nurse Triage** - Initial assessment and prioritization
3. **Doctor Escalation** - Complex cases referred to doctors
4. **Video Consultation** - Real-time consultation with documentation
5. **Follow-up** - Prescriptions, clinical notes, and scheduling

## Development

```bash
# Run development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

Deploy via [Lovable](https://lovable.dev):
1. Open your project in Lovable
2. Click **Share → Publish**
3. Optionally connect a custom domain in Settings → Domains

## License

This project is private and proprietary.

---

Built with [Lovable](https://lovable.dev)
