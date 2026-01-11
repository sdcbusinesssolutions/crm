# Unresponsive Timeout Feature Documentation

## Overview
The **Unresponsive Timeout** feature ensures that your WhatsApp flows do not get stuck indefinitely if a user fails to respond to an interactive message. It allows you to define a specific wait time (e.g., 5 minutes, 1 hour), after which the flow automatically proceeds down a designated "Timeout" path.

This feature is critical for re-engaging users, sending reminders, or gracefully ending sessions without manual intervention.

## Supported Nodes
The feature is currently implemented for the following interaction nodes:

1.  **Send Flow**
2.  **Ask Question**
3.  **List Message**
4.  **Quick Reply**

## How to Use

### 1. Enable the Timeout
1.  Open the settings panel for any of the supported nodes.
2.  Toggle the switch labeled **"Unresponsive timeout"**.
3.  A new set of inputs will appear:
    *   **Value Input**: Enter a number (e.g., `10`, `30`, `1`).
    *   **Unit Select**: Choose from `Minutes`, `Hours`, or `Days`.

### 2. Connect the Timeout Path
Once enabled, a new handle labeled **"ON TIMEOUT"** will appear on the node in the Flow Builder canvas.

*   **Drag a connection** from this "ON TIMEOUT" handle to the next node you want to execute if the user does NOT respond.
*   **Example logic**:
    *   *Node A (Ask Question)* -> [User Answers] -> *Node B (Save Answer)*
    *   *Node A (Ask Question)* -> [Timeout 10m] -> *Node C (Send Reminder)*

### 3. Connection Behavior
*   **On Success**: If the user replies within the time limit, the flow follows the standard connection (e.g., "On Answer" or specific button paths).
*   **On Timeout**: If the time expires without a response, the flow follows the "ON TIMEOUT" connection.

---

## Technical Implementation Details

### Backend Logic
*   **Executor Updates**: Each supported node executor (`sendFlow.js`, `askAnything.js`, etc.) now calculates a `timeoutAt` timestamp based on the user's configuration and saves it to the session variables.
*   **Flow Engine**: The `FlowEngine.js` scheduler has been updated to poll for sessions with status `waiting_input`.
    *   It checks if `now > timeoutAt`.
    *   If true, it marks the node status as `timeout`, triggering the flow to resume.
    *   The engine specifically looks for an edge connected to the `unresponsive` source handle.

### Frontend Logic
*   **Node Component**: The `Node.tsx` component was updated to conditionally render the "ON TIMEOUT" handle.
*   **Visual Logic**:
    *   **Send Flow**: Shows "On Complete" (Default) and "On Timeout".
    *   **Ask Question**: Shows "On Answer" (Default) and "On Timeout".
    *   **List/Quick Reply**: Shows specific option handles and "On Timeout".

### Database Persistence
*   The `timeoutAt` value is persisted in the `flow_sessions` table within the `variables` JSON column, ensuring timeouts survive server restarts.
