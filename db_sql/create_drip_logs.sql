-- ==============================================
-- DRIP & AUTOMATION LOGGING SYSTEM
-- ==============================================

CREATE TABLE IF NOT EXISTS drip_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    drip_enrollment_id UUID REFERENCES drip_enrollments(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Action Type: 'MESSAGE_SENT', 'OWNER_NOTIFY', 'STOP_AT_EXPIRED', 'ERROR', 'SKIP', 'STEP_ADVANCED'
    action_type TEXT NOT NULL, 
    
    -- Context
    campaign_name TEXT,
    step_order INT,
    
    -- Details (Flexible JSON for templates, errors, phone numbers)
    details JSONB DEFAULT '{}', 
    
    -- Idempotency Key (CRITICAL for preventing double-sends)
    -- Format: "enrollment_id-step_id" or "enrollment_id-notification_rule_id"
    idempotency_key TEXT, 
    
    status TEXT DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups and idempotency checks
CREATE INDEX IF NOT EXISTS idx_drip_logs_enrollment ON drip_logs(drip_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_drip_logs_idempotency ON drip_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_drip_logs_created ON drip_logs(created_at);

-- Add comment
COMMENT ON TABLE drip_logs IS 'Comprehensive log of all Drip actions, used for debugging and preventing double-sends.';
