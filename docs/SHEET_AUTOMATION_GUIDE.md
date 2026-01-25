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
1.  **System Check:** The system checks your sheet at the **Time** you selected (e.g., every day at 10 AM).
2.  **Detection:** It scans **ALL** rows in the sheet to see who needs a message.
3.  **Safety Logic (Deduplication):**
    *   **Logic 1 (Standard):** If you give **NO Date Condition**, the system will send to each person **Once in their Lifetime**. It remembers who it sent to (using a digital fingerprint) and will *never* send to them again.
    *   **Logic 2 (Recurring):** If you give a **Date Condition** (e.g., "Birthday IS Today"), the system will send **Once per Year** (or per recurrence).

### ✅ Example 1: Daily Birthday Bot 🎂
*   **Trigger:** Schedule (Daily @ 9 AM).
*   **Condition:** `Birthday Column` **IS** `Today`.
*   **Result:** System checks every day. If a row matches today's date, it sends a message. Next year, it sends again.

### ✅ Example 2: Daily Welcome Bot (Slow) 🐢
*   **Trigger:** Schedule (Daily @ 6 PM).
*   **Condition:** None (or Status is Empty).
*   **Result:** System checks once a day at 6 PM. It finds all *new* people added today and sends them a message. It will **SKIP** anyone it sent to yesterday.

### ❌ What to avoid
*   **Missing Status Column?** No problem! The system now has a "Lifetime Memory". It won't spam your users daily unless you specifically set a Date Condition like "Is Today".

---

## ❓ FAQ

**Q: Can I make "New Row" check faster than 5 minutes?**
A: Currently, this is fixed at 5 minutes to prevent Google from blocking your account for "Too Many Requests".

**Q: What if I edit a row after it is sent?**
*   **Scenario A:** Nothing happens (It passed the bookmark).
*   **Scenario B:** If you don't have a Status Column, the system *might* resend it because the row looks "new" (changed data). **Fix:** Always add a `Status` column ("Sent") to prevent this.

**Q: I deleted a row, will it send again?**
*   No, the system tracks specific unique data (Phone + Name hash).
