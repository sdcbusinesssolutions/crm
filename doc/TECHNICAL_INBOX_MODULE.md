# Technical Documentation: Inbox Module

## 1. Overview
The Inbox Module is the central hub for manual messaging. It mimics a standard chat interface (like WhatsApp Web) allowing agents to converse with contacts in real-time.

## 2. Database Schema

### 2.1 Tables
*   **`conversations`**: Represents a unique chat thread with a contact.
    *   `contact_phone`: The unique identifier for the chat.
    *   `last_message`: Cached text of the last message for list display.
    *   `unread_count`: Number of messages not yet seen by the agent.
    *   `status`: 'open', 'resolved', 'pending'.
*   **`messages`**: Individual message records.
    *   `conversation_id`: FK to `conversations`.
    *   `direction`: 'in' (from contact) or 'out' (from agent).
    *   `status`: 'sent', 'delivered', 'read'.
    *   `type`: 'text', 'image', 'video', etc.
*   **`whatsapp_config`**: Stores API credentials (Meta Graph API token, Phone Number ID).

## 3. Real-Time Architecture

### 3.1 Supabase Realtime
The client subscribes to changes on the `messages` table.
*   **New Message (Inbound)**: When a webhook inserts a message, the client receives an `INSERT` event and appends it to the chat.
*   **Status Update**: When a delivery receipt webhook updates a message status (e.g., to 'read'), the client receives an `UPDATE` event and changes the tick icon (Grey -> Blue).

### 3.2 Webhook Handling (`webhook_logs`)
Incoming data from Meta hits the webhook endpoint (Node.js/Express).
1.  **Verification**: Validates the `hub.verify_token`.
2.  **Processing**:
    *   **Messages**: Parsed and inserted into `messages`. If no conversation exists, one is created.
    *   **Statuses**: Updates existing message records (sent -> delivered -> read).
3.  **Logging**: All raw payloads are saved to `webhook_logs` for debugging.

## 4. Client-Side Logic
*   **Main Component**: `client/src/components/Inbox.tsx` (Chat interface)
*   **Chat List**: `client/src/components/ChatList.tsx` (Sidebar list of conversations)
*   **Message Bubble**: `client/src/components/MessageBubble.tsx` (Individual message rendering)
*   **Service**: `client/src/services/whatsappService.ts` (API calls for sending messages)

### 4.1 State Management
*   **`conversations`**: List of active chats, sorted by `updated_at`.
*   **`activeConversation`**: The currently selected chat.
*   **`messages`**: Array of messages for the active chat.

### 4.2 Sending Messages
1.  **UI**: User types text and hits send.
2.  **Optimistic UI**: Message is immediately added to the list with `status: 'pending'`.
3.  **API Call**: Request sent to backend `/api/whatsapp/send`.
4.  **Backend**:
    *   Calls Meta Graph API.
    *   Inserts message into DB with `status: 'sent'`.
5.  **Confirmation**: Real-time subscription confirms the insert, updating the UI status.

## 5. Server-Side Logic
*   **Webhook Handler**: `server/routes/webhook.js` (Receives Meta events)
*   **WhatsApp Service**: `server/services/whatsappService.js` (Handles Meta API calls)
*   **API Routes**: `server/routes/whatsapp.js` (Endpoints for frontend)

## 6. Debugging & SQL

### Check Webhook Logs for Errors
```sql
SELECT created_at, error_message, raw_payload 
FROM webhook_logs 
WHERE processed_status = 'failed' 
ORDER BY created_at DESC;
```

### Find Broken Conversations (No Messages)
```sql
SELECT c.id, c.contact_name 
FROM conversations c 
LEFT JOIN messages m ON c.id = m.conversation_id 
WHERE m.id IS NULL;
```

### Manually Update Message Status
```sql
UPDATE messages 
SET status = 'read' 
WHERE conversation_id = 'CONV_UUID' AND direction = 'out';
```
