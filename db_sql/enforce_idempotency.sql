-- ==============================================
-- FIX: ENFORCE RIGID IDEMPOTENCY FOR DRIP CAMPAIGNS
-- ==============================================
-- Ensures that no step can ever be processed twice for the same enrollment step,
-- even under extreme concurrency or worker overlap.
-- ==============================================

-- 1. Clean up any existing duplicate logs (safety first)
DELETE FROM drip_logs a 
USING drip_logs b 
WHERE a.id > b.id 
  AND a.idempotency_key = b.idempotency_key 
  AND a.idempotency_key IS NOT NULL;

-- 2. Add Unique Constraint for hard idempotency
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_drip_logs_idempotency'
    ) THEN
        ALTER TABLE drip_logs ADD CONSTRAINT uq_drip_logs_idempotency UNIQUE (idempotency_key);
    END IF;
END $$;

-- 3. Add Index for even faster lookups if not already there
CREATE INDEX IF NOT EXISTS idx_drip_logs_idempotency_v2 ON drip_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 4. Optimize UI performance for high volume Drip lists
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign_status ON drip_enrollments(drip_campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign_order ON drip_steps(drip_campaign_id, step_order);
