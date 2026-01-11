# WhatsApp Flow Builder - Project Structure & Flow Hierarchy

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Root Structure](#root-structure)
3. [Frontend Architecture (Client)](#frontend-architecture-client)
4. [Backend Architecture (Server)](#backend-architecture-server)
5. [Database Layer](#database-layer)
6. [Application Flow](#application-flow)
7. [API Flow](#api-flow)
8. [Authentication Flow](#authentication-flow)
9. [Data Flow Diagram](#data-flow-diagram)

---

## 🎯 Project Overview

**Project Name:** WhatsApp Flow Builder Monorepo  
**Version:** 1.0.0  
**Architecture:** Full-Stack Monorepo (Frontend + Backend + Database)  
**Tech Stack:**
- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express.js
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Netlify (Frontend) + Serverless Functions (Backend)

---

## 📁 Root Structure

```
wpcode/
├── 📂 client/                    # Frontend React Application
├── 📂 server/                    # Backend REST API (Express.js)
├── 📂 db_sql/                    # Database Schema & Migration Scripts
├── 📂 doc/                       # Project Documentation
├── 📂 .netlify/                  # Netlify Deployment Configuration
├── 📄 package.json               # Root package.json (monorepo scripts)
├── 📄 netlify.toml               # Netlify deployment config
├── 📄 run_local.bat              # Windows startup script
├── 📄 run_local.ps1              # PowerShell startup script
├── 📄 run_local.sh               # Linux/Mac startup script
└── 📄 README.md                  # Project documentation
```

### Root Scripts
```json
{
  "postinstall": "Install dependencies for both client and server",
  "build": "Build the client application",
  "start": "Start the server",
  "clean:legacy": "Remove legacy files"
}
```

---

## 🎨 Frontend Architecture (Client)

### Client Directory Structure

```
client/
├── 📂 src/                       # Source code
│   ├── 📂 components/            # React Components
│   │   ├── AuthPage.tsx          # Authentication UI
│   │   ├── Dashboard.tsx         # Main Dashboard
│   │   ├── FlowEditor.tsx        # Visual Flow Builder
│   │   ├── FormBuilder.tsx       # Dynamic Form Builder
│   │   ├── PipelineView.tsx      # Lead Pipeline Management
│   │   ├── ContactList.tsx       # Contact Management
│   │   ├── ContactGroups.tsx     # Group Management
│   │   ├── Inbox.tsx             # Message Inbox
│   │   ├── WhatsAppNumbers.tsx   # WhatsApp Number Config
│   │   ├── GlobalSettings.tsx    # App Settings
│   │   ├── DatabaseSetup.tsx     # DB Setup Wizard
│   │   ├── Canvas.tsx            # Flow Canvas
│   │   ├── Node.tsx              # Flow Node Component
│   │   ├── NodesPanel.tsx        # Node Selection Panel
│   │   ├── SettingsPanel.tsx     # Settings Panel
│   │   ├── InputFields.tsx       # Custom Input Fields
│   │   ├── Sidebar.tsx           # Navigation Sidebar
│   │   ├── Navigation.tsx        # Navigation Component
│   │   ├── Modal.tsx             # Modal Dialog
│   │   ├── Toast.tsx             # Toast Notifications
│   │   └── icons.tsx             # Icon Components
│   │
│   ├── 📂 services/              # API Service Layer
│   │   ├── contactService.ts     # Contact CRUD operations
│   │   ├── contactGroupService.ts # Group CRUD operations
│   │   ├── flowService.ts        # Flow CRUD operations
│   │   ├── inputFieldService.ts  # Custom fields operations
│   │   ├── lead-management-api.ts # Lead/Pipeline API
│   │   ├── themeService.ts       # Theme management
│   │   └── whatsappService.ts    # WhatsApp integration
│   │
│   ├── 📂 lib/                   # Utility Libraries
│   │   └── supabase.ts           # Supabase client config
│   │
│   ├── 📂 types/                 # TypeScript Type Definitions
│   │   └── index.ts              # Shared types
│   │
│   ├── App.tsx                   # Root App Component
│   ├── main.tsx                  # Application Entry Point
│   ├── types.ts                  # Global type definitions
│   └── index.css                 # Global styles
│
├── 📂 public/                    # Static Assets
├── 📂 dist/                      # Build Output (generated)
├── index.html                    # HTML Template
├── vite.config.ts                # Vite Configuration
└── package.json                  # Client Dependencies
```

### Frontend Component Hierarchy

```
App.tsx (Root)
├── AuthPage.tsx (Unauthenticated)
│   └── Login/Signup Forms
│
└── Authenticated Layout
    ├── Sidebar.tsx
    │   └── Navigation Menu
    │
    └── Main Content Area
        ├── Dashboard.tsx
        │   ├── Flow Cards
        │   ├── Analytics
        │   └── Quick Actions
        │
        ├── FlowEditor.tsx
        │   ├── Canvas.tsx
        │   ├── NodesPanel.tsx
        │   ├── SettingsPanel.tsx
        │   └── Node.tsx (multiple)
        │
        ├── FormBuilder.tsx
        │   ├── Form Designer
        │   ├── Field Configuration
        │   └── Preview Panel
        │
        ├── PipelineView.tsx
        │   ├── Pipeline Stages
        │   ├── Lead Cards
        │   └── Stage Management
        │
        ├── Contacts.tsx
        │   ├── ContactList.tsx
        │   ├── ContactGroups.tsx
        │   └── InputFields.tsx
        │
        ├── Inbox.tsx
        │   ├── Conversation List
        │   └── Message Thread
        │
        ├── WhatsAppNumbers.tsx
        │   └── Number Configuration
        │
        └── GlobalSettings.tsx
            ├── Theme Settings
            ├── Organization Settings
            └── User Preferences
```

### Frontend Service Layer Flow

```
Component → Service → Supabase Client → Database
   ↓          ↓           ↓                ↓
UI Logic   API Calls   Auth/RLS      PostgreSQL
```

**Example Flow:**
```typescript
ContactList.tsx
  → contactService.getContacts()
    → supabase.from('contacts').select()
      → Supabase API (with RLS)
        → PostgreSQL Database
          → Returns filtered data
```

---

## 🔧 Backend Architecture (Server)

### Server Directory Structure

```
server/
├── 📂 routes/                    # API Route Handlers
│   ├── contacts.js               # Contact endpoints
│   ├── groups.js                 # Group endpoints
│   ├── fields.js                 # Custom field endpoints
│   ├── form.js                   # Form endpoints
│   └── flows.js                  # Flow endpoints
│
├── 📂 models/                    # Data Models (Legacy)
│   ├── Contact.js                # Contact model
│   └── Flow.js                   # Flow model
│
├── 📂 lib/                       # Shared Libraries
│   └── supabaseClient.js         # Supabase server client
│
├── server.js                     # Express App & Entry Point
├── package.json                  # Server Dependencies
└── .env.example                  # Environment variables template
```

### Server Architecture Layers

```
┌─────────────────────────────────────────┐
│         Express Application             │
│            (server.js)                  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│          Middleware Layer               │
│  • CORS                                 │
│  • JSON Parser (10mb limit)             │
│  • Authentication (requireAuth)         │
│  • Request Logging                      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│           Router Layer                  │
│  /api/status        (Public)            │
│  /api/users/me      (Protected)         │
│  /api/forms/*       (Public)            │
│  /api/contacts/*    (Protected)         │
│  /api/groups/*      (Protected)         │
│  /api/fields/*      (Protected)         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Route Handlers                  │
│  (routes/*.js)                          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Supabase Client                    │
│  (lib/supabaseClient.js)                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Supabase Database                  │
│      (PostgreSQL + RLS)                 │
└─────────────────────────────────────────┘
```

### API Endpoints

#### Public Endpoints
```
GET  /api/status                  # Health check
POST /api/forms/submit            # Submit form data
GET  /api/forms/:id               # Get form by ID
```

#### Protected Endpoints (Require Authentication)
```
# User
GET  /api/users/me                # Get current user

# Contacts
GET    /api/contacts              # List contacts
POST   /api/contacts              # Create contact
PUT    /api/contacts/:id          # Update contact
DELETE /api/contacts/:id          # Delete contact
POST   /api/contacts/bulk         # Bulk import contacts

# Groups
GET    /api/groups                # List groups
POST   /api/groups                # Create group
PUT    /api/groups/:id            # Update group
DELETE /api/groups/:id            # Delete group

# Fields
GET    /api/fields                # List custom fields
POST   /api/fields                # Create field
PUT    /api/fields/:id            # Update field
DELETE /api/fields/:id            # Delete field
```

---

## 🗄️ Database Layer

### Database Structure

```
db_sql/
├── 📄 schema.sql                 # Core schema
├── 📄 lead_management_schema.sql # Lead/Pipeline schema
├── 📄 fix_rls_and_update.sql     # RLS fixes
├── 📄 fix_rls_recursion_safe.sql # Safe RLS fix
├── 📄 check_db_health.sql        # Health check queries
├── 📄 SIMPLE_FIX.sql             # Quick fixes
├── 📄 SCHEMA_DIAGRAM.md          # Schema documentation
├── 📄 SETUP_GUIDE.md             # Setup instructions
└── 📄 LEAD_MANAGEMENT_README.md  # Lead system docs
```

### Database Tables (Supabase/PostgreSQL)

```
┌─────────────────────────────────────────┐
│         Authentication Layer            │
│  • auth.users (Supabase managed)        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Organization Layer              │
│  • organizations                        │
│  • organization_members                 │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Core Data Layer                 │
│  • flows                                │
│  • contacts                             │
│  • contact_groups                       │
│  • contact_group_members                │
│  • input_fields                         │
│  • whatsapp_numbers                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Lead Management Layer              │
│  • pipelines                            │
│  • pipeline_stages                      │
│  • leads                                │
│  • lead_activities                      │
│  • forms                                │
│  • form_fields                          │
│  • form_submissions                     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Messaging Layer                 │
│  • conversations                        │
│  • messages                             │
└─────────────────────────────────────────┘
```

### Row Level Security (RLS) Policies

All tables implement RLS policies based on:
- **User Authentication:** `auth.uid()`
- **Organization Membership:** User must belong to the organization
- **Role-Based Access:** Admin, Member, Viewer roles

---

## 🔄 Application Flow

### 1. Application Startup Flow

```
User Opens Browser
       ↓
   index.html loads
       ↓
   main.tsx executes
       ↓
   App.tsx renders
       ↓
Check Session (useEffect)
       ↓
   ┌─────────────┐
   │ Has Session?│
   └─────────────┘
    ↓           ↓
   YES          NO
    ↓           ↓
Dashboard   AuthPage
```

### 2. Authentication Flow

```
AuthPage.tsx
    ↓
User enters email
    ↓
Supabase.auth.signInWithOtp()
    ↓
Email sent with magic link
    ↓
User clicks link
    ↓
Redirect to app with token
    ↓
onAuthStateChange fires
    ↓
Session established
    ↓
App.tsx re-renders
    ↓
Dashboard shown
```

### 3. Data Fetching Flow

```
Component Mount
    ↓
useEffect hook
    ↓
Call Service Function
    ↓
Service → Supabase Client
    ↓
Supabase applies RLS
    ↓
Query PostgreSQL
    ↓
Return filtered data
    ↓
Update component state
    ↓
Re-render UI
```

### 4. Form Submission Flow (FormBuilder)

```
User designs form in FormBuilder.tsx
    ↓
Configure fields & settings
    ↓
Click "Save Form"
    ↓
POST to Supabase 'forms' table
    ↓
Generate unique form ID
    ↓
Create shareable URL
    ↓
External user visits URL
    ↓
Render form from config
    ↓
User submits form
    ↓
POST /api/forms/submit (Public endpoint)
    ↓
Save to 'form_submissions' table
    ↓
Create lead in 'leads' table
    ↓
Trigger notifications
    ↓
Show in Dashboard/Pipeline
```

### 5. Pipeline/Lead Management Flow

```
Dashboard → PipelineView.tsx
    ↓
Load pipelines from DB
    ↓
Display stages (columns)
    ↓
Load leads for each stage
    ↓
User drags lead to new stage
    ↓
Update lead.stage_id
    ↓
Create activity record
    ↓
Real-time update via Supabase
    ↓
UI reflects change
```

### 6. Contact Management Flow

```
Contacts.tsx
    ↓
Tab Selection (Contacts/Groups/Fields)
    ↓
Load data via service
    ↓
Display in table/grid
    ↓
User clicks "Add Contact"
    ↓
Modal opens
    ↓
Fill form with custom fields
    ↓
Submit → contactService.createContact()
    ↓
POST to Supabase
    ↓
RLS validates organization
    ↓
Insert into 'contacts' table
    ↓
Return new contact
    ↓
Update UI list
```

---

## 🌐 API Flow

### REST API Request Flow

```
Client Request
    ↓
┌─────────────────────────────────────┐
│  Express Server (server.js)         │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  CORS Middleware                    │
│  (Allow cross-origin requests)      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  JSON Parser Middleware             │
│  (Parse request body, 10mb limit)   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Authentication Middleware          │
│  (requireAuth - if protected route) │
│  • Extract Bearer token             │
│  • Validate with Supabase           │
│  • Attach user to req.user          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Route Handler                      │
│  (routes/*.js)                      │
│  • Validate request                 │
│  • Business logic                   │
│  • Database operations              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Supabase Client                    │
│  • Apply RLS policies               │
│  • Execute query                    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  PostgreSQL Database                │
│  • Execute SQL                      │
│  • Return results                   │
└─────────────────────────────────────┘
    ↓
Response sent to client
```

### Example: Create Contact API Flow

```
POST /api/contacts
Headers: {
  Authorization: "Bearer <token>",
  Content-Type: "application/json"
}
Body: {
  name: "John Doe",
  phone: "+1234567890",
  email: "john@example.com"
}

    ↓
server.js receives request
    ↓
CORS middleware (allow)
    ↓
JSON parser (parse body)
    ↓
requireAuth middleware
  → Extract token
  → supabase.auth.getUser(token)
  → Validate user
  → req.user = userData
    ↓
Route: /contacts → routes/contacts.js
    ↓
Handler: POST /
  → Validate input
  → Extract organization_id from user
  → Call Supabase:
    supabase.from('contacts').insert({
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      organization_id: req.user.organization_id
    })
    ↓
Supabase applies RLS
  → Check: user belongs to organization
  → Check: user has insert permission
    ↓
PostgreSQL executes INSERT
    ↓
Return new contact record
    ↓
Response: 201 Created
{
  id: "uuid",
  name: "John Doe",
  phone: "+1234567890",
  email: "john@example.com",
  created_at: "2025-11-25T10:00:00Z"
}
```

---

## 🔐 Authentication Flow

### Client-Side Authentication

```
1. User enters email in AuthPage.tsx
    ↓
2. supabase.auth.signInWithOtp({
     email: userEmail,
     options: {
       emailRedirectTo: window.location.origin
     }
   })
    ↓
3. Supabase sends magic link email
    ↓
4. User clicks link in email
    ↓
5. Redirected to app with #access_token=...
    ↓
6. App.tsx useEffect detects hash
    ↓
7. supabase.auth.getSession()
    → Processes hash
    → Establishes session
    → Stores in localStorage
    ↓
8. onAuthStateChange fires
    → event: 'SIGNED_IN'
    → session: { user, access_token, ... }
    ↓
9. setSession(session)
    ↓
10. App re-renders → Dashboard shown
```

### Server-Side Authentication

```
1. Client makes API request
   Headers: { Authorization: "Bearer <access_token>" }
    ↓
2. requireAuth middleware intercepts
    ↓
3. Extract token from header
   const token = authHeader.split(' ')[1]
    ↓
4. Validate with Supabase
   const { data, error } = await supabase.auth.getUser(token)
    ↓
5. Check validation result
   ┌─────────────┐
   │   Valid?    │
   └─────────────┘
    ↓           ↓
   YES          NO
    ↓           ↓
Attach user   401 Unauthorized
to request    (return error)
    ↓
6. Continue to route handler
   req.user = { id, email, ... }
    ↓
7. Route handler can access user data
   const userId = req.user.id
```

---

## 📊 Data Flow Diagram

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React Application                       │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ Components │→ │  Services  │→ │  Supabase  │     │   │
│  │  │   (UI)     │  │  (API)     │  │   Client   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑
                    HTTPS Requests
                          ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE PLATFORM                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Authentication Service                  │   │
│  │  • Magic Link Email                                  │   │
│  │  • Session Management                                │   │
│  │  • JWT Token Validation                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓ ↑                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                     │   │
│  │  • Row Level Security (RLS)                          │   │
│  │  • Real-time Subscriptions                           │   │
│  │  • Data Storage                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑
                    (Optional Backend)
                          ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│              EXPRESS.JS SERVER (Optional)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              REST API Endpoints                      │   │
│  │  • /api/contacts                                     │   │
│  │  • /api/groups                                       │   │
│  │  • /api/forms (public)                               │   │
│  │  • /api/fields                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓ ↑                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Supabase Server Client                       │   │
│  │  • Server-side queries                               │   │
│  │  • Token validation                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow for Different Operations

#### 1. **Read Operation (GET)**
```
Component → Service → Supabase Client → Database → RLS Check → Return Data
```

#### 2. **Write Operation (POST/PUT)**
```
Component → Service → Supabase Client → Database → RLS Check → Validate → Insert/Update → Return Result
```

#### 3. **Real-time Subscription**
```
Component → supabase.from('table').on('INSERT', callback) → Database Change → Push to Client → Update UI
```

#### 4. **Form Submission (External)**
```
External User → Public Form URL → Submit → Backend API → Database → Create Lead → Notify Dashboard
```

---

## 🚀 Deployment Flow

### Development Environment
```
1. Run: npm run postinstall
   → Install client dependencies
   → Install server dependencies

2. Start Client: cd client && npm run dev
   → Vite dev server on http://localhost:5173

3. Start Server: cd server && npm start
   → Express server on http://localhost:5000

4. Access: http://localhost:5173
```

### Production Deployment (Netlify)
```
1. Build Client
   cd client && npm run build
   → Generates dist/ folder

2. Deploy to Netlify
   → Upload dist/ folder
   → Configure redirects (_redirects file)
   → Set environment variables

3. Serverless Functions
   → server/ code deployed as Netlify Function
   → Accessible at /.netlify/functions/server

4. Database
   → Supabase hosted database
   → Connection via environment variables
```

---

## 📝 Key Configuration Files

### Frontend Configuration
- **vite.config.ts**: Vite build configuration
- **tsconfig.json**: TypeScript compiler options
- **index.html**: HTML entry point
- **client/src/lib/supabase.ts**: Supabase client initialization

### Backend Configuration
- **server/server.js**: Express app setup
- **server/lib/supabaseClient.js**: Server-side Supabase client
- **.env**: Environment variables (not in repo)

### Database Configuration
- **db_sql/schema.sql**: Database schema
- **db_sql/lead_management_schema.sql**: Lead system schema
- **db_sql/fix_rls_and_update.sql**: RLS policy fixes

---

## 🔗 Inter-Component Communication

### Frontend Communication
```
Parent Component
    ↓
Props passed down
    ↓
Child Component
    ↓
Events emitted up (callbacks)
    ↓
Parent handles event
```

### Service Layer Communication
```
Multiple Components
    ↓
All use same Service
    ↓
Service maintains single source of truth
    ↓
Supabase Client (singleton)
```

### Real-time Updates
```
Component A makes change
    ↓
Supabase database updated
    ↓
Real-time subscription fires
    ↓
Component B receives update
    ↓
Component B re-renders
```

---

## 📌 Important Notes

1. **Monorepo Structure**: Client and server are separate npm packages within the same repository
2. **Authentication**: Uses Supabase Auth with magic link (passwordless)
3. **Security**: All database access protected by Row Level Security (RLS)
4. **Real-time**: Supabase provides real-time subscriptions for live updates
5. **Serverless**: Backend can run as serverless functions on Netlify
6. **Type Safety**: TypeScript used throughout frontend for type safety

---

## 🎯 Next Steps for Development

1. **Understand the flow**: Follow a single feature from UI → Service → Database
2. **Check RLS policies**: Ensure database security is properly configured
3. **Test authentication**: Verify magic link flow works correctly
4. **Review API endpoints**: Understand which routes are public vs protected
5. **Explore components**: See how data flows through the component tree

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-25  
**Maintained By:** Development Team
