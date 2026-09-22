import { Node, Edge, NodeType } from '../types';

export interface VariableDefinition {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
}

export interface NodeVariables {
    nodeId: string;
    nodeLabel: string;
    category: string; // Added category
    variables: VariableDefinition[];
}

// Helper to determine category based on node type
const getNodeCategory = (type: NodeType): string => {
    switch (type) {
        case NodeType.OnMessage: return 'On Message';
        case NodeType.AskAnything:
        case NodeType.AskLocation:
        case NodeType.QuickReplyMessage:
        case NodeType.ListMessage:
        case NodeType.AddressMessage:
        case NodeType.Takeaway:
        case NodeType.Delivery:
            return 'User Input Nodes';
        case NodeType.Payment:
        case NodeType.AssignLead:
            return 'API & Integrations';
        case NodeType.Webhook:
        case NodeType.CheckForm:
            return 'Trigger Nodes';
        case NodeType.TextMessage:
        case NodeType.MediaMessage:
        case NodeType.CTAMessage:
        case NodeType.CatalogueMessage:
        case NodeType.TemplateMessage:
            return 'Message Nodes';
        default: return 'Other Nodes';
    }
};

// Define the output schema for each node type
const NODE_OUTPUT_SCHEMAS: Partial<Record<NodeType, VariableDefinition[]>> = {
    [NodeType.OnMessage]: [
        { key: 'text', label: 'Message Text', type: 'string', description: 'The content of the incoming message' },
        { key: 'phone', label: 'Sender Phone', type: 'string', description: 'The phone number of the sender' },
        { key: 'timestamp', label: 'Timestamp', type: 'string', description: 'When the message was received' },
        { key: 'name', label: 'Sender Name', type: 'string', description: 'The profile name of the sender' }
    ],
    [NodeType.TextMessage]: [
        { key: 'messageId', label: 'Message ID', type: 'string' },
        { key: 'status', label: 'Status', type: 'string', description: 'sent, delivered, or read' }
    ],
    [NodeType.AskAnything]: [
        { key: 'response', label: 'User Response', type: 'string', description: 'The text reply from the user' },
        { key: 'timestamp', label: 'Response Time', type: 'string' }
    ],
    [NodeType.QuickReplyMessage]: [
        { key: 'response', label: 'Selected Button (Full JSON)', type: 'object', description: 'The full button object' },
        { key: 'response.id', label: 'Selected Button ID', type: 'string', description: 'The ID of the button clicked' },
        { key: 'response.title', label: 'Selected Button Title', type: 'string', description: 'The text of the button clicked' },
        { key: 'timestamp', label: 'Response Time', type: 'string' }
    ],
    [NodeType.ListMessage]: [
        { key: 'response', label: 'Selected Item (Full JSON)', type: 'object', description: 'The full item object' },
        { key: 'response.id', label: 'Selected Item ID', type: 'string', description: 'The ID of the item selected' },
        { key: 'response.title', label: 'Selected Item Title', type: 'string', description: 'The title of the item selected' },
        { key: 'response.description', label: 'Selected Item Description', type: 'string', description: 'The description of the item selected' },
        { key: 'timestamp', label: 'Response Time', type: 'string' }
    ],
    [NodeType.TemplateMessage]: [
        { key: 'status', label: 'Message Status', type: 'string', description: 'sent, delivered, or read' },
        { key: 'messages.0.id', label: 'Message ID', type: 'string', description: 'WhatsApp Message ID (First)' },
        { key: 'timestamp', label: 'Sent Time', type: 'string' },
        { key: 'response', label: 'User Response (JSON)', type: 'object', description: 'Captured Button/Flow Data' },
        { key: 'response.selectedId', label: 'Response ID / Token', type: 'string', description: 'The ID or token returned' },
        { key: 'response.title', label: 'Response Title', type: 'string', description: 'The text of the button clicked' },
        { key: 'response.nfm_reply', label: 'Flow Data (JSON)', type: 'object', description: 'Data returned from a Flow' }
    ],
    [NodeType.AskInput]: [
        { key: 'response', label: 'User Response', type: 'string', description: 'The validated input' },
        { key: 'response.text', label: 'Response Text', type: 'string' },
        { key: 'timestamp', label: 'Response Time', type: 'string' }
    ],
    [NodeType.AssignLead]: [
        { key: 'status', label: 'Assignment Status', type: 'string', description: 'success or skipped' },
        { key: 'assignedStaffId', label: 'Assigned Staff ID', type: 'string', description: 'The ID of the staff member assigned' },
        { key: 'assignedStaffName', label: 'Assigned Staff Name', type: 'string', description: 'The name of the staff member assigned' }
    ],
    [NodeType.CheckForm]: [
        { key: 'outcome', label: 'Form Checked (True/False)', type: 'boolean', description: 'True if form is submitted, False if not' },
        { key: 'data', label: 'Form Data (JSON)', type: 'object', description: 'Full form submission data' }
    ],
    // Add more schemas as needed
};

/**
 * Finds all nodes that are ancestors of the target node (upstream in the flow).
 */
export const getAvailableVariables = (nodes: Node[], edges: Edge[], targetNodeId: string): NodeVariables[] => {
    const availableNodes = nodes.filter(n => n.id !== targetNodeId);

    const nodeVariables = availableNodes.map(node => {
        const schema = NODE_OUTPUT_SCHEMAS[node.type] || [];

        // If the node has specific data that defines outputs (like 'saveResponseAttribute'), add them
        const dynamicVariables: VariableDefinition[] = [];
        if (node.data && (node.data as any).saveResponseAttribute && (node.data as any).saveResponseAttribute !== 'None') {
            dynamicVariables.push({
                key: (node.data as any).saveResponseAttribute,
                label: (node.data as any).saveResponseAttribute,
                type: 'string'
            });
        }

        // Handle dynamic output variable for AskInput
        if (node.type === NodeType.AskInput && (node.data as any).outputVariableName) {
            const varName = (node.data as any).outputVariableName;
            const inputType = (node.data as any).inputType; // 'Text' or 'Media'

            if (varName) {
                // Base variable (always add)
                dynamicVariables.push({
                    key: varName,
                    label: varName,
                    type: inputType === 'Media' ? 'object' : 'string',
                    description: 'Custom Output Variable'
                });

                // If Media, add sub-properties explicitly so they appear in the droplet
                if (inputType === 'Media') {
                    dynamicVariables.push(
                        { key: `${varName}.url`, label: `${varName} (URL)`, type: 'string', description: 'Public URL of the media' },
                        { key: `${varName}.type`, label: `${varName} (Type)`, type: 'string', description: 'image, video, etc.' },
                        { key: `${varName}.caption`, label: `${varName} (Caption)`, type: 'string', description: 'Caption text if any' },
                        { key: `${varName}.mime_type`, label: `${varName} (Mime Type)`, type: 'string', description: 'e.g. image/jpeg' }
                    );
                }
            }
        }

        // Handle dynamicoutput variable for SendFlow
 // Handle dynamic fields for SendFlow nodes
 // Handle dynamic fields for CheckForm nodes
        if (node.type === NodeType.CheckForm && (node.data as any).formFields && Array.isArray((node.data as any).formFields)) {
            (node.data as any).formFields.forEach((field: any) => {
                const varName = field.name || field.label;
                if (varName) {
                    dynamicVariables.push({
                        key: `data.${varName}`,
                        label: `Form: ${field.label || varName}`,
                        type: 'string', // Forms mostly return strings/booleans
                        description: `Data from form field: ${varName}`
                    });
                }
            });
        }

        // Handle dynamic fields for SetWebhook nodes (Incoming Webhook)
 // Handle dynamic fields for CallApi nodes
 // Handle dynamic fields for Google Sheet nodes
        

        // Handle dynamic output variable for Calendar (Check Availability)
 // Handle dynamic list output for Calendar (Get Available Slots)
 // Handle dynamic output variable for List Message
        if (node.type === NodeType.ListMessage && (node.data as any).outputVariableName) {
            const varName = (node.data as any).outputVariableName;
            dynamicVariables.push({
                key: varName,
                label: `List Selection (${varName})`,
                type: 'object',
                description: 'Full item object'
            });
            dynamicVariables.push({
                key: `${varName}.id`,
                label: `${varName}.id`,
                type: 'string',
                description: 'Selected Item ID'
            });
            dynamicVariables.push({
                key: `${varName}.title`,
                label: `${varName}.title`,
                type: 'string',
                description: 'Selected Item Title'
            });
        }

        // Handle dynamic output variable for AI Agent
 // Smart Label Generation for better identification
        // Format: "Type: Label" (e.g. "Ask Anything: Email")

        const typeLabel = node.type.replace(/([A-Z])/g, ' $1').trim(); // CamelCase to Title Case
        const userLabel = node.data.label || typeLabel;

        let smartLabel = typeLabel;

        // If the user has renamed the node (label is different from type), show both
        if (userLabel && userLabel.toLowerCase() !== typeLabel.toLowerCase()) {
            // Check if userLabel already starts with typeLabel (e.g. "Ask Anything 1")
            // If it does, just use the userLabel as it already contains the type info
            if (userLabel.toLowerCase().startsWith(typeLabel.toLowerCase())) {
                smartLabel = userLabel;
            } else {
                // Otherwise, prefix with the type
                smartLabel = `${typeLabel}: ${userLabel} `;
            }
        } else {
            // If label matches type exactly (or is empty), just show the type
            smartLabel = typeLabel;
        }

        return {
            nodeId: node.id,
            nodeLabel: smartLabel,
            category: getNodeCategory(node.type),
            variables: [...schema, ...dynamicVariables]
        };
    }).filter(n => n.variables.length > 0);

    // Add System Variables
    const systemVariables: NodeVariables = {
        nodeId: 'sys',
        nodeLabel: 'System Variables',
        category: 'System Variables',
        variables: [
            { key: 'currentDate', label: 'Current Date', type: 'string', description: 'YYYY-MM-DD' },
            { key: 'currentTime', label: 'Current Time', type: 'string', description: 'HH:mm:ss' },
            { key: 'currentDateTime', label: 'Full Timestamp', type: 'string', description: 'ISO 8601 Format' },
            { key: 'currentDay', label: 'Day Name', type: 'string', description: 'Monday, Tuesday...' },
            { key: 'currentMonth', label: 'Month Name', type: 'string', description: 'January, February...' },
            { key: 'currentYear', label: 'Current Year', type: 'string', description: 'YYYY' },
            { key: 'timezone', label: 'Timezone', type: 'string', description: 'User/System Timezone' },
            { key: 'unixTimestamp', label: 'Unix Timestamp', type: 'number', description: 'Epoch seconds' }
        ]
    };

    return [systemVariables, ...nodeVariables];
};
