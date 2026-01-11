const axios = require('axios');

module.exports = {
    async execute(session, node, context) {
        const { url, method, headers, params, body, bodyType, authType, authUsername, authPassword, authToken, authHeaderName, authHeaderValue } = node.data;

        console.log(`[CallApiExecutor] Executing API Call to ${url} (${method})`);

        try {
            // Construct headers object
            const headersObj = {};
            if (headers && Array.isArray(headers)) {
                headers.forEach(h => {
                    if (h.key && h.value) headersObj[h.key] = h.value;
                });
            }

            // Handle Authentication
            if (authType === 'basic') {
                const user = authUsername || '';
                const pass = authPassword || '';
                const auth = Buffer.from(`${user}:${pass}`).toString('base64');
                headersObj['Authorization'] = `Basic ${auth}`;
            } else if (authType === 'bearer') {
                const token = authToken || '';
                headersObj['Authorization'] = `Bearer ${token}`;
            } else if (authType === 'header') {
                if (authHeaderName && authHeaderValue) {
                    headersObj[authHeaderName] = authHeaderValue;
                }
            }

            // Construct params object
            const paramsObj = {};
            if (params && Array.isArray(params)) {
                params.forEach(p => {
                    if (p.key && p.value) paramsObj[p.key] = p.value;
                });
            }

            // Construct body
            let data = body;
            if (node.data.bodyInputType === 'kv' && node.data.bodyFields && Array.isArray(node.data.bodyFields)) {
                const fieldsObj = {};
                node.data.bodyFields.forEach(f => {
                    if (f.key) fieldsObj[f.key] = f.value;
                });
                data = fieldsObj;

                // Smart JSON Detection: Handle case where user pasted Raw JSON into the "Key" field of KV mode
                const keys = Object.keys(fieldsObj);
                if (keys.length === 1) {
                    const potentialJson = keys[0].trim();
                    if (potentialJson.startsWith('{') && potentialJson.endsWith('}') && !fieldsObj[keys[0]]) {
                        try {
                            const parsed = JSON.parse(potentialJson);
                            console.log('[CallApiExecutor] Smart JSON Detection: Treated KV key as Raw JSON');
                            data = parsed;
                        } catch (e) {
                            console.warn('[CallApiExecutor] Smart JSON Detection: Parsing failed, sending as raw string.', e.message);
                            data = potentialJson;
                        }
                    }
                }
            } else if (bodyType === 'json' && typeof body === 'string') {
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    console.warn('[CallApiExecutor] Failed to parse JSON body, sending as string.');
                }
            }
            // TODO: Handle form-data if needed (might need FormData polyfill or qs)

            // Log request details for debugging (masking auth)
            const debugHeaders = { ...headersObj };
            if (debugHeaders['Authorization']) {
                debugHeaders['Authorization'] = debugHeaders['Authorization'].substring(0, 10) + '...';
            }
            console.log(`[CallApiExecutor] Sending Request:`, {
                url,
                method,
                headers: debugHeaders,
                data
            });

            const response = await axios({
                method: method || 'GET',
                url: url,
                headers: headersObj,
                params: paramsObj,
                data: data
            });

            console.log(`[CallApiExecutor] Response Status: ${response.status}`);

            return {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                response: response.data
            };

        } catch (error) {
            console.error('[CallApiExecutor] API Call Failed:', error.message);

            // Return error details so flow can handle it (e.g. via Check Condition)
            return {
                error: true,
                message: error.message,
                status: error.response?.status,
                response: error.response?.data
            };
        }
    }
};
