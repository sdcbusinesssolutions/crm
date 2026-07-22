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
        case NodeType.SetWebhook:
        case NodeType.Gsheet:
        case NodeType.Payment:
        case NodeType.AIAgent:
        case NodeType.AssignLead:
            return 'API & Integrations';
        case NodeType.Webhook:
        case NodeType.TaskReminder:
        case NodeType.PipelineTrigger:
        case NodeType.SheetTrigger:
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
    [NodeType.SetWebhook]: [
        { key: 'response', label: 'API Response', type: 'object', description: 'The full JSON response from the API' },
        { key: 'statusCode', label: 'Status Code', type: 'number' }
    ],
    [NodeType.SendFlow]: [
        { key: 'response', label: 'Flow Response (JSON)', type: 'object', description: 'The JSON data returned by the Flow' },
        { key: 'status', label: 'Completion Status (Check)', type: 'string', description: 'completed or incomplete' },
        { key: 'isFilled', label: 'Form Completed? (True/False)', type: 'boolean', description: 'True if form submitted, False if timed out' }
    ],
    [NodeType.CallApi]: [
        { key: 'response', label: 'Full Response (JSON)', type: 'object', description: 'The complete API response body' },
        { key: 'status', label: 'Status Code', type: 'number', description: 'HTTP Status Code (e.g. 200)' }
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
    [NodeType.Gsheet]: [
        { key: 'success', label: 'Success', type: 'boolean', description: 'True if operation succeeded' },
        { key: 'row', label: 'Row Index', type: 'number', description: 'The row number affected' }
    ],
    [NodeType.Calendar]: [
        { key: 'htmlLink', label: 'Calendar Link', type: 'string', description: 'Direct link to Google Calendar event' },
        { key: 'meetLink', label: 'Meet Link', type: 'string', description: 'Google Meet video conference URL' },
        { key: 'eventId', label: 'Event ID', type: 'string', description: 'Unique ID of the created event' },
        { key: 'startTime', label: 'Start Time (ISO)', type: 'string', description: 'Event start time in ISO format' },
        { key: 'endTime', label: 'End Time (ISO)', type: 'string', description: 'Event end time in ISO format' },
        { key: 'formattedDate', label: 'Formatted Date', type: 'string', description: 'e.g. Friday, April 29th' },
        { key: 'formattedTime', label: 'Formatted Time', type: 'string', description: 'e.g. 10:00 AM' },
        { key: 'formattedDateTime', label: 'Full Date/Time', type: 'string', description: 'e.g. Friday 10:00 AM' }
    ],
    [NodeType.TaskReminder]: [
        { key: 'trigger.triggerType', label: 'Trigger Type', type: 'string', description: 'task_due, task_upcoming, or task_completed' },
        { key: 'trigger.title', label: 'Task Title', type: 'string' },
        { key: 'trigger.description', label: 'Description', type: 'string' },
        { key: 'trigger.dueDate', label: 'Due Date', type: 'string' },
        { key: 'contact.name', label: 'Contact Name', type: 'string' },
        { key: 'contact.phone', label: 'Contact Phone', type: 'string' },
        { key: 'contact.email', label: 'Contact Email', type: 'string' }
    ],
    [NodeType.PipelineTrigger]: [
        { key: 'trigger.pipelineName', label: 'Pipeline Name', type: 'string' },
        { key: 'trigger.stageName', label: 'Stage Name', type: 'string' },
        { key: 'contact.name', label: 'Contact Name', type: 'string' },
        { key: 'contact.phone', label: 'Contact Phone', type: 'string' },
        { key: 'contact.email', label: 'Contact Email', type: 'string' },
        { key: 'contact.company', label: 'Company Name', type: 'string' },

        // Common CRM Custom Fields (Pre-mapped for ease of use)
        { key: 'contact.custom_data.address', label: 'Address', type: 'string', description: 'Custom Field: address' },
        { key: 'contact.custom_data.city', label: 'City', type: 'string', description: 'Custom Field: city' },
        { key: 'contact.custom_data.state', label: 'State', type: 'string', description: 'Custom Field: state' },
        { key: 'contact.custom_data.country', label: 'Country', type: 'string', description: 'Custom Field: country' },
        { key: 'contact.custom_data.zip', label: 'Zip Code', type: 'string', description: 'Custom Field: zip' },
        { key: 'contact.custom_data.dob', label: 'Date of Birth', type: 'string', description: 'Custom Field: dob' },
        { key: 'contact.custom_data.notes', label: 'Notes', type: 'string', description: 'Custom Field: notes' },
        { key: 'contact.custom_data.KEY_NAME', label: 'Other Contact Custom Field', type: 'string', description: 'Drag this and replace KEY_NAME' },

        // Lead specific fields for Pipeline Triggers
        { key: 'lead.name', label: 'Lead Name', type: 'string' },
        { key: 'lead.company', label: 'Lead Company', type: 'string' },
        { key: 'lead.custom_data.city', label: 'Lead City', type: 'string', description: 'Lead Custom Field: city' },
        { key: 'lead.custom_data.state', label: 'Lead State', type: 'string', description: 'Lead Custom Field: state' },
        { key: 'lead.custom_data.country', label: 'Lead Country', type: 'string', description: 'Lead Custom Field: country' },
        { key: 'lead.custom_data.zip', label: 'Lead Zip Code', type: 'string', description: 'Lead Custom Field: zip' },
        { key: 'lead.custom_data.KEY_NAME', label: 'Other Lead Custom Field', type: 'string', description: 'Drag this and replace KEY_NAME' }
    ],
    [NodeType.AIAgent]: [
        { key: 'response', label: 'AI Response', type: 'string', description: 'The text reply generated by the AI' },
        { key: 'openai_thread_id', label: 'Thread ID', type: 'string', description: 'Internal OpenAI Thread ID for session persistence' }
    ],
    [NodeType.SheetTrigger]: [
        { key: 'trigger.row_index', label: 'Row Index', type: 'number', description: 'The row number that triggered this flow' },
        { key: 'contact.phone', label: 'Contact Phone', type: 'string' }
    ],
    [NodeType.AssignLead]: [
        { key: 'status', label: 'Assignment Status', type: 'string', description: 'success or skipped' },
        { key: 'assignedStaffId', label: 'Assigned Staff ID', type: 'string', description: 'The ID of the staff member assigned' },
        { key: 'assignedStaffName', label: 'Assigned Staff Name', type: 'string', description: 'The name of the staff member assigned' }
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
        if (node.type === NodeType.SendFlow) {
            // 1. Force add isFilled (Safeguard)
            if (!schema.some(v => v.key === 'isFilled')) {
                dynamicVariables.push({ key: 'isFilled', label: 'Form Completed? (True/False)', type: 'boolean', description: 'True if form submitted, False if timed out' });
            }

            // 2. Custom Output Variable
            if ((node.data as any).outputVariableName) {
                const varName = (node.data as any).outputVariableName;
                dynamicVariables.push({
                    key: varName,
                    label: `Flow Result (${varName})`,
                    type: 'object',
                    description: 'Full JSON response stored in custom variable'
                });
                // Also add isFilled helper for the custom variable
                dynamicVariables.push({
                    key: `${varName}.isFilled`,
                    label: `${varName} (Is Filled?)`,
                    type: 'boolean',
                    description: 'Check if this specific flow response was filled'
                });
            }
        }

        // Handle dynamic fields for SendFlow nodes
        if (node.type === NodeType.SendFlow && (node.data as any).flowFields && Array.isArray((node.data as any).flowFields)) {
            (node.data as any).flowFields.forEach((field: string) => {
                dynamicVariables.push({
                    key: `response.${field}`,
                    label: field, // Or format it nicely
                    type: 'string',
                    description: `Flow field: ${field}`
                });
            });
        }

        // Handle dynamic fields for SetWebhook nodes (Incoming Webhook)
        if (node.type === NodeType.SetWebhook) {
            const webhookData = node.data as any;
            if (webhookData && webhookData.outputVariables && Array.isArray(webhookData.outputVariables)) {
                webhookData.outputVariables.forEach((field: string) => {
                    // Avoid duplicates if the schema already has it
                    if (!schema.some(v => v.key === `response.${field}`)) {
                        dynamicVariables.push({
                            key: `response.${field}`,
                            label: field,
                            type: 'string',
                            description: `Webhook field: ${field}`
                        });
                    }
                });
            }
        }

        // Handle dynamic fields for CallApi nodes
        if (node.type === NodeType.CallApi) {
            const apiData = node.data as any;
            if (apiData && apiData.outputVariables && Array.isArray(apiData.outputVariables)) {
                apiData.outputVariables.forEach((field: string) => {
                    if (!schema.some(v => v.key === `response.${field}`)) {
                        dynamicVariables.push({
                            key: `response.${field}`,
                            label: field,
                            type: 'string',
                            description: `API Response: ${field}`
                        });
                    }
                });
            }
        }

        // Handle dynamic fields for Google Sheet nodes
        if (node.type === NodeType.Gsheet || node.type === NodeType.SheetTrigger) {
            const gsheetData = node.data as any;
            // Use columns if available, or fallback to rowData keys (which represent headers)
            const cols = (gsheetData && gsheetData.columns && Array.isArray(gsheetData.columns))
                ? gsheetData.columns
                : (gsheetData && gsheetData.rowData ? Object.keys(gsheetData.rowData) : []);

            if (cols.length > 0) {
                cols.forEach((col: string) => {
                    const prefix = node.type === NodeType.SheetTrigger ? 'trigger.' : '';
                    const fullKey = `${prefix}${col}`;

                    // Avoid duplicates if standard schema has it
                    if (!schema.some(v => v.key === fullKey)) {
                        dynamicVariables.push({
                            key: fullKey,
                            label: node.type === NodeType.SheetTrigger ? `Trigger: ${col}` : col,
                            type: 'string',
                            description: `Sheet Column: ${col}`
                        });
                    }
                });
            }
        }

        // Handle dynamic output variable for Calendar (Check Availability)
        if (node.type === NodeType.Calendar && (node.data as any).action === 'check_availability' && (node.data as any).outputVariableName) {
            const varName = (node.data as any).outputVariableName;
            dynamicVariables.push({
                key: varName,
                label: `Availability (${varName})`,
                type: 'boolean',
                description: 'True if slot is free'
            });
            dynamicVariables.push({
                key: `${varName}.text`,
                label: `${varName} (Text)`,
                type: 'string',
                description: '"true" or "false" text string'
            });
        }

        // Handle dynamic list output for Calendar (Get Available Slots)
        if (node.type === NodeType.Calendar && (node.data as any).action === 'get_available_slots') {
            dynamicVariables.push({
                key: 'list_sections',
                label: 'Available Slots (List Format)',
                type: 'array',
                description: 'Use this in List Message sections'
            });
            dynamicVariables.push({
                key: 'count',
                label: 'Slot Count',
                type: 'number',
                description: 'Number of slots found'
            });
        }

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
        if (node.type === NodeType.AIAgent && (node.data as any).outputVariableName) {
            const varName = (node.data as any).outputVariableName;
            dynamicVariables.push({
                key: varName,
                label: `AI Output (${varName})`,
                type: 'string',
                description: 'Custom Output Variable'
            });
        }

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
