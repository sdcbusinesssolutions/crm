# WhatsApp Flow Builder - Visual Flow Diagrams

## 📋 Table of Contents
1. [Request Flow Diagrams](#request-flow-diagrams)
2. [Feature-Specific Flows](#feature-specific-flows)
3. [State Management Flow](#state-management-flow)
4. [Error Handling Flow](#error-handling-flow)

---

## 🔄 Request Flow Diagrams

### 1. Complete Request Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER ACTION                              │
│              (Click button, submit form, etc.)                   │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    REACT COMPONENT                               │
│  • Event handler triggered                                       │
│  • Validate input (if needed)                                    │
│  • Show loading state                                            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                 │
│  • contactService.ts                                             │
│  • flowService.ts                                                │
│  • lead-management-api.ts                                        │
│  • etc.                                                          │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │  Direct or API? │
                    └─────────────────┘
                     ↓               ↓
              ┌──────────┐    ┌──────────┐
              │  Direct  │    │   API    │
              │ Supabase │    │ Backend  │
              └──────────┘    └──────────┘
                     ↓               ↓
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLIENT                               │
│  • Get session token                                             │
│  • Prepare request                                               │
│  • Add authentication headers                                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE PLATFORM                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  1. Authentication Check                                   │  │
│  │     • Validate JWT token                                   │  │
│  │     • Extract user ID                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  2. Row Level Security (RLS)                               │  │
│  │     • Check organization membership                        │  │
│  │     • Verify permissions                                   │  │
│  │     • Apply data filters                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  3. Database Query                                         │  │
│  │     • Execute SQL                                          │  │
│  │     • Apply RLS policies                                   │  │
│  │     • Return filtered results                              │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    RESPONSE HANDLING                             │
│  • Parse response                                                │
│  • Check for errors                                              │
│  • Transform data if needed                                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    COMPONENT UPDATE                              │
│  • Update state                                                  │
│  • Hide loading state                                            │
│  • Show success/error message                                    │
│  • Re-render UI                                                  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                    UI UPDATED                                    │
│              (User sees the result)                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Feature-Specific Flows

### 2. Contact Creation Flow

```
ContactList.tsx
    │
    │ User clicks "Add Contact"
    ↓
Open Modal/Form
    │
    │ User fills form:
    │ • Name
    │ • Phone
    │ • Email
    │ • Custom fields
    ↓
Validate Input
    │
    │ ✓ Valid
    ↓
contactService.createContact({
  name, phone, email, ...customFields
})
    │
    ↓
supabase
  .from('contacts')
  .insert({
    name,
    phone,
    email,
    organization_id: user.organization_id,
    created_by: user.id,
    ...customFields
  })
    │
    ↓
┌─────────────────────────────┐
│   Supabase RLS Check        │
│                             │
│  1. User authenticated?     │
│     ✓ Yes                   │
│                             │
│  2. User in organization?   │
│     ✓ Yes                   │
│                             │
│  3. User has permission?    │
│     ✓ Yes (member role)     │
└─────────────────────────────┘
    │
    ↓
PostgreSQL INSERT
    │
    ↓
Return new contact record
{
  id: "uuid-123",
  name: "John Doe",
  phone: "+1234567890",
  created_at: "2025-11-25T10:00:00Z",
  ...
}
    │
    ↓
Update ContactList state
    │
    ↓
Re-render table with new contact
    │
    ↓
Show success toast
"Contact created successfully!"
    │
    ↓
Close modal
```

### 3. Form Builder & Submission Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FORM CREATION (Admin)                        │
└─────────────────────────────────────────────────────────────────┘

FormBuilder.tsx
    │
    │ Admin designs form
    ↓
Configure:
  • Form name
  • Pipeline selection
  • Form fields (text, email, phone, etc.)
  • Field validation rules
  • Submit button text
    │
    ↓
Click "Save Form"
    │
    ↓
POST to Supabase 'forms' table
{
  name: "Contact Form",
  pipeline_id: "uuid-pipeline",
  fields: [...],
  organization_id: "uuid-org"
}
    │
    ↓
Generate unique form ID
    │
    ↓
Create shareable URL
https://app.example.com/form/abc123
    │
    ↓
Display URL to admin
(Can be embedded or shared)

┌─────────────────────────────────────────────────────────────────┐
│                 FORM SUBMISSION (Public User)                   │
└─────────────────────────────────────────────────────────────────┘

External user visits form URL
    │
    ↓
Load form configuration
GET /api/forms/abc123 (Public endpoint)
    │
    ↓
Render form dynamically
  • Display fields from config
  • Apply validation rules
    │
    │ User fills form
    ↓
Click "Submit"
    │
    ↓
Validate client-side
    │
    │ ✓ Valid
    ↓
POST /api/forms/submit
{
  form_id: "abc123",
  data: {
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "+9876543210"
  }
}
    │
    ↓
Backend processes submission
    │
    ├─→ Save to 'form_submissions' table
    │
    ├─→ Create lead in 'leads' table
    │   {
    │     pipeline_id: form.pipeline_id,
    │     stage_id: first_stage_id,
    │     contact_info: submission.data,
    │     source: "form"
    │   }
    │
    └─→ Create activity record
        {
          lead_id: new_lead.id,
          type: "form_submitted",
          details: {...}
        }
    │
    ↓
Return success response
    │
    ↓
Show thank you message
"Thank you! We'll be in touch soon."
    │
    ↓
┌─────────────────────────────────────────────────────────────────┐
│              ADMIN SEES NEW LEAD IN DASHBOARD                   │
└─────────────────────────────────────────────────────────────────┘

Dashboard.tsx / PipelineView.tsx
    │
    │ Real-time subscription active
    ↓
Supabase real-time event fires
"New lead inserted"
    │
    ↓
Update pipeline view
    │
    ↓
New lead card appears in first stage
    │
    ↓
Show notification badge
"1 new lead"
```

### 4. Pipeline/Lead Management Flow

```
PipelineView.tsx
    │
    │ Component mounts
    ↓
Load pipeline data
    │
    ├─→ GET pipelines
    │   supabase.from('pipelines').select()
    │
    ├─→ GET stages
    │   supabase.from('pipeline_stages')
    │     .select()
    │     .eq('pipeline_id', selectedPipeline)
    │     .order('position')
    │
    └─→ GET leads
        supabase.from('leads')
          .select('*, activities(*)')
          .eq('pipeline_id', selectedPipeline)
    │
    ↓
Render pipeline board
┌──────────┬──────────┬──────────┬──────────┐
│  Stage 1 │ Stage 2  │ Stage 3  │ Stage 4  │
│  ┌────┐  │  ┌────┐  │  ┌────┐  │  ┌────┐  │
│  │Lead│  │  │Lead│  │  │Lead│  │  │Lead│  │
│  └────┘  │  └────┘  │  └────┘  │  └────┘  │
│  ┌────┐  │          │  ┌────┐  │          │
│  │Lead│  │          │  │Lead│  │          │
│  └────┘  │          │  └────┘  │          │
└──────────┴──────────┴──────────┴──────────┘
    │
    │ User drags lead from Stage 1 to Stage 2
    ↓
onDragEnd event
    │
    ↓
Update lead in database
supabase
  .from('leads')
  .update({
    stage_id: newStageId,
    updated_at: new Date()
  })
  .eq('id', leadId)
    │
    ↓
Create activity record
supabase
  .from('lead_activities')
  .insert({
    lead_id: leadId,
    type: 'stage_changed',
    details: {
      from_stage: oldStageId,
      to_stage: newStageId
    },
    created_by: user.id
  })
    │
    ↓
Optimistic UI update
(Move card immediately)
    │
    ↓
Database confirms update
    │
    ↓
Real-time subscription fires
(Other users see the change)
    │
    ↓
Update complete
```

### 5. Flow Editor Flow

```
Dashboard.tsx
    │
    │ User clicks "Create Flow" or "Edit Flow"
    ↓
Navigate to FlowEditor.tsx
    │
    ↓
Load flow data (if editing)
supabase
  .from('flows')
  .select('*')
  .eq('id', flowId)
  .single()
    │
    ↓
Initialize canvas
    │
    ├─→ Canvas.tsx (main drawing area)
    ├─→ NodesPanel.tsx (available nodes)
    └─→ SettingsPanel.tsx (node configuration)
    │
    ↓
Render existing nodes and connections
    │
    │ User drags node from panel to canvas
    ↓
Create new node
{
  id: "node-123",
  type: "message",
  position: { x: 100, y: 200 },
  data: { text: "" }
}
    │
    ↓
Add to canvas state
    │
    │ User connects nodes
    ↓
Create connection
{
  id: "edge-456",
  source: "node-123",
  target: "node-789"
}
    │
    ↓
Update canvas state
    │
    │ User configures node (click on it)
    ↓
Open SettingsPanel
    │
    │ User edits node properties
    ↓
Update node data
    │
    ↓
Click "Save Flow"
    │
    ↓
Validate flow
  • All nodes connected?
  • Required fields filled?
  • No circular dependencies?
    │
    │ ✓ Valid
    ↓
Save to database
supabase
  .from('flows')
  .upsert({
    id: flowId,
    name: flowName,
    nodes: [...],
    edges: [...],
    organization_id: user.organization_id
  })
    │
    ↓
Show success message
"Flow saved successfully!"
    │
    ↓
Navigate back to Dashboard
```

---

## 🔐 Authentication Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│                    INITIAL PAGE LOAD                            │
└─────────────────────────────────────────────────────────────────┘

App.tsx mounts
    │
    ↓
useEffect runs
    │
    ↓
Check for auth redirect
window.location.hash includes 'access_token'?
    │
    ├─→ YES: Set isAuthLoading = true
    │
    └─→ NO: Continue
    │
    ↓
supabase.auth.getSession()
    │
    ↓
Check localStorage for session
    │
    ├─→ Found: Parse and validate
    │   │
    │   ↓
    │   Session valid?
    │   │
    │   ├─→ YES: setSession(session)
    │   │        Show Dashboard
    │   │
    │   └─→ NO: Clear session
    │            Show AuthPage
    │
    └─→ Not found: Show AuthPage

┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN PROCESS                                │
└─────────────────────────────────────────────────────────────────┘

AuthPage.tsx
    │
    │ User enters email
    ↓
Click "Send Magic Link"
    │
    ↓
supabase.auth.signInWithOtp({
  email: userEmail,
  options: {
    emailRedirectTo: window.location.origin
  }
})
    │
    ↓
Supabase sends email
    │
    ↓
Show message:
"Check your email for the login link"
    │
    │ User opens email
    │ User clicks magic link
    ↓
Redirect to app with token in URL hash
https://app.example.com/#access_token=...&refresh_token=...
    │
    ↓
App.tsx detects hash
    │
    ↓
supabase.auth.getSession()
  • Processes hash
  • Extracts tokens
  • Validates with Supabase
    │
    ↓
onAuthStateChange fires
event: 'SIGNED_IN'
session: { user, access_token, refresh_token }
    │
    ↓
Store session in localStorage
    │
    ↓
setSession(session)
    │
    ↓
Clean up URL hash
window.history.replaceState(null, '', ' ')
    │
    ↓
App re-renders
    │
    ↓
Show Dashboard
(User is now logged in)

┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED REQUESTS                       │
└─────────────────────────────────────────────────────────────────┘

Component makes API call
    │
    ↓
Service function
    │
    ↓
Supabase client automatically adds headers:
{
  Authorization: "Bearer <access_token>",
  apikey: "<supabase_anon_key>"
}
    │
    ↓
Request sent to Supabase
    │
    ↓
Supabase validates token
    │
    ├─→ Valid: Process request
    │
    └─→ Invalid/Expired:
        │
        ↓
        Try to refresh token
        │
        ├─→ Success: Retry request
        │
        └─→ Fail: Return 401
            │
            ↓
            onAuthStateChange fires
            event: 'SIGNED_OUT'
            │
            ↓
            Clear session
            │
            ↓
            Redirect to AuthPage

┌─────────────────────────────────────────────────────────────────┐
│                    LOGOUT PROCESS                               │
└─────────────────────────────────────────────────────────────────┘

User clicks "Sign Out"
    │
    ↓
handleLogout()
    │
    ↓
supabase.auth.signOut()
    │
    ↓
Clear localStorage
    │
    ↓
onAuthStateChange fires
event: 'SIGNED_OUT'
    │
    ↓
setSession(null)
    │
    ↓
App re-renders
    │
    ↓
Show AuthPage
```

---

## 📊 State Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT STATE                              │
└─────────────────────────────────────────────────────────────────┘

Component mounts
    │
    ↓
Initialize state
const [data, setData] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
    │
    ↓
useEffect runs
    │
    ↓
Fetch data
    │
    ├─→ setLoading(true)
    │
    ├─→ Call service
    │   │
    │   ↓
    │   Success: setData(result)
    │   Error: setError(error)
    │
    └─→ setLoading(false)
    │
    ↓
Component re-renders with new data
    │
    │ User interaction (e.g., create, update, delete)
    ↓
Event handler
    │
    ├─→ Optimistic update (optional)
    │   setData(prev => [...prev, newItem])
    │
    ├─→ Call service
    │   │
    │   ↓
    │   Success: Confirm update
    │   Error: Rollback optimistic update
    │
    └─→ Component re-renders

┌─────────────────────────────────────────────────────────────────┐
│                    REAL-TIME UPDATES                            │
└─────────────────────────────────────────────────────────────────┘

Component mounts
    │
    ↓
Set up real-time subscription
supabase
  .from('contacts')
  .on('INSERT', (payload) => {
    setData(prev => [...prev, payload.new])
  })
  .on('UPDATE', (payload) => {
    setData(prev => prev.map(item =>
      item.id === payload.new.id ? payload.new : item
    ))
  })
  .on('DELETE', (payload) => {
    setData(prev => prev.filter(item =>
      item.id !== payload.old.id
    ))
  })
  .subscribe()
    │
    │ Database change occurs (from any source)
    ↓
Supabase pushes update to client
    │
    ↓
Subscription callback fires
    │
    ↓
Update state
    │
    ↓
Component re-renders
(User sees live update)
    │
    │ Component unmounts
    ↓
Clean up subscription
supabase.removeSubscription(subscription)
```

---

## ⚠️ Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                               │
└─────────────────────────────────────────────────────────────────┘

API Call
    │
    ↓
try {
  const result = await service.getData()
}
    │
    ↓
    ├─→ SUCCESS
    │   │
    │   ↓
    │   Process data
    │   Update UI
    │   Show success message (optional)
    │
    └─→ ERROR
        │
        ↓
        catch (error) {
          │
          ↓
          Identify error type
          │
          ├─→ Network Error
          │   │
          │   ↓
          │   Show: "Connection lost. Please check your internet."
          │   Retry button
          │
          ├─→ Authentication Error (401)
          │   │
          │   ↓
          │   Clear session
          │   Redirect to login
          │   Show: "Session expired. Please log in again."
          │
          ├─→ Permission Error (403)
          │   │
          │   ↓
          │   Show: "You don't have permission to perform this action."
          │   Contact admin button
          │
          ├─→ Not Found Error (404)
          │   │
          │   ↓
          │   Show: "Resource not found."
          │   Go back button
          │
          ├─→ Validation Error (400)
          │   │
          │   ↓
          │   Show: "Invalid input. Please check your data."
          │   Highlight invalid fields
          │
          ├─→ Server Error (500)
          │   │
          │   ↓
          │   Show: "Something went wrong. Please try again later."
          │   Report error button
          │
          └─→ Unknown Error
              │
              ↓
              Log error to console
              Show: "An unexpected error occurred."
              Retry button
        }
        │
        ↓
        Update error state
        setError(error.message)
        │
        ↓
        Show error UI
        │
        ├─→ Toast notification
        ├─→ Inline error message
        └─→ Error boundary (for critical errors)
```

---

## 🔄 Data Synchronization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE/ONLINE SYNC                          │
└─────────────────────────────────────────────────────────────────┘

User goes offline
    │
    ↓
Detect offline state
window.addEventListener('offline', ...)
    │
    ↓
Show offline indicator
"You're offline. Changes will sync when you're back online."
    │
    │ User makes changes
    ↓
Queue changes locally
localStorage.setItem('pending_changes', [...])
    │
    │ User comes back online
    ↓
Detect online state
window.addEventListener('online', ...)
    │
    ↓
Retrieve pending changes
const pending = localStorage.getItem('pending_changes')
    │
    ↓
Sync changes to server
for (const change of pending) {
  await service.syncChange(change)
}
    │
    ↓
Clear pending queue
localStorage.removeItem('pending_changes')
    │
    ↓
Show success message
"All changes synced successfully!"
    │
    ↓
Refresh data from server
(Ensure consistency)
```

---

## 📱 Mobile vs Desktop Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESPONSIVE BEHAVIOR                          │
└─────────────────────────────────────────────────────────────────┘

App loads
    │
    ↓
Detect screen size
const isMobile = window.innerWidth < 768
    │
    ↓
    ├─→ DESKTOP (>= 768px)
    │   │
    │   ↓
    │   Sidebar always visible
    │   │
    │   ↓
    │   Multi-column layouts
    │   │
    │   ↓
    │   Hover interactions
    │   │
    │   ↓
    │   Keyboard shortcuts enabled
    │
    └─→ MOBILE (< 768px)
        │
        ↓
        Sidebar hidden by default
        │
        ↓
        Hamburger menu button shown
        │
        │ User clicks hamburger
        ↓
        Sidebar slides in (overlay)
        │
        │ User clicks menu item
        ↓
        Navigate to page
        │
        ↓
        Sidebar slides out
        │
        ↓
        Single-column layouts
        │
        ↓
        Touch-optimized interactions
        │
        ↓
        Swipe gestures enabled
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-25  
**Purpose:** Visual representation of all major application flows
