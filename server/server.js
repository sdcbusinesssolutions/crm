const express = require('express');
const cors = require('cors');
const compression = require('compression');
const serverless = require('serverless-http');
const path = require('path');
const dns = require('dns');

// Globally force IPv4 resolution first to prevent Node 18+ IPv6 connect timeout errors
dns.setDefaultResultOrder('ipv4first');


// Load env vars only if not in production/Netlify (where they are injected)
try {
  if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
  }
} catch (e) { console.log('No .env file found, using process.env'); }

// --- GLOBAL PROXY CLEANUP (Run AFTER .env load) ---
// Aggressively remove any proxy environment variables to prevent "Invalid host defined options"
// errors in gaxios/googleapis/node-fetch. These might be injected by dotenv or system.
const proxyVars = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy',
  'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'
];
proxyVars.forEach(v => {
  if (process.env[v] !== undefined) {
    console.log(`[Startup] Cleaning process.env.${v}`);
    delete process.env[v];
  }
});
// Explicitly set NO_PROXY just in case
process.env.NO_PROXY = 'googleapis.com,sheets.googleapis.com,oauth2.googleapis.com';

// --- DYNAMIC CLIENT CONFIG SYNCHRONIZATION ---
// Automatically syncs server environment variables to the statically served frontend's config.js
// on startup. This prevents login failures due to blank client configuration files.
try {
  const fs = require('fs');
  const clientBuildPath = process.env.CLIENT_BUILD_PATH || path.join(__dirname, '../client/dist');
  const publicConfigPath = path.join(__dirname, '../client/public');
  
  const configContent = `window.env = {
  VITE_SUPABASE_URL: ${JSON.stringify(process.env.SUPABASE_URL || '')},
  VITE_SUPABASE_ANON_KEY: ${JSON.stringify(process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '')},
  VITE_CLIENT_URL: "__DYNAMIC_ORIGIN__",
  VITE_API_URL: ${JSON.stringify(process.env.API_URL || '/api')},
  VITE_MASTER_URL: ${JSON.stringify(process.env.VITE_MASTER_URL || '')},
  VITE_BRIDGE_DOMAIN: ${JSON.stringify(process.env.BRIDGE_DOMAIN || '')}
};
`;

  // Write to client build folder
  if (fs.existsSync(clientBuildPath)) {
    fs.writeFileSync(path.join(clientBuildPath, 'config.js'), configContent);
    console.log(`✅ [ConfigSync] Synced runtime config to static build path: ${clientBuildPath}`);
  }
  // Write to client public folder (dev mode fallback)
  if (fs.existsSync(publicConfigPath)) {
    fs.writeFileSync(path.join(publicConfigPath, 'config.js'), configContent);
    console.log(`✅ [ConfigSync] Synced runtime config to source public path: ${publicConfigPath}`);
  }
} catch (err) {
  console.warn(`⚠️ [ConfigSync] Warning: Could not automatically sync client config: ${err.message}`);
}
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

// --- Supabase Reverse Proxy (Must be BEFORE express.json and compression middleware) ---
try {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  const proxyTarget = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
  if (proxyTarget) {
    const supabaseProxy = createProxyMiddleware({
      target: proxyTarget,
      changeOrigin: true,
      ws: true,
      pathRewrite: { '^/api/supabase-proxy': '' },
      logLevel: 'error',
      onProxyReq: (proxyReq, req, res) => {
        // Force uncompressed responses from Supabase to prevent double-compression/corruption
        // issues when passing through compression middleware or reverse proxies.
        proxyReq.setHeader('accept-encoding', 'identity');
      },
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        // Essential for WebSocket protocol mirroring
        if (req.headers['sec-websocket-protocol']) {
          proxyReq.setHeader('sec-websocket-protocol', req.headers['sec-websocket-protocol']);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        // Ensure CORS headers are always present to override restrictive Supabase defaults if needed
        proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'apikey, X-Client-Info, Content-Type, Authorization, Accept, Accept-Language, X-Authorization, Prefer, x-customer-id, x-vendor-id, x-account-id';
      }
    });
    app.use('/api/supabase-proxy', supabaseProxy);
    app.set('supabaseProxy', supabaseProxy); // Save for upgrade event
    console.log(`✅ [Proxy] Route /api/supabase-proxy mapped to ${proxyTarget}`);
  } else {
    console.warn(`⚠️ [Proxy] SUPABASE_URL missing, proxy not created.`);
  }
} catch (e) {
  console.log('Skipping proxy setup:', e.message);
}

// --- Middleware ---
app.set('trust proxy', 1); // Essential for Cloudflare/Nginx: Trust the proxy to get the real client IP
app.use(cors());
app.use(compression());

// Force Restart: 2026-01-12 23:25 UTC - Deduplication Active
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
// Docker healthcheck endpoint — must return 200 or container is marked unhealthy by Traefik
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: Math.floor(process.uptime()) });
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
const testRequestRoutes = require('./routes/test_request');
const uploadRoutes = require('./routes/upload');
const whatsappTemplatesRoutes = require('./routes/whatsapp_templates');
const campaignsRoutes = require('./routes/campaigns');
const dashboardRoutes = require('./routes/dashboard');
const leadDashboardRoutes = require('./routes/lead_dashboard'); // New optimized route
const integrationsRoutes = require('./routes/integrations'); // New: Import integrations router
const clientLogRoutes = require('./routes/client_logs'); // New: Client Logging
const staffRoutes = require('./modules/teamStaff/routes/staff.routes');
const authNotificationsRoutes = require('./routes/auth_notifications');

// Admin Routes
const followUpRoutes = require('./routes/followUps');
const dripCampaignRoutes = require('./routes/dripCampaigns');

const adminAuthRoutes = require('./routes/admin/authRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardRoutes');
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminPlanRoutes = require('./routes/admin/planRoutes');
const adminSubscriptionRoutes = require('./routes/admin/subscriptionRoutes');
const adminSettingsRoutes = require('./routes/admin/settingsRoutes');

// Public Routes
const authRoutes = require('./routes/auth');
router.use('/auth', authRoutes);

router.use('/forms', formRoutes);
router.use('/team-staff', staffRoutes);
router.use('/', webhookRoutes); // Meta Webhook (Mounted at root to match /api/:userId/:phoneId/webhook)
router.use('/webhooks', incomingWebhookRoutes); // Dynamic Incoming Webhooks
router.use('/client-logs', clientLogRoutes); // Public Client Logging

// Protected Routes
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/lead-dashboard', requireAuth, leadDashboardRoutes);
router.use('/contacts', requireAuth, contactsRoutes);
router.use('/groups', requireAuth, groupsRoutes);
router.use('/tags', requireAuth, require('./routes/tags'));
router.use('/fields', requireAuth, fieldsRoutes);
router.use('/pipelines', requireAuth, pipelinesRoutes);
router.use('/stages', requireAuth, stagesRoutes);
router.use('/leads', requireAuth, leadsRoutes);
router.use('/notes', requireAuth, notesRoutes);
router.use('/tasks', requireAuth, tasksRoutes);
router.use('/appointments', requireAuth, appointmentsRoutes);
router.use('/call-logs', requireAuth, callLogsRoutes);

router.use('/follow-ups', requireAuth, followUpRoutes);
router.use('/drip-campaigns', requireAuth, dripCampaignRoutes);

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
router.use('/test-request', requireAuth, testRequestRoutes);
router.use('/upload', requireAuth, uploadRoutes);

// Admin Routes (Mounted under /admin)
router.use('/admin/auth', adminAuthRoutes); // Auth has its own middleware or none for login
router.use('/admin/dashboard', adminDashboardRoutes);
app.use('/api/public-settings', require('./routes/publicSettings'));
router.use('/admin/users', adminUserRoutes);
router.use('/admin/plans', adminPlanRoutes);
router.use('/admin/subscriptions', adminSubscriptionRoutes);

router.use('/admin/settings', adminSettingsRoutes);
router.use('/admin/limits', require('./routes/admin/featureLimitsRoutes'));
// EXPERIMENTAL FIX: Mount integrations explicitly to avoid wildcard shadowing
console.log('✅ Integrations Route Mounted at /api/integrations');
app.use('/api/integrations', requireAuth, integrationsRoutes);

app.use('/api/sheet-automations', requireAuth, require('./routes/sheet_automations'));
app.use('/api/ai-agents', requireAuth, require('./routes/ai_agents'));
app.use('/api/quick-replies', requireAuth, require('./routes/quick_replies'));
app.use('/api', router);

app.use('/api/auth-notifications', authNotificationsRoutes); // Triggered post-signup for whatsapp config
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

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    // If we have a proxy middleware, attach it to the upgrade event for WebSockets
    const supabaseProxy = app.get('supabaseProxy');
    if (supabaseProxy) {
      server.on('upgrade', (req, socket, head) => {
        if (req.url.startsWith('/api/supabase-proxy') && typeof supabaseProxy.upgrade === 'function') {
          supabaseProxy.upgrade(req, socket, head);
        }
      });
      console.log(`🔌 Attached WebSocket proxy for Supabase Realtime.`);
    }

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

      // Start Drip Campaign Engine (New)
      const dripEngine = require('./workers/dripProcessor');
      const workerCount = parseInt(process.env.DRIP_WORKER_COUNT || '1');
      console.log(`[DripEngine] Starting ${workerCount} worker(s)...`);
      for (let i = 0; i < workerCount; i++) {
        setTimeout(() => dripEngine.start(), i * 2000); // Stagger start by 2s
      }
    } else {
      console.warn('⚠️ Campaign Worker not started: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    // Start Sheet Automation Scheduler
    const SheetAutomationService = require('./services/SheetAutomationService');
    setInterval(() => {
      SheetAutomationService.processJobs().catch(e => console.error('[SheetScheduler] Error:', e));
    }, 60000); // Check every minute

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
