# Automation Duplicate Handling - Root Cause & Fix

## Issue Description
Users reported receiving duplicate messages every 5 minutes (Cron Interval), despite the Google Sheet status column explicitly showing "Sent".

## Root Cause Analysis
The system uses a **Double-Check Mechanism** to prevent duplicates:
1.  **Sheet Status Check:** "Is the Status column 'Sent'?"
2.  **Database History Check:** "Have we processed a row with this **Hash** today?"

**Both checks were failing simultaneously due to a subtle logic flaw:**

### 1. The Hashing Paradox (DB Check Failure)
*   The **Row Hash** (Fingerprint) was calculated using **ALL** columns in the row, including the `Status` column.
*   **Run 1 (10:00 AM):**
    *   Row Data: `{ Name: "John", Status: "" }`
    *   Hash: `A1B2... (Empty Status)`
    *   Action: Send Message -> Update Sheet Status to "Sent".
*   **Run 2 (10:05 AM):**
    *   Row Data: `{ Name: "John", Status: "Sent" }`
    *   Hash: `X9Y8... (Sent Status)`
    *   **The System Thought:** "Hash `X9Y8` has never been seen before!" (Because looking for `A1B2`).
    *   **Result:** The History Check was bypassed because the "Identity" of the row changed after processing.

### 2. The Case Sensitivity Bug (Sheet Check Failure)
*   The code checked specifically for: `rowObj[config.statusColumn] === 'sent'`.
*   If the user configured the column as `Status` (Capital S) but the sheet header was `status` (lowercase):
    *   `rowObj['Status']` would be `undefined`.
    *   The check `undefined === 'sent'` is FALSE.
    *   **Result:** The system thought the message was NOT sent.

## The Fix (Applied 2026-01-25)

### 1. Stable Row Hashing
We updated `SheetAutomationService.js` to **Explicitly Exclude** the configured Status Column from the Hash calculation.
*   **Before:** Hash(`Name:John|Status:`) != Hash(`Name:John|Status:Sent`)
*   **After:** Hash(`Name:John`) == Hash(`Name:John`)
*   Now, even after the status changes to "Sent", the system recognizes the row as "Already Processed" via the Database.

### 2. Case-Insensitive Status Lookup
We updated the logic to find the status column robustly:
```javascript
const actualKey = Object.keys(rowObj).find(k => 
    k.toLowerCase() === configStatusCol.toLowerCase()
);
if (rowObj[actualKey] === 'sent') SKIP;
```

## Verification
This fix ensures that even if one check fails (e.g. status isn't written back due to network error), the **Database Hash** remains stable and prevents the re-send loop.
