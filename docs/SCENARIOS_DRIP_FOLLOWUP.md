# Advanced Drip & Follow-Up Scenarios

Below are multiple advanced scenarios demonstrating how to use the Drip Campaigns and Follow-Up systems together to create powerful automations.

## Scenario 1: The "Cold to Sold" Nurture Sequence
**Goal:** Automatically warm up a cold lead over 2 weeks without manual effort.

1.  **Preparation:**
    *   Create a Tag specifically for this: `COLD_LEAD_NURTURE`.
    *   Create 3 WhatsApp Templates:
        *   `value_add_1`: "Here is a free guide..."
        *   `value_add_2`: "Did you know X about our product?"
        *   `soft_ask`: "Are you still looking for a solution?"

2.  **Drip Campaign Setup:**
    *   **Name:** "Cold Lead Re-engagement"
    *   **Trigger:** `Tag Added` -> `COLD_LEAD_NURTURE`
    *   **Step 1:** WhatsApp Message (`value_add_1`)
    *   **Step 2:** Wait **3 Days**
    *   **Step 3:** WhatsApp Message (`value_add_2`)
    *   **Step 4:** Wait **4 Days**
    *   **Step 5:** WhatsApp Message (`soft_ask`)

3.  **Execution:**
    *   Go to your **Contacts** list.
    *   Select 50 old leads who haven't replied.
    *   Bulk Tag them with `COLD_LEAD_NURTURE`.
    *   **Result:** They all start receiving messages automatically. If any recover, the campaign stops (if "Stop on Reply" is enabled).

---

## Scenario 2: The "Webinar Countdown" (Event-Based)
**Goal:** Send reminders at specific intervals before an event.

1.  **Drip Campaign Setup:**
    *   **Name:** "Webinar Reminder"
    *   **Trigger:** `Tag Added` -> `WEBINAR_REGISTERED`
    *   **Schedule Window:** Set to `09:00 - 20:00` (so messages aren't sent at night).

2.  **Structure:**
    *   **Step 1 (Immediate):** WhatsApp "Registration Confirmed!"
    *   **Step 2:** Wait **2 Days**
    *   **Step 3:** WhatsApp "Here is the agenda..."
    *   **Step 4:** Wait **1 Day** (The day before event)
    *   **Step 5:** WhatsApp "Tomorrow is the big day!"
    *   **Step 6:** Wait **20 Hours** (Morning of event)
    *   **Step 7:** WhatsApp "Starting in 1 hour! Join link: ..."

---

## Scenario 3: Post-Meeting Manual Follow-Up + Automation
**Goal:** You just finished a call. You want to send a "Thank You" note automatically, but remind yourself to check in manually next week.

1.  **Step A: Automatic "Thank You"**
    *   Create a manual Drip Campaign called "Post-Meeting Thank You".
    *   **Step 1:** WhatsApp "Great speaking with you! Here is the summary..."
    *   **Step 2:** Wait **2 Minutes**
    *   **Step 3:** Email "Full Proposal attached."

2.  **Step B: Manual Reminder**
    *   Go to **Follow-Ups**.
    *   Click `+ New Follow-Up`.
    *   **Title:** "Check if they read proposal".
    *   **Date:** Next Tuesday.
    *   **Priority:** High.

3.  **Execution after Call:**
    *   Go to the contact's profile.
    *   Click "Enroll in Sequence" -> Select "Post-Meeting Thank You". (Or add a tag that triggers it).
    *   The system sends the messages while you move to your next call.
    *   Next Tuesday, your task list reminds you to close the deal.

---

## Scenario 4: "Happy Birthday" / Anniversary (Recurring)
*Note: This usually requires a "Date Field" trigger which is an advanced feature, but you can simulate it manually for VIPs.*

1.  **Follow-Up Setup:**
    *   Create a Follow-Up task for a VIP Client.
    *   **Title:** "Send Anniversary Gift".
    *   **Date:** Their signup anniversary.
    *   **Recurring:** Yes -> **Yearly** (Every 12 Months).

2.  **Result:**
    *   Every year on that date, you get a task.
    *   You can then manually trigger a "Gift Sequence" or send a personal message.

---

## Scenario 5: The "Ghosted" Contingency
**Goal:** A lead stopped replying mid-negotiation.

1.  **Drip Campaign Setup:**
    *   **Name:** "Negotiation Recovery"
    *   **Trigger:** Manual (You decide when to use this).
    
2.  **Structure:**
    *   **Step 1:** Wait **2 Days** (Give them space).
    *   **Step 2:** WhatsApp "Just bubbling this up - did you see my last message?"
    *   **Step 3:** Wait **3 Days**.
    *   **Step 4:** WhatsApp "Is this still a priority for you?"
    *   **Step 5:** Wait **5 Days**.
    *   **Step 6:** WhatsApp "I'll assume you're busy. I'll close this file for now." (The "Break-up" message).

3.  **Execution:**
    *   If a hot lead goes silent, enroll them in this sequence.
    *   It gently nudges them without you having to remember to type a message every few days.
