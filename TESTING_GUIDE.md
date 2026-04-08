# Testing Guide: Drip Campaign Fixes

## 🧪 Complete Testing Procedure

### Prerequisites
1. ✅ Server restarted with new code
2. ✅ Database has `updated_at` column in `follow_ups` table (run `fix_followups_schema.sql` if needed)
3. ✅ WhatsApp Business API credentials configured

---

## Test 1: Duplicate Prevention (API Level)

### Goal
Verify that enrolling the same contact twice doesn't create duplicates.

### Steps

1. **Navigate to Drip Campaigns**
   - Go to `http://localhost:3000`
   - Click on "Drip Campaigns" in sidebar

2. **Select Your Campaign**
   - Click on the campaign you want to test (e.g., "checkF12")
   - Click "Enrollments" tab

3. **Enroll a Test Contact (First Time)**
   - Click "Enroll Contacts" button
   - Select a test contact (e.g., 918408907516)
   - Set "Stop At" date (optional): Tomorrow's date
   - Add notification rule:
     ```json
     Phone: 910000000000
     Time: 10
     Unit: MINUTES
     ```
   - Click "Enroll"

4. **Try to Enroll Same Contact Again**
   - Click "Enroll Contacts" again
   - Select the SAME contact (918408907516)
   - Click "Enroll"

### ✅ Expected Result
```json
{
  "success": true,
  "count": 0,
  "skipped": 1,
  "message": "All contacts are already enrolled."
}
```

### ❌ If It Fails
- Check server logs for errors
- Verify the contact is in ACTIVE/PAUSED status
- Check `drip_enrollments` table in database

---

## Test 2: Duplicate Cleanup (Processor Level)

### Goal
Verify that existing duplicate enrollments are auto-cancelled.

### Steps

1. **Create Duplicate Enrollments Manually (via SQL)**
   ```sql
   -- Get your campaign and contact IDs
   SELECT id, name FROM drip_campaigns WHERE name = 'checkF12';
   SELECT id, name, phone FROM contacts WHERE phone = '918408907516';
   
   -- Get first step
   SELECT id, step_order FROM drip_steps 
   WHERE drip_campaign_id = 'YOUR_CAMPAIGN_ID' 
   ORDER BY step_order LIMIT 1;
   
   -- Create 2 duplicate enrollments
   INSERT INTO drip_enrollments (
       drip_campaign_id,
       contact_id,
       current_step_id,
       status,
       next_run_at,
       started_at
   ) VALUES 
   ('YOUR_CAMPAIGN_ID', 'YOUR_CONTACT_ID', 'FIRST_STEP_ID', 'ACTIVE', NOW() + INTERVAL '1 minute', NOW()),
   ('YOUR_CAMPAIGN_ID', 'YOUR_CONTACT_ID', 'FIRST_STEP_ID', 'ACTIVE', NOW() + INTERVAL '1 minute', NOW() + INTERVAL '1 second');
   ```

2. **Wait for Processor Cycle**
   - The drip processor runs every ~30 seconds
   - Watch the server logs

3. **Check Logs**
   Look for:
   ```
   [DripEngine] Processing batch of 2 enrollments (Safe Locked)...
   [DripEngine] DUPLICATE DETECTED: Enrollment XXX is redundant (found older YYY). Cancelling.
   [DripEngine] SENT WA to 918408907516: uti
   ```

### ✅ Expected Result
- Only 1 message sent to 918408907516
- Second enrollment marked as `DUPLICATE_CANCELLED`
- Check database:
  ```sql
  SELECT id, status, created_at, completed_at 
  FROM drip_enrollments 
  WHERE contact_id = 'YOUR_CONTACT_ID' 
  AND drip_campaign_id = 'YOUR_CAMPAIGN_ID'
  ORDER BY created_at;
  ```
  
  Should show:
  ```
  id                  | status              | created_at           | completed_at
  --------------------|---------------------|----------------------|-------------
  older-enrollment-id | COMPLETED           | 2026-02-12 18:21:00  | 2026-02-12 18:21:30
  newer-enrollment-id | DUPLICATE_CANCELLED | 2026-02-12 18:21:01  | 2026-02-12 18:21:30
  ```

### ❌ If It Fails
- Both enrollments sent messages → Check `dripProcessor.js` duplicate guard code
- No cancellation → Verify `created_at` timestamps are different

---

## Test 3: Owner Notifications

### Goal
Verify that owner receives WhatsApp notifications at configured intervals.

### Steps

1. **Create Enrollment with Short Notification Window**
   - Enroll a contact with:
     - Stop At: 15 minutes from now
     - Notification Rule:
       ```
       Phone: 910000000000 (your owner number)
       Value: 10
       Unit: MINUTES
       ```

2. **Wait for Notification Trigger**
   - When 5 minutes have passed (15 min stop_at - 10 min rule = 5 min wait)
   - The processor should detect it's within the 10-minute window

3. **Check Owner Phone**
   - Owner (910000000000) should receive WhatsApp message:
     ```
     ⏰ Follow-up Reminder
     
     Contact: dev
     Phone: 918408907516
     Campaign: checkF12
     
     Due in approximately 10 MINUTES
     ```

4. **Check Server Logs**
   Look for:
   ```
   [DripLog] OWNER_NOTIFY: {"phone":"910000000000","message":"Follow-up for dev due in ~10 MINUTES"}
   [DripEngine] ✅ Owner notification sent to 910000000000
   ```

### ✅ Expected Result
- Owner receives actual WhatsApp message
- Log shows successful send
- Notification is NOT sent again (idempotency)

### ❌ If It Fails
- Log shows "OWNER_NOTIFY" but no "✅ Owner notification sent" → Check WhatsApp API credentials
- Error in logs → Check `WhatsAppService.sendMessage` implementation
- Notification sent multiple times → Check idempotency key logic

---

## Test 4: Message Cost Verification

### Goal
Confirm only 1 message is sent per contact, even with duplicates.

### Steps

1. **Check WhatsApp API Logs**
   - Look at Meta Business Manager → WhatsApp → Analytics
   - Or check your `whatsapp_messages` table:
     ```sql
     SELECT 
         to_number,
         COUNT(*) as message_count,
         MIN(created_at) as first_sent,
         MAX(created_at) as last_sent
     FROM whatsapp_messages
     WHERE to_number = '918408907516'
     AND created_at > NOW() - INTERVAL '1 hour'
     GROUP BY to_number;
     ```

2. **Verify Single Message**
   - `message_count` should be 1 (not 3)
   - `first_sent` and `last_sent` should be same timestamp

### ✅ Expected Result
```
to_number      | message_count | first_sent           | last_sent
---------------|---------------|----------------------|----------------------
918408907516   | 1             | 2026-02-12 18:25:00  | 2026-02-12 18:25:00
```

### ❌ If It Fails
- Multiple messages → Duplicate enrollments still exist, check processor logs
- Check `drip_enrollments` for ACTIVE duplicates

---

## Test 5: Race Condition Simulation

### Goal
Verify thread safety with concurrent enrollments.

### Steps

1. **Create Multiple Enrollments Simultaneously**
   
   Open 3 terminal windows and run these commands at the same time:
   
   **Terminal 1:**
   ```bash
   curl -X POST http://localhost:5000/api/drip-campaigns/YOUR_CAMPAIGN_ID/enroll \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"contact_ids": ["CONTACT_ID_1"]}'
   ```
   
   **Terminal 2:**
   ```bash
   curl -X POST http://localhost:5000/api/drip-campaigns/YOUR_CAMPAIGN_ID/enroll \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"contact_ids": ["CONTACT_ID_1"]}'
   ```
   
   **Terminal 3:**
   ```bash
   curl -X POST http://localhost:5000/api/drip-campaigns/YOUR_CAMPAIGN_ID/enroll \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"contact_ids": ["CONTACT_ID_1"]}'
   ```

2. **Check Responses**
   - First request: `{"success": true, "count": 1, "skipped": 0}`
   - Second request: `{"success": true, "count": 0, "skipped": 1}`
   - Third request: `{"success": true, "count": 0, "skipped": 1}`

3. **Verify Database**
   ```sql
   SELECT COUNT(*) as enrollment_count
   FROM drip_enrollments
   WHERE contact_id = 'CONTACT_ID_1'
   AND drip_campaign_id = 'YOUR_CAMPAIGN_ID'
   AND status IN ('ACTIVE', 'PROCESSING');
   ```
   
   Should return: `enrollment_count = 1`

### ✅ Expected Result
- Only 1 enrollment created
- Other requests skipped due to duplicate check
- No race condition errors in logs

---

## Quick Test Checklist

Use this for rapid verification after server restart:

- [ ] **Restart server** with `.\run_local.bat`
- [ ] **Check logs** for startup errors
- [ ] **Enroll test contact** (918408907516)
- [ ] **Try duplicate enrollment** → Should be rejected
- [ ] **Wait 1-2 minutes** for processor cycle
- [ ] **Check logs** for `[DripEngine] Processing batch...`
- [ ] **Verify single message** sent (check WhatsApp)
- [ ] **Check owner notification** if configured
- [ ] **Review database** for `DUPLICATE_CANCELLED` status

---

## Monitoring Commands

### Watch Server Logs in Real-Time
```powershell
# In PowerShell
Get-Content -Path "server\logs\app_info_*.log" -Wait -Tail 50
```

### Check Active Enrollments
```sql
SELECT 
    e.id,
    c.name as contact_name,
    c.phone,
    dc.name as campaign_name,
    e.status,
    e.created_at,
    e.next_run_at
FROM drip_enrollments e
JOIN contacts c ON e.contact_id = c.id
JOIN drip_campaigns dc ON e.drip_campaign_id = dc.id
WHERE e.status IN ('ACTIVE', 'PROCESSING')
ORDER BY e.created_at DESC
LIMIT 20;
```

### Check Recent Messages
```sql
SELECT 
    to_number,
    message_type,
    template_name,
    status,
    created_at
FROM whatsapp_messages
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Check Drip Logs
```sql
SELECT 
    action_type,
    campaign_name,
    details,
    created_at
FROM drip_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Troubleshooting

### Issue: "Template name does not exist" Error
**Solution:** Already fixed in previous update. Ensure server restarted.

### Issue: "updated_at column not found"
**Solution:** Run the SQL migration:
```sql
-- Run this in Supabase SQL Editor
ALTER TABLE follow_ups ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
NOTIFY pgrst, 'reload schema';
```

### Issue: Duplicate messages still being sent
**Solution:**
1. Check `drip_enrollments` for duplicates:
   ```sql
   SELECT contact_id, drip_campaign_id, COUNT(*)
   FROM drip_enrollments
   WHERE status = 'ACTIVE'
   GROUP BY contact_id, drip_campaign_id
   HAVING COUNT(*) > 1;
   ```
2. Manually cancel duplicates (keep oldest):
   ```sql
   -- This will be auto-handled by processor, but you can force it
   UPDATE drip_enrollments
   SET status = 'DUPLICATE_CANCELLED', completed_at = NOW()
   WHERE id IN (
       SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (
               PARTITION BY contact_id, drip_campaign_id 
               ORDER BY created_at
           ) as rn
           FROM drip_enrollments
           WHERE status = 'ACTIVE'
       ) t WHERE rn > 1
   );
   ```

### Issue: Owner notifications not received
**Checklist:**
- [ ] `notification_rules` array is set in enrollment
- [ ] Owner phone number is correct (with country code)
- [ ] `stop_at` time is in future
- [ ] Current time is within notification window
- [ ] WhatsApp API credentials are valid
- [ ] Check logs for "✅ Owner notification sent" or error message

---

## Success Criteria

All tests pass when:

1. ✅ **No duplicate enrollments** created via API
2. ✅ **Existing duplicates auto-cancelled** by processor
3. ✅ **Only 1 message sent** per contact per campaign step
4. ✅ **Owner receives notifications** at configured intervals
5. ✅ **No race condition errors** in logs
6. ✅ **Message costs optimized** (1x instead of 3x)

---

## Next Steps After Testing

If all tests pass:
1. Monitor production for 24 hours
2. Check message costs in WhatsApp Business Manager
3. Verify owner notifications are working as expected
4. Consider adding unique constraint to database (see `DRIP_CAMPAIGN_FIXES.md`)

If any test fails:
1. Check server logs for detailed error messages
2. Verify database schema (especially `updated_at` column)
3. Confirm WhatsApp API credentials
4. Review the specific test's troubleshooting section above
