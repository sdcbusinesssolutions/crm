# Email Modal Flow Diagram

```
┌─────────────────────────────────────────────┐
│  User clicks email icon on lead card       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         EmailModal Component Opens          │
│  ┌────────────────┐  ┌──────────────────┐  │
│  │ Load Gmail     │  │ Load SMTP        │  │
│  │ Connections    │  │ Connections      │  │
│  └────────┬───────┘  └────────┬─────────┘  │
│           └──────────┬─────────┘            │
│                      │                       │
│  ┌──────────────────▼──────────────────┐   │
│  │ Auto-select first connection        │   │
│  │ Pre-fill recipient email & name     │   │
│  └─────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         User Interaction                    │
│  • Select connection type (Gmail/SMTP)      │
│  • Choose specific connection               │
│  • Edit To, Subject, Body fields            │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      User clicks "Send Email" button        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
              ┌─────────┐
              │Validate?│
              └────┬────┘
                   │
        ┌──────────┴──────────┐
        │                     │
       No                    Yes
        │                     │
        ▼                     ▼
┌──────────────┐    ┌────────────────────────┐
│ Show Error   │    │ Call Integration       │
│ Notification │    │ Service                │
└──────┬───────┘    └────────┬───────────────┘
       │                     │
       │            ┌────────┴────────┐
       │            │                 │
       │         Gmail              SMTP
       │            │                 │
       │            ▼                 ▼
       │  ┌──────────────┐  ┌──────────────┐
       │  │ POST /api/   │  │ POST /api/   │
       │  │ integrations/│  │ integrations/│
       │  │ gmail/send   │  │ smtp/send    │
       │  └──────┬───────┘  └──────┬───────┘
       │         └────────┬─────────┘
       │                  │
       │                  ▼
       │            ┌──────────┐
       │            │Success?  │
       │            └────┬─────┘
       │                 │
       │        ┌────────┴────────┐
       │        │                 │
       │       No                Yes
       │        │                 │
       │        ▼                 ▼
       │  ┌──────────┐    ┌──────────────┐
       └─▶│  Error   │    │   Success    │
          │Notification│  │ Notification │
          └──────────┘    └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ Close Modal  │
                          │ (auto-close) │
                          └──────────────┘
```

## Component Architecture

```
PipelineView.tsx
├── EmailModal.tsx
│   ├── Modal (wrapper)
│   ├── Connection Type Toggle (Gmail/SMTP)
│   ├── Connection Selector Dropdown
│   ├── Form Fields
│   │   ├── To (email input)
│   │   ├── Subject (text input)
│   │   └── Body (textarea)
│   └── Notification Modal
│       ├── Success Icon
│       ├── Error Icon
│       └── Info Icon
└── Lead Card
    └── Email Icon Button
```

## Data Flow

```
┌──────────────────┐
│  Lead Card Data  │
│  • email         │
│  • name          │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│  EmailModal Props        │
│  • recipientEmail        │
│  • recipientName         │
│  • isOpen                │
│  • onClose               │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  integrationsService     │
│  • getGmailConnections() │
│  • getSmtpConnections()  │
│  • sendGmailEmail()      │
│  • sendSmtpEmail()       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Backend API Routes      │
│  • /gmail/connections    │
│  • /smtp/connections     │
│  • /gmail/send           │
│  • /smtp/send            │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Email Services          │
│  • GmailService          │
│  • SmtpService           │
└──────────────────────────┘
```

## State Management

```
PipelineView State:
├── isEmailModalOpen: boolean
└── emailRecipient: { email: string, name: string }

EmailModal State:
├── emailType: 'gmail' | 'smtp'
├── gmailConnections: Array<Connection>
├── smtpConnections: Array<Connection>
├── selectedConnection: string
├── to: string
├── subject: string
├── body: string
├── sending: boolean
├── loading: boolean
└── notification: { isOpen, title, message, type }
```
