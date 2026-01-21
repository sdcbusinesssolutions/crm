# Google Sheet Automation - Comprehensive Guide & Example

This guide explains how to set up, schedule, and troubleshoot Google Sheet Automations, with a complete breakdown of the backend logic.

## 1. Quick Start: Creating an Automation

1.  **Connect Sheet**: Select your Spreadsheet and Sheet/Tab.
2.  **Map Columns**:
    *   **Phone Column**: Select the column containing phone numbers (e.g., `Phone`).
    *   **Name Column**: Select the column for names (e.g., `Customer Name`).
    *   **Variables**: Map any template variables (e.g., `{{1}}` -> `Order ID`).
3.  **Set Trigger**:
    *   **Type**: Choose between "On New Row" or "At Specific Time".
    *   **Conditions**: (Optional) Add logic like `Date is_today` or `Status equals Pending`.
4.  **Save & Active**: Ensure the status is set to "Active".

---

## 2. Trigger Types Explained (Important)

Choosing the correct trigger type is crucial for timing.

### A. "At Specific Time" (Schedule)
Use this if you want messages to go out at a **precise time** (e.g., 9:00 AM every day).
*   **How it works**: The system checks the clock every minute.
*   **Precision**: Runs within 1 minute of the target time.
*   **Timezone**: Always follows **IST (India Standard Time)**.
*   **Example**: "Send Happy Birthday at 9:00 AM if Birthday is Today".

### B. "When a row is added" (New Row / Polling)
Use this if you want messages to go out **as soon as data is added**.
*   **How it works**: The system checks the sheet **Every 5 Minutes**.
*   **Polling**: It calculates "Has 5 minutes passed since last check?".
*   **Timing**: If you add a row at 12:01, it might trigger at 12:05.
*   **Warning**: This mode **IGNORES** any "Time" setting (like 9:00 AM). It runs 24/7 on a 5-minute loop.

---

## 3. Conditions: How to Use Them (With Examples)

Conditions act as filters. If a row does NOT meet the condition, the message is **Skipped**.

| Operator | Meaning | Example Data | Will it Send? |
| :--- | :--- | :--- | :--- |
| **equals** | Exact Match | Status: "Pending" | **YES** (if condition is `Status equals Pending`) |
| **not_equals** | Anything EXCEPT this | Status: "Paid" | **YES** (if condition is `Status not_equals Failed`) |
| **contains** | Partial Match | Product: "iPhone 15 Pro" | **YES** (if condition is `Product contains iPhone`) |
| **does_not_contain** | Exclude value | Note: "Do not call" | **NO** (if condition is `Note contains Call`) |
| **starts_with** | Prefix Check | ID: "WAP-123" | **YES** (if condition is `ID starts_with WAP`) |
| **ends_with** | Suffix Check | File: "invoice.pdf" | **YES** (if condition is `File ends_with .pdf`) |
| **is_empty** | Check Blank Cell | Feedback: "" | **YES** (if condition is `Feedback is_empty`) |
| **is_not_empty** | Ensure Value Exists | Phone: "9876543210" | **YES** (if condition is `Phone is_not_empty`) |

### Date Conditions (Powerful)
These are dynamic and change every day.

| Operator | When to use | Example Scenario |
| :--- | :--- | :--- |
| **is_today** | Same Day Events | Sending "Appointment Reminder" on the day. |
| **is_tomorrow** | Pre-Alerts | Sending "Your Appointment is Tomorrow" reminder. |
| **is_yesterday** | Follow-ups | Sending "Thank you for visiting yesterday". |
| **in_last_x_days** | Recent Activity | "You signed up 3 days ago, need help?" |
| **in_next_x_days** | Upcoming Deadlines | "Your subscription expires in 5 days." |
| **date_equals** | Specific Static Date | "Join our Webinar on Dec 25th". |
| **date_before** | Past Deadlines | "Your payment was due before Oct 1st". |
| **date_after** | Future Release | "Available after Jan 1st". |

### Birthday & Anniversary (Recurring)
These operators **Ignore the Year**. `1990-05-20` matches `2026-05-20`.

| Operator | Use Case |
| :--- | :--- |
| **day_month_equal** | **Happy Birthday!** (Matches Day & Month) |
| **day_month_before** | "Did we miss your birthday yesterday?" |
| **day_month_after** | "Your birthday is coming soon!" |

---

## 4. Advanced Deduplication & Safety

To prevent spamming customers, the system uses "smart history".

### Deduplication Logic
Before sending, the system calculates a "Fingerprint" (Hash) of the row data.

| Schedule Type | Rule | Reset Time |
| :--- | :--- | :--- |
| **Manual (Test Button)** | **ALWAYS SEND** | N/A |
| **Daily Schedule** | **Once Per Day** | Midnight IST |
| **Weekly Schedule** | **Once Per Day** | Midnight IST |
| **One-Time / Custom** | **Once Forever** | Never |

### Retry Logic (Anti-Loop)
*   **Scenario**: Invalid data (e.g., missing phone).
*   **Behavior**: System tries -> Fails -> **Marks as "Processed" for today**.
*   **Result**: It prevents infinite error loops.
*   **Fix**: Correct data, then click **"Test / Trigger Now"**.

---

## 5. Rescheduling Logic

### Does rescheduling trigger immediately?
No, rescheduling a "Daily" automation just updates **when** it will run next.
*   **For Tomorrow**: It will trigger at the new time tomorrow.
*   **For Today**:
    *   If it **has NOT run yet today**, it will trigger at the new time.
    *   If it **ALREADY ran today**, it will NOT trigger again today (Deduplication).

---

## 6. Complete Workflow Example

**Goal**: Send a "Payment Reminder" via WhatsApp to anyone whose `Date` is today and `Status` is `Pending`.

### Step 1: Sheet Data
| Name | Phone | Date | Status |
| :--- | :--- | :--- | :--- |
| Alice | 919876543210 | 22-01-2026 | Pending |
| Bob | 919876543211 | 22-01-2026 | Paid |

### Step 2: Automation Config
*   **Trigger Type**: "At Specific Time".
*   **Schedule**: Daily at 10:00 AM.
*   **Conditions**:
    1.  `Date` **is_today**.
    2.  `Status` **equals** `Pending`.

### Step 3: Execution (10:00 AM IST)
1.  **System wakes up** at 10:00 AM.
2.  **Reads Sheet**: Finds Alice and Bob.
3.  **Checks Conditions**:
    *   **Alice**: Date is today (Yes). Status is Pending (Yes). -> **MATCH**.
    *   **Bob**: Date is today (Yes). Status is Paid (No). -> **SKIP**.
4.  **Dedupe**: Have I sent to Alice today? **No**.
5.  **Action**: Sends WhatsApp message to Alice.

---

## 7. Troubleshooting Checklist

1.  **Check Status**: Is the automation "Active" (Green Badge)?
2.  **Check Schedule**: If it triggers at random times (e.g., 12:05) and ignores your 9:00 AM setting, you selected **"New Row"**. Change to **"Specific Time"**.
3.  **Check Duplicates**: Do you have two automations targeting the same sheet? This causes double messages.
4.  **Check Errors**: Look at "Action -> Edit" logs.

