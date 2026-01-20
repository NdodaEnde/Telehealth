-- ============================================
-- HCF Platform - RLS Fix & Test Clinician Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Fix RLS Policies for Profiles Table
-- Allow receptionists to see clinician profiles
-- ============================================

-- Drop existing restrictive policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view clinician profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- Create new policies that allow proper access
-- Users can always view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Staff (receptionist, nurse, doctor, admin) can view ALL profiles
-- This is needed so receptionists can see patient names and clinician names
CREATE POLICY "Staff can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- ============================================
-- STEP 2: Fix RLS Policies for User Roles Table
-- ============================================

-- Drop existing policies on user_roles
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Staff can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Authenticated users can view user_roles" ON user_roles;

-- Users can view their own role
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Staff can view all roles (needed to identify clinicians)
CREATE POLICY "Staff can view all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- ============================================
-- STEP 3: Create Test Clinical Associate Accounts
-- These are test accounts for development
-- ============================================

-- First, let's create the auth users via Supabase Auth
-- NOTE: You need to create these users via Supabase Dashboard or Auth API first:
-- 1. Go to Authentication > Users > Add User
-- 2. Create: ca1@hcf.test / password123 (for Sr. Nkosi)
-- 3. Create: ca2@hcf.test / password123 (for Sr. Mokoena)
-- 4. Then run the SQL below with the actual UUIDs

-- IMPORTANT: Replace these placeholder UUIDs with the actual UUIDs 
-- from Supabase Auth after creating the users

-- Uncomment and update with real UUIDs after creating auth users:
/*
-- Sr. Nkosi - Clinical Associate 1
INSERT INTO profiles (id, first_name, last_name, phone, created_at, updated_at)
VALUES (
    'REPLACE_WITH_CA1_UUID',  -- Get this from Supabase Auth after creating ca1@hcf.test
    'Thandiwe',
    'Nkosi',
    '+27821234567',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

INSERT INTO user_roles (user_id, role, created_at)
VALUES (
    'REPLACE_WITH_CA1_UUID',
    'nurse',
    NOW()
) ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role;

-- Sr. Mokoena - Clinical Associate 2
INSERT INTO profiles (id, first_name, last_name, phone, created_at, updated_at)
VALUES (
    'REPLACE_WITH_CA2_UUID',  -- Get this from Supabase Auth after creating ca2@hcf.test
    'Sipho',
    'Mokoena',
    '+27829876543',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

INSERT INTO user_roles (user_id, role, created_at)
VALUES (
    'REPLACE_WITH_CA2_UUID',
    'nurse',
    NOW()
) ON CONFLICT (user_id) DO UPDATE SET
    role = EXCLUDED.role;
*/

-- ============================================
-- STEP 4: Verify Setup
-- Run these queries after setup to verify
-- ============================================

-- Check all user roles
-- SELECT ur.user_id, ur.role, p.first_name, p.last_name 
-- FROM user_roles ur 
-- LEFT JOIN profiles p ON p.id = ur.user_id;

-- Check clinicians specifically
-- SELECT ur.user_id, ur.role, p.first_name, p.last_name 
-- FROM user_roles ur 
-- LEFT JOIN profiles p ON p.id = ur.user_id
-- WHERE ur.role IN ('nurse', 'doctor');

-- ============================================
-- STEP 5: Ensure bookings table has clinician_id
-- ============================================

-- Make sure clinician_id column exists
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS clinician_id UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS appointment_id UUID;

-- Make sure invoices table has clinician_id
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS clinician_id UUID REFERENCES auth.users(id);

-- ============================================
-- STEP 6: Update Bookings RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Staff can create bookings" ON bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON bookings;
DROP POLICY IF EXISTS "Clinicians can view assigned bookings" ON bookings;

-- Patients can view their own bookings
CREATE POLICY "Patients can view own bookings" ON bookings
    FOR SELECT USING (auth.uid() = patient_id);

-- Clinicians can view bookings assigned to them
CREATE POLICY "Clinicians can view assigned bookings" ON bookings
    FOR SELECT USING (auth.uid() = clinician_id);

-- Staff can view all bookings
CREATE POLICY "Staff can view all bookings" ON bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can create bookings
CREATE POLICY "Staff can create bookings" ON bookings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can update bookings
CREATE POLICY "Staff can update bookings" ON bookings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- ============================================
-- STEP 7: Update Appointments RLS Policies
-- ============================================

DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Clinicians can view assigned appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can view all appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can create appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can update appointments" ON appointments;

-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments" ON appointments
    FOR SELECT USING (auth.uid() = patient_id);

-- Clinicians can view appointments assigned to them
CREATE POLICY "Clinicians can view assigned appointments" ON appointments
    FOR SELECT USING (auth.uid() = clinician_id);

-- Staff can view all appointments
CREATE POLICY "Staff can view all appointments" ON appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can create appointments
CREATE POLICY "Staff can create appointments" ON appointments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can update appointments
CREATE POLICY "Staff can update appointments" ON appointments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- ============================================
-- Done! Now:
-- 1. Create test CA users in Supabase Auth
-- 2. Update the UUIDs in STEP 3 and run those inserts
-- 3. Test the booking flow
-- ============================================
