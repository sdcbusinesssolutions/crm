

const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');
const path = require('path');
// Load env vars only if not in production/Netlify (where they are injected)
try {
  if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
  }
} catch (e) { console.log('No .env file found, using process.env'); }
// Import the shared static client for middleware verification
const { supabase } = require('./lib/supabaseClient');
const { overrideConsole } = require('./utils/logger');
overrideConsole();

const app = express();
const PORT = process.env.PORT;
if (!PORT) {
  console.error('❌ CRITICAL: PORT is not defined in .env or environment variables.');
  process.exit(1);
}

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Startup Check: File System Permissions ---
const fs = require('fs');
const logDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    console.log('✅ Created logs directory:', logDir);
  }
  const testFile = path.join(logDir, 'startup_check.txt');
  fs.writeFileSync(testFile, `Startup Write Check: ${new Date().toISOString()}\n`);
  console.log('✅ LOGIC CHECK: Write permission to /app/server/logs CONFIRMED.');
} catch (e) {
  console.error('❌ LOGIC CHECK: CRITICAL - Cannot write to /app/server/logs:', e.message);
  console.error('   Verify Docker volume mounts and permissions.');
}

// app.use('/uploads', express.static('uploads')); // Disabled for Netlify Serverless

const requireAuth = require('./middleware/requireAuth');

// --- Direct Public Routes (Bypassing Router for Safety) ---
app.get('/status', (req, res) => {
  res.json({ status: 'online', endpoint: 'root' });
});
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', endpoint: 'api' });
});

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

// Debug Endpoint for DB Connectivity
router.get('/debug-db', async (req, res) => {
  try {
    const { supabaseAdmin } = require('./lib/supabaseClient');
    const hasAdmin = !!supabaseAdmin;

    // Test Query
    let dbStatus = 'unknown';
    let errorDetail = null;
    let userCount = 0;

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) {
        dbStatus = 'failed';
        errorDetail = error.message;
      } else {
        dbStatus = 'connected';
        userCount = data?.users?.length || 0;
      }
    }

    res.json({
      environment: process.env.NODE_ENV,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      adminClientInitialized: hasAdmin,
      dbConnection: dbStatus,
      userCountSample: userCount,
      error: errorDetail
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
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
// const testRequestRoutes = require('./routes/test_request');
const uploadRoutes = require('./routes/upload');
const whatsappTemplatesRoutes = require('./routes/whatsapp_templates');
const campaignsRoutes = require('./routes/campaigns');
const dashboardRoutes = require('./routes/dashboard');
const integrationsRoutes = require('./routes/integrations'); // New: Import integrations router

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

// Soft-Auth Branding Route (Must be before protected /settings mount to function correctly)
const brandingRoutes = require('./routes/branding');
router.use('/settings/branding', brandingRoutes);

router.use('/settings', requireAuth, settingsRoutes);
router.use('/flows', requireAuth, flowsRoutes);
router.use('/whatsapp/forms', requireAuth, whatsappFormsRoutes);
router.use('/whatsapp/templates', requireAuth, whatsappTemplatesRoutes);
router.use('/campaigns', requireAuth, campaignsRoutes);
router.use('/campaigns', requireAuth, campaignsRoutes);
router.use('/inbox', requireAuth, inboxRoutes);
router.use('/inbox', requireAuth, inboxRoutes);
// router.use('/test-request', requireAuth, testRequestRoutes);
router.use('/upload', requireAuth, uploadRoutes);

// Admin Routes (Mounted under /admin)
router.use('/admin/auth', adminAuthRoutes); // Auth has its own middleware or none for login
router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/admin/plans', adminPlanRoutes);
router.use('/admin/subscriptions', adminSubscriptionRoutes);

router.use('/admin/settings', adminSettingsRoutes);
// EXPERIMENTAL FIX: Mount integrations explicitly to avoid wildcard shadowing
console.log('✅ Integrations Route Mounted at /api/integrations');
app.use('/api/integrations', requireAuth, integrationsRoutes);

app.use('/api', router);
app.use('/api/external', require('./routes/external_api')); // Dedicated External API Endpoint
app.use('/.netlify/functions/server', router);
// app.use('/', router); // DISABLED: This causes conflict with SPA routing (e.g. /admin/users hits API instead of React)

// --- Export ---
module.exports.handler = serverless(app);

// --- Local Start ---
if (require.main === module) {
  // --- Serve Static Frontend (Single Port Deployment) ---
  const clientBuildPath = process.env.CLIENT_BUILD_PATH || path.join(__dirname, '../client/dist');

  // Serve static assets with default cache (usually efficient for hashed files)
  app.use(express.static(clientBuildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // Handle Client Routing (SPA) - Return index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't intercept API routes (though they should be caught above)
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    // Start Campaign Worker
    // Note: In production, this should ideally be a separate process.
    // For this setup, we run it alongside the API.
    const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.trim() : '';

    console.log('--- DEBUG AUTH CONFIG ---');
    console.log(`URL Length: ${supabaseUrl ? supabaseUrl.length : 'MISSING'}`);
    console.log(`Service Key Length: ${serviceKey ? serviceKey.length : 'MISSING'}`);
    console.log('-------------------------');

    if (supabaseUrl && serviceKey) {
      const CampaignWorker = require('./workers/campaignWorker');
      const worker = new CampaignWorker(supabaseUrl, serviceKey);
      worker.start();

      const Scheduler = require('./workers/scheduler');
      const scheduler = new Scheduler(supabaseUrl, serviceKey);
      scheduler.start();
    } else {
      console.warn('⚠️ Campaign Worker not started: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    // Log Automation Status
    const clientUrl = process.env.CLIENT_URL;
    if (!clientUrl) {
      console.warn('⚠️  WARNING: CLIENT_URL is not defined in .env.');
    } else {
      console.log(`🌍 Public Client URL: ${clientUrl}`);
    }
    console.log(`🔐 Ensure this URL is whitelisted in Supabase Dashboard > Auth > URL Configuration`);
  });
}
