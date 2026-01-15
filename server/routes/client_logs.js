const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

router.post('/', (req, res) => {
    try {
        const { level, message, details } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Use the centralized logger strategy (auth_bridge_DD-MM-YYYY_partX.log)
        logger.logAuthBridgeEvent(level || 'INFO', {
            message,
            details,
            ip,
            clientTimestamp: new Date().toISOString()
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Logging endpoint error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
