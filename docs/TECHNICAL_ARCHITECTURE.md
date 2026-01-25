# Google Sheet Automation: Technical & Configuration Guide

This document provides a complete overview of the Google Sheet Automation system, including the logic flow, database tables, file structure, and syntax for conditions.

---

## 1. System Architecture & Files

The automation system relies on the following core files:

| File Path | Purpose |
| :--- | :--- |
| **`server/services/SheetAutomationService.js`** | **The Brain.** Contains all logic for checking schedules, reading sheets, comparing conditions, and preventing duplicates. |
| **`server/services/whatsappService.js`** | **The Action.** Handles the actual sending of WhatsApp messages using the official API. |
| **Database (Supabase)** | Stores your configuration (`sheet_automations`) and the history of sent messages (`sheet_automation_history`). |

---

## 2. Execution Flow (How it works)

Every 1 minute, the server wakes up and follows this flowchart:

1.  **Check Schedule**: "Is it time to run this bot?"
    *   *New Row Bot:* Checks every 5 mins.
    *   *Schedule Bot:* Checks if User Time (e.g., 10 AM) matches Current Time.
2.  **Read Sheet**: Fetches data from the configured Google Spreadsheet.
3.  **Filter Rows**:
    *   **Index Check:** (Only for New Row Bots) Ignores old rows.
    *   **Condition Check:** Filters rows based on your rules (e.g., `City == 'Delhi'`).
    *   **Status Check:** Ignores rows where Status is "Sent".
    *   **History Check:** Ignores rows with a "Hash" (Fingerprint) that exists in the database.
4.  **Action**: Sends the WhatsApp Message.
5.  **Update**:
    *   Writes "Sent" to the Google Sheet.
    *   Saves the "Hash" to the Database History.

---

## 3. Database Tables

### Table: `sheet_automations`
Stores your bot configuration.

| Column | Description |
| :--- | :--- |
| `automation_type` | `new_row` (Watchdog) OR `schedule` (Calendar). |
| `spreadsheet_id` | ID of the Google Sheet. |
| `trigger_condition` | JSON rule for filtering (e.g., `{ column: "City", operator: "equal", value: "Delhi" }`). |
| `mapping_config` | Maps sheet columns to phone numbers and variables (e.g., `phone_col: "Phone Number"`). |
| `last_processed_row_index` | Bookmark for "New Row" mode. |
| `schedule_config` | Days and Times for "Schedule" mode. |

### Table: `sheet_automation_history`
Stores the log of every sent message to prevent duplicates.

| Column | Description |
| :--- | :--- |
| `automation_id` | Links to the parent automation. |
| `row_hash` | MD5 Fingerprint of the row data (Name+Phone). |
| `status` | `sent`, `pending`, or `failed`. |
| `sent_at` | Timestamp of sending. |

---

## 4. Condition Syntax (How to write rules)

You can filter which rows get messages using the **Trigger Condition** settings.

### Basic Operators

| Operator | Syntax / Example | Meaning |
| :--- | :--- | :--- |
| **Equals** | `equal` | Cell value must exactly match (Case insensitive). <br> *Example: Status equal Pending* |
| **Contains** | `contains` | Cell must contain this text. <br> *Example: Notes contains "High Priority"* |
| **Is Empty** | `is_empty` | Cell must be blank. |
| **Is Not Empty** | `is_not_empty` | Cell must have any value. |

### Date Operators (For Birthdays/Reminders)
*Dates must be in `DD/MM/YYYY` or `YYYY-MM-DD` format in your sheet.*

| Operator | Description | Logic |
| :--- | :--- | :--- |
| **Is Today** | `is_today` | Matches if the date in the column is **Today**. (Ignores year if needed). |
| **Is Tomorrow** | `is_tomorrow` | Matches if the date is **Tomorrow**. |
| **X Days After** | `day_month_after` | Matches if today is past the sheet date. |

### Variable Syntax (In Messages)
When sending a message, you can insert data from the sheet row dynamically.

*   **Syntax:** `{{Column Name}}`
*   **Example:** "Hello {{Name}}, your order {{Order ID}} is ready!"
*   **Note:** The Column Name must match the Sheet Header **exactly** (Case Sensitive).

---

## 5. Troubleshooting Common Issues

1.  **"It's sending duplicates!"**
    *   Check if you added a **Status Column**.
    *   Ensure the automation has successfully written "Sent" to that column.

2.  **"It's not sending at all."**
    *   Check your **Header Names**. If you changed "Phone" to "Mobile" in the sheet, you must update the bot configuration.
    *   Check the **Logs** in the dashboard.

3.  **"Bot stopped working after I deleted rows."**
    *   (New Row Bot): Reseting the index might be required. Go to Automation Settings -> "Reset Index".
