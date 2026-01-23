-- =====================================================
-- HCF Telehealth - Complete Database Migration Script
-- VERSION 2.0 - Multi-Tenant Ready
-- =====================================================
-- Target Launch: 1 March 2026
-- Architecture: Single health group, multi-clinic
-- =====================================================
-- 
-- Key Features:
-- ✅ Multi-tenancy from day one (clinic_id on all tables)
-- ✅ Default clinic auto-assigned (no UI change needed for launch)
-- ✅ UUID-based (consistent with Supabase Auth)
-- ✅ RLS policies filter by clinic
-- ✅ Ready to "turn on" clinic selector later
--
-- =====================================================

-- =====================================================
-- PART 1: ENUMS
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'patient', 'nurse', 'doctor', 'receptionist');

CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

CREATE TYPE public.chat_status AS ENUM ('new', 'active', 'waiting', 'booked', 'resolved', 'closed');

CREATE TYPE public.consultation_type AS ENUM ('video', 'audio', 'chat', 'in_person');

CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

CREATE TYPE public.message_type_chat AS ENUM ('text', 'file', 'image', 'system');

CREATE TYPE public.patient_billing_type AS ENUM ('cash', 'medical_aid', 'campus_africa', 'university_student');

CREATE TYPE public.service_type AS ENUM (
    'teleconsultation', 
    'follow_up_0_3', 
    'follow_up_4_7', 
    'script_1_month', 
    'script_3_months', 
    'script_6_months', 
    'medical_forms',
    'walk_in_consultation'
);

CREATE TYPE public.symptom_severity AS ENUM ('mild', 'moderate', 'severe', 'critical');

CREATE TYPE public.clinic_type AS ENUM ('telehealth', 'walk_in', 'hybrid');

-- =====================================================
-- PART 2: CLINICS TABLE (Multi-Tenancy Foundation)
-- =====================================================

-- Clinics table - the foundation of multi-tenancy
CREATE TABLE public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- Short code like 'QC-TH', 'QC-JHB-01'
    clinic_type clinic_type NOT NULL DEFAULT 'telehealth',
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb, -- Clinic-specific settings
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default telehealth clinic (will be used for all records until multi-clinic UI is enabled)
INSERT INTO public.clinics (id, name, code, clinic_type, phone, email)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Quadcare Telehealth',
    'QC-TH',
    'telehealth',
    '+27 XXX XXX XXXX',
    'telehealth@quadcare.co.za'
);

-- Create constant for default clinic ID (used in defaults and RLS)
CREATE OR REPLACE FUNCTION public.default_clinic_id()
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT '00000000-0000-0000-0000-000000000001'::uuid;
$$;

-- =====================================================
-- PART 3: HELPER FUNCTIONS
-- =====================================================

-- Function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to get user's clinic ID
CREATE OR REPLACE FUNCTION public.get_user_clinic_id(_user_id uuid)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(clinic_id, default_clinic_id()) 
  FROM public.user_roles 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- Function to check if user belongs to clinic
CREATE OR REPLACE FUNCTION public.user_in_clinic(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (clinic_id = _clinic_id OR clinic_id IS NULL)
  )
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _clinic_id UUID;
BEGIN
  -- Get clinic_id from metadata or use default
  _clinic_id := COALESCE(
    (NEW.raw_user_meta_data->>'clinic_id')::uuid,
    default_clinic_id()
  );

  -- Insert into profiles
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name);

  -- Insert into user_roles with clinic_id
  INSERT INTO public.user_roles (user_id, role, clinic_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::app_role,
    _clinic_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, user_roles.role),
    clinic_id = COALESCE(EXCLUDED.clinic_id, user_roles.clinic_id);

  -- If role is nurse or doctor, create clinician_profiles entry
  IF NEW.raw_user_meta_data->>'role' IN ('nurse', 'doctor') THEN
    INSERT INTO public.clinician_profiles (id, clinic_id, specialization, is_available)
    VALUES (
      NEW.id,
      _clinic_id,
      CASE 
        WHEN NEW.raw_user_meta_data->>'role' = 'nurse' THEN 'Clinical Associate'
        ELSE 'General Practice'
      END,
      true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Function to set sender name on chat messages
CREATE OR REPLACE FUNCTION public.set_sender_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.sender_name IS NULL AND NEW.sender_role != 'system' THEN
        SELECT TRIM(CONCAT(first_name, ' ', last_name))
        INTO NEW.sender_name
        FROM profiles
        WHERE id = NEW.sender_id;
        
        IF NEW.sender_name IS NULL OR NEW.sender_name = '' THEN
            NEW.sender_name := 'Unknown';
        END IF;
    END IF;
    
    IF NEW.sender_role = 'system' AND (NEW.sender_name IS NULL OR NEW.sender_name = '') THEN
        NEW.sender_name := 'System';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE chat_conversations
    SET 
        last_message = LEFT(NEW.content, 100),
        last_message_at = NEW.created_at,
        updated_at = NOW(),
        unread_count = unread_count + 1
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- =====================================================
-- PART 4: CORE TABLES
-- =====================================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    date_of_birth DATE,
    id_number TEXT,
    avatar_url TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table with clinic assignment
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Clinician profiles (additional info for nurses/doctors)
CREATE TABLE public.clinician_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    specialization TEXT,
    qualification TEXT,
    hpcsa_number TEXT,
    bio TEXT,
    years_experience INTEGER,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clinician availability slots
CREATE TABLE public.clinician_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Symptom assessments (pre-consultation questionnaire)
CREATE TABLE public.symptom_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    symptoms TEXT[] NOT NULL,
    description TEXT,
    severity symptom_severity NOT NULL DEFAULT 'mild',
    recommended_specialization TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PART 5: APPOINTMENTS & BOOKINGS
-- =====================================================

-- Appointments (core scheduling)
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symptom_assessment_id UUID REFERENCES public.symptom_assessments(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    consultation_type consultation_type NOT NULL DEFAULT 'video',
    status appointment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings (receptionist-created, linked to chat)
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID, -- Will reference chat_conversations
    appointment_id UUID REFERENCES public.appointments(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    service_type service_type NOT NULL DEFAULT 'teleconsultation',
    billing_type patient_billing_type NOT NULL DEFAULT 'cash',
    status appointment_status NOT NULL DEFAULT 'confirmed',
    notes TEXT,
    invoice_id UUID,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PART 6: CHAT SYSTEM
-- =====================================================

-- Chat conversations (patient-receptionist)
CREATE TABLE public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receptionist_id UUID REFERENCES auth.users(id),
    booking_id UUID,
    patient_type patient_billing_type,
    status chat_status NOT NULL DEFAULT 'new',
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key from bookings to chat_conversations
ALTER TABLE public.bookings 
ADD CONSTRAINT fk_bookings_conversation 
FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id);

-- Chat messages
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL,
    sender_name TEXT,
    content TEXT NOT NULL,
    message_type message_type_chat NOT NULL DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PART 7: INVOICES
-- =====================================================

CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type service_type NOT NULL,
    service_name TEXT NOT NULL,
    service_description TEXT,
    amount NUMERIC NOT NULL,
    consultation_date TIMESTAMPTZ NOT NULL,
    status invoice_status NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- PART 8: CONSULTATION SESSIONS (Video Calls)
-- =====================================================

CREATE TABLE public.consultation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting',
    patient_joined_at TIMESTAMPTZ,
    clinician_joined_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    recording_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consultation messages (in-call chat)
CREATE TABLE public.consultation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.consultation_sessions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PART 9: CLINICAL DOCUMENTATION
-- =====================================================

-- Clinical notes (SOAP notes)
CREATE TABLE public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- SOAP Structure
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    examination_findings TEXT,
    diagnosis TEXT[],
    icd10_codes JSONB DEFAULT '[]'::jsonb,
    treatment_plan TEXT,
    prescriptions JSONB DEFAULT '[]'::jsonb,
    -- Follow-up
    follow_up_date DATE,
    follow_up_instructions TEXT,
    -- Referral (for doctor escalation)
    referral_required BOOLEAN DEFAULT false,
    referral_details TEXT,
    escalated_to_doctor BOOLEAN DEFAULT false,
    escalation_notes TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'draft',
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prescriptions
CREATE TABLE public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) DEFAULT default_clinic_id(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id),
    clinical_note_id UUID REFERENCES public.clinical_notes(id),
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT NOT NULL,
    quantity INTEGER,
    instructions TEXT,
    refills INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    pharmacy_notes TEXT,
    prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PART 10: NOTIFICATIONS & MISC
-- =====================================================

-- Push notification subscriptions
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
);

-- Audit log for important actions
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PART 11: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 12: RLS POLICIES - CLINICS
-- =====================================================

CREATE POLICY "Anyone can view active clinics"
ON public.clinics FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage clinics"
ON public.clinics FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- PART 13: RLS POLICIES - PROFILES
-- =====================================================

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

-- =====================================================
-- PART 14: RLS POLICIES - USER ROLES
-- =====================================================

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view roles in their clinic"
ON public.user_roles FOR SELECT
USING (
    (has_role(auth.uid(), 'admin') OR 
     has_role(auth.uid(), 'nurse') OR 
     has_role(auth.uid(), 'doctor') OR 
     has_role(auth.uid(), 'receptionist'))
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id IS NULL)
);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- PART 15: RLS POLICIES - CLINICIAN PROFILES
-- =====================================================

CREATE POLICY "Anyone can view available clinicians in their clinic"
ON public.clinician_profiles FOR SELECT
USING (
    is_available = true 
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

CREATE POLICY "Clinicians can manage their own profile"
ON public.clinician_profiles FOR ALL
USING (auth.uid() = id);

CREATE POLICY "Staff can view clinicians in their clinic"
ON public.clinician_profiles FOR SELECT
USING (
    (has_role(auth.uid(), 'admin') OR 
     has_role(auth.uid(), 'nurse') OR 
     has_role(auth.uid(), 'doctor') OR 
     has_role(auth.uid(), 'receptionist'))
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- =====================================================
-- PART 16: RLS POLICIES - APPOINTMENTS
-- =====================================================

CREATE POLICY "Patients can view their own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create own appointments"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view their appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can update their appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = clinician_id);

CREATE POLICY "Staff can manage appointments in their clinic"
ON public.appointments FOR ALL
USING (
    (has_role(auth.uid(), 'admin') OR 
     has_role(auth.uid(), 'nurse') OR 
     has_role(auth.uid(), 'doctor') OR 
     has_role(auth.uid(), 'receptionist'))
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- =====================================================
-- PART 17: RLS POLICIES - CHAT
-- =====================================================

CREATE POLICY "Patients can view own conversations"
ON public.chat_conversations FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Staff can manage conversations in their clinic"
ON public.chat_conversations FOR ALL
USING (
    (has_role(auth.uid(), 'admin') OR 
     has_role(auth.uid(), 'nurse') OR 
     has_role(auth.uid(), 'doctor') OR 
     has_role(auth.uid(), 'receptionist'))
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- Chat Messages
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM chat_conversations c
        WHERE c.id = chat_messages.conversation_id
        AND (c.patient_id = auth.uid() OR c.receptionist_id = auth.uid())
    )
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'nurse')
    OR has_role(auth.uid(), 'doctor')
    OR has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Users can send messages in their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id
    AND (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = chat_messages.conversation_id
            AND (c.patient_id = auth.uid() OR c.receptionist_id = auth.uid())
        )
        OR has_role(auth.uid(), 'admin')
        OR has_role(auth.uid(), 'nurse')
        OR has_role(auth.uid(), 'doctor')
        OR has_role(auth.uid(), 'receptionist')
    )
);

-- =====================================================
-- PART 18: RLS POLICIES - BOOKINGS
-- =====================================================

CREATE POLICY "Patients can view own bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view assigned bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Staff can manage bookings in their clinic"
ON public.bookings FOR ALL
USING (
    (has_role(auth.uid(), 'admin') OR 
     has_role(auth.uid(), 'nurse') OR 
     has_role(auth.uid(), 'doctor') OR 
     has_role(auth.uid(), 'receptionist'))
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- =====================================================
-- PART 19: RLS POLICIES - INVOICES
-- =====================================================

CREATE POLICY "Patients can view own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Staff can manage invoices in their clinic"
ON public.invoices FOR ALL
USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist'))
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- =====================================================
-- PART 20: RLS POLICIES - CONSULTATION SESSIONS
-- =====================================================

CREATE POLICY "Patients can view their sessions"
ON public.consultation_sessions FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create sessions"
ON public.consultation_sessions FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Clinicians can manage their sessions"
ON public.consultation_sessions FOR ALL
USING (auth.uid() = clinician_id);

CREATE POLICY "Participants can update sessions"
ON public.consultation_sessions FOR UPDATE
USING (auth.uid() = patient_id OR auth.uid() = clinician_id);

-- Consultation Messages
CREATE POLICY "Participants can view session messages"
ON public.consultation_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM consultation_sessions cs
        WHERE cs.id = consultation_messages.session_id
        AND (cs.patient_id = auth.uid() OR cs.clinician_id = auth.uid())
    )
);

CREATE POLICY "Participants can send session messages"
ON public.consultation_messages FOR INSERT
WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
        SELECT 1 FROM consultation_sessions cs
        WHERE cs.id = consultation_messages.session_id
        AND (cs.patient_id = auth.uid() OR cs.clinician_id = auth.uid())
    )
);

-- =====================================================
-- PART 21: RLS POLICIES - CLINICAL NOTES
-- =====================================================

CREATE POLICY "Clinicians can manage their notes"
ON public.clinical_notes FOR ALL
USING (auth.uid() = clinician_id);

CREATE POLICY "Patients can view their completed notes"
ON public.clinical_notes FOR SELECT
USING (auth.uid() = patient_id AND status = 'completed');

CREATE POLICY "Admins can view all notes in their clinic"
ON public.clinical_notes FOR SELECT
USING (
    has_role(auth.uid(), 'admin')
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- =====================================================
-- PART 22: RLS POLICIES - PRESCRIPTIONS
-- =====================================================

CREATE POLICY "Patients can view their prescriptions"
ON public.prescriptions FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can manage their prescriptions"
ON public.prescriptions FOR ALL
USING (auth.uid() = clinician_id);

CREATE POLICY "Admins can view all prescriptions in their clinic"
ON public.prescriptions FOR SELECT
USING (
    has_role(auth.uid(), 'admin')
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id = default_clinic_id())
);

-- =====================================================
-- PART 23: RLS POLICIES - MISC
-- =====================================================

-- Clinician Availability
CREATE POLICY "Anyone can view active availability"
ON public.clinician_availability FOR SELECT
USING (is_active = true);

CREATE POLICY "Clinicians can manage their availability"
ON public.clinician_availability FOR ALL
USING (auth.uid() = clinician_id);

-- Symptom Assessments
CREATE POLICY "Patients can manage their assessments"
ON public.symptom_assessments FOR ALL
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view linked assessments"
ON public.symptom_assessments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.symptom_assessment_id = symptom_assessments.id
        AND a.clinician_id = auth.uid()
    )
);

-- Push Subscriptions
CREATE POLICY "Users can manage their subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id);

-- Audit Logs
CREATE POLICY "Admins can view audit logs in their clinic"
ON public.audit_logs FOR SELECT
USING (
    has_role(auth.uid(), 'admin')
    AND (clinic_id = get_user_clinic_id(auth.uid()) OR clinic_id IS NULL)
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- =====================================================
-- PART 24: TRIGGERS
-- =====================================================

-- Updated_at triggers
CREATE TRIGGER update_clinics_updated_at
    BEFORE UPDATE ON public.clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinician_profiles_updated_at
    BEFORE UPDATE ON public.clinician_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinician_availability_updated_at
    BEFORE UPDATE ON public.clinician_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON public.chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinical_notes_updated_at
    BEFORE UPDATE ON public.clinical_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at
    BEFORE UPDATE ON public.prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Chat message triggers
CREATE TRIGGER set_chat_message_sender_name
    BEFORE INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION set_sender_name();

CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Auth trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- PART 25: STORAGE
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'consultation-files',
    'consultation-files',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'consultation-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view"
ON storage.objects FOR SELECT
USING (bucket_id = 'consultation-files' AND auth.uid() IS NOT NULL);

-- =====================================================
-- PART 26: REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- =====================================================
-- PART 27: INDEXES
-- =====================================================

-- User lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_clinic_id ON public.user_roles(clinic_id);

-- Appointments
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_clinician_id ON public.appointments(clinician_id);
CREATE INDEX idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- Chat
CREATE INDEX idx_chat_conversations_patient_id ON public.chat_conversations(patient_id);
CREATE INDEX idx_chat_conversations_clinic_id ON public.chat_conversations(clinic_id);
CREATE INDEX idx_chat_conversations_status ON public.chat_conversations(status);
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Bookings
CREATE INDEX idx_bookings_patient_id ON public.bookings(patient_id);
CREATE INDEX idx_bookings_clinician_id ON public.bookings(clinician_id);
CREATE INDEX idx_bookings_clinic_id ON public.bookings(clinic_id);
CREATE INDEX idx_bookings_scheduled_at ON public.bookings(scheduled_at);

-- Invoices
CREATE INDEX idx_invoices_patient_id ON public.invoices(patient_id);
CREATE INDEX idx_invoices_clinic_id ON public.invoices(clinic_id);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);

-- Clinical
CREATE INDEX idx_clinical_notes_patient_id ON public.clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_clinician_id ON public.clinical_notes(clinician_id);
CREATE INDEX idx_clinical_notes_clinic_id ON public.clinical_notes(clinic_id);
CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_clinic_id ON public.prescriptions(clinic_id);

-- Clinician
CREATE INDEX idx_clinician_profiles_clinic_id ON public.clinician_profiles(clinic_id);
CREATE INDEX idx_clinician_availability_clinician_id ON public.clinician_availability(clinician_id);

-- =====================================================
-- PART 28: VERIFICATION FUNCTIONS
-- =====================================================

-- Check test clinician status
CREATE OR REPLACE FUNCTION public.get_test_clinician_status()
RETURNS TABLE (
    email text,
    user_exists boolean,
    has_profile boolean,
    has_role boolean,
    has_clinician_profile boolean,
    clinic_name text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        test_email::text,
        EXISTS(SELECT 1 FROM auth.users u WHERE u.email = test_email) as user_exists,
        EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id = u.id WHERE u.email = test_email) as has_profile,
        EXISTS(SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id WHERE u.email = test_email) as has_role,
        EXISTS(SELECT 1 FROM auth.users u JOIN public.clinician_profiles cp ON cp.id = u.id WHERE u.email = test_email) as has_clinician_profile,
        (SELECT c.name FROM auth.users u 
         JOIN public.user_roles r ON r.user_id = u.id 
         JOIN public.clinics c ON c.id = r.clinic_id 
         WHERE u.email = test_email) as clinic_name
    FROM unnest(ARRAY['ca1@hcf.test', 'ca2@hcf.test', 'dr1@hcf.test', 'reception@hcf.test']) AS test_email;
END;
$$;

-- Get clinic stats
CREATE OR REPLACE FUNCTION public.get_clinic_stats(_clinic_id uuid DEFAULT NULL)
RETURNS TABLE (
    clinic_name text,
    total_users bigint,
    total_bookings bigint,
    total_appointments bigint,
    active_conversations bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name::text,
        (SELECT COUNT(*) FROM user_roles WHERE clinic_id = c.id),
        (SELECT COUNT(*) FROM bookings WHERE clinic_id = c.id),
        (SELECT COUNT(*) FROM appointments WHERE clinic_id = c.id),
        (SELECT COUNT(*) FROM chat_conversations WHERE clinic_id = c.id AND status IN ('new', 'active', 'waiting'))
    FROM clinics c
    WHERE (_clinic_id IS NULL OR c.id = _clinic_id)
    AND c.is_active = true;
END;
$$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
--
-- NEXT STEPS:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Create test users in Authentication > Add User:
--
--    | Email              | Password    | Metadata                                                    |
--    |--------------------|-------------|-------------------------------------------------------------|
--    | ca1@hcf.test       | password123 | {"first_name":"Thandiwe","last_name":"Nkosi","role":"nurse"}|
--    | ca2@hcf.test       | password123 | {"first_name":"Sipho","last_name":"Mokoena","role":"nurse"} |
--    | reception@hcf.test | password123 | {"first_name":"Reception","last_name":"Staff","role":"receptionist"}|
--    | patient@hcf.test   | password123 | {"first_name":"Test","last_name":"Patient","role":"patient"}|
--
-- 3. Verify setup: SELECT * FROM get_test_clinician_status();
-- 4. Update frontend/backend .env with new Supabase credentials
--
-- =====================================================
