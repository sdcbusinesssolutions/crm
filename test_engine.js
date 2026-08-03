const FlowEngine = require('./server/services/flowEngine');
const engine = new FlowEngine();

const flow = {
    id: 'f1',
    name: 'test flow',
    nodes: [
        { id: '1', type: 'pipelineTrigger', data: { pipelineId: 'p1', stageId: 's1' } },
        { id: '2', type: 'textMessage', data: { text: 'Hello' } }
    ],
    edges: [
        { id: 'e1', source: '1', target: '2', sourceHandle: 'default' }
    ]
};

engine.startFlow('u1', '123', flow, { triggerType: 'pipeline_change', pipelineId: 'p1', stageId: 's1' }, '1').catch(console.error);
