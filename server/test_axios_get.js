const axios = require('axios');

async function run() {
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/18tOJqU0Pd_E4VrGwlzQ5-_houhx4m2WR_wO9dqeHI20/values/Sheet2!1:1`;
    
    try {
        console.log('Testing GET with data: null');
        await axios({
            method: 'GET',
            url: headerUrl,
            data: null,
            headers: {
                'Content-Type': 'application/json'
            },
            proxy: false
        });
    } catch (e) {
        if (typeof e.response?.data === 'string') {
            console.log('Result for data: null ->', e.response?.data.substring(0, 100));
        } else {
            console.log('Result for data: null ->', e.response?.status, 'JSON');
        }
    }

    try {
        console.log('\nTesting GET with NO data property');
        await axios({
            method: 'GET',
            url: headerUrl,
            headers: {
                'Content-Type': 'application/json'
            },
            proxy: false
        });
    } catch (e) {
        if (typeof e.response?.data === 'string') {
            console.log('Result for NO data property ->', e.response?.data.substring(0, 100));
        } else {
            console.log('Result for NO data property ->', e.response?.status, 'JSON');
        }
    }
}
run();
