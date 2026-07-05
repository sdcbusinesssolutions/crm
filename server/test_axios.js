const axios = require('axios');

async function test() {
    const accessToken = 'EAAialqCpZCtoBR4apZBo0hiPscszflZAyLBxjsHXLBtQcFzXZC3pNxfEC47oCRvvbbNBOn3CY53deNYLd1y62dEKtcQSI2TF74QGx5QfvqffmHXa9TwxPvoePvCLvbq2d0bcMDF6n6C4ius02ZBaJczZCnuJVjKsF9WimeloVoX9DSREqubOlruet6KTNcJzpYewZDZD';
    try {
        const apiVersion = 'v20.0';
        const baseUrl = `https://graph.facebook.com/${apiVersion}`;
        const res = await axios.get(`${baseUrl}/me/adaccounts`, {
            params: {
                fields: 'id,name,account_id,currency',
                access_token: accessToken
            }
        });
        console.log('Success:', res.data.data);
    } catch (error) {
        console.log('Error:', error.response?.data);
    }
}

test();
