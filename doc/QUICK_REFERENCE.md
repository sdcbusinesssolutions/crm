# Quick Reference Guide - Folder Structure & Flow

## 🚀 Quick Navigation

### Frontend (Client)
```
client/src/
├── components/          → All React UI components
├── services/           → API calls & business logic
├── lib/                → Utility libraries (Supabase client)
├── types/              → TypeScript type definitions
├── App.tsx             → Root component
└── main.tsx            → Entry point
```

### Backend (Server)
```
server/
├── routes/             → API endpoint handlers
├── models/             → Data models (legacy)
├── lib/                → Shared utilities
└── server.js           → Express app setup
```

### Database
```
db_sql/
├── schema.sql                    → Core database schema
├── lead_management_schema.sql    → Lead/Pipeline tables
└── fix_rls_*.sql                 → Security policy fixes
```

---

## 📂 Component Directory Map

### Core Components
| Component | Purpose | Location |
|-----------|---------|----------|
| `AuthPage.tsx` | Login/Signup UI | `client/src/components/` |
| `Dashboard.tsx` | Main dashboard | `client/src/components/` |
| `FlowEditor.tsx` | Visual flow builder | `client/src/components/` |
| `FormBuilder.tsx` | Dynamic form creator | `client/src/components/` |
| `PipelineView.tsx` | Lead pipeline board | `client/src/components/` |
| `ContactList.tsx` | Contact management | `client/src/components/` |
| `Inbox.tsx` | Message inbox | `client/src/components/` |
| `GlobalSettings.tsx` | App settings | `client/src/components/` |

### Supporting Components
| Component | Purpose |
|-----------|---------|
| `Sidebar.tsx` | Navigation menu |
| `Canvas.tsx` | Flow drawing area |
| `Node.tsx` | Flow node element |
| `Modal.tsx` | Dialog boxes |
| `Toast.tsx` | Notifications |

---

## 🔌 Service Layer Map

### Services
| Service | Purpose | Main Functions |
|---------|---------|----------------|
| `contactService.ts` | Contact CRUD | `getContacts()`, `createContact()`, `updateContact()`, `deleteContact()` |
| `contactGroupService.ts` | Group CRUD | `getGroups()`, `createGroup()`, `addMember()`, `removeMember()` |
| `flowService.ts` | Flow CRUD | `getFlows()`, `createFlow()`, `updateFlow()`, `deleteFlow()` |
| `inputFieldService.ts` | Custom fields | `getFields()`, `createField()`, `updateField()`, `deleteField()` |
| `lead-management-api.ts` | Lead/Pipeline | `getPipelines()`, `getLeads()`, `updateLead()`, `createForm()` |
| `themeService.ts` | Theme management | `getTheme()`, `setTheme()`, `applyTheme()` |
| `whatsappService.ts` | WhatsApp integration | `getNumbers()`, `sendMessage()` |

---

## 🛣️ API Endpoint Reference

### Public Endpoints
```
GET  /api/status                     → Health check
GET  /api/forms/:id                  → Get form configuration
POST /api/forms/submit               → Submit form data
```

### Protected Endpoints (Require Auth)
```
# User
GET  /api/users/me                   → Get current user info

# Contacts
GET    /api/contacts                 → List all contacts
POST   /api/contacts                 → Create new contact
PUT    /api/contacts/:id             → Update contact
DELETE /api/contacts/:id             → Delete contact
POST   /api/contacts/bulk            → Bulk import

# Groups
GET    /api/groups                   → List all groups
POST   /api/groups                   → Create new group
PUT    /api/groups/:id               → Update group
DELETE /api/groups/:id               → Delete group

# Fields
GET    /api/fields                   → List custom fields
POST   /api/fields                   → Create field
PUT    /api/fields/:id               → Update field
DELETE /api/fields/:id               → Delete field
```

---

## 🗄️ Database Tables Quick Reference

### Core Tables
```
organizations              → Company/workspace data
organization_members       → User-organization relationships
flows                      → WhatsApp flow definitions
contacts                   → Contact information
contact_groups             → Contact group definitions
contact_group_members      → Group membership
input_fields               → Custom field definitions
whatsapp_numbers           → WhatsApp number configurations
```

### Lead Management Tables
```
pipelines                  → Sales pipeline definitions
pipeline_stages            → Pipeline stage configurations
leads                      → Lead/opportunity records
lead_activities            → Lead activity history
forms                      → Dynamic form definitions
form_fields                → Form field configurations
form_submissions           → Form submission data
```

### Messaging Tables
```
conversations              → Chat conversation threads
messages                   → Individual messages
```

---

## 🔄 Common Flow Patterns

### 1. Fetch Data Pattern
```typescript
// In component
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await service.getData();
      setData(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, []);
```

### 2. Create Record Pattern
```typescript
// In component
const handleCreate = async (formData) => {
  try {
    const newRecord = await service.create(formData);
    setData(prev => [...prev, newRecord]);
    showToast('Created successfully!');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};
```

### 3. Update Record Pattern
```typescript
// In component
const handleUpdate = async (id, updates) => {
  try {
    const updated = await service.update(id, updates);
    setData(prev => prev.map(item => 
      item.id === id ? updated : item
    ));
    showToast('Updated successfully!');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};
```

### 4. Delete Record Pattern
```typescript
// In component
const handleDelete = async (id) => {
  if (!confirm('Are you sure?')) return;
  try {
    await service.delete(id);
    setData(prev => prev.filter(item => item.id !== id));
    showToast('Deleted successfully!');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};
```

### 5. Real-time Subscription Pattern
```typescript
// In component
useEffect(() => {
  const subscription = supabase
    .from('table_name')
    .on('INSERT', (payload) => {
      setData(prev => [...prev, payload.new]);
    })
    .on('UPDATE', (payload) => {
      setData(prev => prev.map(item =>
        item.id === payload.new.id ? payload.new : item
      ));
    })
    .on('DELETE', (payload) => {
      setData(prev => prev.filter(item =>
        item.id !== payload.old.id
      ));
    })
    .subscribe();

  return () => {
    supabase.removeSubscription(subscription);
  };
}, []);
```

---

## 🔐 Authentication Quick Reference

### Check if User is Logged In
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // User is logged in
  const user = session.user;
}
```

### Get Current User
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

### Sign In with Magic Link
```typescript
await supabase.auth.signInWithOtp({
  email: userEmail,
  options: {
    emailRedirectTo: window.location.origin
  }
});
```

### Sign Out
```typescript
await supabase.auth.signOut();
```

### Listen to Auth Changes
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User signed in
  } else if (event === 'SIGNED_OUT') {
    // User signed out
  }
});
```

---

## 🎨 Component Communication Patterns

### Parent to Child (Props)
```typescript
// Parent
<ChildComponent data={data} onAction={handleAction} />

// Child
interface Props {
  data: DataType;
  onAction: (id: string) => void;
}
```

### Child to Parent (Callbacks)
```typescript
// Parent
const handleChildEvent = (value: string) => {
  console.log('Child sent:', value);
};
<ChildComponent onEvent={handleChildEvent} />

// Child
props.onEvent('some value');
```

### Sibling Components (Lift State Up)
```typescript
// Parent holds shared state
const [sharedData, setSharedData] = useState();

<ChildA data={sharedData} onChange={setSharedData} />
<ChildB data={sharedData} />
```

---

## 📊 State Management Patterns

### Local State (useState)
```typescript
const [value, setValue] = useState(initialValue);
```

### Side Effects (useEffect)
```typescript
useEffect(() => {
  // Run on mount and when dependencies change
  return () => {
    // Cleanup on unmount
  };
}, [dependencies]);
```

### Derived State (useMemo)
```typescript
const derivedValue = useMemo(() => {
  return expensiveComputation(data);
}, [data]);
```

### Callbacks (useCallback)
```typescript
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

---

## 🚨 Error Handling Patterns

### Try-Catch Pattern
```typescript
try {
  const result = await riskyOperation();
  handleSuccess(result);
} catch (error) {
  handleError(error);
} finally {
  cleanup();
}
```

### Error Boundaries (React)
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    logError(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### Validation Pattern
```typescript
const validate = (data) => {
  const errors = {};
  if (!data.name) errors.name = 'Name is required';
  if (!data.email) errors.email = 'Email is required';
  return errors;
};

const errors = validate(formData);
if (Object.keys(errors).length > 0) {
  setErrors(errors);
  return;
}
```

---

## 🔧 Development Commands

### Install Dependencies
```bash
npm run postinstall           # Install all dependencies
```

### Development
```bash
cd client && npm run dev      # Start frontend dev server
cd server && npm start        # Start backend server
```

### Build
```bash
cd client && npm run build    # Build frontend for production
```

### Clean
```bash
npm run clean:legacy          # Remove legacy files
```

---

## 📁 File Naming Conventions

### Components
- **PascalCase**: `ContactList.tsx`, `FormBuilder.tsx`
- **Location**: `client/src/components/`

### Services
- **camelCase**: `contactService.ts`, `flowService.ts`
- **Location**: `client/src/services/`

### Types
- **camelCase**: `types.ts`, `index.ts`
- **Location**: `client/src/types/`

### Routes
- **camelCase**: `contacts.js`, `groups.js`
- **Location**: `server/routes/`

### SQL Files
- **snake_case**: `schema.sql`, `fix_rls_and_update.sql`
- **Location**: `db_sql/`

---

## 🎯 Common Tasks Quick Guide

### Add a New Component
1. Create file in `client/src/components/ComponentName.tsx`
2. Import in parent component
3. Add to navigation if needed (edit `Sidebar.tsx`)

### Add a New API Endpoint
1. Create route handler in `server/routes/routeName.js`
2. Register route in `server/server.js`
3. Add authentication if needed (`requireAuth` middleware)

### Add a New Database Table
1. Create migration in `db_sql/`
2. Run in Supabase SQL Editor
3. Add RLS policies
4. Update TypeScript types in `client/src/types.ts`

### Add a New Service Function
1. Add function to appropriate service file in `client/src/services/`
2. Use Supabase client for database operations
3. Handle errors appropriately
4. Return typed data

---

## 🔍 Debugging Tips

### Check Authentication
```typescript
// In browser console
const { data } = await supabase.auth.getSession();
console.log(data.session);
```

### Check Database Connection
```typescript
// In browser console
const { data, error } = await supabase.from('contacts').select('*').limit(1);
console.log(data, error);
```

### Check RLS Policies
```sql
-- In Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'contacts';
```

### View Network Requests
- Open browser DevTools → Network tab
- Filter by "Fetch/XHR"
- Check request/response details

---

## 📚 Related Documentation

- **[PROJECT_STRUCTURE_HIERARCHY.md](./PROJECT_STRUCTURE_HIERARCHY.md)** - Detailed project structure
- **[FLOW_DIAGRAMS.md](./FLOW_DIAGRAMS.md)** - Visual flow diagrams
- **[SCHEMA_DIAGRAM.md](./SCHEMA_DIAGRAM.md)** - Database schema details
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Setup instructions
- **[CONTACT_FEATURES.md](./CONTACT_FEATURES.md)** - Contact features documentation

---

**Last Updated:** 2025-11-25  
**Version:** 1.0
