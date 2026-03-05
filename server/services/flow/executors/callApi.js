const axios = require('axios');
const contextManager = require('../context');

module.exports = {
    async execute(session, node, context) {
        const { url, method, headers, params, body, bodyType, authType, authUsername, authPassword, authToken, authHeaderName, authHeaderValue } = node.data;

        console.log(`[CallApiExecutor] Executing API Call to ${url} (${method})`);

        try {
            const resolvedUrl = contextManager.resolve(url, context);
            const resolvedHeaders = contextManager.resolveObject(headers, context);
            const resolvedParams = contextManager.resolveObject(params, context);
            const resolvedBody = contextManager.resolveObject(body, context);

            // Construct headers object
            const headersObj = {};
            if (resolvedHeaders && Array.isArray(resolvedHeaders)) {
                resolvedHeaders.forEach(h => {
                    if (h.key && h.value) headersObj[h.key] = h.value;
                });
            }

            // Handle Authentication
            if (authType === 'basic') {
                const user = contextManager.resolve(authUsername, context) || '';
                const pass = contextManager.resolve(authPassword, context) || '';
                const auth = Buffer.from(`${user}:${pass}`).toString('base64');
                headersObj['Authorization'] = `Basic ${auth}`;
            } else if (authType === 'bearer') {
                const token = contextManager.resolve(authToken, context) || '';
                headersObj['Authorization'] = `Bearer ${token}`;
            } else if (authType === 'header') {
                const name = contextManager.resolve(authHeaderName, context);
                const value = contextManager.resolve(authHeaderValue, context);
                if (name && value) {
                    headersObj[name] = value;
                }
            }

            // Construct params object
            const paramsObj = {};
            if (resolvedParams && Array.isArray(resolvedParams)) {
                resolvedParams.forEach(p => {
                    if (p.key && p.value) paramsObj[p.key] = p.value;
                });
            }

            // Construct body
            let data = resolvedBody;
            if (node.data.bodyInputType === 'kv' && node.data.bodyFields && Array.isArray(node.data.bodyFields)) {
                const fieldsObj = {};
                const resolvedFields = contextManager.resolveObject(node.data.bodyFields, context);
                resolvedFields.forEach(f => {
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
            } else if (typeof data === 'string') {
                const trimmed = data.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    try {
                        data = JSON.parse(trimmed);
                    } catch (e) {
                        console.warn('[CallApiExecutor] Failed to parse JSON body, sending as string.', e.message);
                    }
                }
            }

            if (typeof data === 'object' && data !== null) {
                const hasContentType = Object.keys(headersObj).some(k => k.toLowerCase() === 'content-type');
                if (!hasContentType) {
                    headersObj['Content-Type'] = 'application/json';
                }
            }
            // TODO: Handle form-data if needed (might need FormData polyfill or qs)

            // Log request details for debugging (masking auth)
            const debugHeaders = { ...headersObj };
            if (debugHeaders['Authorization']) {
                debugHeaders['Authorization'] = debugHeaders['Authorization'].substring(0, 10) + '...';
            }
            console.log(`[CallApiExecutor] Sending Request:`, {
                url: resolvedUrl,
                method,
                headers: debugHeaders,
                data
            });

            const response = await axios({
                method: method || 'GET',
                url: resolvedUrl,
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
