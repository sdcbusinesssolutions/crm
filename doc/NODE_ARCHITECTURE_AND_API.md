# Node Architecture and Meta API Mapping

This document provides a comprehensive end-to-end overview of each node type in the WhatsApp automation flow, tracing the journey from the UI configuration to the backend execution, database persistence, and finally, the interaction with the Meta (WhatsApp) API.

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Message Nodes](#message-nodes)
   - [Text Message](#text-message)
   - [Media Message](#media-message)
   - [List Message](#list-message)
   - [Quick Reply](#quick-reply-message)
   - [CTA (Call To Action)](#cta-message)
   - [Carousel Message](#carousel-message)
   - [Template Message](#template-message)
3. [Logic Nodes](#logic-nodes)
   - [Ask Anything](#ask-anything)
   - [Check Condition](#check-condition)
   - [Set Webhook](#set-webhook)
   - [Call API](#call-api)
   - [Send (Jump) Flow](#send-jump-flow)
   - [Timing (Delay)](#timing-delay)
4. [Triggers](#triggers)
   - [On Message](#on-message)

---

## Core Concepts

### 1. UI Configuration (`SettingsPanel.tsx`)
User configures nodes in `SettingsPanel.tsx`. Each node has a specific settings component (e.g., `TextMessageSettingsPanel`) that updates the `node.data` object.

### 2. Database Persistence
- **Table:** `whatsapp_flows`
- **Column:** `nodes` (JSONB)
- **Structure:** The entire flow, including all nodes and their `data` properties, is stored as a JSON array within the `nodes` column of a specific flow record.
- **Session:** Execution state is tracked in `flow_sessions` (JSONB `variables` column holds context).

### 3. Server Execution (`flowEngine.js`)
The `flowEngine.js` orchestrates the flow. It uses a dispatch map (`EXECUTORS`) to route execution to specific executor services located in `server/services/flow/executors/`.

### 4. Meta API Wrapper (`whatsappService.js`)
All WhatsApp outgoing messages are sent via `whatsappService.sendMessage()`, which standardizes the payload for the Meta Graph API (`v21.0`).

---

## Message Nodes

### Text Message
*   **Description:** Sends a simple text message.
*   **UI Component:** `TextMessageSettingsPanel`
*   **Data Structure:** `TextMessageData` (`message`: string)
*   **Executor:** `server/services/flow/executors/textMessage.js`
*   **DB Persistence:** Saved in `nodes` JSON.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `text`
    *   **Payload:**
        ```json
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "<PHONE_NUMBER>",
          "type": "text",
          "text": { "body": "<MESSAGE_CONTENT>" }
        }
        ```

### Media Message
*   **Description:** Sends an image, video, audio, or document.
*   **UI Component:** `MediaMessageSettingsPanel`
*   **Data Structure:** `MediaMessageData` (`mediaType`: 'Image'|'Video'|'Audio'|'Document', `url`: string, `caption`: string, `filename`?: string)
*   **Executor:** `server/services/flow/executors/mediaMessage.js`
*   **DB Persistence:** Saved in `nodes` JSON.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `image` | `video` | `audio` | `document`
    *   **Payload (Example for Image):**
        ```json
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "<PHONE_NUMBER>",
          "type": "image",
          "image": {
            "link": "<URL>",
            "caption": "<CAPTION>"
          }
        }
        ```
    *   **Note:** Supports `link` (URL) or `id` (Media ID). This system primarily uses `link`.

### List Message
*   **Description:** Sends a menu with up to 10 selectable options.
*   **UI Component:** `ListMessageSettingsPanel`
*   **Data Structure:** `ListMessageData` (`header`?, `body`, `footer`?, `buttonText`, `sections`: ListSection[])
*   **Executor:** `server/services/flow/executors/listMessage.js`
*   **DB Persistence:** Saved in `nodes` JSON.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `interactive`
    *   **Payload:**
        ```json
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "<PHONE_NUMBER>",
          "type": "interactive",
          "interactive": {
            "type": "list",
            "header": { "type": "text", "text": "<HEADER>" },
            "body": { "text": "<BODY>" },
            "footer": { "text": "<FOOTER>" },
            "action": {
              "button": "<BUTTON_TEXT>",
              "sections": [
                {
                  "title": "<SECTION_TITLE>",
                  "rows": [
                    { "id": "<UNIQUE_ID>", "title": "<ITEM_TITLE>", "description": "<DESC>" }
                  ]
                }
              ]
            }
          }
        }
        ```

### Quick Reply Message
*   **Description:** Sends a message with up to 3 quick reply buttons.
*   **UI Component:** `QuickReplySettingsPanel`
*   **Data Structure:** `QuickReplyMessageData` (`headerType`, `headerText`|`headerUrl`, `body`, `footer`, `buttons`: QuickReply[])
*   **Executor:** `server/services/flow/executors/quickReplyMessage.js`
*   **DB Persistence:** Saved in `nodes` JSON.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `interactive`
    *   **Payload:**
        ```json
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "<PHONE_NUMBER>",
          "type": "interactive",
          "interactive": {
            "type": "button",
            "header": { "type": "<image|text|video|document>", ... },
            "body": { "text": "<BODY>" },
            "footer": { "text": "<FOOTER>" },
            "action": {
              "buttons": [
                {
                  "type": "reply",
                  "reply": { "id": "<UNIQUE_ID>", "title": "<BUTTON_TITLE>" }
                }
              ]
            }
          }
        }
        ```

### CTA Message
*   **Description:** Sends a Call-To-Action message with a URL button.
*   **UI Component:** `CTAMessageSettingsPanel`
*   **Data Structure:** `CTAMessageData` (`headerType`, `headerUrl`..., `body`, `footer`, `displayText`, `url`)
*   **Executor:** `server/services/flow/executors/ctaMessage.js`
*   **DB Persistence:** Saved in `nodes` JSON.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `interactive`
    *   **Payload:**
        ```json
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "<PHONE_NUMBER>",
          "type": "interactive",
          "interactive": {
            "type": "cta_url",
            "header": { ... },
            "body": { "text": "<BODY>" },
            "footer": { "text": "<FOOTER>" },
            "action": {
              "name": "cta_url",
              "parameters": {
                "display_text": "<DISPLAY_TEXT>",
                "url": "<URL>"
              }
            }
          }
        }
        ```

### Carousel Message
*   **Description:** Sends a horizontally scrollable carousel of up to 10 cards.
*   **UI Component:** `CarouselSettingsPanel`
*   **Data Structure:** `CarouselMessageData` (`body`, `cards`: CarouselCard[])
*   **Executor:** `server/services/flow/executors/carouselMessage.js`
*   **DB Persistence:** Saved in `nodes` JSON.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `interactive`
    *   **Payload:**
        ```json
        {
             // ... wrapper
             "interactive": {
                 "type": "carousel",
                 "body": { "text": "<BODY>" },
                 "action": {
                     "cards": [
                         {
                             "header": { "type": "image", "image": { "link": "<URL>" } },
                             "body": { "text": "<BODY>" },
                             "buttons": [
                                 { "type": "url", "url": "<URL>", "text": "<TEXT>" }
                                 // OR
                                 { "type": "quick_reply", "reply": { "id": "<ID>", "title": "<TITLE>" } }
                             ]
                         }
                     ]
                 }
             }
        }
        ```

### Template Message
*   **Description:** Sends a pre-approved WhatsApp template.
*   **UI Component:** `TemplateMessageSettingsPanel`
*   **Data Structure:** `TemplateMessageData` (`templateId`, `variableMapping`, `mediaUrl`, `carouselMediaUrls`...)
*   **Executor:** `server/services/flow/executors/templateMessage.js`
*   **DB Persistence:** Node stores `templateId` and mappings. Template definitions are fetched from `whatsapp_templates` table if needed.
*   **Meta API:**
    *   **Endpoint:** `POST /<PHONE_NUMBER_ID>/messages`
    *   **Type:** `template`
    *   **Payload:**
        ```json
        {
          "messaging_product": "whatsapp",
          "recipient_type": "individual",
          "to": "<PHONE_NUMBER>",
          "type": "template",
          "template": {
            "name": "<TEMPLATE_NAME>",
            "language": { "code": "<LANG>" },
            "components": [
               { "type": "header", "parameters": [...] },
               { "type": "body", "parameters": [...] },
               { "type": "button", "sub_type": "url", "index": 0, "parameters": [...] }
            ]
          }
        }
        ```

---

## Logic Nodes

### Ask Anything
*   **Description:** Sends a question (text) and waits for *any* user text response.
*   **UI Component:** `AskAnythingSettingsPanel`
*   **Executor:** `server/services/flow/executors/askAnything.js`
*   **Behavior:** Sends a text message (via `textMessage` logic) and then pauses the flow (`__action: 'PAUSE'`) setting the session status to `waiting_input`.
*   **Resume:** When a webhook comes in, `flowEngine` stores the user's text in session variables under the node ID and resumes execution.

### Check Condition
*   **Description:** Evaluates variables against rules to branch the flow.
*   **UI Component:** `CheckConditionSettingsPanel`
*   **Executor:** `server/services/flow/executors/checkCondition.js` (Implicit or explicit)
*   **Behavior:** Pure server-side logic. Checks `session.variables` against configured rules (e.g., `Name is 'John'`). Returns a result that determines the next edge to follow (True/False path).

### Set Webhook
*   **Description:** Provides a URL to trigger the flow from an external system.
*   **UI Component:** `SetWebhookSettingsPanel`
*   **Executor:** `server/services/flow/executors/setWebhook.js`
*   **Behavior:** No specific execution logic during flow run. It acts as an entry point or a place to define output variables from an external POST request that resumes or starts a flow.

### Call API
*   **Description:** Makes an HTTP request to an external API.
*   **UI Component:** `CallApiSettingsPanel`
*   **Executor:** `server/services/flow/executors/callApi.js`
*   **Behavior:** Uses `axios` to make a request (`GET`, `POST`, etc.) using configured URLs and headers. Responses are stored in `session.variables` for subsequent nodes to use.

### Send (Jump) Flow
*   **Description:** Jumps execution to another Flow.
*   **UI Component:** `SendFlowSettingsPanel`
*   **Executor:** `server/services/flow/executors/sendFlow.js`
*   **Behavior:** Loads the target flow definition from DB and starts executing it, effectively "calling" a subroutine.

### Timing (Delay)
*   **Description:** Pauses execution for a set duration.
*   **UI Component:** `TimingSettingsPanel`
*   **Executor:** `server/services/flow/executors/timing.js`
*   **Behavior:** Calculates the resume time and returns `__action: 'DELAY'`. The `FlowEngine` scheduler checks periodically and resumes the session when the time passes.

---

## Triggers

### On Message
*   **Description:** The starting point of a flow, triggered by incoming keywords.
*   **UI Component:** `Node` (Visual Only, configured via Sidebar Keywords)
*   **Logic:** `flowEngine.js` -> `processMessage`.
*   **Behavior:** When an incoming webhook matches a keyword configured in this node, the engine creates a new session and interprets this node as the start.
