const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const contextManager = require('./flow/context');
const { logFlowEvent } = require('../utils/logger');
const whatsappService = require('./whatsappService');

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
const notifyExecutor = require('./flow/executors/notify');
const assignLeadExecutor = require('./flow/executors/assignLead');

// Executor Map
const EXECUTORS = {
    'textMessage': textMessageExecutor,
    'askAnything': askAnythingExecutor,
    'askLocation': askAnythingExecutor,
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
    'aiAgent': aiAgentExecutor,
    'notify': notifyExecutor,
    'assignLead': assignLeadExecutor
};

const { flattenObject } = require('../utils/objectUtils');
const NodeCache = require('node-cache'); // We need to add this to package.json if it isn't, but let's try a simple custom implement/Map first

// --- HIGH PERFORMANCE CACHE ---
// For 10 Lakh customers, querying DB for 'whatsapp_config' or 'flow_definition' 
// on EVERY message causes DB deadlocks and high latency.
// These caches hold data for 5 minutes.
const configCache = new Map();
const flowCache = new Map();

// Helper to manage simple TTL
const getCached = (cacheMap, key) => {
    const item = cacheMap.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
        cacheMap.delete(key);
        return null;
    }
    return item.data;
};

const setCached = (cacheMap, key, data, ttlMinutes = 5) => {
    cacheMap.set(key, {
        data: data,
        expiry: Date.now() + (ttlMinutes * 60 * 1000) // 5 minutes standard TTL
    });
};
// -----------------------------

class FlowEngine {
    constructor() {
        this.instanceId = Math.random().toString(36).substring(7); // Debug ID
        this.startScheduler();
    }

    async getBusinessConfig(userId, phoneNumberId = null) {
        // Cache Key: Try to use specific phone, else generic user
        const cacheKey = `config_${userId}_${phoneNumberId || 'default'}`;
        const cached = getCached(configCache, cacheKey);

        if (cached) {
            // console.log(`[Cache Hit] WhatsApp Config (User: ${userId})`);
            return cached;
        }

        try {
            let query = supabaseAdmin.from('whatsapp_config').select('phone_number, phone_number_id').eq('user_id', userId);
            if (phoneNumberId) query = query.eq('phone_number_id', phoneNumberId);

            const { data } = await query.maybeSingle();

            const config = {
                phoneNumber: data?.phone_number || 'System',
                phoneNumberId: data?.phone_number_id || 'Unknown'
            };

            setCached(configCache, cacheKey, config, 10); // Cache for 10 minutes
            return config;
        } catch (e) {
            return { phoneNumber: 'System', phoneNumberId: 'Unknown' };
        }
    }

    // --- NEW: Helper to fetch Flow with Caching ---
    async getCachedFlow(flowId) {
        const cacheKey = `flow_${flowId}`;
        const cached = getCached(flowCache, cacheKey);
        if (cached) {
            // console.log(`[Cache Hit] Flow Definition (${flowId})`);
            return cached;
        }

        const { data: flowData } = await supabaseAdmin.rpc('get_flow_by_id', { p_flow_id: flowId });

        if (flowData && flowData.length > 0) {
            setCached(flowCache, cacheKey, flowData[0], 5); // Cache for 5 mins
            return flowData[0];
        }
        return null;
    }

    startScheduler() {
        // Add random jitter (0-10s) to startup so 8 containers don't hit the DB in the same exact second
        const jitter = Math.floor(Math.random() * 10000);
        setTimeout(() => {
            console.log(`[FlowEngine] Instance ${this.instanceId} Scheduler Monitoring (Ticks: 30s)...`);
            setInterval(async () => {
                try {
                    const now = new Date();
                    const nowIso = now.toISOString();
                    const rpcClient = supabaseAdmin;

                    // 1. Handle DELAYED sessions
                    // Only fetch sessions that are actually ready to be resumed based on current status
                    const { data: delayedSessions, error } = await rpcClient
                        .from('flow_sessions')
                        .select('id, status, current_node_id, variables, flow_id, user_id')
                        .eq('status', 'delayed')
                        .order('last_interaction_at', { ascending: true })
                        .limit(20); // Smaller batches for faster cluster distribution

                    if (!error && delayedSessions && delayedSessions.length > 0) {
                        for (const session of delayedSessions) {
                            const variables = session.variables || {};
                            const currentNodeId = session.current_node_id;
                            const nodeOutput = variables[currentNodeId];

                            if (nodeOutput && nodeOutput.resumeAt) {
                                const resumeTime = new Date(nodeOutput.resumeAt);

                                if (!isNaN(resumeTime.getTime()) && resumeTime <= now) {
                                    // PREPARE STATE
                                    const updatedVariables = { ...variables };
                                    if (updatedVariables[currentNodeId] && typeof updatedVariables[currentNodeId] === 'object') {
                                        updatedVariables[currentNodeId] = {
                                            ...updatedVariables[currentNodeId],
                                            resumeAt: null // Clear so it doesn't trigger again
                                        };
                                    }

                                    // ATOMIC CLAIM: Update status AND variables to ensure single processing
                                    // Including currentNodeId and current status in WHERE clause is the primary distributed lock
                                    const { data: claimed, error: claimError } = await rpcClient
                                        .from('flow_sessions')
                                        .update({ 
                                            status: 'active', 
                                            variables: updatedVariables,
                                            last_interaction_at: nowIso 
                                        })
                                        .eq('id', session.id)
                                        .eq('status', 'delayed')
                                        .eq('current_node_id', currentNodeId)
                                        .select();

                                    if (!claimError && claimed && claimed.length > 0) {
                                        console.log(`[FlowEngine Scheduler] Instance ${this.instanceId} Successfully Claimed Delay Session ${session.id}.`);
                                        await this.executeNextStep(claimed[0], await this.getCachedFlow(claimed[0].flow_id), claimed[0].current_node_id);
                                    }
                                }
                            }
                        }
                    }

                    // 2. Handle WAITING_INPUT sessions (Unresponsive)
                    // We only fetch 100 to prevent massive egress if there are thousands of stuck sessions.
                    const { data: waitingSessions, error: waitingError } = await rpcClient
                        .from('flow_sessions')
                        .select('id, status, current_node_id, variables, flow_id, user_id')
                        .eq('status', 'waiting_input')
                        .order('last_interaction_at', { ascending: true }) // CRITICAL: Must be true to fetch oldest (timed out) first
                        .limit(100);

                    if (!waitingError && waitingSessions && waitingSessions.length > 0) {
                        for (const session of waitingSessions) {
                            const variables = session.variables || {};
                            const currentNodeId = session.current_node_id;
                            const nodeOutput = variables[currentNodeId];

                            if (nodeOutput && nodeOutput.timeoutAt) {
                                const timeoutTime = new Date(nodeOutput.timeoutAt);
                                
                                if (!isNaN(timeoutTime.getTime()) && timeoutTime <= now) {
                                    // PREPARE TIMEOUT STATE
                                    const updatedVariables = { ...variables };
                                    if (updatedVariables[currentNodeId] && typeof updatedVariables[currentNodeId] === 'object') {
                                        updatedVariables[currentNodeId] = {
                                            ...updatedVariables[currentNodeId],
                                            status: 'timeout',
                                            isFilled: false,
                                            response: null,
                                            timeoutAt: null // Clear timeout
                                        };
                                    }

                                    // ATOMIC CLAIM
                                    const { data: claimed, error: claimError } = await rpcClient
                                        .from('flow_sessions')
                                        .update({ 
                                            status: 'resuming',
                                            variables: updatedVariables,
                                            last_interaction_at: nowIso
                                        })
                                        .eq('id', session.id)
                                        .eq('status', 'waiting_input')
                                        .eq('current_node_id', currentNodeId)
                                        .select();

                                    if (!claimError && claimed && claimed.length > 0) {
                                        console.log(`[FlowEngine Scheduler] Instance ${this.instanceId} Successfully Claimed Unresponsive Session ${session.id} (Node: ${currentNodeId})`);
                                        await this.handleSessionTimeout(session.id, 'unresponsive', updatedVariables, claimed[0]);
                                    }
                                }
                            }
                        }
                    }

                    // 3. Handle STUCK sessions (> 15 mins processing/resuming/active)
                    const stuckThreshold = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
                    const { data: stuckSessions, error: stuckError } = await rpcClient
                        .from('flow_sessions')
                        .select('id')
                        .in('status', ['active', 'processing', 'resuming'])
                        .lt('last_interaction_at', stuckThreshold)
                        .limit(50);

                    if (!stuckError && stuckSessions && stuckSessions.length > 0) {
                        for (const stuck of stuckSessions) {
                            await rpcClient.from('flow_sessions')
                                .update({ status: 'error', last_interaction_at: nowIso })
                                .eq('id', stuck.id)
                                .in('status', ['active', 'processing', 'resuming']); // Ensure still stuck
                            console.log(`[FlowEngine] Instance ${this.instanceId} Reset stuck session ${stuck.id}.`);
                        }
                    }

                } catch (err) {
                    console.error(`[FlowEngine Scheduler] Instance ${this.instanceId} Error:`, err);
                }
            }, 30000);
        }, jitter);
    }

    async resumeSession(session, interactionId = null) {
        const rpcClient = supabaseAdmin;

        // Fetch Flow (Now using high-speed cache!)
        const flow = await this.getCachedFlow(session.flow_id);

        if (flow) {
            // Update status to active
            await rpcClient.rpc('update_session_status', {
                p_session_id: session.id,
                p_status: 'active'
            });

            // Execute Next Step
            await this.executeNextStep(session, flow, session.current_node_id, interactionId);
        } else {
            console.error(`[FlowEngine] Failed to resume session ${session.id}: Flow ${session.flow_id} not found.`);
            await rpcClient.from('flow_sessions').update({ status: 'error' }).eq('id', session.id);
        }
    }
    /**
     * Main Entry Point: Process an incoming message
     */
    async processMessage(userId, contactPhone, messageInput, messageType = 'text', interactionId = null, waMessageId = null) {
        // Store waMessageId in the class for use in startFlow/continueFlow during this execution cycle
        this._currentWaMessageId = waMessageId;
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
        
        // 0. Check Manual AI Assignment
        try {
            const { data: convData, error: convError } = await rpcClient.from('conversations')
                .select('assigned_ai_agent_id, bot_paused_until')
                .eq('user_id', userId)
                .eq('contact_phone', contactPhone)
                .maybeSingle();
                
            if (convError) throw convError;
                
            if (convData && convData.assigned_ai_agent_id) {
                // Check if paused
                if (convData.bot_paused_until) {
                    const pausedUntil = new Date(convData.bot_paused_until);
                    if (pausedUntil > new Date()) {
                        console.log(`[FlowEngine] AI is manually paused for ${contactPhone}. Bypassing AI assignment.`);
                        return null; 
                    }
                }
            
            console.log(`[FlowEngine] Conversation is manually assigned to AI Agent ${convData.assigned_ai_agent_id}. Bypassing flow builder.`);
            
            const aiAgentExecutor = require('./flow/executors/aiAgent');
            const fakeSession = { user_id: userId, contact_phone: contactPhone };
            const fakeNode = { data: { agentId: convData.assigned_ai_agent_id, userQuery: messageText } };
            
            try {
                const result = await aiAgentExecutor.execute(fakeSession, fakeNode, {});
                if (result && result.success && result.response) {
                    const whatsappService = require('./whatsappService');
                    await whatsappService.sendMessage(userId, contactPhone, 'text', { body: result.response }, interactionId);
                }
                return; // Stop processing further flows
            } catch (err) {
                console.error('[FlowEngine] Error executing assigned AI agent:', err);
                return;
            }
        }
        } catch (dbErr) {
            console.error('[FlowEngine] Error checking manual AI assignment (DB):', dbErr);
            // Swallow error and fallback to standard flow
        }

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

        // B. (Removed) We no longer implicitly trigger a flow just because it starts with a 'newLead' node.
        // Users must explicitly set '*' wildcard or specify keywords to trigger flows.

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
        // TRIGGER TYPING INDICATOR (Confirmation that we are handling this flow)
        if (this._currentWaMessageId) {
            console.log(`[FlowEngine] Bot starting flow '${flow.name}'. Sending Typing Indicator/Read Status.`);
            const whatsappService = require('./whatsappService');
            whatsappService.sendTypingIndicator(userId, contactPhone, this._currentWaMessageId).catch(() => {});
        }
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
            let leadQuery = rpcClient
                .from('leads')
                .select('*')
                .eq('user_id', userId);

            // Use exact leadId if provided by the trigger, otherwise fallback to phone
            if (initialInput && initialInput.leadId) {
                leadQuery = leadQuery.eq('id', initialInput.leadId);
            } else {
                leadQuery = leadQuery.eq('phone', contactPhone).order('created_at', { ascending: false }).limit(1);
            }

            const { data: leadData } = await leadQuery.maybeSingle();

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

        // Small safeguard delay to ensure DB transaction commits (Reduced to minimum)
        await new Promise(r => setTimeout(r, 5));

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

        // Use RPC to get flow by ID (Cache bypasses RLS too)
        const flow = await this.getCachedFlow(session.flow_id);

        if (!flow) {
            console.error('[FlowEngine] Error fetching flow for session:', session.id);
            return;
        }

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

        // --- STALE BUTTON CLICK OR INVALID TEXT PREVENTION ---
        // Prevents users from clicking completed buttons from previous steps,
        // OR typing random text to bypass a menu node.
        if (node) {
            const isMenuNode = ['quickReplyMessage', 'listMessage'].includes(node.type);

            if (isMenuNode) {
                let isValidClick = false;
                let recognizedInteractionId = interactionId;

                if (interactionId === 'unresponsive' || interactionId === 'invalid') {
                    isValidClick = true;
                } else {
                    // 1. Check if it matches quick reply buttons
                    if (node.data.buttons && Array.isArray(node.data.buttons)) {
                        // Check by ID
                        if (recognizedInteractionId && node.data.buttons.some(b => String(b.id) === String(recognizedInteractionId) || String(b.payload) === String(recognizedInteractionId))) {
                            isValidClick = true;
                        } else if (!recognizedInteractionId && finalResponse && finalResponse.text) {
                            // Check by Exact Text Match (if user typed the button label)
                            const userText = finalResponse.text.toLowerCase().trim();
                            const matchedBtn = node.data.buttons.find(b => b.title && b.title.toLowerCase().trim() === userText);
                            if (matchedBtn) {
                                isValidClick = true;
                                recognizedInteractionId = matchedBtn.id;
                            }
                        }
                    }

                    // 2. Check list items
                    if (node.data.sections && Array.isArray(node.data.sections)) {
                        for (const section of node.data.sections) {
                            const items = section.rows || section.items || [];
                            if (Array.isArray(items)) {
                                if (recognizedInteractionId && items.some(i => String(i.id) === String(recognizedInteractionId))) {
                                    isValidClick = true;
                                } else if (!recognizedInteractionId && finalResponse && finalResponse.text) {
                                    // Match list item text
                                    const userText = finalResponse.text.toLowerCase().trim();
                                    const matchedItem = items.find(i => i.title && i.title.toLowerCase().trim() === userText);
                                    if (matchedItem) {
                                        isValidClick = true;
                                        recognizedInteractionId = matchedItem.id;
                                    }
                                }
                            }
                        }
                    }

                    // 3. Provide bypass for dynamic list sections
                    if (node.type === 'listMessage' && node.data.dynamicSections) {
                        isValidClick = true;
                    }
                }

                if (!isValidClick) {
                    console.warn(`[FlowEngine] INVALID INPUT PREVENTION: Ignoring random text/invalid interaction for menu node '${node.id}'`);
                    // Release the lock from 'processing' to 'waiting_input' so the user is not soft-locked
                    await rpcClient.from('flow_sessions').update({
                        status: 'waiting_input'
                    }).eq('id', session.id);
                    return; // Stop execution without replying or advancing
                } else {
                    // Update interactionId in case we mapped text to a button ID
                    interactionId = recognizedInteractionId;
                }
            }
        }

        // TRIGGER TYPING INDICATOR (Confirmation that the input is valid and we are processing the next step)
        if (this._currentWaMessageId) {
            console.log(`[FlowEngine] Input validated for session ${session.id}. Sending Typing Indicator/Read Status.`);
            const whatsappService = require('./whatsappService');
            whatsappService.sendTypingIndicator(session.user_id, session.contact_phone, this._currentWaMessageId).catch(() => {});
        }

        const executor = EXECUTORS[node ? node.type : null];

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
                } else if (validationResult.action === 'IGNORE') {
                    console.log(`[FlowEngine] Validation returned IGNORE. Aborting continuation.`);
                    // Release lock back to waiting
                    await rpcClient.from('flow_sessions').update({ status: 'waiting_input' }).eq('id', session.id);
                    return; // STOP here
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

        // Move to next step (Context passed IN-MEMORY)
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
            const node = flow.nodes.find(n => n.id === currentNodeId);
            
            // Do not let 'unresponsive' timeouts fall back to the default success edge on askInput
            if (!(node && node.type === 'askInput' && interactionId === 'unresponsive')) {
                // Prefer explicitly defaults first
                edge = flow.edges.find(e => e.source === currentNodeId && e.sourceHandle === 'default');
            }

            // If absolutely nothing else, take whatever is connected (Legacy behavior)
            // EXCEPTION: Do not do this for logic nodes that have distinct outputs (newLead, condition, etc)
            // This prevents "Existing Contact" falling back to "New Lead" path if "Existing Contact" is unconnected.
            if (!edge && node && !['newLead', 'checkCondition', 'switch', 'askInput'].includes(node.type)) {
                edge = flow.edges.find(e => e.source === currentNodeId);
            }
        }

        if (!edge) {
            console.log(`[FlowEngine] No outgoing edge found from ${currentNodeId}. Flow completed.`);
            const rpcClient = supabaseAdmin || supabase;

            // 🚀 SCALE OPTIMIZATION: Final Save
            // Now that the engine has finished processing all invisible steps in RAM,
            // we do exactly ONE write to the database to mark it complete and save all vars.
            await rpcClient.from('flow_sessions').update({
                status: 'completed',
                current_node_id: currentNodeId,
                variables: session.variables,
                last_interaction_at: new Date().toISOString()
            }).eq('id', session.id);

            return;
        }

        const nextNodeId = edge.target;
        console.log(`[FlowEngine] Found edge to ${nextNodeId}`);

        const nextNode = flow.nodes.find(n => n.id === nextNodeId);

        if (!nextNode) {
            console.error(`[FlowEngine] Error: Target node ${nextNodeId} not found in flow definition.`);
            return;
        }

        // Execute Node
        // 🚀 SCALE OPTIMIZATION: Call-stack passing! No DB I/O for `status = active` transition.
        await this.executeNode(session, flow, nextNode);
    }

    /**
     * Execute the logic for a specific node
     */
    async executeNode(session, flow, node) {
        console.log(`[FlowEngine] Executing Node: ${node.type} (${node.id})`);

        // IMPORTANT FIX: Sync the session's current node ID in-memory so executors 
        // and future resumptions (RAM timers) use the correct context.
        session.current_node_id = node.id;

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
                console.log(`[FlowEngine] Instance ${this.instanceId} Flow Paused for Node: ${node.id}`);

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

                // 🚀 HIGH-PERFORMANCE UNRESPONSIVE OPTIMIZATION:
                // Global DB Scheduler runs every 30s. If user sets a "10s timeout", they shouldn't 
                // have to wait up to 30s for the next DB sweep.
                if (output.timeoutAt) {
                    const timeoutTime = new Date(output.timeoutAt).getTime();
                    const delayMs = timeoutTime - Date.now();

                    // Scheduling exact RAM trigger for any timeout up to 24 hours
                    if (delayMs > 0 && delayMs <= 24 * 60 * 60 * 1000) {
                        console.log(`[FlowEngine] Short unresponsive timeout detected. Scheduling RAM trigger in ${delayMs}ms for session ${session.id}.`);
                        setTimeout(async () => {
                            try {
                                // Prepare fresh state for claim
                                const updatedVars = { ...newContext };
                                if (updatedVars[node.id]) {
                                    updatedVars[node.id] = { 
                                        ...updatedVars[node.id],
                                        status: 'timeout',
                                        isFilled: false,
                                        response: null,
                                        timeoutAt: null // Clear timeout so it doesn't trigger again
                                    };
                                }

                                // ATOMIC CLAIM: Only trigger if session is still WAITING_INPUT on THIS node
                                const { data: claimed, error: claimError } = await rpcClient
                                    .from('flow_sessions')
                                    .update({ 
                                        status: 'resuming',
                                        variables: updatedVars,
                                        last_interaction_at: new Date().toISOString()
                                    })
                                    .eq('id', session.id)
                                    .eq('status', 'waiting_input')
                                    .eq('current_node_id', node.id)
                                    .select();

                                if (!claimError && claimed && claimed.length > 0) {
                                    console.log(`[FlowEngine] Instance ${this.instanceId} RAM Unresponsive Timer Fired Successfully for Session ${session.id}!`);
                                    await this.handleSessionTimeout(session.id, 'unresponsive', updatedVars, claimed[0]);
                                }
                            } catch (e) {
                                console.error('RAM Unresponsive Timer Error:', e);
                            }
                        }, delayMs);
                    }
                }

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

                // 🚀 HIGH-PERFORMANCE DELAY OPTIMIZATION:
                // Global DB Scheduler runs every 30s. If user sets a "5 second delay", they shouldn't 
                // have to wait up to 30 seconds for the next database sweep. 
                // We will use an exact RAM timeout for any delay under 5 minutes.
                if (output.delayMs && output.delayMs <= 5 * 60 * 1000) {
                    console.log(`[FlowEngine] Short delay detected. Scheduling exact RAM trigger in ${output.delayMs}ms.`);
                    setTimeout(async () => {
                        try {
                            // Prepare updated variables to clear resumeAt
                            const updatedVars = { ...newContext };
                            if (updatedVars[node.id]) {
                                updatedVars[node.id] = { ...updatedVars[node.id], resumeAt: null };
                            }

                            // Optimistic Lock: Check if another server instance already grabbed it
                            const { data: claimed, error: claimError } = await rpcClient
                                .from('flow_sessions')
                                .update({ 
                                    status: 'resuming',
                                    variables: updatedVars 
                                })
                                .eq('id', session.id)
                                .eq('status', 'delayed')
                                .eq('current_node_id', node.id)
                                .select();

                            if (!claimError && claimed && claimed.length > 0) {
                                console.log(`[FlowEngine] RAM Timer Fired Exactly for Session ${session.id}!`);
                                // Execute perfectly on time with fresh claimed data
                                await this.resumeSession(claimed[0]);
                            }
                        } catch (e) {
                            console.error('RAM Delay Timer Error:', e);
                        }
                    }, output.delayMs);
                }

                return; // Stop execution
            }

            // 4. Update Context with Output (In-Memory ONLY)
            const newContext = {
                ...session.variables,
                [node.id]: { ...(session.variables[node.id] || {}), ...output }
            };

            // 🚀 SCALE OPTIMIZATION:
            // We specifically SKIP hitting the Database ('flow_sessions' .update) right here!
            // Supabase Database receives 0 load while the logic evaluates internally.

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
     * Handle Session Timeout (Unresponsive)
     * Called by Scheduler or RAM timers
     */
    async handleSessionTimeout(sessionId, triggerType, updatedVariables = null, claimedSession = null) {
        console.log(`[FlowEngine] Handling Timeout for Session ${sessionId} (Type: ${triggerType})`);
        const rpcClient = supabaseAdmin;

        // 1. Resolve Session: Use claimedSession if provided to avoid stale reads!
        let session = claimedSession;
        if (!session) {
            const { data } = await rpcClient.from('flow_sessions').select('*').eq('id', sessionId).single();
            session = { ...data, variables: updatedVariables || data.variables };
        }

        if (!session) return;

        // 2. Fetch Flow (Cached)
        const flow = await this.getCachedFlow(session.flow_id);
        if (!flow) return;

        // 3. Advance Flow (Strictly follow Unresponsive handle)
        // Note: Removed the built-in 'timeoutMessage' logic to prevent double messaging 
        // in 8-container clusters. Content is now 100% controlled by the next node.
        await this.executeNextStep(session, flow, session.current_node_id, triggerType);
    }
}

module.exports = new FlowEngine();

