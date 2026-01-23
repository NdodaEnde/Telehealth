# HCF Telehealth Platform - Production Roadmap

**Target Launch Date:** 1 March 2026  
**Current Date:** 20 January 2026  
**Time to Launch:** ~6 weeks  
**Version:** Draft 1.0

---

## Executive Summary

This roadmap outlines the path from current MVP state to production-ready platform for Quadcare's telehealth service. The platform will initially serve 12 clinics with architecture designed to scale to 20+ clinics by end of 2026.

---

## 1. Current State Assessment

### What's Built ✅
| Component | Status | Notes |
|-----------|--------|-------|
| Patient Registration & Auth | ✅ Complete | Supabase Auth with role-based access |
| Chat-Based Booking System | ✅ Complete | Real-time chat, receptionist workflow |
| Receptionist Dashboard | ✅ Complete | Chat queue, booking creation, patient type |
| Patient Dashboard | ✅ Complete | Chat, consultations, profile tabs |
| Booking with Fee Schedule | ✅ Complete | Quadcare pricing, invoice generation |
| Video Consultation | ✅ Built | WebRTC implementation exists |
| Clinical Notes (SOAP) | ✅ Built | Clinician documentation |
| Prescription Management | ✅ Built | Digital prescriptions |
| Invoice/PDF Generation | ✅ Built | Cash patient invoices |

### What Needs Work 🔧
| Component | Status | Priority |
|-----------|--------|----------|
| Clinician Dashboard | 🔧 Needs Integration | P0 - Must have |
| Video Consultation Testing | 🔧 Needs Testing | P0 - Must have |
| Multi-Clinic Support | ⚠️ Not Started | P1 - Important |
| HealthBridge Integration | 🔶 Mocked | P2 - Post-launch |
| Email/SMS Notifications | ⚠️ Not Started | P1 - Important |
| Payment Integration | ⚠️ Not Started | P2 - Post-launch |

---

## 2. Production Tech Stack

### 2.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                               │
│                    (CDN + DDoS Protection)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
        ┌───────▼───────┐               ┌───────▼───────┐
        │   FRONTEND    │               │    BACKEND    │
        │   Vercel      │               │  Railway/     │
        │   or          │               │  Render/      │
        │   Cloudflare  │               │  Fly.io       │
        │   Pages       │               │               │
        └───────────────┘               └───────┬───────┘
                                                │
                                        ┌───────▼───────┐
                                        │   SUPABASE    │
                                        │  (Managed)    │
                                        │  - PostgreSQL │
                                        │  - Auth       │
                                        │  - Realtime   │
                                        │  - Storage    │
                                        └───────────────┘
```

### 2.2 Tech Stack Decisions

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend Hosting** | **Vercel** (Recommended) | - Automatic deployments from Git<br>- Global CDN<br>- Preview deployments for testing<br>- Excellent React/Vite support |
| **Backend Hosting** | **Railway** or **Render** | - Easy FastAPI deployment<br>- Auto-scaling<br>- PostgreSQL add-ons if needed<br>- Affordable for startup |
| **Database** | **Supabase Pro** ($25/mo) | - Managed PostgreSQL<br>- Built-in Auth<br>- Realtime subscriptions<br>- Row Level Security<br>- 8GB database, 50GB bandwidth |
| **File Storage** | **Supabase Storage** | - Already integrated<br>- 100GB included in Pro |
| **Video Calls** | **Daily.co** or **Twilio** | - More reliable than pure WebRTC<br>- HIPAA compliant options<br>- Recording capability |
| **Email** | **Resend** or **SendGrid** | - Transactional emails<br>- Templates<br>- Analytics |
| **SMS** | **Twilio** or **Africa's Talking** | - SA coverage<br>- Appointment reminders |
| **Monitoring** | **Sentry** + **LogTail** | - Error tracking<br>- Performance monitoring<br>- Log aggregation |
| **CDN/Security** | **Cloudflare** (Free tier) | - DDoS protection<br>- SSL<br>- Caching |

### 2.3 Cost Estimate (Monthly)

| Service | Tier | Cost (USD) |
|---------|------|------------|
| Supabase | Pro | $25 |
| Vercel | Pro | $20 |
| Railway/Render | Starter | $20-50 |
| Daily.co (Video) | Scale | $0.004/min (~$50-100) |
| Resend (Email) | Pro | $20 |
| Twilio (SMS) | Pay-as-go | ~$50 |
| Sentry | Team | $26 |
| Cloudflare | Free | $0 |
| **Total** | | **~$210-300/month** |

*Note: Costs scale with usage. Initial months will be lower.*

---

## 3. Development Phases

### Phase 1: Foundation (Jan 20 - Jan 31) - Week 1-2
**Goal:** Stable database, proper environment setup

| Task | Owner | Days | Status |
|------|-------|------|--------|
| Create production Supabase project | Dev | 1 | ⬜ |
| Run corrected migration script | Dev | 1 | ⬜ |
| Create test user accounts | Dev | 0.5 | ⬜ |
| Update environment variables | Dev | 0.5 | ⬜ |
| Test booking flow end-to-end | Dev + QA | 2 | ⬜ |
| Fix any booking/chat bugs | Dev | 3 | ⬜ |
| Document API endpoints | Dev | 1 | ⬜ |

**Deliverable:** Working booking flow with real Supabase

---

### Phase 2: Clinician Experience (Feb 1 - Feb 7) - Week 3
**Goal:** Clinicians can view and conduct consultations

| Task | Owner | Days | Status |
|------|-------|------|--------|
| Clinician Dashboard - view assigned bookings | Dev | 2 | ⬜ |
| Clinician Dashboard - patient queue | Dev | 1 | ⬜ |
| Video consultation integration | Dev | 2 | ⬜ |
| Clinical notes during/after consult | Dev | 1 | ⬜ |
| Prescription creation flow | Dev | 1 | ⬜ |

**Deliverable:** Clinicians can conduct full consultation

---

### Phase 3: Notifications & Polish (Feb 8 - Feb 14) - Week 4
**Goal:** Users receive appropriate notifications

| Task | Owner | Days | Status |
|------|-------|------|--------|
| Email service integration (Resend) | Dev | 1 | ⬜ |
| Booking confirmation emails | Dev | 1 | ⬜ |
| Appointment reminder emails | Dev | 1 | ⬜ |
| SMS integration (optional) | Dev | 2 | ⬜ |
| UI polish and responsive fixes | Dev | 2 | ⬜ |

**Deliverable:** Automated notifications working

---

### Phase 4: Testing & QA (Feb 15 - Feb 21) - Week 5
**Goal:** Comprehensive testing, bug fixes

| Task | Owner | Days | Status |
|------|-------|------|--------|
| End-to-end test script creation | QA | 2 | ⬜ |
| Patient flow testing | QA | 1 | ⬜ |
| Receptionist flow testing | QA | 1 | ⬜ |
| Clinician flow testing | QA | 1 | ⬜ |
| Video call testing (multiple devices) | QA | 1 | ⬜ |
| Load testing (simulate 50 concurrent) | Dev | 1 | ⬜ |
| Security audit (basic) | Dev | 1 | ⬜ |
| Bug fixes from testing | Dev | 3 | ⬜ |

**Deliverable:** Test report, critical bugs fixed

---

### Phase 5: Production Deployment (Feb 22 - Feb 25) - Week 6a
**Goal:** Deploy to production infrastructure

| Task | Owner | Days | Status |
|------|-------|------|--------|
| Set up Vercel project | Dev | 0.5 | ⬜ |
| Set up Railway/Render | Dev | 0.5 | ⬜ |
| Configure production environment | Dev | 1 | ⬜ |
| Set up custom domain (hcf.co.za or similar) | Dev + Client | 1 | ⬜ |
| SSL certificates | Dev | 0.5 | ⬜ |
| Set up monitoring (Sentry) | Dev | 0.5 | ⬜ |
| Production smoke tests | QA | 1 | ⬜ |

**Deliverable:** Live production environment

---

### Phase 6: Soft Launch & Training (Feb 26 - Feb 28) - Week 6b
**Goal:** Train staff, controlled launch

| Task | Owner | Days | Status |
|------|-------|------|--------|
| Receptionist training session | Client + Dev | 0.5 | ⬜ |
| Clinician training session | Client + Dev | 0.5 | ⬜ |
| Create user guides/documentation | Dev | 1 | ⬜ |
| Soft launch with 1-2 clinics | Client | 2 | ⬜ |
| Monitor and fix issues | Dev | 2 | ⬜ |

**Deliverable:** Staff trained, soft launch complete

---

### 🚀 Launch Day: March 1, 2026

---

## 4. Testing Strategy

### 4.1 Test Scenarios

#### Patient Flow
- [ ] Register new account
- [ ] Login with existing account
- [ ] Start chat with reception
- [ ] Send text message
- [ ] Upload image in chat
- [ ] Receive booking confirmation
- [ ] View upcoming consultation
- [ ] Join video consultation
- [ ] View consultation history
- [ ] View and download invoice (cash patient)

#### Receptionist Flow
- [ ] Login as receptionist
- [ ] View unassigned chats
- [ ] Claim a chat
- [ ] Respond to patient
- [ ] Select patient type
- [ ] Create booking with clinician
- [ ] Send booking confirmation
- [ ] View all bookings
- [ ] Cancel/reschedule booking

#### Clinician Flow
- [ ] Login as nurse/doctor
- [ ] View today's schedule
- [ ] View patient details before consult
- [ ] Start video consultation
- [ ] View chat history and images
- [ ] Complete clinical notes
- [ ] Create prescription
- [ ] End consultation

### 4.2 Device Testing Matrix

| Device | Browser | Priority |
|--------|---------|----------|
| Desktop Windows | Chrome | P0 |
| Desktop Mac | Chrome/Safari | P0 |
| iPhone 12+ | Safari | P0 |
| Android Phone | Chrome | P0 |
| iPad | Safari | P1 |
| Desktop | Firefox | P2 |

### 4.3 Load Testing Targets

| Metric | Target |
|--------|--------|
| Concurrent users | 100 |
| API response time | < 500ms (p95) |
| Page load time | < 3 seconds |
| Video call latency | < 200ms |
| Chat message delivery | < 1 second |

---

## 5. Multi-Clinic Architecture (Built-In from Day One)

### 5.1 Architecture Decision
**Multi-tenancy is built into the database from day one**, but the UI remains single-clinic for launch.

| Layer | Day One | Future |
|-------|---------|--------|
| Database | ✅ `clinic_id` on all tables | Same |
| RLS Policies | ✅ Filter by `clinic_id` | Same |
| Default Clinic | ✅ "Quadcare Telehealth" auto-assigned | Same |
| UI | Single clinic (no selector) | Clinic dropdown |
| Reporting | Single view | Per-clinic + aggregate |

### 5.2 Data Model (Already in Migration v2)
```sql
-- Clinics table with types
CREATE TABLE clinics (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,  -- 'QC-TH', 'QC-JHB-01'
    clinic_type clinic_type,    -- telehealth, walk_in, hybrid
    ...
);

-- Default clinic auto-created
INSERT INTO clinics (id, name, code, clinic_type)
VALUES ('00000000-...', 'Quadcare Telehealth', 'QC-TH', 'telehealth');

-- clinic_id on ALL relevant tables with default
ALTER TABLE bookings ADD COLUMN clinic_id UUID DEFAULT default_clinic_id();
```

### 5.3 RLS Policies (Already Implemented)
- Staff see only their clinic's data
- Patients see only their own data (any clinic)
- Admins can see all clinics
- Default clinic used if none specified

### 5.4 Timeline to Enable Multi-Clinic UI
- **Launch (March 1):** Hidden - all users auto-assigned to Quadcare Telehealth
- **Phase 2 (April):** Add clinic selector in receptionist/admin UI
- **Phase 3 (Q3):** Per-clinic dashboards, add walk-in clinics

---

## 6. Security Checklist

### Pre-Launch Security
- [ ] All API endpoints require authentication (except public)
- [ ] RLS policies reviewed and tested
- [ ] No secrets in frontend code
- [ ] Environment variables not exposed
- [ ] HTTPS enforced everywhere
- [ ] CORS configured correctly
- [ ] Rate limiting on auth endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (React handles this)
- [ ] POPIA compliance review

### POPIA Considerations (SA Data Protection)
- [ ] Privacy policy on website
- [ ] Consent for data collection
- [ ] Data retention policy defined
- [ ] Right to deletion implemented
- [ ] Audit logs for data access

---

## 7. Post-Launch Roadmap

### March 2026 (Stabilization)
- Monitor and fix production issues
- Gather user feedback
- Performance optimization

### April 2026 (Multi-Clinic)
- Implement clinic selection
- Per-clinic admin views
- Clinic-specific reporting

### May-June 2026 (Integrations)
- HealthBridge API integration (if available)
- Payment gateway (PayGate/PayFast)
- Automated medical aid claims

### Q3-Q4 2026 (Scale)
- Mobile app (React Native)
- Advanced analytics
- AI-assisted triage
- Patient mobile check-in

---

## 8. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Video call quality issues | High | Medium | Use Daily.co instead of raw WebRTC |
| Database performance at scale | High | Low | Proper indexing, Supabase Pro |
| Integration delays | Medium | Medium | Launch without HealthBridge, add later |
| Staff adoption resistance | Medium | Medium | Thorough training, good UX |
| Security breach | Critical | Low | Security audit, RLS, encryption |

---

## 9. Open Questions for Client

1. **Domain:** What domain will we use? (e.g., telehealth.quadcare.co.za)
2. **Branding:** Final logo and color scheme confirmed?
3. **Video Provider:** Preference on Daily.co vs Twilio vs raw WebRTC?
4. **Email Sender:** What email address for notifications? (e.g., noreply@quadcare.co.za)
5. **SMS:** Is SMS notification required for launch?
6. **Soft Launch Clinics:** Which 1-2 clinics for initial testing?
7. **Support:** Who handles patient support queries post-launch?
8. **Backup Plan:** Manual booking fallback if system is down?

---

## 10. Success Metrics

| Metric | Target (Month 1) |
|--------|------------------|
| Successful bookings | 50+ |
| Completed consultations | 30+ |
| Patient satisfaction | > 4/5 |
| System uptime | > 99% |
| Average booking time | < 5 minutes |
| Video call success rate | > 95% |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 Draft | Jan 20, 2026 | Initial roadmap |

---

**Prepared by:** Development Team  
**Reviewed by:** [Client Name]  
**Approved by:** [To be filled]
