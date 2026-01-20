-- =============================================
-- Check and Create Clinician Profiles
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Check existing clinician profiles
SELECT 
    cp.id,
    cp.specialization,
    cp.is_available,
    p.first_name,
    p.last_name,
    ur.role
FROM clinician_profiles cp
LEFT JOIN profiles p ON p.id = cp.id
LEFT JOIN user_roles ur ON ur.user_id = cp.id;

-- 2. Check users who should be clinicians but don't have clinician_profiles
SELECT 
    ur.user_id,
    ur.role,
    p.first_name,
    p.last_name
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
LEFT JOIN clinician_profiles cp ON cp.id = ur.user_id
WHERE ur.role IN ('nurse', 'doctor')
AND cp.id IS NULL;

-- 3. Create clinician_profiles for nurses/doctors who don't have one
INSERT INTO clinician_profiles (id, specialization, is_available)
SELECT 
    ur.user_id,
    CASE 
        WHEN ur.role = 'nurse' THEN 'General Nursing'
        WHEN ur.role = 'doctor' THEN 'General Practice'
        ELSE 'General'
    END,
    true
FROM user_roles ur
LEFT JOIN clinician_profiles cp ON cp.id = ur.user_id
WHERE ur.role IN ('nurse', 'doctor')
AND cp.id IS NULL;

-- 4. Verify - list all clinicians with their details
SELECT 
    cp.id,
    cp.specialization,
    cp.is_available,
    CONCAT(p.first_name, ' ', p.last_name) as name,
    ur.role
FROM clinician_profiles cp
JOIN profiles p ON p.id = cp.id
JOIN user_roles ur ON ur.user_id = cp.id
ORDER BY p.first_name;
