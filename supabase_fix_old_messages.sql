-- =============================================
-- FIX: Update old messages with incorrect sender_name
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. First, let's see what we have
SELECT 
    id,
    sender_id,
    sender_name,
    sender_role,
    LEFT(content, 50) as content_preview,
    created_at
FROM chat_messages
WHERE sender_role != 'system' AND (sender_name IS NULL OR sender_name = 'System' OR sender_name = 'Unknown')
ORDER BY created_at DESC
LIMIT 20;

-- 2. Fix messages where sender_name is wrong (not system messages)
UPDATE chat_messages cm
SET sender_name = COALESCE(
    NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
    'Unknown'
)
FROM profiles p
WHERE cm.sender_id = p.id
  AND cm.sender_role != 'system'
  AND (cm.sender_name IS NULL OR cm.sender_name = 'System' OR cm.sender_name = 'Unknown' OR cm.sender_name = '');

-- 3. Verify the fix
SELECT 
    id,
    sender_id,
    sender_name,
    sender_role,
    LEFT(content, 50) as content_preview,
    created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 20;
