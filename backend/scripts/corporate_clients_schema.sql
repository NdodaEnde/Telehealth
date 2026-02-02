-- =====================================================
-- CORPORATE CLIENTS & PATIENT SEGMENTATION SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create corporate_clients table
CREATE TABLE IF NOT EXISTS corporate_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE,  -- Short code like "CA" for Campus Africa
    type VARCHAR(50) NOT NULL DEFAULT 'corporate',  -- corporate, university, individual, government
    
    -- Contact info
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Address
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Contract details
    contract_start DATE,
    contract_end DATE,
    billing_type VARCHAR(50) DEFAULT 'per_consultation',  -- per_consultation, monthly, annual
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- active, inactive, suspended
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add corporate_client_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS corporate_client_id UUID REFERENCES corporate_clients(id);

-- 3. Add patient_type to profiles (individual, corporate, dependant)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS patient_type VARCHAR(50) DEFAULT 'individual';

-- 4. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_profiles_corporate_client ON profiles(corporate_client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_patient_type ON profiles(patient_type);
CREATE INDEX IF NOT EXISTS idx_corporate_clients_status ON corporate_clients(status);
CREATE INDEX IF NOT EXISTS idx_corporate_clients_type ON corporate_clients(type);

-- 5. Insert default "Individual/Walk-in" client for non-corporate patients
INSERT INTO corporate_clients (name, code, type, status, notes)
VALUES ('Individual / Walk-in', 'IND', 'individual', 'active', 'Default client for non-corporate patients')
ON CONFLICT (name) DO NOTHING;

-- 6. Insert Campus Africa as a corporate client
INSERT INTO corporate_clients (name, code, type, status, notes)
VALUES ('Campus Africa', 'CA', 'university', 'active', 'Student accommodation provider - bulk imported students')
ON CONFLICT (name) DO NOTHING;

-- 7. Create view for easy patient analytics by client
CREATE OR REPLACE VIEW patient_analytics_by_client AS
SELECT 
    cc.id AS client_id,
    cc.name AS client_name,
    cc.type AS client_type,
    cc.status AS client_status,
    COUNT(p.id) AS total_patients,
    COUNT(CASE WHEN p.gender = 'male' THEN 1 END) AS male_count,
    COUNT(CASE WHEN p.gender = 'female' THEN 1 END) AS female_count,
    COUNT(CASE WHEN p.date_of_birth IS NOT NULL THEN 1 END) AS with_dob,
    COUNT(CASE WHEN p.phone IS NOT NULL THEN 1 END) AS with_phone,
    COUNT(CASE WHEN p.id_number IS NOT NULL THEN 1 END) AS with_id_number
FROM corporate_clients cc
LEFT JOIN profiles p ON p.corporate_client_id = cc.id
GROUP BY cc.id, cc.name, cc.type, cc.status;

-- 8. Enable RLS on corporate_clients
ALTER TABLE corporate_clients ENABLE ROW LEVEL SECURITY;

-- 9. Policy: Admins can do everything
CREATE POLICY "Admins can manage corporate clients" ON corporate_clients
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 10. Policy: Authenticated users can view active clients
CREATE POLICY "Authenticated users can view active clients" ON corporate_clients
    FOR SELECT
    USING (
        auth.role() = 'authenticated' AND status = 'active'
    );

-- Done!
SELECT 'Schema created successfully!' AS status;
