# Flow Timeout & Unresponsive Handling Guide

This guide explains how to use the **Unresponsive Timeout** feature in the WhatsApp Flow Builder to handle scenarios where a user stops replying.

## 1. Overview
When you send a message that requires a response (like a Template with buttons or a Question), you can set a **timeout duration**. If the user does not reply within this time, the flow will automatically proceed down a specific **"On Timeout"** path.

This allows you to re-engage users who dropped off ("ghosted") without manual intervention.

---

## 2. Supported Nodes
Currently, the following nodes support Unresponsive Timeouts:
1.  **Send Template Message**: When sending templates (esp. with Buttons/Lists).
2.  **Ask Question**: When asking for text/media input.
3.  **Ask Anything**: When asking open-ended questions.

---

## 3. How to Configure

1.  **Select Node**: Click on a supported node (e.g., "Send Template Message").
2.  **Enable Feature**: Scroll down to the **"Unresponsive timeout"** toggle and switch it ON.
3.  **Set Duration**:
    *   Enter the numeric value (e.g., `1`, `30`, `24`).
    *   Select the unit (`Minutes`, `Hours`, `Days`).
4.  **Visual Update**:
    *   A new handle labeled **"ON TIMEOUT"** (orange/slate color) will appear on the node card in the canvas.
    *   The standard output handle is now labeled **"NEXT STEP"** (or just the default connection point).

---

## 4. Connecting the Logic

| Handle Name | Trigger Condition | Behavior |
| :--- | :--- | :--- |
| **NEXT STEP** | **User Replies** | Fires immediately when the user sends a message or clicks a button. This is the "Happy Path". |
| **ON TIMEOUT** | **Timer Expires** | Fires only if the user is **silent** for the full duration. This is the "Recovery Path". |

### ⚠️ IMPORTANT: Behavior with Buttons vs Text
*   **Templates WITH Buttons**: The flow **ALWAYS pauses** to wait for a click. The "Next Step" will *only* trigger if the user clicks.
*   **Templates WITHOUT Buttons**:
    *   **If Timeout OFF**: The flow continues *immediately* to the Next Step (0 delay).
    *   **If Timeout ON**: The flow pauses to wait for a text reply.

---

## 5. Advanced Strategies (Drip Campaigns)

### Strategy A: "Smart Drip" (Recommended)
You only want to follow up if the user ignores you.
1.  **Node 1**: Template ("Hello?"). Timeout = 24 Hours.
2.  **Next Step**: Connect to conversation flow ("Thanks for replying!").
3.  **On Timeout**: Connect to **Node 2** ("Are you still there?").

### Strategy B: "Blind Drip" (Fixed Sequence)
You want to send Message 2 after 24 hours *regardless* of their reply.
1.  **Node 1**: Template. Timeout = 24 Hours.
2.  **Next Step**: Connect to a **Delay Node** (set to remaining time) -> **Node 2**.
3.  **On Timeout**: Connect to **Node 2**.
*(Note: This is complex to time perfectly. Strategy A is preferred).*

---

## 6. Technical Behavior

*   **Scheduler**: A background system scheduler runs every **60 seconds**.
*   **Mechanism**:
    1.  When the node executes, it calculates the `timeoutAt` timestamp (Current Time + Duration).
    2.  The flow enters a `waiting_input` state.
    3.  If the user replies -> The flow continues immediately via the "Next Step" path.
    4.  If the user does NOT reply -> The scheduler detects the `timeoutAt` has passed and triggers the "On Timeout" path.
*   **Precision**: The check runs every minute. So a 1-minute timeout might trigger between 60-119 seconds depending on when the scheduler tick happens.

---

## 7. Example Use Case: "Abandoned Cart" Recovery

1.  **Node 1 (Template)**: Send "Do you want to confirm your order?" (Buttons: Yes/No).
2.  **Timeout Setting**: 2 Hours.
3.  **Next Step (Yes)**: Connect to "Payment Link" node.
4.  **On Timeout**: Connect to a Text Node: *"We reserved your items. Click here to checkout before they expire!"*

This ensures you don't lose sales just because a user got distracted.
