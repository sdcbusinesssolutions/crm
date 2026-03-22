
const axios = require('axios');

async function debugToken() {
    const access_token = 'EAAO4J3qeOYUBZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
    
    // Debug token via /debug_token requires an App Token (AppID|AppSecret).
    // Let's see if we can at least get the App ID from /app again (Step 416 failed, why?)
    // Ah, wait. I'll try v20.0 or v19.0.
    
    const versions = ['v21.0', 'v20.0', 'v19.0'];
    for (const v of versions) {
        try {
            const res = await axios.get(`https://graph.facebook.com/${v}/me?fields=id,name,email&access_token=${access_token}`);
            console.log(`✅ Success for ${v}: ${res.data.id} (${res.data.name})`);
        } catch (err) {
            console.error(`❌ Fail for ${v}:`, err.response?.data?.error?.message || err.message);
        }
    }
}

debugToken();
