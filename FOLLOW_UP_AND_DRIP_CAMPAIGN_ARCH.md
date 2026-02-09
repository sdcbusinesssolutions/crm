# Follow-Up and Advanced Drip Campaign System Architecture

## 1. Overview
This document outlines the architecture for a comprehensive **Follow-Up and Drip Campaign System**. This system will allow users to schedule manual follow-ups and create automated, multi-step drip campaigns with advanced logic.

---

## 2. Database Schema Design

### 2.1. Follow-Ups (Manual & Scheduled)
Table: `follow_ups`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK to Users |
| `contact_id` | UUID | FK to Contacts |
| `title` | TEXT | Short description (e.g., "Call regarding invoice") |
| `description` | TEXT | Detailed notes |
| `scheduled_at` | TIMESTAMP | When the follow-up should happen (UTC) |
| `status` | ENUM | `PENDING`, `COMPLETED`, `MISSED`, `CANCELLED` |
| `priority` | ENUM | `LOW`, `MEDIUM`, `HIGH` |
| `type` | ENUM | `CALL`, `EMAIL`, `WHATSAPP`, `MEETING`, `TASK` |
| `assigned_to` | UUID | FK to User (Team member) |
| `timezone` | TEXT | User's timezone (e.g., "Asia/Kolkata") |
| `recurrence_rule` | JSONB | For repeating follow-ups (Daily, Weekly, custom) |
| `created_at` | TIMESTAMP | |

### 2.2. Drip Campaigns (Headers)
Table: `drip_campaigns`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK to Users |
| `name` | TEXT | Campaign Name |
| `trigger_type` | ENUM | `MANUAL`, `TAG_ADDED`, `NEW_LEAD`, `FORM_SUBMIT` |
| `trigger_config` | JSONB | specific config (e.g. which tag?) |
| `status` | ENUM | `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED` |
| `stop_on_reply` | BOOLEAN | If true, stop drip if user replies |
| `allow_reentry` | BOOLEAN | Can a contact enter this drip multiple times? |
| `created_at` | TIMESTAMP | |

### 2.3. Drip Steps (The Sequence)
Table: `drip_steps`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `drip_campaign_id` | UUID | FK to Drip Campaigns |
| `step_order` | INT | 1, 2, 3... |
| `delay_value` | INT | e.g. 2 |
| `delay_unit` | ENUM | `MINUTES`, `HOURS`, `DAYS`, `WEEKS` |
| `action_type` | ENUM | `SEND_MESSAGE`, `SEND_EMAIL`, `ADD_TAG`, `NOTIFY_ADMIN` |
| `template_id` | UUID | FK to Message Templates (optional) |
| `content` | JSONB | Raw content if not using template |
| `channel` | ENUM | `WHATSAPP`, `EMAIL`, `SMS` |
| `conditions` | JSONB | Logic to execute this step (Branching) |
| `parent_step_id` | UUID | For branching logic (Linked List style) |

### 2.4. Drip Enrollments (Tracking)
Table: `drip_enrollments`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `drip_campaign_id` | UUID | FK to Drip Campaigns |
| `contact_id` | UUID | FK to Contacts |
| `current_step_id` | UUID | The step they are currently waiting on |
| `status` | ENUM | `ACTIVE`, `COMPLETED`, `STOPPED`, `PAUSED` |
| `next_run_at` | TIMESTAMP | When the current step should execute |
| `started_at` | TIMESTAMP | |
| `metadata` | JSONB | Store variables or history |

---

## 3. Core Features Implementation

### 3.1. Follow-Up Scheduling Options
*   **Storage**: Uses `follow_ups` table.
*   **Recurrence**: The `recurrence_rule` column stores specific patterns using a standard format (like RRule) or simple JSON:
    ```json
    {
      "frequency": "WEEKLY",
      "interval": 2, // Every 2 weeks
      "days": ["MON", "WED"], // On Mon and Wed
      "end_date": "2026-12-31"
    }
    ```
*   **Timezones**: Only store UTC in `scheduled_at`. The UI converts to/from `timezone`.

### 3.2. Advanced Drip Campaign Builder
*   **Structure**: A Directed Acyclic Graph (DAG) or Linear Sequence.
*   **Delays**: Calculated relative to the *completion* of the previous step.
*   **Pause/Resume**: Toggle `status` in `drip_campaigns` (global) or `drip_enrollments` (individual).
*   **Cloning**: An API endpoint `POST /drip-campaigns/{id}/clone` will duplicate the campaign and all its steps.

### 3.3. Template Management
*   Extend existing `templates` table (if exists) or create a unified one.
*   **Placeholders**: dynamic replacement `{{name}}`, `{{phone}}` at runtime (Worker level).
*   **Multi-channel**: Store distinct content for `whatsapp_content`, `email_content` in the template structure.

### 3.4. Timezone & Localization
*   **Logic**: When enrolling a contact into a drip, calculate `next_run_at` based on:
    1.  The Campaign's default timezone OR
    2.  The Contact's specific timezone (if available).
*   **"Quiet Hours"**: Optional feature to prevent sending drips at 3 AM user-time.

### 3.5. Manual Follow-Up Tracking
*   **Actions**:
    *   `POST /follow-ups/{id}/complete`: Marks status `COMPLETED`.
    *   `POST /follow-ups`: Creates new.
*   **History**: A `timeline` view in UI showing all interactions (joined with `messages` table).

### 3.6. Smart Automation (Stop on Reply)
*   **Mechanism**:
    *   The **Webhook Handler** (which receives WhatsApp incoming messages) must check:
    *   "Is this user active in any Drip Campaign with `stop_on_reply=true`?"
    *   If yes -> Update `drip_enrollments` status to `STOPPED`.

---

## 4. Scheduler & Worker Architecture

### 4.1. The "Heartbeat" (Cron Job)
A single cron job/scheduler running every **1 Minute**.

### 4.2. Job 1: Process Follow-Ups
1.  Query `follow_ups` where `status = 'PENDING'` AND `scheduled_at <= NOW()`.
2.  **Action**:
    *   If `type` is communication (e.g. Auto-Email): Send it.
    *   If `type` is Task: Send Push Notification/Socket Event to User Dashboard.
3.  Update status to `COMPLETED` (or `MISSED` if older than X hours).
4.  **Recurrence**: If it's a recurring task, immediately create the *next* instance in the `follow_ups` table based on the rule.

### 4.3. Job 2: Process Drip Enrollments
1.  Query `drip_enrollments` where `status = 'ACTIVE'` AND `next_run_at <= NOW()`.
2.  Fetch the `drip_step` associated with `current_step_id`.
3.  **Execute Step**: Send Message / Email / Tag.
4.  **Advance**:
    *   Find next step in `drip_steps` (by `step_order`).
    *   If Next Step exists:
        *   Calculate delay.
        *   Update `drip_enrollments`: `current_step_id = next_step.id`, `next_run_at = NOW() + delay`.
    *   If No Next Step:
        *   Update `drip_enrollments`: `status = 'COMPLETED'`.

---

## 5. UI/UX Requirements

### 5.1. Drip Builder (Canvas)
*   **Library**: React Flow (already used in Flow Builder? Reuse it).
*   **Nodes**: "Delay", "Message", "Condition", "Action".
*   **Drag & Drop**: Easy visual arrangement.

### 5.2. Calendar View
*   **Library**: `react-big-calendar` or `FullCalendar`.
*   Shows: Manual Follow-ups + Expected Drip steps (optional).

### 5.3. Kanban Board
*   Cols: `To Do`, `Overdue`, `Completed`.
*   Cards: Follow-up items.

---

## 6. API Endpoints (Draft)

### Campaigns
*   `GET /api/drips`
*   `POST /api/drips`
*   `POST /api/drips/:id/steps`
*   `POST /api/drips/:id/enroll` (Bulk enrollment)

### Follow-Ups
*   `GET /api/follow-ups?date=2026-02-10`
*   `POST /api/follow-ups`
*   `PATCH /api/follow-ups/:id/status`

### Analytics
*   `GET /api/analytics/drips/:id` (Stats: Enrolled, Completed, Replied)

---

## 7. Bulk Operations
*   **CSV Import**: Parse CSV -> Map Columns -> `POST /api/contacts/bulk` -> `POST /api/drips/:id/enroll`.

---
