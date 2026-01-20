-- =============================================
-- HCF Telehealth - Chat-Based Booking System
-- Run this script in Supabase SQL Editor
-- =============================================

-- 1. Add 'receptionist' to app_role enum (if not exists)
-- Note: If this fails, the role might already exist or you may need to recreate the enum
DO $$ 
BEGIN
    ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'receptionist';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create chat_status enum
DO $$ 
BEGIN
    CREATE TYPE chat_status AS ENUM (
        'new',
        'active', 
        'booking_pending',
        'booked',
        'consultation_complete',
        'closed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create message_type enum
DO $$ 
BEGIN
    CREATE TYPE message_type AS ENUM (
        'text',
        'image',
        'file',
        'system',
        'booking_confirmation'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Create patient_billing_type enum
DO $$ 
BEGIN
    CREATE TYPE patient_billing_type AS ENUM (
        'medical_aid',
        'campus_africa',
        'university_student',
        'cash'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create service_type enum for telehealth services
DO $$ 
BEGIN
    CREATE TYPE service_type AS ENUM (
        'teleconsultation',
        'follow_up_0_3',
        'follow_up_4_7',
        'script_1_month',
        'script_3_months',
        'script_6_months',
        'medical_forms'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 6. Create invoice_status enum
DO $$ 
BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'pending',
        'paid',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Create chat_conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receptionist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status chat_status NOT NULL DEFAULT 'new',
    patient_type patient_billing_type,
    booking_id UUID,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type message_type NOT NULL DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create bookings table (separate from appointments for receptionist workflow)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    service_type service_type NOT NULL DEFAULT 'teleconsultation',
    billing_type patient_billing_type NOT NULL DEFAULT 'cash',
    status appointment_status NOT NULL DEFAULT 'confirmed',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    invoice_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type service_type NOT NULL,
    service_name TEXT NOT NULL,
    service_description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    consultation_date TIMESTAMPTZ NOT NULL,
    clinician_id UUID NOT NULL REFERENCES auth.users(id),
    status invoice_status NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_conversations_patient ON chat_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_receptionist ON chat_conversations(receptionist_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_patient ON bookings(patient_id);
CREATE INDEX IF NOT EXISTS idx_bookings_clinician ON bookings(clinician_id);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 12. Enable Row Level Security
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies for chat_conversations

-- Patients can view their own conversations
CREATE POLICY "Patients can view own conversations"
    ON chat_conversations FOR SELECT
    USING (auth.uid() = patient_id);

-- Staff (admin, nurse, doctor) can view all conversations
CREATE POLICY "Staff can view all conversations"
    ON chat_conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Patients can create conversations
CREATE POLICY "Patients can create conversations"
    ON chat_conversations FOR INSERT
    WITH CHECK (auth.uid() = patient_id);

-- Staff can update conversations (claim, status change, etc.)
CREATE POLICY "Staff can update conversations"
    ON chat_conversations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- 14. RLS Policies for chat_messages

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = conversation_id
            AND (c.patient_id = auth.uid() OR c.receptionist_id = auth.uid())
        )
        OR
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND (
            EXISTS (
                SELECT 1 FROM chat_conversations c
                WHERE c.id = conversation_id
                AND (c.patient_id = auth.uid() OR c.receptionist_id = auth.uid())
            )
            OR
            EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
            )
        )
    );

-- 15. RLS Policies for bookings

-- Patients can view their own bookings
CREATE POLICY "Patients can view own bookings"
    ON bookings FOR SELECT
    USING (auth.uid() = patient_id);

-- Staff can view all bookings
CREATE POLICY "Staff can view all bookings"
    ON bookings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can create bookings
CREATE POLICY "Staff can create bookings"
    ON bookings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can update bookings
CREATE POLICY "Staff can update bookings"
    ON bookings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- 16. RLS Policies for invoices

-- Patients can view their own invoices
CREATE POLICY "Patients can view own invoices"
    ON invoices FOR SELECT
    USING (auth.uid() = patient_id);

-- Staff can view all invoices
CREATE POLICY "Staff can view all invoices"
    ON invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'nurse', 'doctor', 'receptionist')
        )
    );

-- Staff can create and update invoices
CREATE POLICY "Staff can manage invoices"
    ON invoices FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'receptionist')
        )
    );

-- 17. Enable Realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 18. Create function to update conversation timestamp
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- 19. Create trigger for auto-updating conversation on new message
DROP TRIGGER IF EXISTS on_new_message ON chat_messages;
CREATE TRIGGER on_new_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- 20. Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 21. Create triggers for updated_at
DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Done!
SELECT 'Chat-based booking system tables created successfully!' as result;
