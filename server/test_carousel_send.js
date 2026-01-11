const axios = require('axios');

const payload = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "919373393645",
    "type": "template",
    "template": {
        "name": "test244",
        "language": {
            "code": "en_US"
        },
        "components": [
            {
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "text": "value1"
                    },
                    {
                        "type": "text",
                        "text": "varlue2"
                    }
                ]
            },
            {
                "type": "carousel",
                "cards": [
                    {
                        "card_index": 0,
                        "components": [
                            {
                                "type": "header",
                                "parameters": [
                                    {
                                        "type": "image",
                                        "image": {
                                            "link": `${process.env.SUPABASE_URL}/storage/v1/object/public/campaign-media/5ae5999e-1eb2-4425-adf4-858156709d2d/2025-12-17/1765997526284-417777291.png`
                                        }
                                    }
                                ]
                            },
                            {
                                "type": "button",
                                "sub_type": "quick_reply",
                                "index": 0,
                                "parameters": [
                                    {
                                        "type": "payload",
                                        "payload": "CARD_0_BTN_0"
                                    }
                                ]
                            },
                            {
                                "type": "button",
                                "sub_type": "url",
                                "index": 1
                            }
                        ]
                    },
                    {
                        "card_index": 1,
                        "components": [
                            {
                                "type": "header",
                                "parameters": [
                                    {
                                        "type": "image",
                                        "image": {
                                            "link": `${process.env.SUPABASE_URL}/storage/v1/object/public/campaign-media/5ae5999e-1eb2-4425-adf4-858156709d2d/2025-12-17/1765997531604-840125997.png`
                                        }
                                    }
                                ]
                            },
                            {
                                "type": "button",
                                "sub_type": "quick_reply",
                                "index": 0,
                                "parameters": [
                                    {
                                        "type": "payload",
                                        "payload": "CARD_1_BTN_0"
                                    }
                                ]
                            },
                            {
                                "type": "button",
                                "sub_type": "url",
                                "index": 1
                            }
                        ]
                    },
                    {
                        "card_index": 2,
                        "components": [
                            {
                                "type": "header",
                                "parameters": [
                                    {
                                        "type": "image",
                                        "image": {
                                            "link": `${process.env.SUPABASE_URL}/storage/v1/object/public/campaign-media/5ae5999e-1eb2-4425-adf4-858156709d2d/2025-12-17/1765997537348-773555933.png`
                                        }
                                    }
                                ]
                            },
                            {
                                "type": "button",
                                "sub_type": "quick_reply",
                                "index": 0,
                                "parameters": [
                                    {
                                        "type": "payload",
                                        "payload": "CARD_2_BTN_0"
                                    }
                                ]
                            },
                            {
                                "type": "button",
                                "sub_type": "url",
                                "index": 1
                            }
                        ]
                    }
                ]
            }
        ]
    }
};

const token = "eyJhbGciOiJIUzI1NiIsImtpZCI6Im4zUm5oRW5Fay9aLzM4cSsiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2RraWJxZ2FtdXhqemhpd3hjZnpkLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1YWU1OTk5ZS0xZWIyLTQ0MjUtYWRmNC04NTgxNTY3MDlkMmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY1OTk5MTg3LCJpYXQiOjE3NjU5OTU1ODcsImVtYWlsIjoia2QzMTk2N0BnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoia2QzMTk2N0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiI1YWU1OTk5ZS0xZWIyLTQ0MjUtYWRmNC04NTgxNTY3MDlkMmQifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2NTk4ODI4MX1dLCJzZXNzaW9uX2lkIjoiNzQ2OTliZDMtNjFiYy00ZjA0LWE4ZDktNWEzYzdmOGQ1Zjg0IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.JjUjmBmz2tcwQEXwmROum-Sr-copGOV54wSZtb-mPLw";

require('dotenv').config();
const baseUrl = process.env.APP_URL || process.env.SERVER_URL || 'http://localhost:5000';
axios.post(`${baseUrl}/api/external/send-template`, payload, {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
})
    .then(response => {
        console.log('SUCCESS:', JSON.stringify(response.data, null, 2));
    })
    .catch(error => {
        console.error('ERROR:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    });
