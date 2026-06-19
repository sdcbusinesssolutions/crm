const axios = require('axios');

async function run() {
    const accessToken = 'fake_token';
    const spreadsheetId = '18tOJqU0Pd_E4VrGwlzQ5-_houhx4m2WR_wO9dqeHI20';
    const encodedSheet = 'Sheet2';
    
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!1:1`;
    
    console.log('GET URL:', headerUrl);
    
    try {
        await axios({
            method: 'GET',
            url: headerUrl,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            proxy: false
        });
    } catch (e) {
        console.log(e.response?.status);
        if (typeof e.response?.data === 'string') {
            console.log(e.response?.data.substring(0, 200));
        } else {
            console.log(e.response?.data);
        }
    }
}
run();
