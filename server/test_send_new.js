
const axios = require('axios');

async function sendNew() {
    const phone_number_id = '850356761502552';
    const access_token = 'EAAO4J3qeOYUBZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
    const meta_app_id = '1046904630557061';
    const to = '918408907516';
    const templateName = 'testim2';
    const templateLang = 'en_US';

    console.log(`--- SENDING NEW TEST VIA MM LITE ---`);
    console.log(`Sender ID: ${phone_number_id}`);
    console.log(`Recipient: ${to}`);
    console.log(`Template: ${templateName} (${templateLang})`);
    console.log(`Service/Solution ID: ${meta_app_id}`);

    // MM Lite endpoint for MARKETING templates
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
                        { type: "text", text: "ORDER-123" }
                    ]
                }
            ]
        },
        solution_id: meta_app_id // Attribution
    };

    try {
        const response = await axios.post(url, payload, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        console.log('✅ Send Success via MM Lite!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('❌ MM Lite Attempt Failed:', err.response?.data?.error?.message || err.message);
        
        // --- System Fallback Simulation ---
        console.log('🔄 Triggering Fallback to standard /messages endpoint...');
        try {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.solution_id;
            
            const fallbackUrl = `https://graph.facebook.com/v21.0/${phone_number_id}/messages`;
            const fallbackRes = await axios.post(fallbackUrl, fallbackPayload, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            console.log('✅ Fallback Send Success!');
            console.log('Fallback Response:', JSON.stringify(fallbackRes.data, null, 2));
        } catch (fallbackErr) {
            console.error('❌ Fallback also failed:', fallbackErr.response?.data?.error?.message || fallbackErr.message);
        }
    }
}

sendNew();
