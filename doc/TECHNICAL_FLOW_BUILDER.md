# Technical Documentation: Flow Builder & Variable Panel

## 1. Overview
The Flow Builder is a visual, node-based editor that allows users to design automated WhatsApp conversation flows. It supports drag-and-drop node creation, connection management, and a dynamic variable system for passing data between nodes.

## 2. Architecture

### 2.1 Database Schema
The Flow Builder relies on two primary tables: `flows` and `flow_sessions`.

#### `flows` Table
Stores the definition of the flow (nodes and edges).
```sql
CREATE TABLE public.flows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Flow',
  description TEXT DEFAULT 'No description',
  status TEXT DEFAULT 'Draft', -- 'Draft' or 'Published'
  nodes JSONB DEFAULT '[]'::jsonb, -- React Flow nodes array
  edges JSONB DEFAULT '[]'::jsonb, -- React Flow edges array
  trigger_keywords TEXT[] DEFAULT '{}', -- Auto-extracted keywords for triggering
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

#### `flow_sessions` Table
Tracks the execution state of a user in a flow.
```sql
CREATE TABLE flow_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_phone TEXT NOT NULL,
    flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
    current_node_id TEXT, -- The ID of the node the user is currently at
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'waiting_input', 'error'
    variables JSONB DEFAULT '{}', -- Stores collected data (e.g. {{askName.response}})
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Server-Side Logic (`server/services/flowEngine.js`)
The `FlowEngine` class orchestrates the execution.

*   **`processMessage(userId, contactPhone, messageText)`**:
    1.  Checks for an active session using `get_active_session` RPC.
    2.  If active, calls `continueFlow`.
    3.  If inactive, searches for a flow matching the keyword using `get_flow_by_keyword` RPC.
    4.  If found, calls `startFlow`.

*   **`startFlow(userId, contactPhone, flow, initialMessage)`**:
    1.  Finds the specific `OnMessage` node that matches the keyword (or defaults to the first one).
    2.  Initializes context variables (trigger data).
    3.  Creates a session using `create_flow_session` RPC.
    4.  Calls `executeNextStep`.

*   **`executeNode(session, flow, node)`**:
    1.  Resolves variables in the node configuration using `ContextManager`.
    2.  Delegates execution to the specific executor (e.g., `textMessage.js`, `askAnything.js`).
    3.  Updates session variables with the node's output.
    4.  Moves to the next node via `executeNextStep`.

### 2.3 Client-Side Logic
*   **Main Editor**: `client/src/components/FlowEditor.tsx` (Canvas, State, Save Logic)
*   **Node Components**: `client/src/components/NodesPanel.tsx` (Sidebar for adding nodes)
*   **Settings Panel**: `client/src/components/SettingsPanel.tsx` (Node configuration)
*   **Variable Sidebar**: `client/src/components/VariableSidebar.tsx` (Draggable variables)
*   **Variable Logic**: `client/src/utils/flowVariables.ts` (Variable definitions & labeling)
*   **Input Component**: `client/src/components/DroppableInput.tsx` (Handles drag-and-drop insertion)
*   **Service**: `client/src/services/flowService.ts` (API calls to backend)

### 2.4 Server-Side Logic
*   **Engine**: `server/services/flowEngine.js` (Main execution logic)
*   **Context Manager**: `server/services/flow/context.js` (Variable resolution)
*   **Executors**:
    *   `server/services/flow/executors/textMessage.js`
    *   `server/services/flow/executors/askAnything.js`
    *   (Other executors in `server/services/flow/executors/`)
*   **API Routes**: `server/routes/flows.js` (CRUD operations for flows)

## 3. Variable Panel & Drag-and-Drop

### 3.1 Variable Structure
Variables are defined in `client/src/utils/flowVariables.ts`.
Format: `{{nodeId.variableKey}}`

**Categories:**
*   **System Variables**: `sys.currentDate`, `sys.currentTime`, etc.
*   **User Input Nodes**: `AskAnything`, `AskLocation`, etc.
*   **Message Nodes**: `TextMessage` (status, id).
*   **API & Integrations**: `SetWebhook`, `Gsheet`.

### 3.2 Drag-and-Drop Implementation (`DroppableInput.tsx`)
*   **Drag Start**: `VariableSidebar` sets `dataTransfer` with the variable token.
*   **Drop**: `DroppableInput` handles the `onDrop` event.
    *   **Validation**: Checks if token is valid (not null/undefined).
    *   **Insertion**: Inserts the token at the cursor position (or end).
    *   **Ref Usage**: Uses `useRef` to ensure the latest input value is used, preventing stale closure bugs.

### 3.3 Node Labeling Logic
In the Variable Panel, nodes are labeled to help users identify them:
*   **Default**: "Ask Anything 1" -> `Ask Anything 1`
*   **Renamed**: "Email Question" -> `Ask Anything: Email Question`
*   **Logic**: `client/src/utils/flowVariables.ts` compares `node.data.label` with `node.type`.

## 4. Debugging & SQL

### Check Active Sessions
```sql
SELECT * FROM flow_sessions WHERE status = 'waiting_input';
```

### Check Flow Structure
```sql
SELECT id, name, nodes FROM flows WHERE name = 'My Flow';
```

### Reset a User's Session
```sql
DELETE FROM flow_sessions WHERE contact_phone = '1234567890';
```

## 5. Webhooks & Functions
*   **`update_flow_keywords`**: A PostgreSQL trigger that automatically extracts keywords from `OnMessage` nodes and updates the `trigger_keywords` column in the `flows` table. This allows for fast keyword lookup without parsing JSON at runtime.
*   **RPC Functions**: `create_flow_session`, `update_session_variables`, etc., are `SECURITY DEFINER` functions to allow the backend to modify session state bypassing RLS (since the backend acts as a system user).
