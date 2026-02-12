# AI Intent Routing System - Feature Specification

## Overview
This feature transforms the Drip Campaign system from static linear sequences into an intelligent, adaptive agent. It introduces an **"AI Intent Analysis"** step that classifies incoming user replies and automatically tags or routes the contact based on their sentiment and intent.

---

## 1. Core Concept: The "AI Router" Node

Instead of simple "Stop on Reply" logic, the system will actively analyze *what* the user said.

**Example Flow:**
1.  **Step 1:** Send Message: *"Hi [Name], are you interested in our premium plan?"*
2.  **Step 2:** **Wait for Reply** (Implicit or Explicit).
3.  **Step 3:** **AI Intent Analysis** (New Step Type).
    *   *Input:* The user's last reply text.
    *   *Process:* Send to OpenAI/Gemini with a classification prompt.
    *   *Output:* A semantic label (Intent).

---

## 2. Supported Intents (Classification Buckets)

The initial version supports the following high-value intents:

*   **`INTERESTED`**: Positive sentiment, asking for price, details, or confirmation.
    *   *Examples:* "Yes", "Tell me more", "How much is it?", "I'm in."
*   **`NOT_INTERESTED`**: Negative sentiment, rejection, or stop request.
    *   *Examples:* "No thanks", "Stop", "Don't message me", "Too expensive."
*   **`LATER`**: Soft rejection, timing objection.
    *   *Examples:* "Contact me next month", "Busy right now", "After the holidays."
*   **`QUESTION`**: Informational query that needs a human or specific answer.
    *   *Examples:* "Do you integrate with Zapier?", "Where is your office?"
*   **`OTHER`**: Ambiguous or unrelated replies.

---

## 3. Automated Actions (The "routing")

Based on the detected intent, the `DripProcessor` automatically performs the following actions:

| Detected Intent | System Action | CRM Result | Next Step in Drip |
| :--- | :--- | :--- | :--- |
| **`INTERESTED`** | **Add Tag:** `AI_INTERESTED` | Lead moved to "Hot Leads" (via Automation) | Proceed to "Booking Link" Step |
| **`NOT_INTERESTED`** | **Add Tag:** `AI_COLD` | Lead Archived / Status: Lost | **STOP** Campaign |
| **`LATER`** | **Add Tag:** `AI_LATER` | Task Created: "Follow up in 30 days" | **PAUSE** for 30 Days (or Snooze) |
| **`QUESTION`** | **Add Tag:** `AI_QUESTION` | Notify Admin: "New Question" | **STOP** & Alert Human |

---

## 4. Technical Architecture

### A. AI Service (`server/services/AIService.js`)
*   **Role:** Dedicated interface for LLM (OpenAI/Gemini).
*   **Method:** `analyzeIntent(text, intentsList)`
*   **Environment:** Requires `OPENAI_API_KEY`.
*   **Model:** Uses cost-effective models (e.g., `gpt-4o-mini`) for speed and low cost.

### B. Backend Processor (`server/workers/dripProcessor.js`)
*   **Logic:**
    1.  Encounters `AI_INTENT` step.
    2.  Queries `messages` table for the latest inbound message from this contact.
    3.  If no message found -> Skips/Logs.
    4.  If message found -> Calls `AIService.analyzeIntent()`.
    5.  Receives Intent -> Inserts `contact_tags` record (e.g., `AI_INTERESTED`).
    6.  Logs action to `drip_logs`.

### C. Frontend Builder (`client/src/components/DripCampaigns/DripBuilder.tsx`)
*   **UI:** New tool in the toolbox: **"AI Intent"**.
*   **Visualization:** Displays a "Magic Wand" icon node in the flow.
*   **Configuration:** Simple panel showing the active intents being classified.

---

## 5. Value Proposition

1.  **Stop Losing Leads:** Don't let a "Yes, call me" get buried. The system flags it immediately.
2.  **Clean CRM:** Automatically filter out "Stop" and "No" replies so you focus only on winners.
3.  **Human-Like Interaction:** Users feel heard because the system reacts correctly to their specific response type.
