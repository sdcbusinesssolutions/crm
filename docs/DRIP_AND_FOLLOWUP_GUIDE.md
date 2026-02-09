# Drip Campaigns and Follow-Up System Guide

This guide provides examples of how to use the newly implemented Drip Campaigns and Follow-Up systems in your application.

## 1. Drip Campaigns
Drip campaigns allow you to automate sequences of messages (WhatsApp, Email) and delays based on triggers.

### Accessing Drip Campaigns
Navigate to **Drip Campaigns** in the sidebar menu.

### Example A: New Lead Welcome Sequence
**Goal:** Automatically welcome a new lead and send them resources over 2 days.

1.  **Create Campaign:**
    *   Click `+ New Campaign`.
    *   **Name:** "New Lead Welcome"
    *   **Trigger:** Select `Tag Added`.
    *   **Value:** Enter `NEW_LEAD`.
    *   **Stop on Reply:** Checked (stops automation if they reply).

2.  **Add Step 1 (Immediate Welcome):**
    *   Click `+` -> **WhatsApp**.
    *   **Template:** Select your `welcome_message` template.
    *   **Save.**

3.  **Add Step 2 (Delay):**
    *   Click `+` -> **Delay**.
    *   **Hours:** Enter `24`.
    *   **Save.**

4.  **Add Step 3 (Resource Link):**
    *   Click `+` -> **WhatsApp**.
    *   **Template:** Select `resource_sharing` template.
    *   **Save.**

5.  **Activate:**
    *   Click **Save Campaign**.
    *   Go back to list and toggle status to **Active** (or use the dropdown menu on the card).

**Result:** When you tag a contact with `NEW_LEAD`, they will immediately get the welcome message. 24 hours later, they will get the resource link, *unless* they replied to the first message.

---

### Example B: Webinar Post-Registration Nurture
**Goal:** Remind a user about a webinar they signed up for.

1.  **Create Campaign:**
    *   **Name:** "Webinar Nurture"
    *   **Trigger:** `Tag Added` -> `WEBINAR_REGISTERED`.

2.  **Steps:**
    *   **Step 1 (Confirmation):** WhatsApp Template `webinar_confirmation`.
    *   **Step 2 (Wait):** Delay `48` hours.
    *   **Step 3 (Teaser):** WhatsApp Template `webinar_teaser_video`.
    *   **Step 4 (Wait):** Delay `24` hours (assuming webinar is soon).
    *   **Step 5 (Reminder):** WhatsApp Template `webinar_starting_soon`.

---

### Example C: Cold Lead Re-engagement
**Goal:** Try to reactivate a lead who hasn't responded in a while.

1.  **Create Campaign:**
    *   **Name:** "Cold Lead Wakeup"
    *   **Trigger:** `Tag Added` -> `COLD_LEAD`.

2.  **Steps:**
    *   **Step 1:** WhatsApp Template `special_offer_discount`.
    *   **Step 2:** Wait `72` hours (3 days).
    *   **Step 3:** WhatsApp Template `are_you_still_interested`.

---

## 2. Follow-Up System
The Follow-Up system allows you to schedule manual tasks (calls, meetings, messages) so you never drop the ball on a lead.

### Accessing Follow-Ups
Navigate to **Lead CRM** -> **Follow-Ups** (or the dedicated Follow-Ups page if configured).

### Example A: Schedule a Call After a Meeting
**Scenario:** You just finished a demo with "John Doe" and agreed to call him next Tuesday.

1.  Click `+ New Follow-Up`.
2.  **Contact:** Search for "John Doe".
3.  **Title:** "Post-Demo Call".
4.  **Type:** Select `Call`.
5.  **Priority:** `High`.
6.  **Scheduled At:** Select next Tuesday's date and time (e.g., 10:00 AM).
7.  **Description:** "Discuss pricing and custom requirements mentioned in demo."
8.  Click **Save**.

**Result:** This task will appear in your "upcoming" list. On Tuesday, it will move to "Today" and show up in your dashboard widgets.

---

### Example B: Recurring Weekly Account Check-in
**Scenario:** You need to check the status of a VIP client every Monday.

1.  Click `+ New Follow-Up`.
2.  **Contact:** Select "VIP Client Name".
3.  **Title:** "Weekly Account Health Check".
4.  **Scheduled At:** Select this coming Monday at 9:00 AM.
5.  **Recurring Follow-up?** Check this box.
    *   **Frequency:** `Weekly`.
    *   **Interval:** `1` (Every 1 week).
6.  Click **Save**.

**Result:** Every time you complete this task, the system will automatically generate the *next* occurrence for the following Monday.

---

### Example C: Managing Overdue Tasks
**Scenario:** You were sick yesterday and missed your calls.

1.  Go to the **Follow-Ups** list.
2.  Click the **Overdue** filter tab.
3.  You will see all tasks that were scheduled for the past but not marked completed.
4.  **Action:**
    *   Click **Edit** to reschedule them for today.
    *   OR perform the task now and click the **Checkmark** icon to mark it as `COMPLETED`.
