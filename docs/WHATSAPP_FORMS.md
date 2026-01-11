# WhatsApp Forms & Flow Builder Documentation

## Overview
The WhatsApp Forms feature allows users to create, manage, preview, and send WhatsApp Flows directly from the application. It integrates with the Meta Graph API to handle flow lifecycle management (creation, publishing, deprecation, deletion) and provides a visual drag-and-drop builder for designing flow screens.

## Features

### 1. WhatsApp Form Builder
The Form Builder is a visual tool for creating multi-screen WhatsApp Flows.
- **Drag & Drop Interface**: Add components like Text, Inputs, Dropdowns, and Date Pickers.
- **Screen Management**: Add, delete, and navigate between multiple screens (up to 8).
- **Component Properties**: Customize labels, helper text, required status, and options for each component.
- **Live Preview**: See a mobile-like preview of the current screen as you build.
- **JSON Generation**: Automatically generates the Meta-compliant Flow JSON structure.

### 2. Preview Functionality
Users can preview flows in two ways:
- **In-App Preview**: A modal displays the flow using the `preview_url` provided by Meta.
    - **Source**: The `preview_url` is retrieved via the `GET /api/whatsapp/forms/:id` endpoint (which calls Meta's `GET /{flow_id}?fields=preview`).
    - **Usage**: This URL is embedded in an `iframe` within the application.
    - *Note*: Draft flows may not always have a preview URL immediately available until processed by Meta.
- **Preview Link**: Generates a `whatsapp://flow?id=...` deep link for testing directly on a mobile device with the WhatsApp app (requires Meta testing environment setup).

### 3. Send Flow
Allows sending a specific flow to one or more phone numbers for testing or production use.
- **Inputs**:
    - **Phone Numbers**: Comma-separated list of recipient numbers (with country code).
    - **Header**: Optional header text for the message.
    - **Body**: Main message body.
    - **Footer**: Optional footer text.
- **Process**: The backend constructs a template-like message containing the Flow token and ID and sends it via the WhatsApp Business API.

### 4. Edit & Manage
- **Edit**: Opens the Flow Builder with the current flow's JSON loaded for modification.
- **Rename/Categorize**: Update flow metadata.
- **Publish**: Changes flow status from `DRAFT` to `PUBLISHED`. *Note: Published flows cannot be edited, only deprecated.*
- **Deprecate**: Archives a published flow.
- **Delete**: Permanently removes the flow from Meta and the local list.

---

## API Endpoints
The following endpoints are implemented in `server/routes/whatsapp_forms.js` to handle communication with the Meta Graph API.

### Base URL: `/api/whatsapp/forms`

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/` | **List Flows**<br>Fetches all flows from the WhatsApp Business Account.<br>Returns: `id`, `name`, `status`, `categories`, `validation_errors`, `preview`. |
| **GET** | `/:id` | **Get Flow Details**<br>Fetches details for a specific flow, including its current JSON assets and preview URL. |
| **POST** | `/` | **Create Flow**<br>Creates a new flow container on Meta.<br>Body: `{ name, categories }` |
| **POST** | `/:id` | **Update Metadata**<br>Updates the name or categories of a flow.<br>Body: `{ name, categories }` |
| **POST** | `/:id/json` | **Update Flow JSON**<br>Updates the visual structure (screens/components) of the flow.<br>Body: `{ flow_json }` |
| **POST** | `/:id/publish` | **Publish Flow**<br>Commits the draft to production. The flow becomes immutable. |
| **POST** | `/:id/deprecate` | **Deprecate Flow**<br>Marks a published flow as deprecated. |
| **DELETE** | `/:id` | **Delete Flow**<br>Permanently deletes the flow from the WhatsApp Business Account. |
| **POST** | `/:id/send` | **Send Flow**<br>Sends the flow to recipients.<br>Body: `{ phoneNumberId, phoneNumbers, headerText, bodyText, footerText }`<br>Logic: Fetches the flow's first screen ID (or defaults to `screen_start`) and sends a message of type `interactive/flow`. |

## Technical Implementation Details

### Authentication
- All requests require a valid Supabase session (`Authorization: Bearer <token>`).
- The backend retrieves the `whatsapp_business_account_id` and `access_token` from the `whatsapp_config` table for the authenticated user.

### Error Handling
- **Preview**: If `preview_url` is missing (common for new Drafts), the UI displays a helpful message.
- **Sending**: The backend validates phone numbers and reports success/failure counts.
- **Meta API**: Errors from Meta (e.g., invalid JSON, permission issues) are caught and returned with descriptive messages to the frontend.

### Component Mapping
The frontend `WhatsAppFormBuilder` maps internal component types to Meta's Flow JSON types:
- `ShortAnswer` -> `TextInput`
- `Paragraph` -> `TextArea`
- `SingleChoice` -> `RadioButtonsGroup`
- `MultipleChoice` -> `CheckboxGroup`
- `Dropdown` -> `Dropdown`
- `DatePicker` -> `DatePicker`
- `OptIn` -> `OptIn`
