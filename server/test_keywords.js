const { supabaseAdmin } = require('./lib/supabaseClient');

async function test() {
    const { data, error } = await supabaseAdmin.from('flows').select('id, name, keywords, user_id').ilike('name', '%Webinar%');
    if (error) {
        console.error("Error:", error);
        return;
    }
    console.log("Found flows:", data.length);
    if (data.length > 0) {
        console.log("Keywords array:", data[0].keywords);
        
        // Let's also test the RPC
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_flow_by_keyword', {
            p_keyword: 'hi',
            p_user_id: data[0].user_id
        });
        console.log("RPC result for 'hi':", rpcData);
        
        const { data: rpcData2, error: rpcError2 } = await supabaseAdmin.rpc('get_flow_by_keyword', {
            p_keyword: ' Hi',
            p_user_id: data[0].user_id
        });
        console.log("RPC result for ' Hi':", rpcData2);
    }
}
test();
