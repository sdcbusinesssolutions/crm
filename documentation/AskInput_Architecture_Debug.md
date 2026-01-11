
# Troubleshooting & Debugging Guide

## 1. How to Debug Common Issues

### Issue: "My Image is not showing in the Inbox"
**Diagnostics:**
1.  **Check Server Logs**:
    *   Look for `[Inbox] Fetched...` logs.
    *   Check if `Newest Message` log shows a `URL`.
    *   *If URL is null*: The webhook failed to save the media URL. Check `server/routes/webhook.js` logs for "Media uploaded to Supabase".
2.  **Check Database**:
    *   Run `node debug_messages.js` to inspect the last 5 messages in the DB.
    *   Confirm `media_url` column is populated for the latest message.
3.  **Check Supabase Storage**:
    *   Go to Supabase Dashboard -> Storage -> `campaign-media`.
    *   Verify the file exists in the `inbound` folder.

### Issue: "Flow stuck on 'Waiting Input' / Not Responding"
**Diagnostics:**
1.  **Check Flow Session**:
    *   Look at `flow_sessions` table in Supabase.
    *   Check `status` column. Is it `waiting_input`?
2.  **Check Logs**:
    *   Filter server logs for `[FlowEngine]`.
    *   Ensure `Processing message from...` appears when you send a reply.
    *   If you see `No matching flow found... and no active session`, the session ID might have been lost or the phone number doesn't match.

### Issue: "Validation always fails"
**Diagnostics:**
1.  **Check Regex**:
    *   In the Flow Builder, check the "Validation Regex" setting for the Ask Input node.
    *   Ensure it's a valid Javascript Regex string (without the surrounding `/ /`).
    *   *Example Correct*: `^\d{3}$` (for 3 digits).
    *   *Example Incorrect*: `/^\d{3}$/` (some parsers fail on this).

---

# Architecture Diagram (Mermaid)

```mermaid
graph TD
    User((User)) -->|Sends Message| WhatsAppAPI[WhatsApp Cloud API]
    WhatsAppAPI -->|POST /webhook| Webhook[Node.js Webhook Endpoint]
    
    subgraph "Server (Backend)"
        Webhook -->|1. Parse Event| Parser[Event Parser]
        Parser -->|Check Media| MediaHandler{Is Media?}
        
        MediaHandler -->|Yes| Downloader[Download Media]
        Downloader -->|Upload| SupabaseStorage[(Supabase Storage)]
        SupabaseStorage -->|Return URL| Downloader
        
        MediaHandler -->|No| TextHandler[Text Processor]
        
        Downloader --> Saver[DB Saver]
        TextHandler --> Saver
        
        Saver -->|Insert| MessagesTable[(DB: Messages Table)]
        
        Saver -->|Trigger| FlowEngine[Flow Engine Service]
        
        FlowEngine -->|Check Session| SessionManager[Session Manager]
        SessionManager -->|Get Context| Redis[(Flow Sessions Table)]
        
        FlowEngine -->|Validate Input| Validator[Validators.js]
        Validator -->|Valid| Executor[Node Executor]
        Validator -->|Invalid| ErrorHandler[Error Handler]
        
        Executor -->|Send Reply| WhatsAppClient[WhatsApp Service]
        ErrorHandler -->|Send Retry Msg| WhatsAppClient
        
        WhatsAppClient -->|API Call| WhatsAppAPI
    end
    
    subgraph "Client (Frontend)"
        InboxUI[Inbox System] -->|Poll/Fetch| InboxAPI[GET /inbox/messages]
        InboxAPI -->|Query| MessagesTable
        InboxAPI -->|Limit 50| MessageQuery[Newest Messages First]
        InboxUI -->|Render| UserScreen[Screen]
    end
```

---

# Flow Diagram: Ask Input Logic

```mermaid
sequenceDiagram
    participant User
    participant WhatsApp
    participant Webhook
    participant FlowEngine
    participant Validator
    participant Database

    Note over FlowEngine: Flow reaches "Ask Input" Node
    FlowEngine->>Database: Update Session (Status: waiting_input)
    FlowEngine->>WhatsApp: Send Question (e.g. "Send Photo")
    WhatsApp->>User: Delivers Message

    User->>WhatsApp: Replies (Image/Text)
    WhatsApp->>Webhook: POST /webhook
    
    Webhook->>Database: Save Message (with Media URL)
    Webhook->>FlowEngine: Process(Message)

    FlowEngine->>Database: Fetch Active Session
    FlowEngine->>Validator: Validate(Input, NodeConfig)

    alt Input Valid
        Validator-->>FlowEngine: Valid = True
        FlowEngine->>Database: Save Response to Variable
        FlowEngine->>FlowEngine: Execute Next Node
    else Input Invalid
        Validator-->>FlowEngine: Valid = False
        alt Retries Remaining
            FlowEngine->>Database: Increment Retry Count
            FlowEngine->>WhatsApp: Send Retry Message ("Invalid, try again")
            FlowEngine->>Database: Update Status (waiting_input)
        else Max Retries Reached
            FlowEngine->>WhatsApp: (Optional) Failure Message
            FlowEngine->>FlowEngine: Follow "On Invalid" Path
        end
    end
```
