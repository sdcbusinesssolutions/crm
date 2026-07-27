const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/devendra/proj/wpcode/server/.env' });

async function run() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Find a user with pipelines and stages
    const { data: stages } = await supabase.from('pipeline_stages').select('*').limit(1);
    if (!stages || stages.length === 0) return console.log('No stages');
    const stage = stages[0];
    console.log('Stage:', stage.id, 'Pipeline:', stage.pipeline_id);

    // Get the flowEngine instance or simulate it
    const FlowEngine = require('/home/devendra/proj/wpcode/server/services/flowEngine');
    console.log('Got FlowEngine constructor');
    const engine = new (require('/home/devendra/proj/wpcode/server/services/flowEngine').constructor)();
    // Simulate what happens in triggerFlowByEvent
    const mockFlow = {
        name: 'Test Flow',
        nodes: [{
            id: 'node_1',
            type: 'pipelineTrigger',
            data: { pipelineId: stage.pipeline_id, stageId: stage.id }
        }]
    };
    
    const eventData = { pipelineId: stage.pipeline_id, stageId: stage.id };
    
    // Check match
    const nodePipelineId = mockFlow.nodes[0].data.pipelineId;
    const nodeStageId = mockFlow.nodes[0].data.stageId;
    if (nodePipelineId && String(nodePipelineId) !== String(eventData.pipelineId)) {
        console.log("Pipeline mismatch");
    } else if (nodeStageId && String(nodeStageId) !== String(eventData.stageId)) {
        console.log("Stage mismatch");
    } else {
        console.log("MATCHED");
    }
}
run().catch(console.error);
