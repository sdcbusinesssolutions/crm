// server/routes/ai_agents/index.js
const express = require('express');
const router = express.Router();

const agentsRoutes = require('./agents');
const knowledgeRoutes = require('./knowledge');

router.use('/', agentsRoutes); // /api/ai-agents
router.use('/', knowledgeRoutes); // /api/ai-agents (mounts on top for nested /:id routes)

module.exports = router;
