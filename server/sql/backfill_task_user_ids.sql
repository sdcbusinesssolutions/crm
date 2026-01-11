-- Backfill user_id for Tasks
UPDATE tasks
SET user_id = leads.user_id
FROM leads
WHERE tasks.lead_id = leads.id
AND tasks.user_id IS NULL;

-- Backfill user_id for Appointments
UPDATE appointments
SET user_id = leads.user_id
FROM leads
WHERE appointments.lead_id = leads.id
AND appointments.user_id IS NULL;

-- Backfill user_id for Call Logs
UPDATE call_logs
SET user_id = leads.user_id
FROM leads
WHERE call_logs.lead_id = leads.id
AND call_logs.user_id IS NULL;

-- Backfill user_id for Notes
UPDATE notes
SET user_id = leads.user_id
FROM leads
WHERE notes.lead_id = leads.id
AND notes.user_id IS NULL;

-- Notify to reload
NOTIFY pgrst, 'reload config';
