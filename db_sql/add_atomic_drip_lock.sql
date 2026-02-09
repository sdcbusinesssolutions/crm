-- ==============================================
-- ATOMIC JOB LOCKING FUNCTION
-- ==============================================
-- This function allows multiple workers to fetch tasks safely.
-- It works by:
-- 1. Finding due tasks
-- 2. Locking them immediately (skipping any locked by others)
-- 3. Updating their next_run_at to 5 mins in future (to reserve them)
-- 4. Returning the locked rows to the worker
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
        FOR UPDATE SKIP LOCKED -- CRITICAL: Skips rows already grabbed by other workers
    )
    UPDATE drip_enrollments
    SET next_run_at = NOW() + INTERVAL '5 minutes'
    WHERE id IN (SELECT id FROM locked_rows)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
