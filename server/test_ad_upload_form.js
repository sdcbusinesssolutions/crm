const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testImageUpload() {
    const accessToken = 'EAAialqCpZCtoBR4apZBo0hiPscszflZAyLBxjsHXLBtQcFzXZC3pNxfEC47oCRvvbbNBOn3CY53deNYLd1y62dEKtcQSI2TF74QGx5QfvqffmHXa9TwxPvoePvCLvbq2d0bcMDF6n6C4ius02ZBaJczZCnuJVjKsF9WimeloVoX9DSREqubOlruet6KTNcJzpYewZDZD';
    const adAccountId = '4044804002323250';
    
    // Create a dummy 1x1 pixel png
    const dummyImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const imagePath = path.join(__dirname, 'dummy.png');
    fs.writeFileSync(imagePath, dummyImageBuffer);

    try {
        const apiVersion = 'v20.0';
        const baseUrl = `https://graph.facebook.com/${apiVersion}`;
        
        const form = new FormData();
        form.append('access_token', accessToken);
        form.append('filename', fs.createReadStream(imagePath));

        const res = await axios.post(`${baseUrl}/act_${adAccountId}/adimages`, form, {
            headers: {
                ...form.getHeaders()
            }
        });
        
        console.log('Success:', res.data);
    } catch (error) {
        console.log('Error:', JSON.stringify(error.response?.data, null, 2));
    } finally {
        fs.unlinkSync(imagePath);
    }
}

testImageUpload();
