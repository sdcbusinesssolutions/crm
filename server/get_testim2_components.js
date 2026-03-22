
const axios = require('axios');

async function getTemplateComponents() {
    const waba_id = '879173654625800';
    const access_token = 'EAAO4J3qeOYUBQZAaEzaUSHXuxYgiZCJnyBDtI0bZAKNP29Y49YQbF3NR49QKqgKM10gaAc4VBoDZAT5DSzM26Cmal0USGCOCMQ9StuYDgQQmZCXYKzU1HOxJc3MyHHWx8m34Wg2v4Lrqs851fW5kInTgiZCAbvZCS0D5Psx4uA3qt78mXflaDrLQZBAF1cDWohcFuuZArnT6r6BfOUxkzymYyQRmzZCHIbXtyay9MlkZB8V7VDOoQtZAfh6cAJYSnxVtiDaVB7Opr2tFaYShF7tv7k8YDtU0pkbHbQxb';
    const templateName = 'testim2';

    const url = `https://graph.facebook.com/v21.0/${waba_id}/message_templates?name=${templateName}`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        
        const templates = response.data.data;
        if (templates && templates.length > 0) {
            templates.forEach(t => {
                console.log(`\nTemplate: ${t.name} (${t.language})`);
                t.components.forEach(c => {
                    console.log(`Type: ${c.type}, Text: ${c.text || 'N/A'}`);
                    if (c.example) {
                        console.log(`Example: ${JSON.stringify(c.example, null, 2)}`);
                    }
                });
            });
        }
    } catch (err) {
        console.error('Error:', err.response?.data?.error?.message || err.message);
    }
}

getTemplateComponents();
