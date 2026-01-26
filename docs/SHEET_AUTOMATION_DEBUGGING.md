# Sheet Automation Debugging & Architecture

This document describes the critical fixes and architectural patterns implemented to ensure reliable Google Sheet triggers and WhatsApp message sending.

## 1. Flow Integration Fix

### Problem
Previously, the `SheetAutomationService` attempted to send messages directly as a "blast" using a legacy template method. This caused two issues:
1.  **Flows didn't start:** Use cases requiring a Flow (like "Ask Question" or "Wait for Reply") were ignored.
2.  **Missing "OnMessage" Node:** The Flow Engine defaults to looking for an `onMessage` trigger. Sheet triggers use a `sheetTrigger` node, which was not recognized as a valid start point.

### Solution
We updated `SheetAutomationService.js` to behave as a true **Flow Trigger**:
1.  It now detects if the automation is linked to a Flow ID.
2.  It explicitly searches for the `sheetTrigger` node in the Flow configuration.
3.  It invokes `FlowEngine.startFlow` with the **Explicit Node ID** of the sheet trigger.

**Code Reference:**
```javascript
// SheetAutomationService.js
if (auto.flow_id) {
    // ... fetch flow ...
    const startNode = flow.nodes?.find(n => n.type === 'sheetTrigger');
    await flowEngine.startFlow(..., startNode ? startNode.id : null);
}
```

**Flow Engine Update:**
We updated `flowEngine.js` to accept `sheetTrigger` as a valid starting node type, preventing the "No OnMessage node found" error.

## 2. Status Write-Back (Proxy Fix)

### Problem
Calls to write "Sent" status back to Google Sheets were failing with `Invalid host defined options`.
*   **Root Cause:** The standard `googleapis` Node.js library conflicts with certain server proxy settings (common in Docker/VPS environments).

### Solution
We replaced the write logic with a direct **Axios** HTTP call that explicitly bypasses the proxy configurations.

**Code Reference:**
```javascript
// SheetAutomationService.js -> writeStatus
const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
await axios.put(url, ..., { proxy: false });
```

## 3. Race Condition & Deduplication Strategy

To prevent sending duplicate messages when the sheet is polled frequently, we utilize a **Multi-Layer Safety Mechanism**.

### Layer 1: Row Hash (Database)
*   For every row, we generate a unique **Hash** (MD5 of Name + Phone + Date).
*   Before sending, we check the `sheet_automation_history` table.
*   **Rule:** If `Hash` exists for `Today` (or Lifetime, depending on config), we **SKIP**.

### Layer 2: Optimistic Locking (Flow Engine)
*   When a Flow session starts, we attempt to lock the session row in the DB:
    ```sql
    UPDATE flow_sessions SET status = 'processing' ...
    ```
*   If two requests fire simultaneously, the second one will fail to acquire the lock and will abort immediately.

---

## Debugging Commands

**View Recent Flow Logs:**
```powershell
Get-Content server/logs/flow_logs_*.log -Tail 50
```

**View Automation Errors:**
```powershell
Get-Content server/logs/error_log_*.log -Tail 50
```

**Validate Fix Script:**
We created a script to simulate a real Sheet Trigger event without waiting for the cron job:
```powershell
node server/scripts/validate_sheet_flow.js
```
