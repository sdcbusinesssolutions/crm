const axios = require('axios');

async function testFlowApi() {
    try {
        console.log("SENDING TEST REQUEST TO BACKEND /api/test-request...");
        const response = await axios.post('http://localhost:5000/api/test-request', {
            url: 'https://n8n.srv962100.hstgr.cloud/webhook/3ed8863b-1fac-4249-9f7e-ce501e9bd36e',
            method: 'POST',
            bodyType: 'json',
            bodyInputType: 'raw',
            body: '{"name":"dev"}'
        });

        console.log("✅ REQUEST SUCCESSFUL!");
        console.log("------------------------");
        console.log("Backend API Status:", response.status);
        console.log("Response Body Received From n8n Webhook:");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (e) {
        console.error("❌ FAILED!");
        console.error("Status:", e.response?.status);
        console.error("Error Info:", e.response?.data || e.message);
    }
}
testFlowApi();
