# Task Update Not Showing - Quick Fix

## Problem
When you update a task's time/details, the UI shows old data instead of the updated values.

## Root Cause
The `tasks` table was missing the `updated_at` column, or the API wasn't setting it properly.

## Solution Applied

### 1. Database Fix
Run this SQL in Supabase SQL Editor:

```sql
-- Add updated_at column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

### 2. API Fix
Updated `server/routes/tasks.js` to explicitly set `updated_at` when updating tasks.

## How to Apply

### Step 1: Run SQL Migration
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run the contents of: `server/sql/fix_tasks_updated_at.sql`
4. Should see: `NOTICE: Added updated_at column to tasks table` (or "already exists")

### Step 2: Restart Server
```powershell
# Press Ctrl+C to stop
.\run_local.bat
```

### Step 3: Test
1. Go to Follow-ups page
2. Edit the "checkF12" task
3. Change due date to: **Feb 12, 2026 7:00 PM** (or any new time)
4. Click Save
5. Refresh page
6. ✅ Should show NEW time, not old time

## Verify Fix

### Check Database
```sql
-- Verify updated_at column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name = 'updated_at';

-- Check recent updates
SELECT id, title, due_date, updated_at, created_at
FROM tasks
WHERE user_id = 'YOUR_USER_ID'
ORDER BY updated_at DESC
LIMIT 5;
```

### Check API Response
After updating a task, the response should include:
```json
{
  "id": "task-uuid",
  "title": "checkF12",
  "due_date": "2026-02-12T18:35:00Z",
  "updated_at": "2026-02-12T18:35:20.123Z",  ← Should be recent
  "created_at": "2026-02-12T12:15:00Z"
}
```

## Related Issues Fixed
- ✅ `follow_ups` table - Same issue, already fixed
- ✅ `tasks` table - Fixed now
- ✅ Schema cache reload - Ensures Supabase recognizes new columns

## If Still Not Working

1. **Clear browser cache:**
   - Press `Ctrl+Shift+R` to hard refresh
   - Or open DevTools → Network tab → Disable cache

2. **Check API response:**
   - Open DevTools → Network tab
   - Update a task
   - Look for `PUT /api/tasks/...` request
   - Check response includes `updated_at` field

3. **Verify database:**
   ```sql
   SELECT * FROM tasks WHERE id = 'YOUR_TASK_ID';
   ```
   Should show `updated_at` matching your edit time

4. **Check server logs:**
   ```powershell
   Get-Content -Path "server\logs\app_info_*.log" -Wait -Tail 50
   ```
   Look for errors when updating task

## Success Criteria
- ✅ Task updates show immediately in UI
- ✅ `updated_at` timestamp changes when editing
- ✅ No "old data" showing after refresh
- ✅ Database has `updated_at` column
