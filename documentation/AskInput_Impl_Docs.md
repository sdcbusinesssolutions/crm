# Ask Input Node Implementation Documentation

## Overview
The **Ask Input Node** is a core component of the Flow Builder that allows the bot to pause execution and wait for a specific user response. It supports dynamic validation for various input types (Text, Email, Phone, Number, Date, Media) and handles timeouts, retries, and invalid inputs gracefully. The system saves the user's response to variables that can be used in subsequent nodes.

## Architecture Flow

1.  **Flow Execution**: The `FlowEngine` encounters an `AskInput` node.
2.  **Executor**: `AskInputExecutor` runs, sends the configured question (Text) to the user via WhatsApp API.
3.  **State Transition**: The flow session status is updated to `waiting_input`.
    *   Metadata (timeout, retry counts) is saved to the session.
    *   Execution **PAUSES**.
4.  **User Input**: The user sends a message (Text or Media).
5.  **Webhook**: `server/routes/webhook.js` receives the payload.
    *   **Media Handling**: If media, it is downloaded and uploaded to Supabase Storage (public bucket). A public URL is generated.
    *   **Persistence**: The message (with media URL) is saved to the `messages` table.
6.  **Flow Engine Resume**: `FlowEngine.processMessage` detects the active session.
7.  **Validation**: `FlowEngine` calls `AskInputExecutor.validate`, which uses `Validators`.
    *   **Valid**: Response is saved to the Output Variable. Flow continues to the next node.
    *   **Invalid**:
        *   If retries remain: Send error message, increment retry count. Status remains `waiting_input`.
        *   If retries exhausted: Trigger `On Invalid Input` path (if connected) or mark as failed.
8.  **Inbox Display**: The *Inbox* fetches the stored messages (including media) and displays them.

---

## 1. File Changes Summary

### Client Side (React)
| File | Description |
| :--- | :--- |
| `client/src/types.ts` | Added `AskInput` enum and `AskInputData` interface definition. |
| `client/src/components/FlowEditor.tsx` | Updated to support `AskInput` node instantiation. |
| `client/src/components/NodesPanel.tsx` | Added visual element for dragging `AskInput` node. |
| `client/src/components/Node.tsx` | Added handles for flows, including the special "On Invalid Input" handle. |
| `client/src/components/SettingsPanel.tsx` | **Major Update**: Added configuration UI for Input Type (Text/Media), Regex, Date Formats, Timeouts, and dynamic variables. |
| `client/src/utils/flowVariables.ts` | Added variable definitions (e.g., response.text, response.url) for the Variable Picker. |

### Server Side (Node.js)
| File | Description |
| :--- | :--- |
| `types.ts` | Synced shared types with client. |
| `server/services/flowEngine.js` | **Core Logic**: Added Scheduler for timeouts, validation logic in `continueFlow`, and session state management. |
| `server/services/flow/executors/askInput.js` | **New**: Helper class to execute the node (send prompt) and handle validation state logic. |
| `server/services/flow/validators.js` | **New**: Logic to validate Text (Regex, Email, Phone, Date) and Media (Mime types, extensions). |
| `server/routes/webhook.js` | **Critical**: Refactored to save messages directly to DB (bypassing old RPC) to ensure media metadata (URL, filename, mime_type) is preserved. |
| `server/routes/inbox.js` | Updated `/messages/:conversationId` to fetch `limit` (default 50) newest messages and reverse them (Newest -> Oldest). |
| `server/services/flow/context.js` | Fixed variable resolution for `{{nodeId.variable}}` syntax. |

### Database (PostgreSQL/Supabase)
*   **Table**: `messages`
    *   Added columns: `media_url`, `filename`, `mime_type`, `caption`.
*   **Table**: `flow_sessions`
    *   Utilized `variables` JSONB column to store node state (`retryAttempts`, `status`).

---

## 2. API & Routes

### Webhook (`POST /webhook`)
*   **Role**: Entry point for WhatsApp messages.
*   **Process**:
    1.  Receives JSON payload.
    2.  If Media: Downloads content -> Uploads to `campaign-media` bucket -> Generates URL.
    3.  **Direct DB Insert**: Inserts into `messages` table with `media_url`.
    4.  Triggers `FlowEngine.processMessage(..., { type, url, text, ... })`.

### Inbox Messages (`GET /inbox/messages/:conversationId`)
*   **Role**: Fetches chat history for the Inbox UI.
*   **Logic**:
    1.  Accepts optional `?limit=50` query param.
    2.  Queries `messages` table, ordered by `created_at DESC` (Newest First).
    3.  Reverses array `data.reverse()` before returning.
    4.  Ensures Inbox always loads the latest context.

---

## 3. Detailed Logic Breakdowns

### A. Media Handling (Webhook)
Instead of relying on a restricted RPC, the webhook now directly interacts with the database:
```javascript
// server/routes/webhook.js
// 1. Download Media
const publicUrl = await downloadMedia(mediaId, mime_type, ...);

// 2. Direct Insert (Preserves Metadata)
await supabaseAdmin.from('messages').insert([{
    conversation_id: conversationId,
    type: messageType, // 'image', 'video', etc.
    text: body,
    media_url: publicUrl, // CRITICAL
    mime_type: context.mime_type,
    filename: context.filename,
    direction: 'in'
}]);
```

### B. Validation Logic (Validators.js)
The validation system is robust and handles:
*   **Dates**: Supports strict formats (DD/MM/YYYY, YYYY-MM-DD, etc.) via Regex fallback.
*   **Attributes**: Validates Email, Phone via Regex.
*   **Media**: Checks against allowed extensions (e.g., `jpg`, `pdf`) and Mime Types.

### C. Flow Engine State Machine
The engine manages the "Wait" state:
1.  **Pause**: `status` = 'waiting_input'.
2.  **Resume**: When a message comes in, checks `current_node_id`.
3.  **Validate**: Calls `AskInputExecutor.validate`.
4.  **Action**:
    *   `valid: true` -> Move Next.
    *   `action: RETRY` -> Increment attempt count, re-send error message, stay on node.
    *   `action: INVALID` -> Max retries reached, follow 'On Invalid' path.

---

## 4. Setup & Configuration

### Environment Variables
Ensure these are set in `server/.env`:
*   `SUPABASE_URL`: DB URL.
*   `SUPABASE_SERVICE_KEY`: Admin key for RLS bypass.
*   `APP_URL`: (Optional) Base URL if using local media storage fallback.

### SQL Scripts
Executed to support this feature:
1.  `server/sql/fix_media_storage.sql`: Added media columns to `messages`.
2.  `server/sql/fix_update_session.sql`: Created helper RPC for atomic variable updates.

---

## 5. User Guide (Testing)

1.  **Create Flow**: Drag "Ask Input" node.
2.  **Configure**:
    *   Select "Input Type": Media (Image).
    *   Set "Allowed Formats": `jpg, png`.
    *   Set "Timeout": 1 Minute.
3.  **Test**:
    *   Send keyword to trigger flow.
    *   Bot asks for image.
    *   Send Text -> Bot replies "Invalid input".
    *   Send Image (.png) -> Bot accepts, flow continues.
    *   **Inbox**: Verify the image appears in the chat history.
