const express = require('express');
const router = express.Router();

// Dummy route for test_request to prevent server crash
router.all('/', (req, res) => {
    res.json({ message: 'Test request route placeholder' });
});

module.exports = router;
