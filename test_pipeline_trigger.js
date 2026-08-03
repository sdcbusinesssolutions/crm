const FlowEngine = require('./server/services/flowEngine');
const engine = new (FlowEngine.constructor)();
engine.variableResolver = { resolveNodeVariables: (n) => n }; // mock
engine.executeNextStep = async function(session, flow, currentNodeId, interactionId) {
    console.log(`Executing next step from ${currentNodeId} with interactionId ${interactionId}`);
    let edge = flow.edges.find(e => e.source === currentNodeId && e.sourceHandle === 'default');
    if (!edge) edge = flow.edges.find(e => e.source === currentNodeId);
    if (!edge) return console.log('No edge found');
    console.log('Found edge:', edge);
};

const mockFlow = {
    id: 'f1',
    name: 'Test',
    nodes: [
        { id: 'n1', type: 'pipelineTrigger', data: { pipelineId: 'p1', stageId: 's1' } },
        { id: 'n2', type: 'textMessage', data: { text: 'Hello' } }
    ],
    edges: [
        { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'default' }
    ]
};

engine.startFlow('u1', '919000000000', mockFlow, { triggerType: 'pipeline_change' }, 'n1')
    .then(() => console.log('Done'))
    .catch(e => console.error(e));
