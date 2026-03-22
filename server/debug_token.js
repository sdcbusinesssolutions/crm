
const axios = require('axios');

async function debugToken() {
    const access_token = 'EAAO4J3qeOYUBZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
    
    // Debug token requires an App Access Token.
    // We can try to use the token to query /me
    try {
        const response = await axios.get(`https://graph.facebook.com/v21.0/me?access_token=${access_token}`);
        console.log('✅ Token Valid for /me:', response.data);
    } catch (err) {
        console.error('❌ Token Invalid for /me:', err.response?.data?.error?.message || err.message);
    }
}

debugToken();
