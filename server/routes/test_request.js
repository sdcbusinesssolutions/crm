const express = require('express');
const router = express.Router();
const axios = require('axios');

const contextManager = require('../services/flow/context');

router.post('/', async (req, res) => {
    const { url, method, headers, params, body, bodyType, bodyInputType, bodyFields, variables, authType, authUsername, authPassword, authToken, authHeaderName, authHeaderValue } = req.body;

    console.log('Testing Request:', { url, method, bodyType, bodyInputType, authType });

    try {
        // Resolve variables if provided
        const context = variables || {};
        const resolvedUrl = contextManager.resolve(url, context);
        const resolvedHeaders = contextManager.resolveObject(headers, context);
        const resolvedParams = contextManager.resolveObject(params, context);
        const resolvedBody = contextManager.resolveObject(body, context);

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

        const paramsObj = {};
        if (resolvedParams && Array.isArray(resolvedParams)) {
            resolvedParams.forEach(p => {
                if (p.key && p.value) paramsObj[p.key] = p.value;
            });
        }

        let data = resolvedBody;
        if (bodyInputType === 'kv' && bodyFields && Array.isArray(bodyFields)) {
            // Construct object from key-value pairs
            const fieldsObj = {};
            // Resolve fields first
            const resolvedFields = contextManager.resolveObject(bodyFields, context);
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
                        console.log('Smart JSON Detection: Treated KV key as Raw JSON');
                        data = parsed;
                    } catch (e) {
                        console.warn('Smart JSON Detection: Parsing failed, but sending as raw string anyway because it looks like JSON.', e.message);
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
                    console.warn('Failed to parse JSON body string, sending as is:', e.message);
                }
            }
        }

        if (typeof data === 'object' && data !== null) {
            const hasContentType = Object.keys(headersObj).some(k => k.toLowerCase() === 'content-type');
            if (!hasContentType) {
                headersObj['Content-Type'] = 'application/json';
            }
        }

        console.log('Sending Axios Request:', {
            method: method || 'GET',
            url: resolvedUrl,
            headers: headersObj,
            params: paramsObj,
            data
        });

        const response = await axios({
            method: method || 'GET',
            url: resolvedUrl,
            headers: headersObj,
            params: paramsObj,
            data: data
        });

        console.log('Axios Response Status:', response.status);
        res.json(response.data);
    } catch (error) {
        console.error('Test Request Error:', error.message);
        if (error.response) {
            console.error('Error Response Data:', error.response.data);
        }
        res.status(error.response?.status || 500).json({
            error: error.message,
            data: error.response?.data
        });
    }
});

module.exports = router;
