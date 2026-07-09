const axios = require('axios');
require('dotenv').config();
const token = process.env.META_ACCESS_TOKEN;

async function test() {
    const types = ['adinterest', 'adbehavior', 'adTargetingCategory'];
    for (const type of types) {
        try {
            console.log(`\nTesting type=${type} with q=engaged`);
            let res = await axios.get(`https://graph.facebook.com/v20.0/search`, {
                params: { type: type, q: 'engaged', access_token: token, limit: 3 }
            });
            console.log("Success! Found:", res.data.data.length, "items.");
        } catch(e) {
            console.log("Failed:", e.response ? e.response.data.error.message : e.message);
        }
    }
    
    try {
        console.log(`\nTesting type=adTargetingCategory with class=behaviors (NO q)`);
        let res = await axios.get(`https://graph.facebook.com/v20.0/search`, {
            params: { type: 'adTargetingCategory', class: 'behaviors', access_token: token }
        });
        console.log("Success! Found:", res.data.data.length, "behaviors.");
    } catch(e) {
        console.log("Failed:", e.response ? e.response.data.error.message : e.message);
    }
}
test();
