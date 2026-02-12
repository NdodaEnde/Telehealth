# Quadcare Telehealth Platform
# 15-Day Production Deployment Battle Plan

**Version:** 1.0  
**Created:** February 2025  
**Target Go-Live:** 15 Days from Start  
**Author:** DevOps Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Day-by-Day Battle Plan](#day-by-day-battle-plan)
5. [Environment Configuration](#environment-configuration)
6. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
7. [Database Migration Strategy](#database-migration-strategy)
8. [Security Hardening](#security-hardening)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Alerting](#monitoring--alerting)
11. [Go-Live Checklist](#go-live-checklist)
12. [Rollback Procedures](#rollback-procedures)
13. [Post-Launch Monitoring](#post-launch-monitoring)
14. [Incident Response Playbook](#incident-response-playbook)
15. [Appendices](#appendices)

---

## Executive Summary

### Mission
Deploy Quadcare Telehealth Platform from development to production-ready state within 15 days, ensuring reliability, security, and scalability for healthcare operations.

### Expected Load (First 3 Months)
| Metric | Expected |
|--------|----------|
| Daily Active Users | 50 |
| Consultations/Day | 20 |
| Concurrent Video Calls | 4 |
| Monthly Consultations | ~600 |

### Infrastructure Cost Summary
| Service | Staging | Production | Monthly Total |
|---------|---------|------------|---------------|
| Render Frontend (Static) | $0 | $0 | $0 |
| Render Backend (Web Service) | $7 (Starter) | $25 (Standard) | $32 |
| Render Background Worker | - | $7 | $7 |
| Supabase | Free | $25 (Pro) | $25 |
| Daily.co (est. 600 consults) | ~$5 | ~$72 | ~$77 |
| OpenAI (est. 600 transcriptions) | ~$5 | ~$40 | ~$45 |
| Cloudflare | $0 | $0 | $0 |
| Sentry | $0 | $0 | $0 |
| Resend | $0 | $0 | $0 |
| **TOTAL** | **~$17** | **~$169** | **~$186/month** |

---

## Architecture Overview

### Production Architecture Diagram

```
                         ┌─────────────────────────────────────┐
                         │           CLOUDFLARE                │
                         │    quadcare.co.za DNS + SSL + WAF   │
                         │           FREE tier                 │
                         └──────────────┬──────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
          ┌─────────▼─────────┐               ┌─────────────▼─────────────┐
          │   app.quadcare.   │               │   api.quadcare.co.za      │
          │      co.za        │               │                           │
          │                   │               │   Render Web Service      │
          │  Render Static    │               │   Standard ($25/mo)       │
          │  Site ($0/mo)     │               │                           │
          │                   │               │   - FastAPI               │
          │  - React SPA      │               │   - JWT Validation        │
          │  - Vite Build     │               │   - PDF Generation        │
          │  - CDN Cached     │               │   - Real-time APIs        │
          └───────────────────┘               └─────────────┬─────────────┘
                                                            │
          ┌─────────────────────────────────────────────────┼─────────────────────┐
          │                           │                     │                     │
┌─────────▼─────────┐    ┌────────────▼────────┐   ┌───────▼───────┐   ┌─────────▼─────────┐
│   SUPABASE PRO    │    │  RENDER BACKGROUND  │   │   DAILY.CO    │   │      OPENAI       │
│     $25/mo        │    │   WORKER $7/mo      │   │   ~$72/mo     │   │     ~$40/mo       │
│                   │    │                     │   │               │   │                   │
│ - PostgreSQL DB   │    │ - Bulk imports      │   │ - Video rooms │   │ - Whisper (STT)   │
│ - Auth (GoTrue)   │    │ - AI transcription  │   │ - Meeting     │   │ - GPT-4o (SOAP)   │
│ - Realtime        │    │ - Heavy processing  │   │   tokens      │   │                   │
│ - Storage (files) │    │ - Async jobs        │   │ - Recording   │   │                   │
│ - Edge Functions  │    │                     │   │               │   │                   │
└───────────────────┘    └─────────────────────┘   └───────────────┘   └───────────────────┘

                         ┌─────────────────────────────────────┐
                         │           MONITORING                │
                         │                                     │
                         │  Sentry (Errors) + UptimeRobot     │
                         │  Alerts → Email                     │
                         └─────────────────────────────────────┘
```

### Domain Structure

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | app.quadcare.co.za | api.quadcare.co.za |
| **Staging** | staging.quadcare.co.za | api-staging.quadcare.co.za |

### Deployment Strategy Recommendation

| Branch | Environment | Trigger | Approval |
|--------|-------------|---------|----------|
| `staging` | Staging | Auto on push | None (immediate) |
| `main` | Production | Auto on push | **Manual merge from staging** |

**Rationale:** 
- Staging auto-deploys for rapid iteration
- Production deploys when you merge `staging` → `main`
- The merge itself is the "approval gate"
- Render handles CI/CD automatically on branch push

---

## Pre-Deployment Checklist

### Account Setup Checklist

| Service | Action | Status |
|---------|--------|--------|
| **GitHub** | Create `quadcare-telehealth` repository | ⬜ |
| | Create `staging` branch | ⬜ |
| | Set up branch protection on `main` | ⬜ |
| **Cloudflare** | Create account | ⬜ |
| | Add quadcare.co.za domain | ⬜ |
| | Configure DNS records | ⬜ |
| **Render** | Create account | ⬜ |
| | Create Team/Organization | ⬜ |
| | Connect GitHub repository | ⬜ |
| **Supabase** | Create STAGING project | ⬜ |
| | Create PRODUCTION project | ⬜ |
| | Upgrade PRODUCTION to Pro ($25/mo) | ⬜ |
| **Sentry** | Create account | ⬜ |
| | Create `quadcare-frontend` project | ⬜ |
| | Create `quadcare-backend` project | ⬜ |
| **Resend** | Verify quadcare.co.za domain | ⬜ |
| | Create production API key | ⬜ |
| **Daily.co** | Verify production domain | ⬜ |
| | Create production API key | ⬜ |
| **OpenAI** | Create production API key | ⬜ |
| | Set up billing alerts | ⬜ |

---

## Day-by-Day Battle Plan

### Phase 1: Foundation (Days 1-3)

---

#### DAY 1: Architecture Review & Account Setup

**Morning (4 hours)**

- [ ] **Code Review & Cleanup**
  ```bash
  # Remove all console.log statements
  grep -r "console.log" frontend/src --include="*.tsx" --include="*.ts" | wc -l
  
  # Remove debug code
  grep -r "// DEBUG\|// TODO\|// FIXME" . --include="*.py" --include="*.tsx"
  
  # Check for hardcoded URLs
  grep -r "localhost\|127.0.0.1" frontend/src backend/
  ```

- [ ] **Environment Variable Audit**
  - Document all required environment variables
  - Ensure no secrets in code
  - Create `.env.example` files

- [ ] **Dependency Audit**
  ```bash
  # Frontend - check for vulnerabilities
  cd frontend && yarn audit
  
  # Backend - check for vulnerabilities
  cd backend && pip-audit
  ```

**Afternoon (4 hours)**

- [ ] **Create Cloudflare Account**
  1. Go to https://dash.cloudflare.com/sign-up
  2. Add site: `quadcare.co.za`
  3. Cloudflare will provide nameservers
  4. Update nameservers at domain registrar (takes 24-48 hours)

- [ ] **Create Render Account**
  1. Go to https://render.com
  2. Sign up with GitHub
  3. Authorize Render to access your repos

- [ ] **Create Sentry Account**
  1. Go to https://sentry.io/signup
  2. Create organization: `quadcare`
  3. Create project: `quadcare-frontend` (React)
  4. Create project: `quadcare-backend` (Python/FastAPI)
  5. Note down DSN values

**Deliverables Day 1:**
- [ ] All accounts created
- [ ] Cloudflare nameserver change initiated
- [ ] Code audit report generated
- [ ] Environment variables documented

---

#### DAY 2: GitHub Repository & Supabase Setup

**Morning (4 hours)**

- [ ] **GitHub Repository Setup**
  ```bash
  # Initialize repository (if not already)
  git init
  git remote add origin git@github.com:YOUR_ORG/quadcare-telehealth.git
  
  # Create staging branch
  git checkout -b staging
  git push -u origin staging
  
  # Set main as default branch
  git checkout main
  git push -u origin main
  ```

- [ ] **Branch Protection Rules**
  
  Go to: GitHub → Repository → Settings → Branches → Add Rule
  
  **For `main` branch:**
  - [x] Require pull request before merging
  - [x] Require approvals: 1 (can be self for solo)
  - [x] Require status checks to pass
  - [x] Require branches to be up to date
  - [x] Do not allow bypassing

  **For `staging` branch:**
  - [x] Require status checks to pass

- [ ] **Create GitHub Secrets** (Settings → Secrets → Actions)
  ```
  # Will be used later for any GitHub Actions
  SENTRY_AUTH_TOKEN=xxx
  ```

**Afternoon (4 hours)**

- [ ] **Create Supabase STAGING Project**
  1. Go to https://app.supabase.com
  2. New Project → Name: `quadcare-staging`
  3. Choose region: closest to South Africa (eu-west or similar)
  4. Generate strong password → SAVE IT
  5. Note down:
     - Project URL
     - Anon Key
     - Service Role Key

- [ ] **Create Supabase PRODUCTION Project**
  1. New Project → Name: `quadcare-production`
  2. Same region as staging
  3. Generate strong password → SAVE IT
  4. Note down all keys
  5. **Upgrade to Pro Plan** ($25/month)
     - Dashboard → Organization → Billing → Upgrade

- [ ] **Export Current Schema**
  ```sql
  -- Connect to current Supabase project
  -- Go to SQL Editor and run:
  
  -- Export schema (run in Supabase Dashboard → SQL Editor)
  -- Or use Supabase CLI:
  supabase db dump -f schema.sql
  ```

**Deliverables Day 2:**
- [ ] GitHub repo with staging + main branches
- [ ] Branch protection configured
- [ ] Supabase staging project created
- [ ] Supabase production project created + Pro upgrade
- [ ] Schema exported from current database

---

#### DAY 3: Database Migration & Schema Setup

**Morning (4 hours)**

- [ ] **Install Supabase CLI**
  ```bash
  # macOS
  brew install supabase/tap/supabase
  
  # Or npm
  npm install -g supabase
  ```

- [ ] **Initialize Supabase in Project**
  ```bash
  cd /app
  supabase init
  ```

- [ ] **Create Migration Files**
  Create: `/app/supabase/migrations/`

  ```sql
  -- 001_initial_schema.sql
  -- (This should contain your full database schema)
  -- Tables: profiles, user_roles, appointments, clinical_notes,
  -- prescriptions, chat_conversations, chat_messages, bookings, etc.
  ```

- [ ] **Apply Schema to STAGING**
  ```bash
  # Link to staging project
  supabase link --project-ref YOUR_STAGING_PROJECT_REF
  
  # Push migrations
  supabase db push
  ```

**Afternoon (4 hours)**

- [ ] **Configure Row Level Security (RLS)**
  
  Ensure all tables have RLS enabled with appropriate policies.
  
  ```sql
  -- Example: profiles table
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);
  
  CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
  ```

- [ ] **Set Up Auth Providers**
  - Supabase Dashboard → Authentication → Providers
  - Enable Email/Password
  - Configure email templates
  - Set Site URL: `https://staging.quadcare.co.za`
  - Set Redirect URLs

- [ ] **Configure Storage Buckets**
  ```sql
  -- Create buckets for file storage
  INSERT INTO storage.buckets (id, name, public)
  VALUES 
    ('profile-photos', 'profile-photos', true),
    ('documents', 'documents', false),
    ('prescriptions', 'prescriptions', false);
  ```

- [ ] **Test Staging Database**
  - Create test user via Supabase Dashboard
  - Verify tables exist
  - Test RLS policies

**Deliverables Day 3:**
- [ ] Migration files created and version controlled
- [ ] Staging database fully configured
- [ ] RLS policies applied
- [ ] Auth configured
- [ ] Storage buckets created

---

### Phase 2: Deployment (Days 4-6)

---

#### DAY 4: Render Services Setup - Backend

**Morning (4 hours)**

- [ ] **Prepare Backend for Render**

  Create `/app/backend/render.yaml`:
  ```yaml
  # This file helps Render understand your service
  services:
    - type: web
      name: quadcare-api-staging
      env: python
      branch: staging
      buildCommand: pip install -r requirements.txt
      startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
      envVars:
        - key: PYTHON_VERSION
          value: 3.11.0
  ```

  Create `/app/backend/Dockerfile` (alternative):
  ```dockerfile
  FROM python:3.11-slim
  
  WORKDIR /app
  
  # Install dependencies
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  RUN pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
  
  # Copy application
  COPY . .
  
  # Expose port
  EXPOSE 8001
  
  # Start command
  CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
  ```

- [ ] **Create Staging Backend on Render**
  1. Render Dashboard → New → Web Service
  2. Connect repository: `quadcare-telehealth`
  3. Settings:
     - Name: `quadcare-api-staging`
     - Branch: `staging`
     - Root Directory: `backend`
     - Runtime: Python 3
     - Build Command: `pip install -r requirements.txt && pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/`
     - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
     - Instance Type: Starter ($7/month)

**Afternoon (4 hours)**

- [ ] **Configure Staging Environment Variables**
  
  Render → quadcare-api-staging → Environment
  
  ```
  # Database
  SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
  SUPABASE_ANON_KEY=eyJ...staging_anon_key
  SUPABASE_SERVICE_KEY=eyJ...staging_service_key
  
  # External Services
  DAILY_API_KEY=your_daily_api_key
  DAILY_DOMAIN=quadcare-sa.daily.co
  OPENAI_API_KEY=sk-...your_openai_key
  RESEND_API_KEY=re_...your_resend_key
  EMERGENT_LLM_KEY=sk-emergent-...
  
  # App Config
  CORS_ORIGINS=https://staging.quadcare.co.za
  ENVIRONMENT=staging
  
  # Sentry
  SENTRY_DSN=https://xxx@sentry.io/xxx
  ```

- [ ] **Create Production Backend on Render**
  1. New → Web Service
  2. Settings:
     - Name: `quadcare-api-production`
     - Branch: `main`
     - Root Directory: `backend`
     - Instance Type: Standard ($25/month)
  3. Add production environment variables (different Supabase keys!)

- [ ] **Test Backend Deployment**
  ```bash
  # Check staging health endpoint
  curl https://quadcare-api-staging.onrender.com/api/health
  
  # Expected response:
  # {"status": "healthy", "timestamp": "..."}
  ```

**Deliverables Day 4:**
- [ ] Staging backend deployed and accessible
- [ ] Production backend deployed (with production env vars)
- [ ] Health endpoints responding
- [ ] Logs accessible in Render dashboard

---

#### DAY 5: Render Services Setup - Frontend & Worker

**Morning (4 hours)**

- [ ] **Prepare Frontend for Production**

  Update `/app/frontend/vite.config.ts`:
  ```typescript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react-swc'
  import path from 'path'

  export default defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true, // Enable for Sentry
    },
  })
  ```

  Create `/app/frontend/.env.production`:
  ```
  REACT_APP_BACKEND_URL=https://api.quadcare.co.za
  REACT_APP_SUPABASE_URL=https://YOUR_PROD_PROJECT.supabase.co
  REACT_APP_SUPABASE_ANON_KEY=eyJ...production_anon_key
  REACT_APP_SENTRY_DSN=https://xxx@sentry.io/frontend
  ```

  Create `/app/frontend/.env.staging`:
  ```
  REACT_APP_BACKEND_URL=https://api-staging.quadcare.co.za
  REACT_APP_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
  REACT_APP_SUPABASE_ANON_KEY=eyJ...staging_anon_key
  REACT_APP_SENTRY_DSN=https://xxx@sentry.io/frontend
  ```

- [ ] **Create Staging Frontend on Render**
  1. Render Dashboard → New → Static Site
  2. Connect repository
  3. Settings:
     - Name: `quadcare-frontend-staging`
     - Branch: `staging`
     - Root Directory: `frontend`
     - Build Command: `yarn install && yarn build`
     - Publish Directory: `dist`
  4. Environment Variables:
     ```
     REACT_APP_BACKEND_URL=https://quadcare-api-staging.onrender.com
     REACT_APP_SUPABASE_URL=https://YOUR_STAGING.supabase.co
     REACT_APP_SUPABASE_ANON_KEY=eyJ...
     ```

**Afternoon (4 hours)**

- [ ] **Create Production Frontend on Render**
  - Same steps as staging
  - Name: `quadcare-frontend-production`
  - Branch: `main`
  - Production environment variables

- [ ] **Create Background Worker on Render**
  1. New → Background Worker
  2. Settings:
     - Name: `quadcare-worker-production`
     - Branch: `main`
     - Root Directory: `backend`
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `python worker.py` (we'll create this)
     - Instance Type: Starter ($7/month)

- [ ] **Create Worker Script**
  
  Create `/app/backend/worker.py`:
  ```python
  """
  Background Worker for Quadcare
  Handles: Bulk imports, heavy AI processing, scheduled tasks
  """
  import asyncio
  import logging
  from datetime import datetime
  import os

  logging.basicConfig(level=logging.INFO)
  logger = logging.getLogger(__name__)

  async def process_bulk_import_queue():
      """Process pending bulk import jobs"""
      # Implementation here
      pass

  async def process_transcription_queue():
      """Process pending audio transcriptions"""
      # Implementation here
      pass

  async def main():
      logger.info("Quadcare Worker started")
      
      while True:
          try:
              # Check for pending jobs every 30 seconds
              await process_bulk_import_queue()
              await process_transcription_queue()
              await asyncio.sleep(30)
          except Exception as e:
              logger.error(f"Worker error: {e}")
              await asyncio.sleep(60)  # Back off on error

  if __name__ == "__main__":
      asyncio.run(main())
  ```

**Deliverables Day 5:**
- [ ] Staging frontend deployed
- [ ] Production frontend deployed
- [ ] Background worker created and deployed
- [ ] All services showing in Render dashboard

---

#### DAY 6: Cloudflare DNS & SSL Configuration

**Morning (4 hours)**

- [ ] **Verify Cloudflare Nameservers Active**
  ```bash
  # Check nameservers
  dig NS quadcare.co.za
  
  # Should show Cloudflare nameservers like:
  # xxx.ns.cloudflare.com
  # yyy.ns.cloudflare.com
  ```

- [ ] **Configure DNS Records**
  
  Cloudflare Dashboard → quadcare.co.za → DNS
  
  | Type | Name | Content | Proxy |
  |------|------|---------|-------|
  | CNAME | app | quadcare-frontend-production.onrender.com | ✅ Proxied |
  | CNAME | staging | quadcare-frontend-staging.onrender.com | ✅ Proxied |
  | CNAME | api | quadcare-api-production.onrender.com | ✅ Proxied |
  | CNAME | api-staging | quadcare-api-staging.onrender.com | ✅ Proxied |

- [ ] **Configure SSL/TLS**
  
  Cloudflare → SSL/TLS → Overview
  - Set mode to: **Full (strict)**
  
  Cloudflare → SSL/TLS → Edge Certificates
  - Always Use HTTPS: ON
  - Automatic HTTPS Rewrites: ON
  - Minimum TLS Version: TLS 1.2

**Afternoon (4 hours)**

- [ ] **Configure Security Settings**
  
  Cloudflare → Security → WAF
  - Enable Managed Rules (free tier includes basic)
  
  Cloudflare → Security → Settings
  - Security Level: Medium
  - Challenge Passage: 30 minutes
  - Browser Integrity Check: ON

- [ ] **Configure Performance**
  
  Cloudflare → Speed → Optimization
  - Auto Minify: JavaScript, CSS, HTML
  - Brotli: ON
  
  Cloudflare → Caching → Configuration
  - Caching Level: Standard
  - Browser Cache TTL: 4 hours

- [ ] **Add Custom Domain to Render**
  
  For each Render service:
  1. Render → Service → Settings → Custom Domains
  2. Add domain (e.g., `app.quadcare.co.za`)
  3. Render will show verification steps
  4. Cloudflare is already configured, so it should verify

- [ ] **Test All Domains**
  ```bash
  # Test each endpoint
  curl -I https://app.quadcare.co.za
  curl -I https://api.quadcare.co.za/api/health
  curl -I https://staging.quadcare.co.za
  curl -I https://api-staging.quadcare.co.za/api/health
  ```

**Deliverables Day 6:**
- [ ] All DNS records configured
- [ ] SSL certificates active (automatic via Cloudflare)
- [ ] Custom domains connected to Render services
- [ ] All endpoints accessible via HTTPS

---

### Phase 3: Testing (Days 7-10)

---

#### DAY 7: Integration Testing - Backend

**Morning (4 hours)**

- [ ] **Create Backend Test Suite**
  
  Create `/app/backend/tests/test_api.py`:
  ```python
  """
  API Integration Tests for Quadcare Backend
  """
  import pytest
  import httpx
  import os

  BASE_URL = os.getenv("TEST_API_URL", "https://api-staging.quadcare.co.za")

  class TestHealthEndpoints:
      def test_health_check(self):
          response = httpx.get(f"{BASE_URL}/api/health")
          assert response.status_code == 200
          data = response.json()
          assert data["status"] == "healthy"

      def test_api_docs_accessible(self):
          response = httpx.get(f"{BASE_URL}/api/docs")
          assert response.status_code == 200

  class TestAuthEndpoints:
      def test_unauthenticated_request_returns_401(self):
          response = httpx.get(f"{BASE_URL}/api/users/me")
          assert response.status_code == 401

      def test_invalid_token_returns_401(self):
          headers = {"Authorization": "Bearer invalid_token"}
          response = httpx.get(f"{BASE_URL}/api/users/me", headers=headers)
          assert response.status_code == 401

  class TestPublicEndpoints:
      def test_fee_schedule_accessible(self):
          response = httpx.get(f"{BASE_URL}/api/bookings/fee-schedule")
          assert response.status_code == 200
          data = response.json()
          assert len(data) == 7  # 7 service types

      def test_medical_aid_schemes_accessible(self):
          response = httpx.get(f"{BASE_URL}/api/patient/medical-aid-schemes")
          assert response.status_code == 200
          data = response.json()
          assert len(data["schemes"]) >= 10

      def test_symptom_categories_accessible(self):
          response = httpx.get(f"{BASE_URL}/api/symptoms/common")
          assert response.status_code == 200

      def test_triage_reference_ranges_accessible(self):
          response = httpx.get(f"{BASE_URL}/api/triage/reference-ranges")
          assert response.status_code == 200

  class TestVideoEndpoints:
      def test_daily_health_check(self):
          response = httpx.get(f"{BASE_URL}/api/video/health")
          assert response.status_code == 200
          data = response.json()
          assert data["status"] == "ok"
          assert "daily.co" in data["domain"]

  class TestIDValidation:
      def test_valid_sa_id(self):
          response = httpx.post(
              f"{BASE_URL}/api/patient/validate-id",
              json={"id_number": "9001015009087"}  # Test ID
          )
          # Should return validation result (may be 200 or 400 depending on checksum)
          assert response.status_code in [200, 400]

      def test_invalid_sa_id_format(self):
          response = httpx.post(
              f"{BASE_URL}/api/patient/validate-id",
              json={"id_number": "123"}
          )
          assert response.status_code == 400
  ```

- [ ] **Run Backend Tests**
  ```bash
  cd /app/backend
  TEST_API_URL=https://api-staging.quadcare.co.za pytest tests/ -v
  ```

**Afternoon (4 hours)**

- [ ] **Test Authenticated Endpoints**
  
  Create test user in staging Supabase, then test:
  ```python
  class TestAuthenticatedEndpoints:
      @pytest.fixture
      def auth_headers(self):
          # Get token from Supabase
          # This would be done via Supabase client
          token = "your_test_user_token"
          return {"Authorization": f"Bearer {token}"}

      def test_get_user_profile(self, auth_headers):
          response = httpx.get(
              f"{BASE_URL}/api/users/me",
              headers=auth_headers
          )
          assert response.status_code == 200

      def test_get_appointments(self, auth_headers):
          response = httpx.get(
              f"{BASE_URL}/api/appointments",
              headers=auth_headers
          )
          assert response.status_code == 200

      def test_get_conversations(self, auth_headers):
          response = httpx.get(
              f"{BASE_URL}/api/chat/conversations",
              headers=auth_headers
          )
          assert response.status_code == 200
  ```

- [ ] **Document Test Results**
  
  Create `/app/backend/tests/RESULTS.md` with test outcomes

**Deliverables Day 7:**
- [ ] Backend test suite created
- [ ] All public endpoints tested
- [ ] Authenticated endpoints tested
- [ ] Test results documented

---

#### DAY 8: Integration Testing - Frontend

**Morning (4 hours)**

- [ ] **Create E2E Test Suite with Playwright**
  
  ```bash
  cd /app/frontend
  yarn add -D @playwright/test
  npx playwright install
  ```
  
  Create `/app/frontend/e2e/auth.spec.ts`:
  ```typescript
  import { test, expect } from '@playwright/test';

  const BASE_URL = process.env.TEST_URL || 'https://staging.quadcare.co.za';

  test.describe('Authentication Flow', () => {
    test('landing page loads correctly', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page).toHaveTitle(/Quadcare/i);
      await expect(page.locator('text=Book Consultation')).toBeVisible();
    });

    test('login page accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await expect(page.locator('text=Sign In')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('signup page accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.click('text=Create Account');
      await expect(page.locator('text=First Name')).toBeVisible();
    });

    test('password reset page accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.click('text=Forgot your password');
      await expect(page.locator('text=Reset Password')).toBeVisible();
    });

    test('invalid login shows error', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[type="email"]', 'invalid@test.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 });
    });
  });
  ```
  
  Create `/app/frontend/e2e/navigation.spec.ts`:
  ```typescript
  import { test, expect } from '@playwright/test';

  const BASE_URL = process.env.TEST_URL || 'https://staging.quadcare.co.za';

  test.describe('Navigation', () => {
    test('protected routes redirect to auth', async ({ page }) => {
      await page.goto(`${BASE_URL}/patient`);
      await expect(page).toHaveURL(/auth/);
    });

    test('clinician route protected', async ({ page }) => {
      await page.goto(`${BASE_URL}/clinician`);
      await expect(page).toHaveURL(/auth/);
    });

    test('admin route protected', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await expect(page).toHaveURL(/auth/);
    });
  });
  ```

**Afternoon (4 hours)**

- [ ] **Create Authenticated E2E Tests**
  
  Create `/app/frontend/e2e/patient-flow.spec.ts`:
  ```typescript
  import { test, expect } from '@playwright/test';

  // Test with a real staging user
  const TEST_EMAIL = 'test-patient@quadcare.co.za';
  const TEST_PASSWORD = 'TestPassword123!';
  const BASE_URL = process.env.TEST_URL || 'https://staging.quadcare.co.za';

  test.describe('Patient Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto(`${BASE_URL}/auth`);
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/patient**', { timeout: 15000 });
    });

    test('patient dashboard loads', async ({ page }) => {
      await expect(page.locator('text=Chat')).toBeVisible();
      await expect(page.locator('text=Consultations')).toBeVisible();
    });

    test('can start new chat', async ({ page }) => {
      await page.click('text=New Conversation');
      await expect(page.locator('textarea')).toBeVisible();
    });

    test('can view profile', async ({ page }) => {
      await page.click('text=Profile');
      await expect(page.locator('text=Personal Information')).toBeVisible();
    });
  });
  ```

- [ ] **Run E2E Tests**
  ```bash
  cd /app/frontend
  TEST_URL=https://staging.quadcare.co.za npx playwright test
  ```

- [ ] **Generate Test Report**
  ```bash
  npx playwright show-report
  ```

**Deliverables Day 8:**
- [ ] Playwright E2E tests created
- [ ] Public page tests passing
- [ ] Authenticated flow tests passing
- [ ] Test report generated

---

#### DAY 9: Security Audit

**Morning (4 hours)**

- [ ] **OWASP Top 10 Checklist**

  | Vulnerability | Check | Status |
  |--------------|-------|--------|
  | **A01: Broken Access Control** | | |
  | - All endpoints require auth where needed | Test each endpoint | ⬜ |
  | - Role-based access enforced | Test role restrictions | ⬜ |
  | - Users can't access other users' data | Test data isolation | ⬜ |
  | **A02: Cryptographic Failures** | | |
  | - All traffic over HTTPS | Check Cloudflare SSL | ⬜ |
  | - Passwords hashed (Supabase handles) | Verify Supabase config | ⬜ |
  | - Sensitive data encrypted at rest | Supabase Pro feature | ⬜ |
  | **A03: Injection** | | |
  | - SQL injection prevention | Parameterized queries | ⬜ |
  | - XSS prevention | React escapes by default | ⬜ |
  | **A04: Insecure Design** | | |
  | - Rate limiting on auth endpoints | Check implementation | ⬜ |
  | - Account lockout after failures | Supabase config | ⬜ |
  | **A05: Security Misconfiguration** | | |
  | - No default credentials | Check all services | ⬜ |
  | - Error messages don't leak info | Test error responses | ⬜ |
  | - CORS properly configured | Test from different origin | ⬜ |
  | **A07: Auth Failures** | | |
  | - Strong password policy | Check Supabase settings | ⬜ |
  | - JWT tokens expire | Check token lifetime | ⬜ |
  | - Refresh tokens rotate | Supabase handles | ⬜ |

- [ ] **Run Security Headers Check**
  ```bash
  # Check security headers
  curl -I https://api-staging.quadcare.co.za/api/health
  
  # Should see:
  # X-Content-Type-Options: nosniff
  # X-Frame-Options: DENY
  # Strict-Transport-Security: max-age=...
  ```

- [ ] **Add Security Headers to Backend**
  
  Update `/app/backend/server.py`:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  from starlette.middleware.base import BaseHTTPMiddleware

  class SecurityHeadersMiddleware(BaseHTTPMiddleware):
      async def dispatch(self, request, call_next):
          response = await call_next(request)
          response.headers["X-Content-Type-Options"] = "nosniff"
          response.headers["X-Frame-Options"] = "DENY"
          response.headers["X-XSS-Protection"] = "1; mode=block"
          response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
          response.headers["Permissions-Policy"] = "geolocation=(), microphone=(self), camera=(self)"
          return response

  app.add_middleware(SecurityHeadersMiddleware)
  ```

**Afternoon (4 hours)**

- [ ] **POPIA Compliance Checklist**

  | Requirement | Implementation | Status |
  |-------------|----------------|--------|
  | **Accountability** | | |
  | - Privacy policy published | Link in footer | ⬜ |
  | - Data processing purpose stated | In terms of service | ⬜ |
  | **Processing Limitation** | | |
  | - Only collect necessary data | Review data models | ⬜ |
  | - Consent obtained for processing | Signup flow includes consent | ⬜ |
  | **Purpose Specification** | | |
  | - Clear purpose for each data field | Documented | ⬜ |
  | **Information Quality** | | |
  | - Users can update their data | Profile editing enabled | ⬜ |
  | **Openness** | | |
  | - Users know what data is collected | Privacy policy | ⬜ |
  | **Security Safeguards** | | |
  | - Encryption at rest | Supabase Pro | ⬜ |
  | - Encryption in transit | HTTPS/TLS | ⬜ |
  | - Access controls | RLS + JWT | ⬜ |
  | **Data Subject Participation** | | |
  | - Users can request their data | Export feature | ⬜ |
  | - Users can delete their data | Account deletion | ⬜ |

- [ ] **Create Privacy Policy Page**
  
  Ensure frontend has `/privacy-policy` route with POPIA-compliant privacy policy.

- [ ] **Create Terms of Service Page**
  
  Ensure frontend has `/terms` route with medical service terms.

**Deliverables Day 9:**
- [ ] Security audit completed
- [ ] Security headers added
- [ ] POPIA compliance checklist completed
- [ ] Privacy policy and terms pages verified

---

#### DAY 10: Performance Testing & Optimization

**Morning (4 hours)**

- [ ] **Backend Performance Test**
  
  Create `/app/backend/tests/load_test.py`:
  ```python
  """
  Load Testing for Quadcare API
  Using locust for load testing
  """
  # Install: pip install locust
  
  from locust import HttpUser, task, between

  class QuadcareUser(HttpUser):
      wait_time = between(1, 3)
      
      @task(10)
      def health_check(self):
          self.client.get("/api/health")
      
      @task(5)
      def get_fee_schedule(self):
          self.client.get("/api/bookings/fee-schedule")
      
      @task(3)
      def get_medical_aids(self):
          self.client.get("/api/patient/medical-aid-schemes")
      
      @task(2)
      def get_symptoms(self):
          self.client.get("/api/symptoms/common")
  ```
  
  Run load test:
  ```bash
  pip install locust
  locust -f tests/load_test.py --host=https://api-staging.quadcare.co.za
  # Open http://localhost:8089
  # Configure: 50 users, spawn rate 5/s
  # Run for 5 minutes
  ```

- [ ] **Record Performance Baseline**
  
  | Endpoint | Avg Response Time | P95 | P99 |
  |----------|-------------------|-----|-----|
  | /api/health | ms | ms | ms |
  | /api/bookings/fee-schedule | ms | ms | ms |
  | /api/symptoms/common | ms | ms | ms |

**Afternoon (4 hours)**

- [ ] **Frontend Performance Audit**
  
  Use Chrome DevTools Lighthouse:
  1. Open https://staging.quadcare.co.za
  2. DevTools → Lighthouse → Generate Report
  3. Record scores:
  
  | Metric | Score | Target |
  |--------|-------|--------|
  | Performance | /100 | >80 |
  | Accessibility | /100 | >90 |
  | Best Practices | /100 | >90 |
  | SEO | /100 | >80 |

- [ ] **Optimize Bundle Size**
  ```bash
  cd /app/frontend
  yarn build
  
  # Analyze bundle
  npx vite-bundle-analyzer
  ```

- [ ] **Add Lazy Loading**
  
  Update routes to use lazy loading:
  ```typescript
  // In App.tsx
  import { lazy, Suspense } from 'react';
  
  const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
  const ClinicianDashboard = lazy(() => import('./pages/ClinicianDashboard'));
  const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
  
  // In routes:
  <Route path="/patient" element={
    <Suspense fallback={<LoadingSpinner />}>
      <PatientDashboard />
    </Suspense>
  } />
  ```

- [ ] **Database Query Optimization**
  
  Check Supabase query performance:
  1. Supabase Dashboard → Database → Query Performance
  2. Identify slow queries
  3. Add indexes where needed

**Deliverables Day 10:**
- [ ] Load test completed
- [ ] Performance baseline documented
- [ ] Lighthouse audit completed
- [ ] Optimizations implemented

---

### Phase 4: Production Deployment (Days 11-13)

---

#### DAY 11: Production Database Setup

**Morning (4 hours)**

- [ ] **Apply Schema to Production Supabase**
  ```bash
  # Link to production project
  supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
  
  # Push migrations
  supabase db push
  ```

- [ ] **Configure Production Auth**
  
  Supabase Production → Authentication → URL Configuration:
  - Site URL: `https://app.quadcare.co.za`
  - Redirect URLs:
    - `https://app.quadcare.co.za`
    - `https://app.quadcare.co.za/auth/callback`

- [ ] **Configure Production Email Templates**
  
  Supabase → Authentication → Email Templates:
  - Confirm signup
  - Reset password
  - Magic link
  
  Update templates with Quadcare branding.

- [ ] **Set Up Storage Buckets in Production**
  ```sql
  -- Run in Supabase SQL Editor
  INSERT INTO storage.buckets (id, name, public)
  VALUES 
    ('profile-photos', 'profile-photos', true),
    ('documents', 'documents', false),
    ('prescriptions', 'prescriptions', false);
  ```

**Afternoon (4 hours)**

- [ ] **Data Migration (if applicable)**
  
  If migrating existing users:
  ```sql
  -- Export from staging
  COPY (SELECT * FROM profiles) TO '/tmp/profiles.csv' CSV HEADER;
  
  -- Import to production (carefully!)
  COPY profiles FROM '/tmp/profiles.csv' CSV HEADER;
  ```

- [ ] **Verify RLS Policies**
  ```sql
  -- Check all tables have RLS enabled
  SELECT schemaname, tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public';
  ```

- [ ] **Create Production Admin User**
  1. Supabase → Authentication → Users → Invite User
  2. Create admin account with your email
  3. Set role to 'admin' in user_roles table

**Deliverables Day 11:**
- [ ] Production database schema deployed
- [ ] Auth configured for production domain
- [ ] Storage buckets created
- [ ] Admin user created

---

#### DAY 12: Production Services Deployment

**Morning (4 hours)**

- [ ] **Update Production Environment Variables on Render**
  
  Render → quadcare-api-production → Environment:
  ```
  # Supabase PRODUCTION
  SUPABASE_URL=https://YOUR_PRODUCTION_PROJECT.supabase.co
  SUPABASE_ANON_KEY=eyJ...production_anon_key
  SUPABASE_SERVICE_KEY=eyJ...production_service_key
  
  # External Services (use production keys)
  DAILY_API_KEY=your_daily_production_key
  DAILY_DOMAIN=quadcare-sa.daily.co
  OPENAI_API_KEY=sk-...production_key
  RESEND_API_KEY=re_...production_key
  EMERGENT_LLM_KEY=sk-emergent-...
  
  # CORS - Production only
  CORS_ORIGINS=https://app.quadcare.co.za
  ENVIRONMENT=production
  
  # Sentry
  SENTRY_DSN=https://xxx@sentry.io/backend
  ```

  Render → quadcare-frontend-production → Environment:
  ```
  REACT_APP_BACKEND_URL=https://api.quadcare.co.za
  REACT_APP_SUPABASE_URL=https://YOUR_PRODUCTION.supabase.co
  REACT_APP_SUPABASE_ANON_KEY=eyJ...production
  REACT_APP_SENTRY_DSN=https://xxx@sentry.io/frontend
  ```

- [ ] **Merge staging → main**
  ```bash
  git checkout main
  git merge staging
  git push origin main
  ```
  
  This triggers production deployment on Render.

- [ ] **Monitor Deployment**
  - Watch Render logs for errors
  - Verify all services start successfully

**Afternoon (4 hours)**

- [ ] **Verify Production Endpoints**
  ```bash
  # Health check
  curl https://api.quadcare.co.za/api/health
  
  # Fee schedule
  curl https://api.quadcare.co.za/api/bookings/fee-schedule
  
  # Frontend loads
  curl -I https://app.quadcare.co.za
  ```

- [ ] **Test Critical Flows on Production**
  
  | Flow | Status |
  |------|--------|
  | User signup | ⬜ |
  | User login | ⬜ |
  | Password reset | ⬜ |
  | Patient dashboard access | ⬜ |
  | Start chat conversation | ⬜ |
  | View fee schedule | ⬜ |

- [ ] **Configure Resend for Production**
  1. Resend Dashboard → Domains → Add Domain
  2. Add: `quadcare.co.za`
  3. Add DNS records to Cloudflare:
     - SPF record
     - DKIM records
  4. Verify domain

**Deliverables Day 12:**
- [ ] Production backend deployed and running
- [ ] Production frontend deployed and running
- [ ] All endpoints accessible
- [ ] Critical flows tested
- [ ] Email domain verified

---

#### DAY 13: Monitoring & Alerting Setup

**Morning (4 hours)**

- [ ] **Set Up Sentry Error Tracking**
  
  **Backend Integration:**
  
  Update `/app/backend/server.py`:
  ```python
  import sentry_sdk
  from sentry_sdk.integrations.fastapi import FastApiIntegration
  from sentry_sdk.integrations.starlette import StarletteIntegration

  SENTRY_DSN = os.getenv("SENTRY_DSN")
  ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

  if SENTRY_DSN:
      sentry_sdk.init(
          dsn=SENTRY_DSN,
          integrations=[
              StarletteIntegration(),
              FastApiIntegration(),
          ],
          traces_sample_rate=0.1,  # 10% of transactions
          environment=ENVIRONMENT,
          send_default_pii=False,  # Don't send PII for POPIA
      )
  ```
  
  Add to requirements.txt:
  ```
  sentry-sdk[fastapi]>=1.40.0
  ```

  **Frontend Integration:**
  
  Update `/app/frontend/src/main.tsx`:
  ```typescript
  import * as Sentry from "@sentry/react";

  const SENTRY_DSN = import.meta.env.REACT_APP_SENTRY_DSN;

  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
    });
  }
  ```
  
  Add to package.json:
  ```bash
  yarn add @sentry/react
  ```

- [ ] **Configure Sentry Alerts**
  
  Sentry → Settings → Alerts:
  1. Create alert: "High error rate"
     - Condition: Error count > 10 in 1 hour
     - Action: Email notification
  
  2. Create alert: "New issue"
     - Condition: First seen
     - Action: Email notification

**Afternoon (4 hours)**

- [ ] **Set Up Uptime Monitoring**
  
  Create account at https://uptimerobot.com (free tier: 50 monitors)
  
  Create monitors:
  | Monitor | URL | Interval |
  |---------|-----|----------|
  | Production Frontend | https://app.quadcare.co.za | 5 min |
  | Production API | https://api.quadcare.co.za/api/health | 5 min |
  | Staging Frontend | https://staging.quadcare.co.za | 5 min |
  | Staging API | https://api-staging.quadcare.co.za/api/health | 5 min |
  
  Configure email alerts for downtime.

- [ ] **Create Status Page (Optional)**
  
  UptimeRobot → Status Pages → Create
  - Public URL for status updates
  - Add all monitors
  - Brand with Quadcare colors

- [ ] **Set Up Database Monitoring**
  
  Supabase Dashboard → Database → Query Performance
  - Enable query analysis
  - Set up slow query alerts

- [ ] **Create Monitoring Dashboard**
  
  Create `/app/MONITORING_RUNBOOK.md`:
  ```markdown
  # Quadcare Monitoring Runbook

  ## Dashboards
  - Sentry: https://sentry.io/organizations/quadcare/
  - UptimeRobot: https://uptimerobot.com/dashboard
  - Render: https://dashboard.render.com
  - Supabase: https://app.supabase.com/project/xxx
  - Cloudflare: https://dash.cloudflare.com

  ## Alert Escalation
  1. Automated alert → Email
  2. If no response in 15 min → SMS (future)
  3. If critical → Call

  ## On-Call Contacts
  - Primary: [Your Name] - [Your Email]
  ```

**Deliverables Day 13:**
- [ ] Sentry configured for frontend and backend
- [ ] Alert rules configured
- [ ] Uptime monitoring active
- [ ] Monitoring runbook created

---

### Phase 5: Final Preparation (Days 14-15)

---

#### DAY 14: Final Testing & Documentation

**Morning (4 hours)**

- [ ] **End-to-End Production Test**
  
  Test each user journey on production:
  
  **Patient Journey:**
  | Step | Status | Notes |
  |------|--------|-------|
  | 1. Sign up as new patient | ⬜ | |
  | 2. Verify email | ⬜ | |
  | 3. Complete onboarding | ⬜ | |
  | 4. Start chat with reception | ⬜ | |
  | 5. (Reception creates booking) | ⬜ | |
  | 6. Receive booking confirmation | ⬜ | |
  | 7. Join video consultation | ⬜ | |
  | 8. Rate consultation | ⬜ | |
  | 9. View invoice | ⬜ | |
  | 10. Download prescription PDF | ⬜ | |

  **Clinician Journey:**
  | Step | Status | Notes |
  |------|--------|-------|
  | 1. Login as doctor/nurse | ⬜ | |
  | 2. View today's queue | ⬜ | |
  | 3. View patient history | ⬜ | |
  | 4. Start video consultation | ⬜ | |
  | 5. Record consultation | ⬜ | |
  | 6. Generate SOAP notes (AI) | ⬜ | |
  | 7. Save clinical notes | ⬜ | |
  | 8. Create prescription | ⬜ | |
  | 9. Complete consultation | ⬜ | |

  **Reception Journey:**
  | Step | Status | Notes |
  |------|--------|-------|
  | 1. Login as receptionist | ⬜ | |
  | 2. View unassigned chats | ⬜ | |
  | 3. Claim conversation | ⬜ | |
  | 4. Assist patient | ⬜ | |
  | 5. Create booking | ⬜ | |
  | 6. Generate invoice | ⬜ | |

**Afternoon (4 hours)**

- [ ] **Create User Documentation**
  
  Create quick-start guides:
  - Patient Guide (PDF/web)
  - Clinician Guide (PDF/web)
  - Reception Guide (PDF/web)
  - Admin Guide (PDF/web)

- [ ] **Update README**
  
  Ensure `/app/README.md` has:
  - Production URLs
  - Environment setup instructions
  - Deployment commands
  - Contact information

- [ ] **Create Runbook**
  
  `/app/RUNBOOK.md`:
  - Common issues and solutions
  - How to restart services
  - How to check logs
  - How to rollback

**Deliverables Day 14:**
- [ ] All user journeys tested on production
- [ ] User documentation created
- [ ] README updated
- [ ] Runbook created

---

#### DAY 15: Go-Live Day

**Morning (4 hours)**

- [ ] **Pre-Launch Checklist**

  | Category | Item | Status |
  |----------|------|--------|
  | **Infrastructure** | | |
  | | All services running | ⬜ |
  | | SSL certificates valid | ⬜ |
  | | DNS propagated | ⬜ |
  | | Backups enabled | ⬜ |
  | **Security** | | |
  | | All secrets in env vars | ⬜ |
  | | CORS properly configured | ⬜ |
  | | Rate limiting active | ⬜ |
  | **Monitoring** | | |
  | | Sentry active | ⬜ |
  | | Uptime monitoring active | ⬜ |
  | | Email alerts configured | ⬜ |
  | **Data** | | |
  | | Production database ready | ⬜ |
  | | Admin user created | ⬜ |
  | | Test data cleaned | ⬜ |
  | **Documentation** | | |
  | | Privacy policy live | ⬜ |
  | | Terms of service live | ⬜ |
  | | User guides ready | ⬜ |

- [ ] **Notify Stakeholders**
  - Send "Go-Live" notification
  - Share production URLs
  - Share monitoring dashboard access

- [ ] **Enable Production Traffic**
  
  If using feature flag or maintenance mode, disable it now.

**Afternoon (4 hours)**

- [ ] **Monitor Launch**
  - Watch Sentry for errors
  - Monitor Render logs
  - Check Supabase query performance
  - Be ready to respond to issues

- [ ] **Document Known Issues**
  - Any non-critical issues found
  - Workarounds provided
  - Scheduled for fix

- [ ] **Post-Launch Communication**
  - Send "Launch Successful" notification
  - Document any issues encountered
  - Plan first week monitoring schedule

**Deliverables Day 15:**
- [ ] Platform live at app.quadcare.co.za
- [ ] All systems monitored
- [ ] Stakeholders notified
- [ ] First users onboarded

---

## Environment Configuration

### Environment Variables Reference

#### Backend (.env)

```bash
# ===================
# STAGING ENVIRONMENT
# ===================

# Database
SUPABASE_URL=https://YOUR_STAGING.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# External Services
DAILY_API_KEY=xxx
DAILY_DOMAIN=quadcare-sa.daily.co
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
EMERGENT_LLM_KEY=sk-emergent-...

# App Config
CORS_ORIGINS=https://staging.quadcare.co.za
ENVIRONMENT=staging

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/backend

# ===================
# PRODUCTION ENVIRONMENT
# ===================

# Database
SUPABASE_URL=https://YOUR_PRODUCTION.supabase.co
SUPABASE_ANON_KEY=eyJ...production
SUPABASE_SERVICE_KEY=eyJ...production

# External Services (same keys or production-specific)
DAILY_API_KEY=xxx
DAILY_DOMAIN=quadcare-sa.daily.co
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
EMERGENT_LLM_KEY=sk-emergent-...

# App Config
CORS_ORIGINS=https://app.quadcare.co.za
ENVIRONMENT=production

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/backend
```

#### Frontend (.env)

```bash
# ===================
# STAGING
# ===================
REACT_APP_BACKEND_URL=https://api-staging.quadcare.co.za
REACT_APP_SUPABASE_URL=https://YOUR_STAGING.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...staging
REACT_APP_SENTRY_DSN=https://xxx@sentry.io/frontend

# ===================
# PRODUCTION
# ===================
REACT_APP_BACKEND_URL=https://api.quadcare.co.za
REACT_APP_SUPABASE_URL=https://YOUR_PRODUCTION.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...production
REACT_APP_SENTRY_DSN=https://xxx@sentry.io/frontend
```

---

## Rollback Procedures

### Scenario 1: Bad Backend Deployment

```bash
# Option A: Rollback via Render Dashboard
# 1. Render → Service → Deploys
# 2. Find last working deployment
# 3. Click "Redeploy"

# Option B: Git revert
git checkout main
git revert HEAD
git push origin main
# Auto-deploys previous version
```

### Scenario 2: Bad Frontend Deployment

```bash
# Same as backend - use Render redeploy or git revert
```

### Scenario 3: Database Migration Issue

```sql
-- Supabase keeps point-in-time backups (Pro)
-- Contact Supabase support for restore if needed

-- For manual rollback, create inverse migration:
-- e.g., if you added a column:
ALTER TABLE table_name DROP COLUMN column_name;
```

### Scenario 3: Complete Rollback

If everything is broken:
1. Switch DNS back to old system (if exists)
2. Put maintenance page on Cloudflare
3. Debug and fix
4. Redeploy

---

## Incident Response Playbook

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1 - Critical** | Service completely down | 15 minutes | API returning 500s |
| **P2 - High** | Major feature broken | 1 hour | Video calls not working |
| **P3 - Medium** | Minor feature broken | 4 hours | PDF generation failing |
| **P4 - Low** | Cosmetic/minor issue | 24 hours | UI alignment issue |

### Incident Response Steps

1. **Detect** - Alert received or user report
2. **Acknowledge** - Respond within SLA
3. **Diagnose** - Check logs, Sentry, monitoring
4. **Fix** - Apply fix or rollback
5. **Communicate** - Update stakeholders
6. **Document** - Post-incident report

### Common Issues & Solutions

| Issue | Check | Solution |
|-------|-------|----------|
| 502 Bad Gateway | Render logs | Restart service |
| 401 Unauthorized | Token expiry | Check Supabase auth |
| Slow responses | Supabase queries | Add indexes |
| CORS errors | Browser console | Check CORS_ORIGINS |
| Video not connecting | Daily.co dashboard | Check API key |

---

## Post-Launch Monitoring

### Daily Checks (First 2 Weeks)

- [ ] Check Sentry for new errors
- [ ] Check UptimeRobot status
- [ ] Review Render logs
- [ ] Check Supabase usage
- [ ] Review user feedback

### Weekly Checks

- [ ] Supabase database size
- [ ] API response times
- [ ] Error rate trends
- [ ] Cost tracking
- [ ] User growth metrics

### Monthly Reviews

- [ ] Infrastructure cost analysis
- [ ] Performance optimization opportunities
- [ ] Security updates needed
- [ ] Feature requests backlog
- [ ] Capacity planning

---

## Appendices

### Appendix A: Service URLs

| Service | Staging | Production |
|---------|---------|------------|
| Frontend | https://staging.quadcare.co.za | https://app.quadcare.co.za |
| Backend API | https://api-staging.quadcare.co.za | https://api.quadcare.co.za |
| API Docs | https://api-staging.quadcare.co.za/api/docs | https://api.quadcare.co.za/api/docs |
| Supabase | https://app.supabase.com/project/STAGING | https://app.supabase.com/project/PRODUCTION |

### Appendix B: Account Credentials Location

| Service | Where Credentials Are Stored |
|---------|------------------------------|
| Cloudflare | Password manager |
| Render | Password manager |
| Supabase | Password manager |
| Sentry | Password manager |
| Daily.co | Password manager |
| OpenAI | Password manager |
| Resend | Password manager |

### Appendix C: Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | [Your Name] | [Your Email] |
| Backup | [Backup Name] | [Backup Email] |
| Supabase Support | - | support@supabase.com |
| Render Support | - | support@render.com |

### Appendix D: Cost Tracking

Track monthly:
- Render invoice
- Supabase invoice
- Daily.co usage
- OpenAI usage
- Resend usage

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2025 | DevOps | Initial creation |

---

**End of Deployment Battle Plan**

*Good luck with your launch! 🚀*
