# How to Use Google Sheet Automation

This guide explains how to set up automations correctly based on your needs ("Scenario A" vs "Scenario B").

---

## 🚀 Quick Summary: Which one should I choose?

| I want to... | Choose Trigger | Frequency |
| :--- | :--- | :--- |
| **Send a message immediately** when a new person is added to the sheet (e.g., Welcome Message, Lead Alert). | **"When a new row is added"** | Checked every **5 Minutes** automatically. |
| **Send a recurring message** based on a date (e.g., Happy Birthday, Payment Reminder, Daily Check-in). | **"Run on Schedule"** | **Daily / Weekly / Monthly** (You decide). |

---

## 🔹 Scenario A: "When a New Row is Added"

Use this for **One-Time Messages** triggered by new data (e.g. New Leads).

### How it works
1.  **System Check:** The system checks your Google Sheet automatically **every 5 minutes**.
2.  **Detection:** It looks for **new rows** added at the bottom of the sheet.
3.  **Action:** It sends the message immediately to those new rows.

### ✅ Best Practices
*   **Do NOT delete rows from the top.** The system remembers the *Row Number*. If you delete row 5, row 6 becomes row 5, and the system might get confused or skip a row.
*   **Status Column:** Recommended. The system writes "Sent" to avoid duplicates.
*   **Filtering:** You can now add **Filter Conditions** (e.g. `City` Equals `Delhi`) directly in the **Flow Builder settings**.

### 🔍 Understanding the "Two Lists" (Architecture)
You might notice that creating a Trigger in the **Flow List** also adds an entry to the **Sheet Automation List**.
*   **Flow List (The Brain):** This is where you define **Logic** (Message content, Filters). **Edit your settings here.**
*   **Sheet Automation List (The Watchdog):** This is the background process created automatically to poll your sheet. **Do not edit this directly.** It exists to track status (like "Last Processed Row").

### ❌ What to avoid
*   **Do not edit the "Watchdog" entry** in the Sheet Automation list if you created it via Flow. Always use the Flow Builder.
*   Do not use this for "Birthdays". This is only for *new* entries.

---

## 🔹 Scenario B: "Run on Schedule"

Use this for **Recurring Messages** or **Batch Processing**.

### How it works
1.  **System Check:** The system checks your sheet at the **Time** you selected (e.g., every day at 09:00 AM IST).
     *   **Daily:** Checks every day at that time.
     *   **Weekly:** Checks on specific days (e.g., Mon, Wed, Fri) at that time.
     *   **Monthly:** Checks on a specific date (e.g., 1st of month) at that time.
2.  **Detection:** It scans **ALL** rows in the sheet to see who needs a message based on your Conditions.
3.  **Deduplication (The "Recurring" Checkbox):**
    *   **🔲 Unchecked (Default - "Safe Mode"):** The system sends to each person **Once in their Lifetime**. Perfect for "Daily Welcome Bots" or "Payment Reminders". Even if the schedule runs daily, it remembers who received it 6 months ago and skips them.
    *   **✅ Checked ("Recurring Mode"):** The system allows re-sending to the same person **every time the schedule runs**. Perfect for "Daily Team Updates" or "Weekly Newsletters". It only prevents sending duplicates *on the same day*.

### ✅ Example 1: Daily Birthday Bot 🎂
*   **Schedule:** Daily @ 9 AM.
*   **Condition:** `Birthday Column` **IS** `Today`.
*   **Recurring Checkbox:** **Unchecked** (System automatically resets history for Birthday/Anniversary conditions yearly).

### ✅ Example 2: Daily Welcome Bot (Batch) 🐢
*   **Schedule:** Daily @ 6 PM.
*   **Condition:** `Status` **IS** `Empty`.
*   **Recurring Checkbox:** **Unchecked**.
*   **Result:** Checks once a day. Finds all *new* people added today. Sends them a message. Skips yesterday's people.

### ✅ Example 3: Daily Team Update (Broadcast) 📢
*   **Schedule:** Daily @ 10 AM.
*   **Condition:** `Team` **EQUALS** `Sales`.
*   **Recurring Checkbox:** **✅ Checked**.
*   **Result:** Every day at 10 AM, **everyone** in the Sales team gets the message.

### ❌ What to avoid
*   **Missing Status Column?** No problem! The system has a "Lifetime Memory" (if checkbox is unchecked).
*   **Using Recurring Checkbox without conditions:** Be careful! If you check "Recurring" and have 10,000 rows, it will try to send 10,000 messages *every day*. Always use conditions (e.g., `Active` = `Yes`).

---

## ❓ FAQ

**Q: Can I make "New Row" check faster than 5 minutes?**
A: Currently, this is fixed at 5 minutes to prevent Google from blocking your account for "Too Many Requests".

**Q: What if I edit a row after it is sent?**
*   **Scenario A:** Nothing happens (It passed the bookmark).
*   **Scenario B:** If you don't have a Status Column, the system *might* resend it because the row looks "new" (changed data). **Fix:** Always add a `Status` column ("Sent") to prevent this.

**Q: I deleted a row, will it send again?**
*   No, the system tracks specific unique data (Phone + Name hash).
