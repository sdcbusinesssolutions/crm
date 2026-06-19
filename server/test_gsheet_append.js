const axios = require('axios');

async function run() {
    const accessToken = 'fake_token';
    const spreadsheetId = '18tOJqU0Pd_E4VrGwlzQ5-_houhx4m2WR_wO9dqeHI20';
    const encodedSheet = 'Sheet2';
    
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}:append?valueInputOption=USER_ENTERED`;
    
    console.log('URL:', appendUrl);
    
    try {
        await axios({
            method: 'POST',
            url: appendUrl,
            data: {
                values: [['ll', 'Kh', 'Vb']]
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            proxy: false
        });
    } catch (e) {
        console.log(e.response?.status);
        console.log(e.response?.data);
    }
}
run();
