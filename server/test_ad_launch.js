const axios = require('axios');

async function testLaunch() {
    const accessToken = 'EAAialqCpZCtoBR4apZBo0hiPscszflZAyLBxjsHXLBtQcFzXZC3pNxfEC47oCRvvbbNBOn3CY53deNYLd1y62dEKtcQSI2TF74QGx5QfvqffmHXa9TwxPvoePvCLvbq2d0bcMDF6n6C4ius02ZBaJczZCnuJVjKsF9WimeloVoX9DSREqubOlruet6KTNcJzpYewZDZD';
    const adAccountId = '4044804002323250';
    const imageUrl = 'https://cloudospire.in/logo.png'; // dummy url

    try {
        const apiVersion = 'v20.0';
        const baseUrl = `https://graph.facebook.com/${apiVersion}`;
        const res = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, null, {
            params: {
                url: imageUrl,
                access_token: accessToken
            }
        });
        console.log('Success:', res.data);
    } catch (error) {
        console.log('Error:', error.response?.data);
    }
}

testLaunch();
