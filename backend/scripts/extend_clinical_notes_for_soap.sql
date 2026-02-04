-- Extend clinical_notes table for AI-generated SOAP notes and transcripts

-- Add SOAP note columns
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS soap_subjective TEXT;

ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS soap_objective TEXT;

ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS soap_assessment TEXT;

ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS soap_plan TEXT;

-- Add transcript column for audit trail
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add flag for AI-generated notes
ALTER TABLE clinical_notes 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN clinical_notes.soap_subjective IS 'SOAP Subjective - Patient symptoms and history';
COMMENT ON COLUMN clinical_notes.soap_objective IS 'SOAP Objective - Clinical findings and observations';
COMMENT ON COLUMN clinical_notes.soap_assessment IS 'SOAP Assessment - Diagnosis and clinical impression';
COMMENT ON COLUMN clinical_notes.soap_plan IS 'SOAP Plan - Treatment plan and follow-up';
COMMENT ON COLUMN clinical_notes.transcript IS 'Raw transcript from consultation audio';
COMMENT ON COLUMN clinical_notes.is_ai_generated IS 'Whether the SOAP notes were AI-generated';
