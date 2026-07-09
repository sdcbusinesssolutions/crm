const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const token = process.env.META_ACCESS_TOKEN;

async function test() {
    try {
        console.log("Testing adbehavior:");
        let res = await axios.get('https://graph.facebook.com/v20.0/search?type=adbehavior&q=engaged&limit=15', {
            params: { access_token: token }
        });
        console.log(res.data);
    } catch(e) {
        console.log(e.response ? e.response.data : e.message);
    }
    
    try {
        console.log("\nTesting adTargetingCategory with behaviors:");
        let res2 = await axios.get('https://graph.facebook.com/v20.0/search?type=adTargetingCategory&class=behaviors&q=engaged&limit=15', {
            params: { access_token: token }
        });
        console.log(res2.data);
    } catch(e) {
        console.log(e.response ? e.response.data : e.message);
    }
}
test();
