require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');

async function fixLegacyDelayedSessions() {
    console.log('🚀 Starting migration of legacy delayed sessions...');

    let updatedCount = 0;
    let errorCount = 0;
    let page = 0;
    const pageSize = 500;

    while (true) {
        const { data: sessions, error } = await supabaseAdmin
            .from('flow_sessions')
            .select('id, variables, current_node_id')
            .eq('status', 'delayed')
            // Fetch sessions that don't have global_resume_at yet
            .is('variables->global_resume_at', null)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('❌ Error fetching sessions:', error);
            break;
        }

        if (!sessions || sessions.length === 0) {
            break; // Done
        }

        console.log(`Processing batch of ${sessions.length} sessions...`);

        for (const session of sessions) {
            try {
                const nodeOutput = session.variables ? session.variables[session.current_node_id] : null;
                
                if (nodeOutput && nodeOutput.resumeAt) {
                    const updatedVariables = {
                        ...session.variables,
                        global_resume_at: nodeOutput.resumeAt
                    };

                    await supabaseAdmin
                        .from('flow_sessions')
                        .update({ variables: updatedVariables })
                        .eq('id', session.id);
                        
                    updatedCount++;
                }
            } catch (err) {
                console.error(`Failed to update session ${session.id}`, err);
                errorCount++;
            }
        }
        
        // If we update them, they won't match the IS NULL filter next time, 
        // so we don't strictly need to increment page, but just in case some fail:
        page++;
    }

    console.log(`\n🎉 Migration Complete!`);
    console.log(`✅ Successfully updated: ${updatedCount} sessions.`);
    if (errorCount > 0) console.log(`❌ Errors: ${errorCount}`);
    process.exit(0);
}

fixLegacyDelayedSessions();
