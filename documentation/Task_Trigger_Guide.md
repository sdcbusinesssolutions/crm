# Task Trigger Node Guide (v2.0)

The **Task Trigger Node** allows you to automate WhatsApp messages based on your CRM Tasks (Follow-ups). This effectively turns your CRM into an automated assistant.

## 1. Trigger Types
You can configure the node to fire at different stages of a task's lifecycle.

| Trigger Event | Description | Best For |
| :--- | :--- | :--- |
| **When Task is Due** | Fires exactly at the Due Date/Time. | "Meeting is starting now" alerts. |
| **Upcoming (Before Due)** | Fires X minutes/hours **BEFORE** the due time. | "Reminder: Call in 1 hour". |
| **Overdue (Missed)** | Fires X minutes/hours **AFTER** the due time if still incomplete. | "Urgent: You missed a follow-up!" escalations. |
| **When Task is Completed**| Fires immediately when you mark a task as 'Done'. | "Thanks for the call" automated messages. |

> **Common Confusion: "Dashboard Upcoming" vs "Trigger Upcoming"**
> *   **Dashboard Tab:** "Upcoming" simply lists tasks due in *future days*.
> *   **Flow Trigger:** "Upcoming" is a strict timer.
> *   *Example:* If a task is due today at **9:25 PM**, and you set an "Upcoming: 1 Hour" trigger, the message **WILL** fire at **8:25 PM**, even if the dashboard shows the task under "Due Today" and not "Upcoming".

---

## 2. Example Use Cases

### Scenario A: The "Call Reminder" (Before)
You want to remind yourself (or the client) 1 hour before a scheduled call.
1.  **Add Node:** Task Trigger
2.  **Settings:**
    *   Trigger Event: **Upcoming (Before Due)**
    *   Time: **1 Hour Before**
    *   Filter Title: `Call` (Only triggers for tasks named "Call...")
3.  **Connect to:** Text Message
    *   Content: *"Hi {{contact.name}}, looking forward to our call in 60 minutes regarding '{{trigger.title}}'."*

### Scenario B: The "Missed Task" Recovery (After)
You want to ensure no lead is left behind if you forget a task.
1.  **Add Node:** Task Trigger
2.  **Settings:**
    *   Trigger Event: **Overdue (Missed)**
    *   Time: **24 Hours (1 Day) Late**
3.  **Connect to:** Text Message (Internal or to Client)
    *   Content: *"Hi {{contact.name}}, apologies I missed reaching out yesterday. Are you free now?"*

### Scenario C: The "Post-Meeting" Automation (Completed)
You finish a call and want to send a summary instantly.
1.  **Add Node:** Task Trigger
2.  **Settings:**
    *   Trigger Event: **When Task is Completed**
    *   Filter Title: `Demo`
3.  **Connect to:** Template Message
    *   Template: `post_demo_summary` (contains PDF link)
    *   Variable 1: `{{contact.name}}`

---

## 3. Available Variables (Dynamic Data)
These variables are available in the dropdown of any node connected to the Task Trigger.

#### **Task Details**
| Variable | Code | Description |
| :--- | :--- | :--- |
| **Title** | `{{trigger.title}}` | The main subject (e.g., "Contract Review") |
| **Description** | `{{trigger.description}}` | Notes you added to the task |
| **Due Date** | `{{trigger.dueDate}}` | ISO Format (e.g., "2024-10-25T14:00:00") |
| **Trigger Type**| `{{trigger.triggerType}}`| e.g., `task_upcoming`, `task_overdue` |

#### **Contact Details**
| Variable | Code | Description |
| :--- | :--- | :--- |
| **Name** | `{{contact.name}}` | Full name of the contact |
| **Phone** | `{{contact.phone}}` | Phone number (e.g., "1234567890") |
| **Email** | `{{contact.email}}` | Contact's email |

---

## 4. Setup Checklist
1.  **Database Config:** Ensure your Admin has enabled the `reminder_sent` and `metadata` columns in the Tasks table. (This standardizes the locks to prevent duplicate messages).
2.  **Scheduler:** The system checks for tasks every **60 seconds**.
