
const axios = require('axios');

async function checkStatus() {
    const phone_id = '850356761502552';
    const access_token = 'EAAO4J3qeOYUBZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
    
    console.log(`Checking MM Lite Status for Phone ID: ${phone_id}...`);

    try {
        // Checking number status
        const phoneRes = await axios.get(`https://graph.facebook.com/v21.0/${phone_id}?fields=marketing_messages_lite_api_status,marketing_messages_onboarding_status,status`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        
        console.log('--- PHONE STATUS ---');
        console.log(JSON.stringify(phoneRes.data, null, 2));

        // Checking WABA status
        const waba_id = '879173654625800';
        const wabaRes = await axios.get(`https://graph.facebook.com/v21.0/${waba_id}?fields=marketing_messages_onboarding_status`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        console.log('\n--- WABA STATUS ---');
        console.log(JSON.stringify(wabaRes.data, null, 2));

    } catch (err) {
        console.error('❌ Check Failed:', err.response?.data?.error?.message || err.message);
    }
}

checkStatus();
