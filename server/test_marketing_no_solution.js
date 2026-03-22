
const axios = require('axios');

async function sendNew() {
    const phone_number_id = '850356761502552';
    const access_token = 'EAAO4J3qeOYUBQZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
    const to = '918408907516';
    const templateName = 'testim2';
    const templateLang = 'en_US';

    console.log(`--- SENDING NEW TEST VIA MM LITE (NO SOLUTION ID) ---`);
    const url = `https://graph.facebook.com/v21.0/${phone_number_id}/marketing_messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: templateLang },
            components: [
                {
                    type: "header",
                    parameters: [
                        {
                            type: "image",
                            image: { link: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1000&auto=format&fit=crop" }
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: "ORDER-456" }
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        console.log('✅ Send Success via MM Lite (No Solution)!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('❌ MM Lite Failed:', err.response?.data?.error?.message || err.message);
    }
}

sendNew();
