-- Booking Schema Update for Simplified Workflow
-- Run this in your Supabase SQL Editor

-- ============================================
-- Update bookings table to use clinician_name instead of clinician_id
-- ============================================

-- Add clinician_name column (free text for display)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS clinician_name TEXT;

-- Remove clinician_id column if it exists (no longer used)
-- Commented out for safety - run manually if needed after verifying no data loss
-- ALTER TABLE bookings DROP COLUMN IF EXISTS clinician_id;

-- Remove appointment_id column if it exists (we don't create appointments anymore)
-- Commented out for safety - run manually if needed after verifying no data loss
-- ALTER TABLE bookings DROP COLUMN IF EXISTS appointment_id;

-- ============================================
-- Update invoices table to use clinician_name instead of clinician_id
-- ============================================

-- Add clinician_name column (free text for display)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS clinician_name TEXT;

-- Remove clinician_id column if it exists (no longer used)
-- Commented out for safety - run manually if needed after verifying no data loss
-- ALTER TABLE invoices DROP COLUMN IF EXISTS clinician_id;

-- ============================================
-- Grant permissions
-- ============================================

-- Enable RLS on tables if not already enabled
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for bookings
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (
        auth.uid() = patient_id OR
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

DROP POLICY IF EXISTS "Staff can create bookings" ON bookings;
CREATE POLICY "Staff can create bookings" ON bookings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

DROP POLICY IF EXISTS "Staff can update bookings" ON bookings;
CREATE POLICY "Staff can update bookings" ON bookings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Create policies for invoices
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
CREATE POLICY "Users can view their own invoices" ON invoices
    FOR SELECT USING (
        auth.uid() = patient_id OR
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

DROP POLICY IF EXISTS "Staff can create invoices" ON invoices;
CREATE POLICY "Staff can create invoices" ON invoices
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

DROP POLICY IF EXISTS "Staff can update invoices" ON invoices;
CREATE POLICY "Staff can update invoices" ON invoices
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'receptionist')
        )
    );

-- ============================================
-- Verify the changes
-- ============================================
-- Run these queries to verify:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'invoices';
