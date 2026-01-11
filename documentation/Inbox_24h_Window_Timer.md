# Inbox 24-Hour Session Window Timer

## Overview
To comply with Meta's WhatsApp messaging policies, businesses are generally only allowed to send free-form messages to customers within a **24-hour window** of the user's last message. Outside of this window, businesses must use approved Template Messages.

We have implemented a visual timer in the **Inbox** to help agents instantly see the status of this session window.

## Feature Description
When an active chat is selected in the Inbox, a badge appears in the header (next to the Contact actions) indicating the current session status.

### Visual States

1.  **Session Open (Green Badge)**
    *   **Condition**: The last message received from the contact was less than 24 hours ago.
    *   **Display**: Shows the remaining time (e.g., `CLOCK_ICON 23h 45m left`).
    *   **Color**: Green background, Green text.
    *   **Meaning**: You can send any type of message (text, media, etc.) freely.

2.  **Session Expired (Amber Badge)**
    *   **Condition**: The last message received from the contact was more than 24 hours ago, or no message has ever been received.
    *   **Display**: Shows `CLOCK_ICON Session Expired`.
    *   **Color**: Amber (Yellow/Orange) background, Amber text.
    *   **Meaning**: You should ideally send a **Template Message** to re-engage the user. Free-form messages may fail or violate policy (though the system may still attempt to send them depending on specific configuration).

## Implementation Details

### Location
*   **File**: `client/src/components/Inbox.tsx`
*   **Component**: `Inbox` (specifically the Header section of the active chat view).

### Logic
The logic is purely frontend-based for immediate feedback, calculated dynamically from the loaded message list.

1.  **Identify Last Incoming Message**:
    The code filters the `messages` array for the current conversation to find the most recent message where `direction === 'in'`.

    ```typescript
    const lastIncoming = [...messages].reverse().find(m => m.direction === 'in');
    ```

2.  **Calculate Time Difference**:
    It compares the `created_at` timestamp of that message against the current time (`Date.now()`).

    ```typescript
    const lastTime = new Date(lastIncoming.created_at).getTime();
    const now = Date.now();
    const windowDuration = 24 * 60 * 60 * 1000; // 24 Hours in ms
    const diff = (lastTime + windowDuration) - now;
    ```

3.  **Determine Status**:
    *   If `diff > 0`, the window is **Open**.
    *   If `diff <= 0` (or no incoming message exists), the window is **Closed**.

### Usage
This feature requires no manual configuration. It automatically updates whenever the chat is opened or new messages are received/polled.

## Future Improvements
*   **Real-time Countdown**: Currently, the time updates when the component renders or messages change. A `setInterval` could be added to update the minute counter in real-time without needing a re-render of the message list.
*   **Enforcement**: Future updates could visually disable the main text input when the session is expired, forcing the user to select a template, to prevent accidental policy violations.
