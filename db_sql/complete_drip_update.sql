-- ==============================================
-- MASTER UPDATE SCRIPT: DRIP & FOLLOW-UP SYSTEM v2
-- ==============================================
-- Includes:
-- 1. Base Tables Creation
-- 2. Advanced Scheduling Features (v2)
-- 3. Notification Rules & Stop Logic
-- 4. Audit Logging System (Idempotency)
-- 5. Atomic Concurrency Protection (Locking)
-- ==============================================

-- ==============================================
-- PART 1: BASE TABLES (IF NOT EXIST)
-- ==============================================

-- Drip Campaigns
CREATE TABLE IF NOT EXISTS drip_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT CHECK (trigger_type IN ('TAG_ADDED', 'PIPELINE_STAGE_CHANGED', 'MANUAL')),
    trigger_value TEXT,
    status TEXT DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enrollment_count INT DEFAULT 0
);

-- Drip Steps
CREATE TABLE IF NOT EXISTS drip_steps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    drip_campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    step_type TEXT CHECK (step_type IN ('WHATSAPP_MESSAGE', 'EMAIL', 'WAIT', 'CONDITION')),
    step_config JSONB,
    delay_hours INT DEFAULT 0, -- Legacy support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drip Enrollments
CREATE TABLE IF NOT EXISTS drip_enrollments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    drip_campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    current_step_id UUID REFERENCES drip_steps(id),
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, EXPIRED
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Follow Ups
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'PENDING',
    priority TEXT DEFAULT 'MEDIUM',
    type TEXT DEFAULT 'CALL', 
    recurrence_rule JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- PART 2: ADVANCED FEATURES (ADD COLUMNS)
-- ==============================================

-- Add Delivery Windows to Campaigns
ALTER TABLE drip_campaigns 
ADD COLUMN IF NOT EXISTS allowed_days TEXT DEFAULT '0,1,2,3,4,5,6',
ADD COLUMN IF NOT EXISTS time_window_start TIME DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS time_window_end TIME DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS stop_on_reply BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_reentry BOOLEAN DEFAULT FALSE;

-- Add Granular Delays to Steps
ALTER TABLE drip_steps
ADD COLUMN IF NOT EXISTS delay_value INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS delay_unit TEXT DEFAULT 'HOURS', -- 'MINUTES', 'HOURS', 'DAYS', 'WEEKS'
ADD COLUMN IF NOT EXISTS use_custom_schedule BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_allowed_days TEXT,
ADD COLUMN IF NOT EXISTS custom_time_start TIME,
ADD COLUMN IF NOT EXISTS custom_time_end TIME;

-- Add Stop At (Until Date) Logic
ALTER TABLE drip_enrollments
ADD COLUMN IF NOT EXISTS stop_at TIMESTAMP WITH TIME ZONE;

-- Add Notification Tracking
ALTER TABLE drip_enrollments
ADD COLUMN IF NOT EXISTS notifications_sent JSONB DEFAULT '[]';

-- Add Notification Rules (User Settings)
ALTER TABLE drip_enrollments
ADD COLUMN IF NOT EXISTS notification_rules JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS is_looping BOOLEAN DEFAULT FALSE;


-- ==============================================
-- PART 3: AUDIT LOGGING (IDEMPOTENCY)
-- ==============================================

CREATE TABLE IF NOT EXISTS drip_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    drip_enrollment_id UUID REFERENCES drip_enrollments(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'MESSAGE_SENT', 'OWNER_NOTIFY', 'STOP_AT_EXPIRED', 'ERROR'
    campaign_name TEXT,
    step_order INT,
    details JSONB DEFAULT '{}', 
    idempotency_key TEXT, 
    status TEXT DEFAULT 'SUCCESS', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Speed
CREATE INDEX IF NOT EXISTS idx_drip_logs_enrollment ON drip_logs(drip_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_drip_logs_idempotency ON drip_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_next_run ON drip_enrollments(next_run_at);


-- ==============================================
-- PART 4: ATOMIC LOCKING FUNCTION (CONCURRENCY)
-- ==============================================

CREATE OR REPLACE FUNCTION fetch_and_lock_drip_jobs(batch_size INT)
RETURNS SETOF drip_enrollments AS $$
BEGIN
    RETURN QUERY
    WITH locked_rows AS (
        SELECT id
        FROM drip_enrollments
        WHERE status = 'ACTIVE'
          AND next_run_at <= NOW()
        ORDER BY next_run_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED -- CRITICAL: Skips rows locked by other workers
    )
    UPDATE drip_enrollments
    SET next_run_at = NOW() + INTERVAL '5 minutes' -- Reserve for 5 mins
    WHERE id IN (SELECT id FROM locked_rows)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
