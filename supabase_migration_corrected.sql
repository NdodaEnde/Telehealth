-- =====================================================
-- HCF Telehealth - Complete Database Migration Script
-- CORRECTED VERSION - January 2026
-- =====================================================
-- This script recreates the entire database structure
-- Run this in a fresh Supabase project's SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: ENUMS (CORRECTED)
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'patient', 'nurse', 'doctor', 'receptionist');

CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- CORRECTED: Added 'booked' status
CREATE TYPE public.chat_status AS ENUM ('new', 'active', 'waiting', 'booked', 'resolved', 'closed');

CREATE TYPE public.consultation_type AS ENUM ('video', 'audio', 'chat');

CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');

CREATE TYPE public.message_type_chat AS ENUM ('text', 'file', 'image', 'system');

-- CORRECTED: Match Quadcare billing types
CREATE TYPE public.patient_billing_type AS ENUM ('cash', 'medical_aid', 'campus_africa', 'university_student');

-- CORRECTED: Match Quadcare fee schedule service types
CREATE TYPE public.service_type AS ENUM (
    'teleconsultation', 
    'follow_up_0_3', 
    'follow_up_4_7', 
    'script_1_month', 
    'script_3_months', 
    'script_6_months', 
    'medical_forms'
);

CREATE TYPE public.symptom_severity AS ENUM ('mild', 'moderate', 'severe', 'critical');

-- =====================================================
-- PART 2: HELPER FUNCTIONS
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
BEGIN
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

  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::app_role
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, user_roles.role);

  -- If role is nurse or doctor, create clinician_profiles entry
  IF NEW.raw_user_meta_data->>'role' IN ('nurse', 'doctor') THEN
    INSERT INTO public.clinician_profiles (id, specialization, is_available)
    VALUES (
      NEW.id,
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
-- PART 3: TABLES
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

-- Clinician profiles (additional info for nurses/doctors)
CREATE TABLE public.clinician_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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
    symptoms TEXT[] NOT NULL,
    description TEXT,
    severity symptom_severity NOT NULL DEFAULT 'mild',
    recommended_specialization TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Chat conversations (patient-receptionist)
CREATE TABLE public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Bookings (receptionist-created appointments)
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.chat_conversations(id),
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

-- Invoices
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Consultation sessions (video call sessions)
CREATE TABLE public.consultation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting',
    patient_joined_at TIMESTAMPTZ,
    clinician_joined_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
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

-- Clinical notes
CREATE TABLE public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chief_complaint TEXT,
    history_of_present_illness TEXT,
    examination_findings TEXT,
    diagnosis TEXT[],
    icd10_codes JSONB DEFAULT '[]'::jsonb,
    treatment_plan TEXT,
    prescriptions JSONB DEFAULT '[]'::jsonb,
    follow_up_date DATE,
    follow_up_instructions TEXT,
    referral_required BOOLEAN DEFAULT false,
    referral_details TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prescriptions
CREATE TABLE public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- =====================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

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

-- =====================================================
-- PART 5: RLS POLICIES - PROFILES
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
-- PART 6: RLS POLICIES - USER ROLES
-- =====================================================

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all roles"
ON public.user_roles FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- PART 7: RLS POLICIES - CLINICIAN PROFILES
-- =====================================================

CREATE POLICY "Anyone can view available clinicians"
ON public.clinician_profiles FOR SELECT
USING (is_available = true);

CREATE POLICY "Clinicians can view their own profile"
ON public.clinician_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Clinicians can insert their own profile"
ON public.clinician_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Clinicians can update their own profile"
ON public.clinician_profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all clinician profiles"
ON public.clinician_profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view all clinician profiles"
ON public.clinician_profiles FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

-- =====================================================
-- PART 8: RLS POLICIES - CLINICIAN AVAILABILITY
-- =====================================================

CREATE POLICY "Anyone can view active availability"
ON public.clinician_availability FOR SELECT
USING (is_active = true);

CREATE POLICY "Clinicians can manage their own availability"
ON public.clinician_availability FOR ALL
USING (auth.uid() = clinician_id)
WITH CHECK (auth.uid() = clinician_id);

-- =====================================================
-- PART 9: RLS POLICIES - SYMPTOM ASSESSMENTS
-- =====================================================

CREATE POLICY "Patients can create their own assessments"
ON public.symptom_assessments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can view their own assessments"
ON public.symptom_assessments FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view assessments for their appointments"
ON public.symptom_assessments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.symptom_assessment_id = symptom_assessments.id
        AND a.clinician_id = auth.uid()
    )
);

-- =====================================================
-- PART 10: RLS POLICIES - APPOINTMENTS
-- =====================================================

CREATE POLICY "Patients can view their own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create own appointments"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update their pending appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = patient_id AND status = 'pending');

CREATE POLICY "Clinicians can view their appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can update their appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = clinician_id);

CREATE POLICY "Staff can view all appointments"
ON public.appointments FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Staff can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Staff can update appointments"
ON public.appointments FOR UPDATE
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

-- =====================================================
-- PART 11: RLS POLICIES - CHAT CONVERSATIONS
-- =====================================================

CREATE POLICY "Patients can view own conversations"
ON public.chat_conversations FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Staff can view all conversations"
ON public.chat_conversations FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Staff can update conversations"
ON public.chat_conversations FOR UPDATE
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

-- =====================================================
-- PART 12: RLS POLICIES - CHAT MESSAGES
-- =====================================================

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

CREATE POLICY "Users can send messages"
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
-- PART 13: RLS POLICIES - BOOKINGS
-- =====================================================

CREATE POLICY "Patients can view own bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view assigned bookings"
ON public.bookings FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Staff can view all bookings"
ON public.bookings FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Staff can create bookings"
ON public.bookings FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

CREATE POLICY "Staff can update bookings"
ON public.bookings FOR UPDATE
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'nurse') OR 
    has_role(auth.uid(), 'doctor') OR 
    has_role(auth.uid(), 'receptionist')
);

-- =====================================================
-- PART 14: RLS POLICIES - INVOICES
-- =====================================================

CREATE POLICY "Patients can view own invoices"
ON public.invoices FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Staff can view all invoices"
ON public.invoices FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist'));

CREATE POLICY "Staff can manage invoices"
ON public.invoices FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'receptionist'));

-- =====================================================
-- PART 15: RLS POLICIES - CONSULTATION SESSIONS
-- =====================================================

CREATE POLICY "Patients can view their sessions"
ON public.consultation_sessions FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create sessions for their appointments"
ON public.consultation_sessions FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view their sessions"
ON public.consultation_sessions FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can create sessions for their appointments"
ON public.consultation_sessions FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

CREATE POLICY "Participants can update their sessions"
ON public.consultation_sessions FOR UPDATE
USING (auth.uid() = patient_id OR auth.uid() = clinician_id);

-- =====================================================
-- PART 16: RLS POLICIES - CONSULTATION MESSAGES
-- =====================================================

CREATE POLICY "Participants can view session messages"
ON public.consultation_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM consultation_sessions cs
        WHERE cs.id = consultation_messages.session_id
        AND (cs.patient_id = auth.uid() OR cs.clinician_id = auth.uid())
    )
);

CREATE POLICY "Participants can send messages"
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
-- PART 17: RLS POLICIES - CLINICAL NOTES
-- =====================================================

CREATE POLICY "Clinicians can view their own notes"
ON public.clinical_notes FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can create notes for their appointments"
ON public.clinical_notes FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can update their own notes"
ON public.clinical_notes FOR UPDATE
USING (auth.uid() = clinician_id);

CREATE POLICY "Patients can view their completed notes"
ON public.clinical_notes FOR SELECT
USING (auth.uid() = patient_id AND status = 'completed');

CREATE POLICY "Admins can view all clinical notes"
ON public.clinical_notes FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- PART 18: RLS POLICIES - PRESCRIPTIONS
-- =====================================================

CREATE POLICY "Patients can view their prescriptions"
ON public.prescriptions FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view their prescriptions"
ON public.prescriptions FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can create prescriptions"
ON public.prescriptions FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can update their prescriptions"
ON public.prescriptions FOR UPDATE
USING (auth.uid() = clinician_id);

CREATE POLICY "Admins can view all prescriptions"
ON public.prescriptions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- PART 19: RLS POLICIES - PUSH SUBSCRIPTIONS
-- =====================================================

CREATE POLICY "Users can view their own subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- PART 20: TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamps
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

CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Set sender name on chat messages
CREATE TRIGGER set_chat_message_sender_name
    BEFORE INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION set_sender_name();

-- Update conversation on new message
CREATE TRIGGER update_conversation_on_new_message
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Handle new user registration (attach to auth.users)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- PART 21: STORAGE BUCKETS
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'consultation-files',
    'consultation-files',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for consultation-files bucket
CREATE POLICY "Users can upload files to their sessions"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'consultation-files'
    AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view files from their sessions"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'consultation-files'
    AND auth.uid() IS NOT NULL
);

-- =====================================================
-- PART 22: REALTIME CONFIGURATION
-- =====================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_messages;

-- =====================================================
-- PART 23: INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_clinician_id ON public.appointments(clinician_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);

CREATE INDEX idx_chat_conversations_patient_id ON public.chat_conversations(patient_id);
CREATE INDEX idx_chat_conversations_status ON public.chat_conversations(status);

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

CREATE INDEX idx_clinical_notes_patient_id ON public.clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_clinician_id ON public.clinical_notes(clinician_id);
CREATE INDEX idx_clinical_notes_appointment_id ON public.clinical_notes(appointment_id);

CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_clinician_id ON public.prescriptions(clinician_id);

CREATE INDEX idx_clinician_availability_clinician_id ON public.clinician_availability(clinician_id);
CREATE INDEX idx_clinician_availability_day_of_week ON public.clinician_availability(day_of_week);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

CREATE INDEX idx_bookings_patient_id ON public.bookings(patient_id);
CREATE INDEX idx_bookings_clinician_id ON public.bookings(clinician_id);
CREATE INDEX idx_bookings_scheduled_at ON public.bookings(scheduled_at);

CREATE INDEX idx_invoices_patient_id ON public.invoices(patient_id);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);

-- =====================================================
-- PART 24: VERIFICATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_test_clinician_status()
RETURNS TABLE (
    email text,
    user_exists boolean,
    has_profile boolean,
    has_role boolean,
    has_clinician_profile boolean
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
        EXISTS(SELECT 1 FROM auth.users u JOIN public.clinician_profiles cp ON cp.id = u.id WHERE u.email = test_email) as has_clinician_profile
    FROM unnest(ARRAY['ca1@hcf.test', 'ca2@hcf.test', 'dr1@hcf.test']) AS test_email;
END;
$$;

-- =====================================================
-- END OF MIGRATION SCRIPT
-- =====================================================
-- 
-- NEXT STEPS:
-- 1. Run this migration in your new Supabase project
-- 2. Update your frontend .env with new Supabase URL and anon key
-- 3. Update your backend .env with new Supabase URL and service key
-- 4. Create test users via Supabase Dashboard:
--    - ca1@hcf.test (role: nurse) - Sr. Thandiwe Nkosi
--    - ca2@hcf.test (role: nurse) - Sr. Sipho Mokoena
--    - dr1@hcf.test (role: doctor) - Dr. Nomsa Dlamini
--    - reception@hcf.test (role: receptionist)
--    - patient@hcf.test (role: patient)
--
-- When creating users, include metadata:
-- {
--   "first_name": "Thandiwe",
--   "last_name": "Nkosi", 
--   "role": "nurse"
-- }
-- 
-- The handle_new_user() trigger will auto-create:
-- - profiles entry
-- - user_roles entry
-- - clinician_profiles entry (if nurse/doctor)
-- =====================================================
