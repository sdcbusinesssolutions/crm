# 📋 IMPLEMENTATION CHECKLIST

## ⚠️ CRITICAL STEPS (Must Do First)

- [ ] **1. Run Database Schema**
  - Open Supabase Dashboard
  - Go to SQL Editor
  - Copy entire content of `db_sql/pipelines_forms_schema.sql`
  - Paste and click RUN
  - Verify success message appears

- [ ] **2. Verify Tables Created**
  - In Supabase, go to Table Editor
  - Confirm these tables exist:
    - [ ] `pipelines`
    - [ ] `pipeline_stages`
    - [ ] `leads`
    - [ ] `forms`
    - [ ] `form_submissions`

---

## 🔧 CODE UPDATES

### **Update PipelineView Component**

- [ ] Open `client/src/components/PipelineView.tsx`
- [ ] Replace import:
  ```typescript
  // OLD
  import { createPipeline, getPipelines } from '../services/lead-management-api';
  
  // NEW
  import { pipelineService } from '../services/pipelineService';
  import { stageService } from '../services/stageService';
  ```
- [ ] Update function calls:
  ```typescript
  // OLD
  const pipelines = await getPipelines(orgId);
  const newPipeline = await createPipeline({ org_id, name, stages });
  
  // NEW
  const pipelines = await pipelineService.getPipelines();
  const newPipeline = await pipelineService.createPipeline({ name, stages });
  ```

### **Update FormBuilder Component**

- [ ] Open `client/src/components/FormBuilder.tsx`
- [ ] Replace import:
  ```typescript
  // OLD
  import { createForm, getForms, updateForm } from '../services/lead-management-api';
  
  // NEW
  import { formService } from '../services/formService';
  ```
- [ ] Update function calls:
  ```typescript
  // OLD
  const forms = await getForms(orgId);
  const newForm = await createForm({ org_id, name, fields });
  
  // NEW
  const forms = await formService.getForms();
  const newForm = await formService.createForm({ name, fields });
  ```

### **Update Any Other Components Using lead-management-api.ts**

- [ ] Search for imports of `lead-management-api.ts`
- [ ] Replace with appropriate new service:
  - `pipelineService` for pipelines
  - `stageService` for stages
  - `leadService` for leads
  - `formService` for forms

---

## 🗑️ CLEANUP (Delete Old Files)

### **Delete Old SQL Files**

- [ ] Delete `db_sql/COMPLETE_FIX_LEAD_FORM.sql`
- [ ] Delete `db_sql/SAFE_FIX_LEAD_FORM.sql`
- [ ] Delete `db_sql/lead_management_schema.sql`
- [ ] Delete `db_sql/fix_rls_and_update.sql` (if exists)
- [ ] Delete `db_sql/fix_rls_recursion_safe.sql` (if exists)

### **Delete/Rename Old Service File**

- [ ] Delete or rename `client/src/services/lead-management-api.ts`
  - This file directly calls Supabase (not allowed)
  - Rename to `lead-management-api.ts.OLD` if you want to keep for reference

### **Delete Old Types File (Optional)**

- [ ] Review `client/src/types/lead-management.ts`
- [ ] If not needed, delete it
- [ ] Types are now in each service file

---

## ✅ TESTING

### **Test Pipeline Creation**

- [ ] Open your app
- [ ] Go to Pipeline View
- [ ] Click "Create Pipeline"
- [ ] Enter name and stages
- [ ] Click Save
- [ ] **Expected:** Pipeline saves successfully
- [ ] **Expected:** No console errors

### **Test Form Builder**

- [ ] Go to Form Builder
- [ ] Click "Create Form"
- [ ] Add fields
- [ ] Click Save
- [ ] **Expected:** Form saves successfully
- [ ] **Expected:** Form token is generated
- [ ] **Expected:** Public URL is displayed

### **Test Form Submission (Public)**

- [ ] Copy the form public URL
- [ ] Open in incognito/private window (not logged in)
- [ ] Fill out the form
- [ ] Submit
- [ ] **Expected:** Success message appears
- [ ] **Expected:** Lead is created in database

### **Test Lead Movement**

- [ ] Go to Pipeline View
- [ ] Create a lead
- [ ] Drag lead to different stage
- [ ] **Expected:** Lead moves successfully
- [ ] **Expected:** Stage updates in database

---

## 🔍 VERIFICATION

### **Check Server Routes**

- [ ] Open `server/server.js`
- [ ] Verify these routes are registered:
  ```javascript
  router.use('/pipelines', requireAuth, pipelinesRoutes);
  router.use('/stages', requireAuth, stagesRoutes);
  router.use('/leads', requireAuth, leadsRoutes);
  router.use('/forms', formRoutes);
  ```

### **Check No Direct Supabase Calls**

- [ ] Search your components for `supabase.from(`
- [ ] **Expected:** Only found in service files, not components
- [ ] **Expected:** Components only call service functions

### **Check Browser Console**

- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Perform actions (create pipeline, create form)
- [ ] **Expected:** No red errors
- [ ] **Expected:** API calls to `/api/pipelines`, `/api/forms`, etc.

### **Check Network Tab**

- [ ] Open browser DevTools → Network tab
- [ ] Create a pipeline
- [ ] **Expected:** POST request to `/api/pipelines`
- [ ] **Expected:** Status 200
- [ ] **Expected:** Response contains pipeline data

---

## 📊 FINAL VERIFICATION

- [ ] All database tables created
- [ ] All server routes working
- [ ] All components updated
- [ ] Old files deleted
- [ ] Pipeline creation works
- [ ] Form creation works
- [ ] Form submission works
- [ ] Lead movement works
- [ ] No console errors
- [ ] No direct Supabase calls in components

---

## 🎉 SUCCESS!

When all items are checked:
- ✅ Architecture follows Contact List pattern
- ✅ All database operations on server
- ✅ Frontend only calls REST API
- ✅ Simple, maintainable code
- ✅ No more database errors

---

## 📞 IF SOMETHING DOESN'T WORK

1. **Check** `doc/REFACTOR_IMPLEMENTATION_GUIDE.md` for detailed help
2. **Verify** database schema was run successfully
3. **Check** browser console for error messages
4. **Verify** auth token is being sent with requests
5. **Check** Supabase logs for database errors

---

**Last Updated:** 2025-11-25  
**Status:** Ready to Implement
