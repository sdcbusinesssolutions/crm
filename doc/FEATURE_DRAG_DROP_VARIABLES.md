# Feature: Drag & Drop Dynamic Variable Mapping (n8n-style)

## 1. Overview
This feature enables users to dynamically map outputs from previous nodes (e.g., user replies, webhook payloads, trigger data) into the configuration fields of subsequent nodes. It mimics the user experience of platforms like **n8n** or **Zapier**, where a user can simply drag a "pill" representing a variable (like `{{trigger.phone}}`) and drop it into an input field.

**Status: Implemented** ✅

## 2. User Experience (UX)
1.  **Selection**: When a user clicks on a node in the Flow Editor to edit its settings.
2.  **Sidebar**: A "Variable Sidebar" appears on the right side of the Settings Panel.
3.  **Context**: This sidebar lists all *upstream* nodes (nodes connected before the current one).
4.  **Variables**: Under each node in the sidebar, available output variables are listed (e.g., "Message Text", "API Status", "User Response").
5.  **Action**: The user drags a variable item from the sidebar.
6.  **Drop**: The user drops it into any text input (Text Area, Input Field) in the settings panel.
7.  **Result**: A token (e.g., `{{onMessage-1.text}}`) is inserted at the cursor position.

### New Enhancements (Implemented)
*   **Collapsible Groups**: Variable groups (by node) can be expanded/collapsed for cleaner navigation.
*   **Search**: A search bar allows users to quickly find variables by name or key.
*   **Mobile Support**: On mobile devices, the sidebar becomes a bottom sheet drawer.
*   **Tap-to-Insert**: Users can tap a variable to insert it into the currently focused input field (essential for mobile).

## 3. Technical Implementation

### A. Frontend Architecture

#### 1. `src/utils/flowVariables.ts` (Schema Definition)
*   **Purpose**: Defines the "Output Schema" for every node type.
*   **Logic**:
    *   `NODE_OUTPUT_SCHEMAS`: A constant map defining what variables each node type produces (e.g., `OnMessage` produces `text`, `phone`, `name`).
    *   `getAvailableVariables(nodes, edges, targetNodeId)`: A function that traverses the graph (currently simplified to all other nodes) to gather all potential variables available to the `targetNodeId`.

#### 2. `src/components/VariableSidebar.tsx` (The Source)
*   **Purpose**: Displays the list of draggable variables.
*   **Logic**:
    *   Receives `availableVariables` as props.
    *   Renders a list of nodes and their variables.
    *   **Collapsible Groups**: Uses local state to manage expanded/collapsed node groups.
    *   **Search**: Filters variables based on user input.
    *   **Interaction**: Supports both Drag & Drop (`onDragStart`) and Click (`onClick`) for insertion.
    *   **Payload Format**: `application/vnd.flow.variable` -> `{{nodeId.variableKey}}`.

#### 3. `src/components/DroppableInput.tsx` (The Target)
*   **Purpose**: A wrapper around `<input>` and `<textarea>` that accepts drops and tracks focus.
*   **Logic**:
    *   Listens for `onDrop` events to insert tokens.
    *   **Focus Tracking**: Reports focus events to `SettingsContext` via `onFocus` prop, enabling "Tap-to-Insert".
    *   Extracts the token from `dataTransfer`.
    *   Inserts the token at the current cursor position (or appends it).
    *   Triggers the standard `onChange` handler to update the node's data.

#### 4. `src/components/SettingsPanel.tsx` (The Orchestrator)
*   **Purpose**: Integrates the Sidebar and Inputs.
*   **Logic**:
    *   **Context**: Provides `SettingsContext` to manage the currently active input setter.
    *   **Mobile Layout**: Manages state for the mobile bottom sheet variable drawer.
    *   Calculates `availableVariables` using `useMemo` when a node is selected.
    *   Passes these variables to the `SettingsModal`.
    *   Replaces standard HTML inputs with `DroppableInput` components.
    *   Conditionally renders the `VariableSidebar` only if variables exist.

### B. Backend Architecture

#### 1. `server/services/flow/context.js` (The Resolver)
*   **Purpose**: Replaces the tokens with actual values during execution.
*   **Logic**:
    *   `resolve(text, context)`: Regex matches `{{nodeId.key}}`.
    *   Lookups the value in the `session.variables` JSON object.
    *   Replaces the token with the actual value.

#### 2. `server/services/flowEngine.js` (The Execution Loop)
*   **Purpose**: Manages the flow state.
*   **Logic**:
    *   Before executing a node, it calls `contextManager.resolveObject(node.data)`.
    *   After executing a node, it saves the output to `session.variables[node.id]`.

### C. System Variables (Implemented)
In addition to node outputs, the following system variables are available globally:
*   `{{sys.currentDate}}`: Current date (YYYY-MM-DD)
*   `{{sys.currentTime}}`: Current time (HH:mm:ss)
*   `{{sys.currentDateTime}}`: Full timestamp (ISO 8601)
*   `{{sys.currentDay}}`: Day name (Monday, Tuesday...)
*   `{{sys.currentMonth}}`: Month name (January, February...)
*   `{{sys.currentYear}}`: Current year (YYYY)
*   `{{sys.timezone}}`: System timezone
*   `{{sys.unixTimestamp}}`: Epoch timestamp

These are resolved dynamically by the backend `ContextManager`.

## 4. Implementation Prompt
*Use the following prompt to ask an AI to implement this feature in another project or context.*

```markdown
**Objective**: Implement an n8n-style "Drag and Drop Variable Mapping" feature for a React-based Flow Builder.

**Context**:
We have a node-based flow editor (React Flow). Users need to use data from previous steps (e.g., a user's reply from Node A) in the configuration of future steps (e.g., sending that reply in a text message in Node B).

**Requirements**:

1.  **Variable Discovery (`flowVariables.ts`)**:
    *   Create a utility that defines the "Output Schema" for each node type (e.g., `OnMessage` -> `text`, `phone`; `Webhook` -> `response`).
    *   Implement a function `getAvailableVariables(nodes, edges, currentNodeId)` that finds all upstream nodes and returns their available variables.
    *   **System Variables**: Include a default "System Variables" group (Date, Time, etc.) available to all nodes.

2.  **Draggable Sidebar (`VariableSidebar.tsx`)**:
    *   Create a sidebar component that lists these variables.
    *   Make each variable item **draggable** using the HTML5 Drag & Drop API.
    *   **Enhancements**: Add collapsible groups, search functionality, and tap-to-insert support.
    *   On drag start, set the data transfer payload to a token format: `{{nodeId.variableKey}}`.

3.  **Droppable Inputs (`DroppableInput.tsx`)**:
    *   Create a custom Input/Textarea component that handles `onDrop`.
    *   When a variable is dropped, insert the token (`{{...}}`) at the cursor position.
    *   **Focus Handling**: Expose a way to insert text programmatically when the input is focused (for tap-to-insert).
    *   Ensure it works seamlessly with standard `onChange` state updates.

4.  **Integration (`SettingsPanel.tsx`)**:
    *   Update the Node Settings Panel to display the `VariableSidebar` on the side.
    *   **Mobile**: Implement a bottom sheet drawer for variables on small screens.
    *   Replace standard inputs with `DroppableInput`.

5.  **Backend Resolution (Node.js)**:
    *   Ensure the backend `FlowEngine` parses these tokens (Regex: `/\{\{([^}]+)\}\}/g`) and replaces them with actual values from the flow session state before executing the node.
    *   **System Variables**: Implement logic to resolve `sys.*` tokens (e.g., `sys.currentDate`) dynamically.
```
