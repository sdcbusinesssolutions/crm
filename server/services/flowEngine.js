const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const contextManager = require('./flow/context');
const { logFlowEvent } = require('../utils/logger');

// Import Executors
const textMessageExecutor = require('./flow/executors/textMessage');
const askAnythingExecutor = require('./flow/executors/askAnything');
const mediaMessageExecutor = require('./flow/executors/mediaMessage');
const ctaMessageExecutor = require('./flow/executors/ctaMessage');
const quickReplyMessageExecutor = require('./flow/executors/quickReplyMessage');
const listMessageExecutor = require('./flow/executors/listMessage');
const carouselMessageExecutor = require('./flow/executors/carouselMessage');
const sendFlowExecutor = require('./flow/executors/sendFlow');
const setWebhookExecutor = require('./flow/executors/setWebhook');
const callApiExecutor = require('./flow/executors/callApi');
const templateMessageExecutor = require('./flow/executors/templateMessage');
const timingExecutor = require('./flow/executors/timing');
const checkConditionExecutor = require('./flow/executors/checkCondition');
const switchExecutor = require('./flow/executors/switch');
const manageTagsExecutor = require('./flow/executors/manageTags');
const manageGroupsExecutor = require('./flow/executors/manageGroups');
const askInputExecutor = require('./flow/executors/askInput');
const newLeadExecutor = require('./flow/executors/newLead');
const contactPipelineExecutor = require('./flow/executors/contactPipeline');
const gsheetExecutor = require('./flow/executors/gsheet');
const gmailExecutor = require('./flow/executors/gmail');
const calendarExecutor = require('./flow/executors/calendar');
const aiAgentExecutor = require('./flow/executors/aiAgent');

// Executor Map
const EXECUTORS = {
    'textMessage': textMessageExecutor,
    'askAnything': askAnythingExecutor,
    'mediaMessage': mediaMessageExecutor,
    'ctaMessage': ctaMessageExecutor,
    'quickReplyMessage': quickReplyMessageExecutor,
    'listMessage': listMessageExecutor,
    'carouselMessage': carouselMessageExecutor,
    'sendFlow': sendFlowExecutor,
    'setWebhook': setWebhookExecutor,
    'callApi': callApiExecutor,
    'templateMessage': templateMessageExecutor,
    'timing': timingExecutor,
    'checkCondition': checkConditionExecutor,
    'switch': switchExecutor,
    'manageTags': manageTagsExecutor,
    'manageGroups': manageGroupsExecutor,
    'askInput': askInputExecutor,
    'newLead': newLeadExecutor,
    'contactPipeline': contactPipelineExecutor,
    'gsheet': gsheetExecutor,
    'gmail': gmailExecutor,
    'smtp': require('./flow/executors/smtp'),
    'calendar': calendarExecutor,
    'aiAgent': aiAgentExecutor
};

const { flattenObject } = require('../utils/objectUtils');

class FlowEngine {
    constructor() {
        this.phoneCache = new Map();
        this.instanceId = Math.random().toString(36).substring(7); // Debug ID
        this.startScheduler();
    }

    async getBusinessConfig(userId) {
        if (this.phoneCache.has(userId)) return this.phoneCache.get(userId);

        try {
            const { data } = await supabaseAdmin
                .from('whatsapp_config')
                .select('phone_number, phone_number_id')
                .eq('user_id', userId)
                .maybeSingle();

            const config = {
                phoneNumber: data?.phone_number || 'System',
                phoneNumberId: data?.phone_number_id || 'Unknown'
            };
            this.phoneCache.set(userId, config);
            return config;
        } catch (e) {
            return { phoneNumber: 'System', phoneNumberId: 'Unknown' };
        }
    }

    startScheduler() {
        console.log(`[FlowEngine] Starting Scheduler (Instance: ${this.instanceId}) (Delay & Timeout)...`);
        setInterval(async () => {
            try {
                // console.log(`[FlowEngine] Scheduler Tick (${this.instanceId})`);
                const now = new Date();
                const rpcClient = supabaseAdmin;

                // 1. Handle DELAYED sessions
                const { data: delayedSessions, error } = await rpcClient
                    .from('flow_sessions')
                    .select('*')
                    .eq('status', 'delayed');

                if (!error && delayedSessions && delayedSessions.length > 0) {
                    console.log(`[FlowEngine] Scheduler: ACtively monitoring ${delayedSessions.length} delayed sessions.`);
                    for (const session of delayedSessions) {
                        const variables = session.variables || {};
                        const currentNodeId = session.current_node_id;
                        const nodeOutput = variables[currentNodeId];

                        if (nodeOutput && nodeOutput.resumeAt) {
                            const resumeTime = new Date(nodeOutput.resumeAt);

                            // Check for invalid date
                            if (isNaN(resumeTime.getTime())) {
                                console.error(`[FlowEngine] Invalid resumeAt date for session ${session.id}: ${nodeOutput.resumeAt}`);
                                continue;
                            }

                            if (resumeTime <= now) {
                                // OPTIMISTIC LOCK: Try to claim this session
                                const { data: claimed, error: claimError } = await rpcClient
                                    .from('flow_sessions')
                                    .update({ status: 'resuming' }) // Intermediate status
                                    .eq('id', session.id)
                                    .eq('status', 'delayed') // Ensure it is still delayed
                                    .select();

                                if (!claimError && claimed && claimed.length > 0) {
                                    console.log(`[FlowEngine Scheduler] Instance ${this.instanceId} Successfully Claimed Session ${session.id}. Waited until ${nodeOutput.resumeAt}`);
                                    await this.resumeSession(session);
                                }
                            }
                        } else {
                            // If a session is marked 'delayed' but has no resume info, it's stuck. 
                            // We could auto-resume or mark error, but for now just log.
                            console.warn(`[FlowEngine] Session ${session.id} is 'delayed' but missing resumeAt/nodeOutput. CurrentNode: ${currentNodeId}`);
                        }
                    }
                }

                // 2. Handle WAITING_INPUT sessions with Timeout (Unresponsive)
                const { data: waitingSessions, error: waitingError } = await rpcClient
                    .from('flow_sessions')
                    .select('*')
                    .eq('status', 'waiting_input');

                if (!waitingError && waitingSessions && waitingSessions.length > 0) {
                    for (const session of waitingSessions) {
                        const variables = session.variables || {};
                        const currentNodeId = session.current_node_id;
                        const nodeOutput = variables[currentNodeId];

                        if (nodeOutput && nodeOutput.timeoutAt) {
                            if (new Date(nodeOutput.timeoutAt) <= now) {
                                // OPTIMISTIC LOCK for Timeout
                                const { data: claimed, error: claimError } = await rpcClient
                                    .from('flow_sessions')
                                    .update({ status: 'timeout_processing' })
                                    .eq('id', session.id)
                                    .eq('status', 'waiting_input')
                                    .select();

                                if (!claimError && claimed && claimed.length > 0) {
                                    console.log(`[FlowEngine Scheduler] Session ${session.id} timed out (Unresponsive)`);

                                    // Mark as timeout in variables
                                    const newVariables = { ...variables };
                                    if (newVariables[currentNodeId]) {
                                        newVariables[currentNodeId] = {
                                            ...newVariables[currentNodeId],
                                            status: 'timeout',
                                            isFilled: false,
                                            response: null
                                        };
                                    }

                                    // Just update variables (status is already timeout_processing)
                                    await rpcClient.rpc('update_session_variables', {
                                        p_session_id: session.id,
                                        p_variables: newVariables
                                    });

                                    // Resume Flow with 'unresponsive' trigger
                                    await this.resumeSession({ ...session, variables: newVariables }, 'unresponsive');
                                }
                            }
                        }
                    }
                }

                // 3. Handle STUCK sessions (Active/Processing for > 5 mins)
                // This cleans up sessions that crashed or got stuck in a race condition lock
                const stuckThreshold = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
                const { data: stuckSessions, error: stuckError } = await rpcClient
                    .from('flow_sessions')
                    .select('*')
                    .in('status', ['active', 'processing'])
                    .lt('last_interaction_at', stuckThreshold);

                if (!stuckError && stuckSessions && stuckSessions.length > 0) {
                    console.log(`[FlowEngine Scheduler] Found ${stuckSessions.length} STUCK sessions (Active/Processing > 5m). Cleaning up...`);
                    for (const session of stuckSessions) {
                        // Mark as timeout/error
                        await rpcClient.rpc('update_session_status', {
                            p_session_id: session.id,
                            p_status: 'timeout'
                        });
                        console.log(`[FlowEngine Scheduler] Session ${session.id} marked as timeout (Stuck).`);
                    }
                }

            } catch (err) {
                console.error('[FlowEngine Scheduler] Critical Loop Error:', err);
            }
        }, 30000); // Check every 30 seconds
    }

    async resumeSession(session, interactionId = null) {
        const rpcClient = supabaseAdmin;

        // Fetch Flow
        const { data: flowData } = await rpcClient.rpc('get_flow_by_id', {
            p_flow_id: session.flow_id
        });

        if (flowData && flowData[0]) {
            const flow = flowData[0];
            // Update status to active
            await rpcClient.rpc('update_session_status', {
                p_session_id: session.id,
                p_status: 'active'
            });

            // Execute Next Step
            await this.executeNextStep(session, flow, session.current_node_id, interactionId);
        }
    }
    /**
     * Main Entry Point: Process an incoming message
     */
    async processMessage(userId, contactPhone, messageInput, messageType = 'text', interactionId = null) {
        // messageInput can be a string OR an object (for interactives)
        let messageText = '';
        if (typeof messageInput === 'string') {
            messageText = messageInput;
        } else if (typeof messageInput === 'object' && messageInput !== null) {
            // Try to extract a string representation for logging/keyword matching
            messageText = messageInput.title || messageInput.text || JSON.stringify(messageInput);
        }

        console.log(`[FlowEngine] Processing message from ${contactPhone}: ${messageText} (Interaction: ${interactionId})`);
        const rpcClient = supabaseAdmin || supabase;
        const keyword = typeof messageText === 'string' ? messageText.toLowerCase().trim() : '';

        // 1. Check for Keywords (Priority: High)
        // If the message matches a global keyword, we restart/start that flow, ignoring any active session.
        console.log(`[FlowEngine] Searching for flow with keyword: '${keyword}' for User: ${userId} via RPC...`);
        const { data: flows, error: flowError } = await rpcClient.rpc('get_flow_by_keyword', {
            p_keyword: keyword,
            p_user_id: userId
        });

        if (flowError) {
            console.error('[FlowEngine] RPC Error finding flow:', flowError);
        }

        if (flows && flows.length > 0) {
            const flow = flows[0];
            console.log(`[FlowEngine] Triggering Flow: ${flow.name} (${flow.id})`);

            // TODO: Ideally, we should mark any existing 'waiting_input' sessions for this phone as 'aborted' 
            // to avoid ghost sessions, but for now, starting a new one works.

            return this.startFlow(userId, contactPhone, flow, messageInput);
        }

        // 2. No Keyword Match -> Check for Active Session (Priority: Medium)
        // Use RPC to bypass RLS
        const { data: session, error: sessionError } = await rpcClient.rpc('get_active_session', {
            p_contact_phone: contactPhone
        });

        if (session && session.length > 0) {
            console.log(`[FlowEngine] Found active session: ${session[0].id}`);
            return this.continueFlow(session[0], messageInput, interactionId);
        }

        // 3. Fallback: Check for Wildcard Flow ('*') or Implicit "New Lead" Flow
        console.log(`[FlowEngine] Checking for Wildcard Flow ('*') or Default New Lead Flow...`);

        let wildcardFlows = [];

        // A. Check explicit '*' keyword
        const { data: keywordFlows, error: wcError } = await rpcClient.rpc('get_flow_by_keyword', {
            p_keyword: '*',
            p_user_id: userId
        });
        if (wcError) console.error('[FlowEngine] RPC Error finding wildcard flow:', wcError);
        if (keywordFlows) wildcardFlows = keywordFlows;

        // B. (Robustness) If no explicit '*' flow, search for a flow that STARTS with 'newLead' node.
        // This allows users to just drag "New Lead" as start node without config.
        if (wildcardFlows.length === 0) {
            const { data: allFlows } = await rpcClient
                .from('flows')
                .select('*')
                .eq('user_id', userId)
                .ilike('status', 'published');

            if (allFlows) {
                // Find first flow where the 'newLead' node has no incoming edges (is a start node)
                // OR simply contains a newLead node if we want to be generous.
                // Strict check: Is 'newLead' a root node?
                const defaultFlow = allFlows.find(f => {
                    if (!f.nodes || f.nodes.length === 0) return false;
                    const newLeadNode = f.nodes.find(n => n.type === 'newLead');
                    if (!newLeadNode) return false;

                    // Check if anything connects TO this node
                    const edgesToNewLead = (f.edges || []).filter(e => e.target === newLeadNode.id);
                    return edgesToNewLead.length === 0; // It is a start node
                });

                if (defaultFlow) {
                    console.log(`[FlowEngine] Found Implicit Default Flow (starts with New Lead): ${defaultFlow.name}`);
                    wildcardFlows = [defaultFlow];
                }
            }
        }

        if (wildcardFlows && wildcardFlows.length > 0) {
            console.log(`[FlowEngine] Triggering Wildcard/Default Flow: ${wildcardFlows[0].name}`);
            return this.startFlow(userId, contactPhone, wildcardFlows[0], messageInput);
        }

        console.log(`[FlowEngine] No matching flow found for keyword: '${keyword}', no active session, and no default flow.`);
        return null;
    }

    async triggerFlowByEvent(userId, contactPhone, eventType, eventData) {
        console.log(`[FlowEngine] Triggering event '${eventType}' for ${contactPhone}`);
        const rpcClient = supabaseAdmin || supabase;

        // Find flows that have a trigger node matching this event
        const { data: allFlows } = await rpcClient
            .from('flows')
            .select('*')
            .eq('user_id', userId)
            .ilike('status', 'published');

        if (!allFlows || allFlows.length === 0) {
            console.log(`[FlowEngine] No published flows found for user ${userId}`);
            return;
        }

        for (const flow of allFlows) {
            if (!flow.nodes) continue;

            console.log(`[FlowEngine] Checking Flow: ${flow.name} (${flow.id})`);

            // Find TaskReminder nodes
            const taskNodes = flow.nodes.filter(n => n.type === 'taskReminder');

            if (taskNodes.length > 0) {
                console.log(`[FlowEngine] Found ${taskNodes.length} Task Nodes in ${flow.name}`);
            }

            for (const node of taskNodes) {
                // Determine configured trigger (default to 'task_due')
                const configuredTrigger = node.data.triggerEvent || 'task_due';

                console.log(`   > Node ${node.id}: Configured='${configuredTrigger}', Incoming='${eventType}'`);

                let isMatch = false;

                if (configuredTrigger === eventType) {
                    // Check subtype for upcoming or overdue
                    if (eventType === 'task_upcoming' || eventType === 'task_overdue') {
                        const nodeOffset = node.data.timeOffset || 60;
                        const eventOffset = eventData.timeOffset;
                        if (nodeOffset === eventOffset) isMatch = true;
                    } else {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    const { title } = eventData;
                    const filter = node.data.titleFilter || '';

                    console.log(`   > Event Matched! Checking Title Filter: '${filter}' against '${title}'`);

                    // Check if title contains filter (case insensitive)
                    if (filter && (!title || !title.toLowerCase().includes(filter.toLowerCase()))) {
                        console.log(`   > Skipped: Title mismatch.`);
                        continue;
                    }

                    console.log(`[FlowEngine] Flow ${flow.name} matched task trigger '${eventType}'!`);

                    // Prepare variables: map generic 'trigger' data
                    const triggerVars = {
                        ...eventData,
                        triggerType: eventType,
                        source: 'crm',
                        // Create structured objects that will be assigned to [node.id] by startFlow
                        trigger: {
                            title: eventData.title,
                            description: eventData.description,
                            dueDate: eventData.dueDate,
                            triggerType: eventType
                        },
                        contact: {
                            name: eventData['contact.name'],
                            phone: eventData['contact.phone'],
                            email: eventData['contact.email']
                        }
                    };

                    await this.startFlow(userId, contactPhone, flow, triggerVars, node.id);
                } else {
                    console.log(`   > No match.`);
                }
            }

            // Find PipelineTrigger nodes
            const triggerNodes = flow.nodes.filter(n => n.type === 'pipelineTrigger');

            for (const node of triggerNodes) {
                // Check conditions
                if (eventType === 'pipeline_change') {
                    const { pipelineId, stageId } = eventData;
                    const nodePipelineId = node.data.pipelineId;
                    const nodeStageId = node.data.stageId;

                    console.log(`[FlowEngine] Checking Trigger Node ${node.id} in Flow '${flow.name}'`);
                    console.log(`   Event Payload: pipelineId=${pipelineId}, stageId=${stageId}`);
                    console.log(`   Node Config: pipelineId=${nodePipelineId}, stageId=${nodeStageId}`);

                    // If node configures a specific pipeline, it must match
                    // Use loose equality or string comparison to handle potential type mismatches (UUID vs string vs int)
                    if (nodePipelineId && String(nodePipelineId) !== String(pipelineId)) {
                        console.log(`   Skipping: Pipeline ID mismatch.`);
                        continue;
                    }

                    // If node configures a specific stage, it must match
                    if (nodeStageId && String(nodeStageId) !== String(stageId)) {
                        console.log(`   Skipping: Stage ID mismatch.`);
                        continue;
                    }

                    console.log(`[FlowEngine] Flow ${flow.name} matched event trigger! Starting flow...`);
                    await this.startFlow(userId, contactPhone, flow, {
                        ...eventData,
                        triggerType: 'pipeline_change',
                        source: 'crm'
                    }, node.id);
                }
            }
        }
    }

    /**
     * Start a new flow session
     */
    async startFlow(userId, contactPhone, flow, initialInput, explicitStartNodeId = null) {
        console.log(`[FlowEngine] Starting Flow: ${flow.name}`);

        // Normalize Input: If object, extract string for keyword matching
        let messageText = '';
        if (typeof initialInput === 'string') {
            messageText = initialInput;
        } else if (typeof initialInput === 'object' && initialInput !== null) {
            messageText = initialInput.title || initialInput.text || '';
        }

        // Find the specific node that triggered this flow based on the keyword
        // We look for an 'onMessage' node that has the incoming message in its keywords list.
        const normalizedMessage = messageText.toLowerCase().trim();

        let startNode = flow.nodes.find(n =>
            n.type === 'onMessage' &&
            n.data.keywords &&
            Array.isArray(n.data.keywords) &&
            n.data.keywords.some(k => k.toLowerCase().trim() === normalizedMessage)
        );

        if (explicitStartNodeId) {
            startNode = flow.nodes.find(n => n.id === explicitStartNodeId);
        }

        // Fallback: If no exact keyword match found (e.g. if the flow was triggered by some other means or partial match),
        // default to the first 'onMessage' node found.
        if (!startNode) {
            console.log(`[FlowEngine] No exact keyword match for '${normalizedMessage}' in nodes. Defaulting to first OnMessage node.`);
            startNode = flow.nodes.find(n => n.type === 'onMessage');
        }

        // Implicit Start: If still no start node, look for a "New Lead" node
        if (!startNode) {
            console.log(`[FlowEngine] No OnMessage node. Checking for 'newLead' node (Implicit Flow)...`);
            startNode = flow.nodes.find(n => n.type === 'newLead');
        }

        // Implicit Start: If still no start node, look for a "New Lead" node
        if (!startNode) {
            console.log(`[FlowEngine] No OnMessage node. Checking for 'newLead' node (Implicit Flow)...`);
            startNode = flow.nodes.find(n => n.type === 'newLead');
        }

        if (!startNode) {
            console.error('[FlowEngine] Error: No valid start node found in flow. Explicit ID:', explicitStartNodeId);
            return;
        }
        console.log(`[FlowEngine] Found Start Node: ${startNode.id} (Label: ${startNode.data.label}, Type: ${startNode.type})`);

        // Initialize Context
        // Initialize Context
        // We map the initial data to BOTH 'trigger' (for generic access) 
        // AND the specific node ID (e.g. 'on-message-node') so {{on-message-node.text}} works.

        // Fetch User and Lead Details to inject into context
        let leadContext = {};
        try {
            const rpcClient = supabaseAdmin || supabase;

            // 1. Get Contact Details (+ Groups if needed later)
            const { data: contactData } = await rpcClient
                .from('contacts')
                .select('*')
                .eq('user_id', userId)
                .eq('phone', contactPhone)
                .maybeSingle();

            // 2. Get Lead Details (Pipeline Status)
            const { data: leadData } = await rpcClient
                .from('leads')
                .select('*')
                .eq('user_id', userId)
                .eq('phone', contactPhone) // Assuming phone is unique identifier for simplicity here
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            leadContext = {
                contact: contactData || {},
                lead: leadData || {}
            };

            console.log(`[FlowEngine] Injected Context for ${contactPhone}:`, JSON.stringify(leadContext, null, 2));

        } catch (ctxErr) {
            console.warn('[FlowEngine] Error injecting contact context:', ctxErr);
        }

        let initialData = {
            text: messageText, // The string representation
            phone: contactPhone,
            timestamp: new Date().toISOString(),
            name: leadContext.contact?.name || 'User',
            ...leadContext
        };

        if (typeof initialInput === 'object' && initialInput !== null) {
            // Merge the structured input (id, title, etc) into the initial data
            initialData = { ...initialData, ...initialInput };
            // Flatten context for easier access
            const flattened = flattenObject(initialInput);
            initialData = { ...initialData, ...flattened };
        }

        const initialContext = {
            trigger: initialData,
            [startNode.id]: initialData
        };

        // Create Session via RPC
        const rpcClient = supabaseAdmin || supabase;

        // CRITICAL: Cancel any existing active sessions for this user to avoid "ghost" sessions
        // This ensures that if the user restarts a flow, the old one doesn't interfere later.
        console.log(`[FlowEngine] Cancelling active sessions for ${contactPhone}...`);
        await rpcClient.rpc('cancel_active_sessions', {
            p_contact_phone: contactPhone
        });

        // Small safeguard delay to ensure DB transaction commits
        await new Promise(r => setTimeout(r, 100));

        const { data: session, error } = await rpcClient.rpc('create_flow_session', {
            p_user_id: userId,
            p_contact_phone: contactPhone,
            p_flow_id: flow.id,
            p_current_node_id: startNode.id,
            p_variables: initialContext
        });

        if (error) {
            console.error('[FlowEngine] Failed to create session:', error);
            return;
        }
        console.log(`[FlowEngine] Session created: ${session.id}`);

        // --- FLOW LOG: TRIGGER ---
        try {
            const { phoneNumber, phoneNumberId } = await this.getBusinessConfig(userId);
            logFlowEvent('FLOW_TRIGGER', {
                timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata', hour12: false }),
                flowId: flow.id,
                flowName: flow.name,
                from: contactPhone,
                to: phoneNumber,
                phoneNumberId: phoneNumberId,
                whatsappNumber: phoneNumber,
                contact: contactPhone,
                triggerInput: messageText,
                sessionId: session.id
            });
        } catch (logErr) { console.error('Flow Log Error:', logErr); }

        // Execute Start Logic
        if (['onMessage', 'webhook', 'trigger', 'pipelineTrigger', 'sheetTrigger'].includes(startNode.type)) {
            // It is a Trigger Node: The trigger has already "happened".
            // We move immediately to the next steps connected to it.
            await this.executeNextStep(session, flow, startNode.id);
        } else {
            // It is an Action/Logic Node (e.g. New Lead, Condition) acting as the Start Node.
            // We must EXECUTE it first to generate the interaction/outcome (e.g. 'new' or 'existing').
            await this.executeNode(session, flow, startNode);
        }
    }

    /**
     * Continue an existing flow (Handle User Input)
     */
    async continueFlow(session, input, interactionId = null) {
        const rpcClient = supabaseAdmin || supabase;

        // Use RPC to get flow by ID (bypass RLS)
        const { data: flowData, error: flowError } = await rpcClient.rpc('get_flow_by_id', {
            p_flow_id: session.flow_id
        });

        if (flowError || !flowData || flowData.length === 0) {
            console.error('[FlowEngine] Error fetching flow for session:', flowError);
            return;
        }
        const flow = flowData[0];

        // --- OPTIMISTIC LOCKING START ---
        // Prevent race conditions where two simultaneous webhooks trigger the same step twice.
        // We attempt to set the status to 'processing'. If it fails (already processing), we abort.
        const { data: lockedSession, error: lockError } = await rpcClient
            .from('flow_sessions')
            .update({
                status: 'processing',
                last_interaction_at: new Date().toISOString()
            })
            .eq('id', session.id)
            // CRITICAL FIX: Only allow continuation if the session is explicitly waiting for input.
            // This prevents race conditions where a user replies while the bot is still 'active' (executing logic) 
            // or 'processing' (handling another concurrent request).
            .eq('status', 'waiting_input')
            .select();

        if (lockError || !lockedSession || lockedSession.length === 0) {
            console.warn(`[FlowEngine] Race Condition Detected: Session ${session.id} is already processing. Skipping duplicate request.`);
            return;
        }
        console.log(`[FlowEngine] Session ${session.id} locked for processing.`);
        // --- OPTIMISTIC LOCKING END ---

        // Update Context with User Input
        const currentNodeId = session.current_node_id;
        const context = session.variables || {};

        let parsedInput = input;
        try {
            if (typeof input === 'string') {
                if (input.trim().startsWith('{')) {
                    parsedInput = JSON.parse(input);
                } else if (input === '[object Object]') {
                    console.error(`[FlowEngine] CRITICAL ERROR: Input received as "[object Object]" for node ${currentNodeId}. This indicates a serialization issue in the webhook.`);
                }
            }
        } catch (e) {
            // Not JSON, keep as string
        }



        if (typeof parsedInput === 'object') {
            console.log(`[FlowEngine] Captured Flow Response Keys for ${currentNodeId}:`, Object.keys(parsedInput));
            console.log(`[FlowEngine] Full Parsed Input:`, JSON.stringify(parsedInput, null, 2));
        } else {
            console.log(`[FlowEngine] Parsed Input is not an object:`, typeof parsedInput, parsedInput);
        }

        // Flatten the response to support direct field access (e.g. response.question_1 instead of response.screen_1.question_1)
        let finalResponse = parsedInput;
        if (typeof parsedInput === 'object' && parsedInput !== null) {
            const flattenedResponse = flattenObject(parsedInput);
            finalResponse = { ...parsedInput, ...flattenedResponse };
            console.log(`[FlowEngine] Flattened Response:`, JSON.stringify(finalResponse, null, 2));
        }

        const updatedContext = {
            ...context,
            [currentNodeId]: {
                ...context[currentNodeId],
                response: finalResponse,
                selectedId: interactionId,
                status: 'completed', // Update status to completed
                isFilled: true, // Mark as filled explicitly
                timestamp: new Date().toISOString()
            }
        };

        console.log(`[FlowEngine] Updated Context for ${currentNodeId}:`, JSON.stringify(updatedContext[currentNodeId], null, 2));

        // --- VALIDATION LOGIC ---
        const node = flow.nodes.find(n => n.id === currentNodeId);
        const executor = EXECUTORS[node.type];

        let nextContext = updatedContext;

        let validationResult = { valid: true };

        if (executor && executor.validate) {
            console.log(`[FlowEngine] Validating input for node ${node.id} (${node.type})...`);
            validationResult = await executor.validate({ ...session, variables: { ...context, ...updatedContext } }, node, finalResponse);

            if (!validationResult.valid) {
                console.log(`[FlowEngine] Validation Failed. Action: ${validationResult.action}`);

                // 1. Update Variables (Retries, etc)
                // 1. Update Variables (Retries, etc)
                if (validationResult.updates) {
                    nextContext = { ...updatedContext, ...validationResult.updates };

                    // Persist updates safely using DIRECT update
                    const { error } = await rpcClient.from('flow_sessions')
                        .update({
                            variables: nextContext,
                            last_interaction_at: new Date().toISOString()
                        })
                        .eq('id', session.id);

                    if (error) {
                        console.error(`[FlowEngine] CRITICAL: Failed to update session variables via DB:`, error);
                    }
                }

                // 2. Handle Action
                if (validationResult.action === 'RETRY') {
                    // Re-execute this node (it will see the error state and send error msg)
                    // We need to pass the *updated* session
                    await this.executeNode({ ...session, variables: nextContext }, flow, node);
                    return; // STOP here, do not proceed to next step
                } else if (validationResult.action === 'INVALID' || validationResult.action === 'FAILURE') {
                    // Send Failure message if defined
                    if (node.data.retryMessage) {
                        const whatsappService = require('./whatsappService');
                        await whatsappService.sendMessage(session.user_id, session.contact_phone, 'text', { body: node.data.retryMessage });
                    }

                    // Allow saving the INVALID response too
                    if (node.data.outputVariableName) {
                        const varName = node.data.outputVariableName.trim();
                        if (varName) {
                            let valueToStore = finalResponse;
                            if (typeof finalResponse === 'object' && finalResponse !== null && finalResponse.text && typeof finalResponse.text === 'string') {
                                valueToStore = finalResponse.text;
                            }
                            console.log(`[FlowEngine] Saving INVALID response to variable '${varName}':`, valueToStore);
                            nextContext = { ...nextContext, [varName]: valueToStore };
                        }
                    }
                    // Proceed to next step as "Failed/Invalid" - will look for 'invalid' edge
                }
            } else {
                // Validation PASSED
                // Save to Output Variable if defined
                if (node.data.outputVariableName) {
                    const varName = node.data.outputVariableName.trim();
                    if (varName) {
                        // Determine what to save (text or object)
                        let valueToStore = finalResponse;
                        if (typeof finalResponse === 'object' && finalResponse !== null && finalResponse.text && typeof finalResponse.text === 'string') {
                            valueToStore = finalResponse.text; // Use legacy text field if available
                        }
                        console.log(`[FlowEngine] Saving response to variable '${varName}':`, valueToStore);
                        nextContext = { ...nextContext, [varName]: valueToStore };
                    }
                }
            }
        }
        // ------------------------

        // Update Session via RPC (only if we didn't return early above)
        await rpcClient.rpc('update_session_variables', {
            p_session_id: session.id,
            p_variables: nextContext
            // Complexity: The 'validationResult.updates' were merged into 'nextContext'. 
            // If we are here, we are NOT retrying. So we are proceeding.
            // If we are proceeding, we want to save the VALIDATED input.
            // The 'updatedContext' above contains the raw input.
            // If validation passed, we just proceed.
            // If validation failed but action=FAILURE, we proceed with the failed state.
            // So we should use 'updatedContext' OR 'nextContext' (if it exists).
            // Let's refactor slightly to be safe.
        });

        // --- NEW: Save WhatsApp Flow Submission ---
        // If this response is from a 'sendFlow' node, archive it for the "Form Contact" view.
        try {
            const node = flow.nodes.find(n => n.id === currentNodeId);
            if (node && node.type === 'sendFlow') {
                const waFlowId = node.data.flowId;
                if (waFlowId) {
                    const { error } = await rpcClient.from('whatsapp_flow_submissions').insert({
                        user_id: session.user_id,
                        flow_id: waFlowId,
                        flow_name: node.data.flowName || 'WhatsApp Flow', // Fallback if name not stored in node
                        contact_phone: session.contact_phone,
                        contact_name: session.variables.trigger?.name || session.contact_phone,
                        submission_data: finalResponse
                    });
                    if (error) {
                        console.warn('[FlowEngine] Error saving flow submission:', error.message);
                    } else {
                        console.log(`[FlowEngine] Saved submission for flow ${waFlowId}`);
                    }
                }
            }
        } catch (subError) {
            // Silently fail if table doesn't exist to avoid breaking flow, but log valid errors
            console.warn('[FlowEngine] Failed to archive flow submission (Create table "whatsapp_flow_submissions" if missing):', subError.message);
        }
        // ------------------------------------------

        // Determine interaction ID based on validation result
        let nextInteractionId = interactionId;
        if (validationResult && validationResult.action === 'INVALID') {
            nextInteractionId = 'invalid';
        }

        // Move to next step
        await this.executeNextStep({ ...session, variables: nextContext }, flow, currentNodeId, nextInteractionId);
    }

    /**
     * Find the next node and execute it
     */
    async executeNextStep(session, flow, currentNodeId, interactionId = null) {
        console.log(`[FlowEngine] Looking for edge from ${currentNodeId} (Interaction: ${interactionId})...`);

        let edge;
        if (interactionId) {
            // 1. Try to find edge matching the specific handle (button ID or 'unresponsive')
            edge = flow.edges.find(e => e.source === currentNodeId && e.sourceHandle === interactionId);
        }

        // 2. Start of Fix: If no specific edge found, and this is a user response (not a timeout), 
        // specifically look for the 'default' (On Complete/On Answer) handle.
        if (!edge && interactionId && interactionId !== 'unresponsive') {
            edge = flow.edges.find(e => e.source === currentNodeId && e.sourceHandle === 'default');
        }

        // 3. Fallback: If still no edge, look for default edge or any edge
        if (!edge) {
            // Prefer explicitly defaults first
            edge = flow.edges.find(e => e.source === currentNodeId && e.sourceHandle === 'default');

            // If absolutely nothing else, take whatever is connected (Legacy behavior)
            // EXCEPTION: Do not do this for logic nodes that have distinct outputs (newLead, condition, etc)
            // This prevents "Existing Contact" falling back to "New Lead" path if "Existing Contact" is unconnected.
            const node = flow.nodes.find(n => n.id === currentNodeId);
            if (!edge && node && !['newLead', 'checkCondition', 'switch', 'askInput'].includes(node.type)) {
                edge = flow.edges.find(e => e.source === currentNodeId);
            }
        }

        if (!edge) {
            console.log(`[FlowEngine] No outgoing edge found from ${currentNodeId}. Flow completed.`);
            const rpcClient = supabaseAdmin || supabase;
            await rpcClient.rpc('update_session_status', {
                p_session_id: session.id,
                p_status: 'completed'
            });
            return;
        }

        const nextNodeId = edge.target;
        console.log(`[FlowEngine] Found edge to ${nextNodeId}`);

        const nextNode = flow.nodes.find(n => n.id === nextNodeId);

        if (!nextNode) {
            console.error(`[FlowEngine] Error: Target node ${nextNodeId} not found in flow definition.`);
            return;
        }

        // Update Session via RPC
        const rpcClient = supabaseAdmin || supabase;
        await rpcClient.rpc('update_session_step', {
            p_session_id: session.id,
            p_current_node_id: nextNodeId,
            p_status: 'active'
        });

        // Execute Node
        await this.executeNode(session, flow, nextNode);
    }

    /**
     * Execute the logic for a specific node
     */
    async executeNode(session, flow, node) {
        console.log(`[FlowEngine] Executing Node: ${node.type} (${node.id})`);

        const executor = EXECUTORS[node.type];

        if (!executor) {
            console.warn(`[FlowEngine] No executor for ${node.type}. Skipping.`);
            return this.executeNextStep(session, flow, node.id);
        }

        try {
            // 1. Resolve Variables in Node Data
            console.log(`[FlowEngine] Resolving variables for node ${node.id}. Context Keys:`, Object.keys(session.variables));
            // Debug specific variable if possible
            if (node.data.text && node.data.text.includes('{{')) {
                const match = node.data.text.match(/\{\{([^}]+)\}\}/);
                if (match) {
                    const path = match[1];
                    const val = contextManager.getValueByPath(session.variables, path);
                    console.log(`[FlowEngine] Debug Variable Resolution: '${path}' ->`, val);
                    if (val === undefined) {
                        const root = path.split('.')[0];
                        console.log(`[FlowEngine] Root object '${root}':`, JSON.stringify(session.variables[root], null, 2));
                    }
                }
            }

            const resolvedData = contextManager.resolveObject(node.data, session.variables);
            console.log(`[FlowEngine] Resolved Data for Node ${node.id}:`, JSON.stringify(resolvedData, null, 2));
            const resolvedNode = { ...node, data: resolvedData };

            // 2. Execute
            const output = await executor.execute(session, resolvedNode, session.variables);

            // --- FLOW LOG: NODE EXECUTION ---
            try {
                const { phoneNumber, phoneNumberId } = await this.getBusinessConfig(session.user_id);
                logFlowEvent('FLOW_NODE_EXECUTED', {
                    timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata', hour12: false }),
                    flowName: flow.name,
                    from: phoneNumber,
                    to: session.contact_phone,
                    phoneNumberId: phoneNumberId,
                    whatsappNumber: phoneNumber,
                    contact: session.contact_phone,
                    sessionId: session.id,
                    nodeId: node.id,
                    nodeType: node.type,
                    nodeLabel: node.data.label,
                    resolvedData: resolvedData,
                    executionOutput: output
                });
            } catch (logErr) { console.error('Flow Log Node Error:', logErr); }

            const rpcClient = supabaseAdmin || supabase;

            // 3. Handle Output
            if (output && output.__action === 'PAUSE') {
                console.log('[FlowEngine] Flow Paused.');

                // CRITICAL FIX: Merge output with existing node state to preserve properties (like retryAttempts)
                const newContext = {
                    ...session.variables,
                    [node.id]: { ...(session.variables[node.id] || {}), ...output }
                };

                await rpcClient.from('flow_sessions')
                    .update({
                        variables: newContext,
                        status: 'waiting_input',
                        current_node_id: node.id, // Update current node
                        last_interaction_at: new Date().toISOString()
                    })
                    .eq('id', session.id);

                return; // Stop execution here
            }

            if (output && output.__action === 'DELAY') {
                console.log('[FlowEngine] Flow Delayed until:', output.resumeAt);
                // Update session variables first to store payload/resumeAt
                const newContext = {
                    ...session.variables,
                    [node.id]: { ...(session.variables[node.id] || {}), ...output }
                };

                await rpcClient.from('flow_sessions')
                    .update({
                        variables: newContext,
                        status: 'delayed',
                        current_node_id: node.id, // Update current node
                        last_interaction_at: new Date().toISOString()
                    })
                    .eq('id', session.id);

                return; // Stop execution
            }

            // 4. Update Context with Output
            const newContext = {
                ...session.variables,
                [node.id]: { ...(session.variables[node.id] || {}), ...output }
            };

            await rpcClient.from('flow_sessions')
                .update({
                    variables: newContext,
                    current_node_id: node.id, // Update current node for tracking
                    last_interaction_at: new Date().toISOString()
                })
                .eq('id', session.id);

            // 5. Continue
            // If output contains an 'outcome' (e.g. from Check Condition), pass it as interactionId to find the right edge
            let nextInteractionId = null;
            if (output && output.outcome) {
                nextInteractionId = output.outcome;
            }

            await this.executeNextStep({ ...session, variables: newContext }, flow, node.id, nextInteractionId);

        } catch (error) {
            console.error(`[FlowEngine] Error executing node ${node.id}:`, error);

            const rpcClient = supabaseAdmin || supabase;
            await rpcClient.rpc('update_session_status', {
                p_session_id: session.id,
                p_status: 'error'
            });
        }
    }


    /**
     * Handle Session Timeout (Unresponsive or Delay)
     * Called by Scheduler
     */
    async handleSessionTimeout(sessionId, triggerType) {
        console.log(`[FlowEngine] Handling Timeout for Session ${sessionId} (Type: ${triggerType})`);
        const rpcClient = supabaseAdmin || supabase;

        // 1. Fetch Session
        const { data: session, error: sessionError } = await rpcClient
            .from('flow_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            console.error(`[FlowEngine] Session ${sessionId} not found for timeout.`);
            return;
        }

        // 2. Fetch Flow
        const { data: flow, error: flowError } = await rpcClient
            .from('flows')
            .select('*')
            .eq('id', session.flow_id)
            .single();

        if (flowError || !flow) {
            console.error(`[FlowEngine] Flow ${session.flow_id} not found for session ${sessionId}.`);
            return;
        }

        // 3. Execute Next Step with special trigger
        // triggerType is usually 'unresponsive' or 'default' (for delay resume)
        // For delays, we usually just want to proceed, so 'default' works if no specific handle needed?
        // Actually, delays usually connect via default handle.
        await this.executeNextStep(session, flow, session.current_node_id, triggerType);
    }
}

module.exports = new FlowEngine();

