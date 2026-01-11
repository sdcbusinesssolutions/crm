# WhatsApp Flow Builder - Architecture Redesign (n8n Style)

## 1. Overview
The goal is to transform the current hardcoded flow builder into a **generic, scalable, and node-based automation engine** similar to n8n. This architecture separates the **Flow Orchestration** (Engine) from the **Node Logic** (Executors), allowing for infinite extensibility without modifying the core engine.

## 2. Core Concepts

### 2.1. The Node Protocol
Every node, regardless of its function (Send Message, API Call, If/Else), follows a strict protocol:
- **Input**: Receives the `Global Context` (variables from all previous nodes).
- **Configuration**: Static settings defined in the UI (e.g., "Hello {{name}}").
- **Execution**: Performs a specific task (e.g., calls WhatsApp API).
- **Output**: Returns a JSON object (e.g., `{ status: "sent", messageId: "wamid.123" }`).

### 2.2. The Global Context (Variable System)
Instead of hardcoding values, the engine passes a `Context` object to every node.
```json
{
  "trigger": {
    "phone": "+1234567890",
    "text": "Hello"
  },
  "node_1": {
    "status": "sent",
    "messageId": "wamid.123"
  },
  "node_2": {
    "userInput": "Yes, I am interested"
  }
}
```
Users can reference these variables in the UI using `{{node_1.messageId}}`.

## 3. Backend Architecture (Node.js)

### 3.1. Flow Engine (`flowEngine.js`)
The central orchestrator. It does **not** know how to send a message or call an API. It only knows how to:
1.  Load a Flow.
2.  Find the next node.
3.  Resolve variables (e.g., replace `{{trigger.phone}}` with `+123...`).
4.  Delegate execution to a specific `NodeExecutor`.
5.  Save the output to the Context.

### 3.2. Node Executor Interface
Every node type must implement this interface:
```javascript
class NodeExecutor {
    async execute(node, context) {
        // 1. Read Config
        // 2. Perform Action
        // 3. Return Output
    }
}
```

### 3.3. Folder Structure
```
server/
  services/
    flow/
      engine.js          # Main Orchestrator
      context.js         # Variable Substitution Logic
      executors/         # Individual Node Logic
        textMessage.js
        mediaMessage.js
        webhook.js
        condition.js
        apiCall.js
```

## 4. Frontend Architecture (React)

### 4.1. Generic Node Component
Instead of creating a custom component for every node, use a **Generic Node Wrapper** that renders inputs based on a JSON Schema.

### 4.2. Variable Selector (The "Magic")
In the Node Configuration Panel, every input field should allow:
- **Static Text**: Typed manually by the user.
- **Dynamic Variable**: Dragged and dropped from a "Previous Steps" sidebar.

## 5. Implementation Plan

### Phase 1: Backend Core (Immediate)
1.  Refactor `flowEngine.js` to use the **Executor Pattern**.
2.  Implement `ContextManager` for variable substitution.
3.  Create Executors for `SendMessage`, `AskQuestion`, and `Condition`.

### Phase 2: Frontend Builder
1.  Update `SettingsPanel` to support dynamic variable insertion.
2.  Visual indication of data flow (output of Node A -> input of Node B).

### Phase 3: Advanced Nodes
1.  Add `API Request` node (generic HTTP).
2.  Add `Webhook` node (trigger flow via HTTP).
3.  Add `Logic` nodes (Switch, Loop).

---

## 6. Example: Execution Flow

1.  **Trigger**: User sends "Welcome".
2.  **Engine**: Starts Session. Context: `{ trigger: { text: "Welcome" } }`.
3.  **Node 1 (Text)**: Config: "Hi {{trigger.phone}}!".
    -   **Engine**: Resolves to "Hi +123...!". Calls `TextExecutor`.
    -   **Executor**: Sends WhatsApp message. Returns `{ id: "msg_1" }`.
    -   **Engine**: Updates Context: `{ trigger: ..., node_1: { id: "msg_1" } }`.
4.  **Node 2 (Ask)**: Config: "What is your name?".
    -   **Engine**: Sends message. Sets status `waiting_input`.
    -   **System**: Pauses.
5.  **User Reply**: "John".
    -   **Engine**: Resumes. Updates Context: `{ ..., node_2: { reply: "John" } }`.
6.  **Node 3 (Text)**: Config: "Nice to meet you, {{node_2.reply}}".
    -   **Engine**: Resolves to "Nice to meet you, John". Sends message.
