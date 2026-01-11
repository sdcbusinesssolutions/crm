
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Import the shared static client for middleware verification
const { supabase } = require('./lib/supabaseClient');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

const requireAuth = require('./middleware/requireAuth');

// --- API Routes ---
const router = express.Router();

// Public Route
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'WhatsApp Flow Builder API',
    timestamp: new Date().toISOString()
  });
});

// Protected Route
router.get('/users/me', requireAuth, (req, res) => {
  res.json({
    message: 'Authenticated successfully',
    user: {
      id: req.user.id,
      email: req.user.email,
      last_sign_in: req.user.last_sign_in_at
    }
  });
});

// Request logging middleware
router.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Mount Sub-routers (All protected by requireAuth)
// Mount Sub-routers
const formRoutes = require('./routes/forms');
const contactsRoutes = require('./routes/contacts');
const groupsRoutes = require('./routes/groups');
const fieldsRoutes = require('./routes/fields');
const pipelinesRoutes = require('./routes/pipelines');
const stagesRoutes = require('./routes/stages');
const leadsRoutes = require('./routes/leads');
const notesRoutes = require('./routes/notes');
const tasksRoutes = require('./routes/tasks');
const appointmentsRoutes = require('./routes/appointments');
const callLogsRoutes = require('./routes/call_logs');
const settingsRoutes = require('./routes/settings');
const flowsRoutes = require('./routes/flows');
const whatsappFormsRoutes = require('./routes/whatsapp_forms');
const inboxRoutes = require('./routes/inbox');

const webhookRoutes = require('./routes/webhook');
const incomingWebhookRoutes = require('./routes/incoming_webhooks');
const testRequestRoutes = require('./routes/test_request');
const uploadRoutes = require('./routes/upload');
const whatsappTemplatesRoutes = require('./routes/whatsapp_templates');
const campaignsRoutes = require('./routes/campaigns');
const dashboardRoutes = require('./routes/dashboard');

// Admin Routes
const adminAuthRoutes = require('./routes/admin/authRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardRoutes');
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminPlanRoutes = require('./routes/admin/planRoutes');
const adminSubscriptionRoutes = require('./routes/admin/subscriptionRoutes');
const adminSettingsRoutes = require('./routes/admin/settingsRoutes');

// Public Routes
router.use('/forms', formRoutes);
router.use('/', webhookRoutes); // Meta Webhook (Mounted at root to match /api/:userId/:phoneId/webhook)
router.use('/webhooks', incomingWebhookRoutes); // Dynamic Incoming Webhooks

// Protected Routes
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/contacts', requireAuth, contactsRoutes);
router.use('/groups', requireAuth, groupsRoutes);
router.use('/fields', requireAuth, fieldsRoutes);
router.use('/pipelines', requireAuth, pipelinesRoutes);
router.use('/stages', requireAuth, stagesRoutes);
router.use('/leads', requireAuth, leadsRoutes);
router.use('/notes', requireAuth, notesRoutes);
router.use('/tasks', requireAuth, tasksRoutes);
router.use('/appointments', requireAuth, appointmentsRoutes);
router.use('/call-logs', requireAuth, callLogsRoutes);
router.use('/settings', requireAuth, settingsRoutes);
router.use('/flows', requireAuth, flowsRoutes);
router.use('/whatsapp/forms', requireAuth, whatsappFormsRoutes);
router.use('/whatsapp/templates', requireAuth, whatsappTemplatesRoutes);
router.use('/campaigns', requireAuth, campaignsRoutes);
router.use('/inbox', requireAuth, inboxRoutes);
router.use('/test-request', requireAuth, testRequestRoutes);
router.use('/upload', requireAuth, uploadRoutes);

// Admin Routes (Mounted under /admin)
router.use('/admin/auth', adminAuthRoutes); // Auth has its own middleware or none for login
router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/admin/plans', adminPlanRoutes);
router.use('/admin/subscriptions', adminSubscriptionRoutes);
router.use('/admin/settings', adminSettingsRoutes);
// --- Mount Router ---
app.use('/api', router);
app.use('/api/external', require('./routes/external_api')); // Dedicated External API Endpoint
app.use('/.netlify/functions/server', router);
// app.use('/', router); // Commented out to prevent conflict with Frontend Routing (e.g., /forms/:id)

// --- Export ---
module.exports.handler = serverless(app);


// --- INJECTED FOR SINGLE PORT TESTING ---
const path_module = require('path');
const fs = require('fs');
console.log('NOTE: Running in Single Port Mode (Serving Client from /dist)');

// Serve static files from client/dist
// We assume the client has been built to ../client/dist
app.use(express.static(path_module.join(__dirname, '../client/dist')));

// Handle client-side routing, return all requests to index.html
// This must come AFTER API routes are defined (which they are, above this block)
app.get('*', (req, res, next) => {
  // Ignore API routes and other static assets if they fell through
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();

  const indexPath = path_module.join(__dirname, '../client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client build not found. Did you run "npm run build" in client?');
  }
});
// ----------------------------------------

// --- Local Start ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    // Start Campaign Worker
    // Note: In production, this should ideally be a separate process.
    // For this setup, we run it alongside the API.
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && serviceKey) {
      const CampaignWorker = require('./workers/campaignWorker');
      const worker = new CampaignWorker(supabaseUrl, serviceKey);
      worker.start();
    } else {
      console.warn('⚠️ Campaign Worker not started: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
  });
}
