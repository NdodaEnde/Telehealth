-- Create consultation_ratings table for post-consultation feedback
-- Ratings are anonymous to clinicians but visible in admin analytics

CREATE TABLE IF NOT EXISTS consultation_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one rating per appointment
    UNIQUE(appointment_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ratings_clinician ON consultation_ratings(clinician_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON consultation_ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON consultation_ratings(rating);

-- Add RLS policies
ALTER TABLE consultation_ratings ENABLE ROW LEVEL SECURITY;

-- Patients can insert their own ratings
CREATE POLICY "Patients can insert own ratings" ON consultation_ratings
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Patients can view their own ratings
CREATE POLICY "Patients can view own ratings" ON consultation_ratings
    FOR SELECT USING (auth.uid() = patient_id);

-- Admins can view all ratings (for analytics)
CREATE POLICY "Admins can view all ratings" ON consultation_ratings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Clinicians CANNOT view individual ratings (anonymous)
-- They can only see aggregate stats through the admin analytics API

-- Add comments
COMMENT ON TABLE consultation_ratings IS 'Post-consultation feedback from patients. Anonymous to clinicians.';
COMMENT ON COLUMN consultation_ratings.rating IS 'Star rating from 1 (poor) to 5 (excellent)';
COMMENT ON COLUMN consultation_ratings.feedback IS 'Optional text feedback from patient';
