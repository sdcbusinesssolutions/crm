# AI Intent System: Strategic Use Cases & Configuration Guide

This guide details three powerful strategies to automate your lead management using the new **AI Intent Node**. By combining AI analysis with automated routing, you can filter noise, wake up dormant leads, and qualify appointments automatically.

---

## 🚀 Scenario 1: High-Volume Sales ("Filter the Noise")

**Goal:** Process hundreds of inbound messages instantly. Separate "Junk" from "Gold" without human intervention.

### The Problem
You send a broadcast to 1,000 people.
- 150 reply "STOP" or "Unsubscribe".
- 30 ask confusing questions like "Does it fit my specific machine?"
- 20 say "YES, I want to buy!"

**Without AI:** You have to read 200 messages to find the 20 buyers.
**With AI:** The system filters them instantly.

### Configuration Steps

1.  **Step 1:** Send **WhatsApp Message**: *"Flash Sale - 50% Off! Reply YES to claim."*
2.  **Step 2:** Add **Wait Step** (1 Day) to allow time for replies.
3.  **Step 3:** Add **AI Intent Step**.
    *   **Configure Routing:**
        *   `INTERESTED` -> Move to Stage: **Hot Leads** (Sales Team Calls Immediately).
        *   `NOT_INTERESTED` -> Move to Stage: **Lost / Junk** (Ignore).
        *   `QUESTION` -> Move to Stage: **Need Response** (Support Team Handles).

### The Result
*   **Sales Team** only looks at the **Hot Leads** column.
*   **Support Team** only looks at **Need Response**.
*   **No one** wastes time deleting "Stop" messages.

---

## 🌱 Scenario 2: Long-Term Nurture ("Wake Up Inactive Leads")

**Goal:** Detect when a "dead" lead suddenly becomes interested after months of silence, and **alert you immediately**.

### The Problem
You have a 6-month drip campaign sending educational content every 2 weeks.
- **Month 4:** User replies: *"Actually, I might need this next week."*
- **Standard Drip:** Ignores the text and sends another blog post next week. **You lose the lead.**

### Configuration Steps

1.  **Step 1:** Send **WhatsApp Message**: *"Here is a tip on how to improve X..."*
2.  **Step 2:** Add **Wait Step** (2 Weeks).
3.  **Step 3:** Add **AI Intent Step**.
    *   **Configure Routing:**
        *   `INTERESTED` -> Move to Stage: **Hot Leads**.
        *   `LATER` -> Move to Stage: **Cold Leads** (or keep them here).
    *   **Key Logic:** If the user replies with *anything* indicating interest (e.g., "Call me", "Price?", "Maybe soon"), the AI detects `INTERESTED`.

### The Result
The moment a dormant lead replies with interest, they are **moved to "Hot Leads"**.
*   **Pro Tip:** Set up a "Stage Change Automation" (if available) or just check your "Hot Leads" daily. You catch them the moment they wake up.

---

## 📅 Scenario 3: Booking Appointments ("The Gatekeeper")

**Goal:** Only send your Calendar Link to people who are genuinely interested and available.

### The Problem
You don't want to spam everyone with your calendar link. You only want to offer calls to qualified leads.

### Configuration Steps

1.  **Step 1:** Send **WhatsApp Message**: *"Hi, reply 'Book' if you'd like to schedule a quick 15-min call."*
2.  **Step 2:** Add **Wait Step** (1 Day).
3.  **Step 3:** Add **AI Intent Step**.
    *   **Action:** This tags users with `AI_INTERESTED` if they say "Book", "Yes", "Tuesday works", etc.
4.  **Step 4:** Add **Condition Step**.
    *   **Rule:** Check if Tag **Contains** `AI_INTERESTED`.
5.  **Step 5 (True Branch - YES):**
    *   Add **WhatsApp Message**: *"Great! Here is my calendar link: cal.com/my-link"*
6.  **Step 6 (False Branch - NO):**
    *   Add **WhatsApp Message**: *"No problem! Let me know if you change your mind."* (Or just end flow).

### The Result
*   User says: *"I can do Tuesday at 2pm."* -> **AI sees Interest** -> **Sends Link**.
*   User says: *"No thanks."* -> **AI sees Not Interested** -> **Sequence Stops**.
*   User says: *"Is it free?"* -> **AI sees Question** -> **Moves to Support** (Link NOT sent).

---

## 🛠️ Summary of "AI Intent" Actions

| User Reply Example | Detected Intent | Recommended Action |
| :--- | :--- | :--- |
| "Yes", "Interested", "Price?" | `INTERESTED` | Move to **Hot Leads** |
| "Stop", "No thanks", "Unsubscribe" | `NOT_INTERESTED` | Move to **Lost** |
| "Call me next month", "Busy now" | `LATER` | Move to **Cold Leads** |
| "Does it have X?", "Is it free?" | `QUESTION` | Move to **Need Response** |

### How to Activate
1.  Open **Drip Campaign Builder**.
2.  Click `+` and select **AI Intent**.
3.  Map the **Intents** to your **Pipeline Stages** in the right-side panel.
4.  Save & Enroll Contacts!
