# Technical Documentation: CRM Module (Contacts, Pipelines, Groups)

## 1. Overview
The CRM module manages the core business entities: Contacts, Groups, Pipelines, Stages, and Leads. It provides a structured way to organize customer data and track sales processes.

## 2. Database Schema

### 2.1 Contacts & Groups
*   **`contacts`**: Stores individual person details.
    *   `tags`: Array of text tags.
    *   `group_ids`: Array of UUIDs referencing `contact_groups`.
    *   `custom_data`: JSONB column for dynamic fields defined in `custom_fields`.
*   **`contact_groups`**: Logical grouping of contacts (e.g., "VIP", "Newsletter").
*   **`custom_fields`**: Definitions of dynamic fields (Name, Type, Placeholder).

### 2.2 Pipelines & Leads
*   **`pipelines`**: Represents a sales process (e.g., "Sales Pipeline").
*   **`pipeline_stages`**: Steps within a pipeline (e.g., "New", "Qualified", "Closed").
    *   `display_order`: Integer for sorting stages in the UI.
*   **`leads`**: Represents a potential deal or opportunity associated with a contact/person.
    *   `pipeline_id` & `stage_id`: Foreign keys tracking progress.
    *   `estimated_value`: Monetary value of the lead.
    *   `status`: 'active', 'won', 'lost'.

### 2.3 Related Entities
*   **`notes`**: Text notes attached to a lead.
*   **`tasks`**: To-do items with due dates linked to a lead.
*   **`appointments`**: Scheduled events.
*   **`call_logs`**: Records of interactions.

## 3. Server-Side Logic
*   **API Routes**: `server/routes/contacts.js`, `server/routes/pipelines.js`, `server/routes/forms.js`
*   **Database Functions**: `db_sql/master_schema.sql` (Contains `submit_form` logic)

### 3.1 Row Level Security (RLS)
All CRM tables have RLS enabled. Policies generally follow the pattern:
*   **SELECT**: `auth.uid() = user_id` (Users view their own data).
*   **INSERT/UPDATE/DELETE**: `auth.uid() = user_id` (Users manage their own data).

### 3.2 Form Submission Logic (`submit_form` Function)
A critical PostgreSQL function `submit_form` handles public form submissions (which bypass RLS for insertion).
1.  **Validation**: Checks `form_token` and `is_active`.
2.  **Contact Creation**: Creates a new contact with `default_tags` and `default_group_ids` from form settings.
3.  **Lead Creation**: If a pipeline is configured, creates a lead in the specified stage.
4.  **Submission Record**: Logs the raw data in `form_submissions`.

## 4. Client-Side Logic
*   **Pipeline View**: `client/src/components/PipelineView.tsx` (Kanban board for leads)
*   **Contact List**: `client/src/components/ContactList.tsx` (Table view of contacts)
*   **Form Builder**: `client/src/components/FormBuilder.tsx` (Drag-and-drop form creator)
*   **Services**:
    *   `client/src/services/contactService.ts`
    *   `client/src/services/pipelineService.ts`
    *   `client/src/services/formService.ts`

### 4.1 Pipeline View (`PipelineView.tsx`)
*   **Drag-and-Drop**: Uses `react-beautiful-dnd` (or similar) to move leads between stages.
*   **Optimistic Updates**: UI updates immediately while the API call updates the `stage_id` in the background.

### 4.2 Contact List (`ContactList.tsx`)
*   **Filtering**: Client-side or Server-side filtering by Group or Tag.
*   **Custom Fields**: Renders inputs dynamically based on the `custom_fields` definitions.

## 5. Debugging & SQL

### Get All Leads in a Pipeline
```sql
SELECT l.name, s.name as stage, l.estimated_value 
FROM leads l
JOIN pipeline_stages s ON l.stage_id = s.id
WHERE l.pipeline_id = 'YOUR_PIPELINE_ID';
```

### Check Custom Data for a Contact
```sql
SELECT name, custom_data 
FROM contacts 
WHERE custom_data ? 'MyCustomField';
```

### Fix RLS Recursion
If you encounter "infinite recursion" errors in policies, ensure you are not querying the same table within its own policy in a way that creates a loop. Use `auth.uid()` directly instead of joining `users` table if possible.
