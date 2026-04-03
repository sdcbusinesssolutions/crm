# Multi-Number WhatsApp Support: System-Wide Deep Analysis

This document identifies every specific file and logic gate that must be updated to transition from "One User = One Number" to "One User = Multiple Managed Numbers."

---

## 🏗️ 1. Database & Schema Architecture
**Priority: High (Foundation)**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| **Supabase SQL** | `conversations` table | Change unique constraint from `(user_id, contact_phone)` to `(user_id, contact_phone, phone_number_id)`. |
| **Supabase SQL** | `messages` table | Add `phone_number_id` column to track which business number sent/received the message. |
| **Supabase SQL** | `whatsapp_config` | Ensure `phone_number_id` is indexed and unique per `user_id`. |

---

## 💧 2. Drip Builder (Automation)
**Priority: High (Active Development)**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| `client/src/components/FollowUps/FollowUpForm.tsx` | UI State & Render | Add `selectedPhoneNumberId` and a `<select>` dropdown in the form. |
| `client/src/components/FollowUps/FollowUpForm.tsx` | Save Payload | Include `phone_number_id` in the `onSave` object passed to the parent. |
| `server/services/dripProcessor.js` | Message Execution | Update `processQueue` to read `phone_number_id` from the drip step JSON and pass it to `whatsappService.sendMessage`. |

---

## 📥 3. Inbox & Messaging
**Priority: Critical (Data Integrity)**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| `server/routes/webhook.js` | Message Ingestion | Pass the `extracted.phoneNumberId` from the Meta payload into `flowEngine.processMessage`. |
| `server/routes/webhook.js` | Conversation Lookup | Query `conversations` using `user_id`, `contact_phone`, AND `phone_number_id`. |
| `server/routes/inbox.js` | Fetch Conversations | Update the `GET /` route to filter by a specific `phone_number_id` if provided by the client filter. |
| `client/src/components/Inbox.tsx` | Viewport Logic | Add a header dropdown to switch between "All Channels" or specific WhatsApp numbers. |

---

## ⚡ 4. Flow Builder (Chatbots)
**Priority: High**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| `server/services/flowEngine.js` | Config Retrieval | Ensure the `getBusinessConfig` cache key includes the `phoneNumberId`. |
| `server/services/flowEngine.js` | Context Hub | Update `startFlow` to accept an explicit `phoneNumberId` instead of picking the "first available" one. |
| `client/src/components/FlowBuilder/NodeSettings.tsx` | Node Configuration | For "Send Template" nodes, add an option: "Send via [Received Number / Specific Number]". |

---

## 📋 5. Template Management
**Priority: Medium**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| `server/routes/whatsapp_templates.js` | `getWhatsAppConfig` | Remove `.single()`/`.limit(1)`. Change to accept `phoneNumberId` to fetch the correct WABA token. |
| `server/routes/whatsapp_templates.js` | Sync Logic | Allow syncing templates for a specific `wabaId` provided in the query string. |
| `client/src/components/WhatsAppTemplates/TemplateList.tsx` | Filtering | Add a top-level dropdown: "Show templates for [WhatsApp Number A / B]". |

---

## 📊 6. Dashboard & Analytics
**Priority: Low**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| `server/routes/dashboard.js` | Config Fetch | Remove `.limit(1)`. Add filter for `phoneNumberId`. |
| `server/routes/dashboard.js` | Traffic Queries | Update the `messages` count query to selectively filter by `phone_number_id`. |
| `client/src/components/Dashboard.tsx` | Global Sync | Add a state wrapper to refresh the entire dashboard when a different number is selected. |

---

## 🛡️ 7. Core Services (Hidden Impacts)
**Priority: High**

| File Path | Impacted Logic | Required Change |
| :--- | :--- | :--- |
| `server/services/whatsappService.js` | `getConfig` | Change cache key to `user_id_phoneNumberId` to avoid token collision. |
| `client/src/components/Settings/WhatsAppSettings.tsx` | Account Management | Update UI from "Single Connection" to a list of connected accounts. |
| `server/services/FacebookLeadService` | Lead Enrollment | Add mapping logic to determine which WA number replies to a specific FB Lead Form. |

---
