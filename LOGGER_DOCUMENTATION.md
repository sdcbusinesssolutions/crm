# Logger Documentation: Persistence & Structure

## Overview
The application uses a robust, file-based logging system designed to ensure **persistence across deployments** and efficiently manage log sizes through **daily rotation** and **automatic partitioning**.

This system is critical for tracking:
- **Campaign Activity**: Message sends, delivery status, costs.
- **Inbox Messages**: Incoming/Outgoing message history.
- **Flows/WhatsApp Forms**: Form interaction and submission logs.
- **CRM Activity**: Lead creation, pipeline movements, task updates.
- **Template Management**: Creation, sync, and updates of WhatsApp templates.
- **Web Form Builder**: Form design changes and public submissions.

---

## 1. Log Persistence (Safe Deployments)
Originally, logs were stored inside the application container (`/app/server/logs`). This caused logs to be deleted whenever a new deployment replaced the container.

**The Fix:**
- Logs are now stored on the **HOST Machine** in a dedicated folder called `server_logs` at the project root.
- The `docker-compose.yml` mounts this folder into the container:
  ```yaml
  volumes:
    - ./server_logs:/app/server/logs
  ```
- **Result**: You can deploy, restart, or rebuild containers endlessly. The `server_logs` folder on your server will strictly **keep all history**.

---

## 2. Log File Structure & Verification
Logs are stored in `f:\whatsapp\Final-Project-Wp\wpcode\server_logs\` (or `./server_logs` on Linux).

### Naming Convention
Files follow this pattern:
`{log_type}_{DD-MM-YYYY}_part{X}.log`

- **Date**: A new file is automatically created when the date changes (e.g., `01-01-2026` -> `02-01-2026`).
- **Part**: If a single file exceeds its size limit (e.g., 2MB), it is closed, and `_part2.log` is created. **Old parts are NEVER deleted.**

### Example File List
```text
campaign_requests_02-01-2026_part1.log
campaign_requests_02-01-2026_part2.log  <-- Created when part1 got full
inbox_messages_02-01-2026_part1.log
crm_logs_02-01-2026_part1.log
template_logs_02-01-2026_part1.log
```

---

## 3. Supported Log Types

| Log Name (Prefix) | Function Used | Purpose | Max Size |
| :--- | :--- | :--- | :--- |
| `campaign_requests` | `logCampaignRequest` | Logs every template message sent via campaigns. | 10 MB |
| `inbox_messages` | `logInboxMessage` | Logs standard chat messages (text, media) in Inbox. | 5 MB |
| `flow_logs` | `logFlowEvent` | Logs WhatsApp Flow (JSON) logic & validation errors. | 2 MB |
| `onboarding_logs` | `logOnboardingEvent` | Logs WABA connection & setup events. | 2 MB |
| `template_logs` | `logTemplateEvent` | Logs creation, editing, deleting, & syncing of Templates. | 2 MB |
| `crm_logs` | `logCRMEvent` | Logs CRM actions: Leads, Pipelines, Stages, Tasks. | 5 MB |
| `form_builder_logs` | `logFormBuilderEvent` | Logs creation & submission of Web Forms. | 2 MB |
| `whatsapp_form_logs` | `logWhatsAppFormEvent` | Logs creation & sending of WhatsApp Flows. | 2 MB |

---

## 4. Usage Guide (For Developers)

To use the logger in a new feature, import the relevant function from `server/utils/logger.js`.

### Example: Logging a CRM Event
```javascript
const { logCRMEvent } = require('../utils/logger');

// Usage inside a route
router.post('/lead', async (req, res) => {
    // ... create lead logic ...
    
    // Log the event safely
    try {
        logCRMEvent('CREATE_LEAD', {
            leadId: newLead.id,
            name: newLead.name,
            source: 'Manual Entry'
        });
    } catch (e) {
        // Logging should never block the main thread or cause a crash
        console.error('Logging failed:', e);
    }
});
```

### Configuration
You can adjust file size limits in `server/utils/logger.js`:
```javascript
const MAX_CAMPAIGN_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CRM_LOG_SIZE = 5 * 1024 * 1024;      // 5MB
```

---

## 5. Deployment Checklist
When deploying to a new server, ensure:
1. The **`server_logs` directory exists** on the host. (The auto-deploy script handles this: `mkdir -p server_logs`).
2. **Permissions** are set correctly so Docker can write to it:
   ```bash
   chown -R 1000:1000 server_logs
   ```
3. **`docker-compose.yml`** maps the volume correctly.

**Status**: ✅ System is configured correctly. Logging is safe, persistent, and organized.
