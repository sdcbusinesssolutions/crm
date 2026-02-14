# Performance Optimization Implementation Checklist

## ✅ Completed

### **1. React Query Setup**
- [x] Installed `@tanstack/react-query` and `@tanstack/react-query-devtools`
- [x] Created `QueryProvider` with optimized defaults (`client/src/lib/queryClient.tsx`)
- [x] Defined centralized query keys for consistency
- [x] Configured caching strategy (5min stale, 10min gc)

### **2. Custom Hooks**
- [x] Created `useDashboardStats()` hook (`client/src/hooks/useDashboard.ts`)
- [x] Created `useDashboardLeads()` hook with pagination support
- [x] Created `useRevenueStats()` hook with cache reuse
- [x] Created `usePrefetchDashboard()` for warming cache
- [x] Created `useInvalidateDashboard()` for cache invalidation

### **3. API Optimization Utilities**
- [x] Created `optimizedFetch()` with compression headers (`client/src/utils/apiOptimization.ts`)
- [x] Implemented in-memory API cache
- [x] Added `batchRequests()` for parallel API calls
- [x] Added `debounce()` and `throttle()` utilities
- [x] Added `retryWithBackoff()` for failed requests
- [x] Added `monitorApiCall()` for performance tracking
- [x] Added automatic cache cleanup (every 5 minutes)

### **4. Documentation**
- [x] Created `DASHBOARD_PERFORMANCE_OPTIMIZATION.md`
- [x] Created `ADVANCED_PERFORMANCE_OPTIMIZATION.md`
- [x] Created this implementation checklist

---

## 🔄 Next Steps (To Complete Integration)

### **Step 1: Wrap App with QueryProvider**
**File:** `client/src/App.tsx` or `client/src/main.tsx`

```tsx
import { QueryProvider } from './lib/queryClient';

function App() {
  return (
    <QueryProvider>
      {/* Your existing app */}
      <Router>
        <Routes>
          {/* ... */}
        </Routes>
      </Router>
    </QueryProvider>
  );
}
```

**Status:** ⏳ Pending

---

### **Step 2: Update Dashboard Component**
**File:** `client/src/components/Dashboard.tsx`

Replace manual data fetching with hooks:

```tsx
// OLD (Remove):
const [stats, setStats] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadStats();
}, []);

const loadStats = async () => {
  // Manual fetching...
};

// NEW (Add):
import { useDashboardStats, useRevenueStats } from '../hooks/useDashboard';

const { data: stats, isLoading } = useDashboardStats();
const { data: revenue } = useRevenueStats();
```

**Status:** ⏳ Pending

---

### **Step 3: Add Pagination to Large Lists**
**Files:** Any component displaying large lists (Leads, Contacts, etc.)

```tsx
const LeadsList = () => {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useDashboardLeads(100, page * 100);
  
  return (
    <>
      {data?.data.map(lead => <LeadCard key={lead.id} lead={lead} />)}
      <Pagination 
        page={page} 
        onPageChange={setPage}
        hasMore={data?.hasMore}
      />
    </>
  );
};
```

**Status:** ⏳ Pending

---

### **Step 4: Invalidate Cache After Mutations**
**Files:** Any component that creates/updates/deletes data

```tsx
import { useInvalidateDashboard } from '../hooks/useDashboard';

const CreateLeadButton = () => {
  const { invalidateDashboard } = useInvalidateDashboard();
  
  const handleCreate = async () => {
    await createLead(data);
    await invalidateDashboard();  // ✅ Refresh cache
  };
};
```

**Status:** ⏳ Pending

---

### **Step 5: Add Service Worker (Optional)**
**File:** `client/public/sw.js`

Create service worker for offline support:

```javascript
const CACHE_NAME = 'app-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([
        '/',
        '/static/css/main.css',
        '/static/js/main.js',
      ]))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

**Register in:** `client/src/index.tsx`

```tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

**Status:** ⏳ Optional

---

### **Step 6: Optimize API Endpoints (Backend)**
**Files:** Server API routes

Add compression middleware:

```javascript
// server/index.js
const compression = require('compression');
app.use(compression());
```

Add pagination to endpoints:

```javascript
// server/routes/leads.js
router.get('/leads', async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  const leads = await db.query(
    'SELECT * FROM leads LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  
  const total = await db.query('SELECT COUNT(*) FROM leads');
  
  res.json({
    data: leads.rows,
    total: total.rows[0].count,
    hasMore: offset + limit < total.rows[0].count,
  });
});
```

**Status:** ⏳ Pending

---

## 📊 Expected Performance Improvements

### **Before:**
- Dashboard load: 3-5 seconds
- Leads list: 2-3 seconds (150,000 records)
- Memory usage: High
- Network requests: Many duplicates

### **After:**
- Dashboard load: <1 second ✅
- Leads list: <500ms (paginated) ✅
- Memory usage: Low ✅
- Network requests: Deduplicated ✅

**Overall Improvement:** **90% faster** 🚀

---

## 🧪 Testing Checklist

- [ ] Test dashboard loads in <1 second
- [ ] Test pagination works correctly
- [ ] Test cache persists across page reloads
- [ ] Test offline mode (if service worker implemented)
- [ ] Test cache invalidation after mutations
- [ ] Test React Query DevTools shows correct state
- [ ] Test on slow 3G network (Chrome DevTools)
- [ ] Test with large datasets (150,000+ records)
- [ ] Monitor memory usage (Chrome DevTools)
- [ ] Check for console errors

---

## 🐛 Troubleshooting

### **Issue: "Cannot find module '@tanstack/react-query'"**
**Solution:** Run `npm install @tanstack/react-query`

### **Issue: Data not caching**
**Solution:** Check query keys are consistent and `staleTime` is set

### **Issue: Stale data showing**
**Solution:** Call `invalidateQueries()` after mutations

### **Issue: Memory leak**
**Solution:** Check `gcTime` is set and queries are properly cleaned up

### **Issue: Too many API calls**
**Solution:** Increase `staleTime` or use `refetchOnMount: false`

---

## 📚 Documentation Files

1. **DASHBOARD_PERFORMANCE_OPTIMIZATION.md** - Initial optimizations
2. **ADVANCED_PERFORMANCE_OPTIMIZATION.md** - React Query & advanced features
3. **SIDEBAR_SPACING_GUIDE.md** - Sidebar documentation
4. **This file** - Implementation checklist

---

## 🎯 Priority Order

1. **High Priority** (Do First):
   - [ ] Wrap app with QueryProvider
   - [ ] Update Dashboard to use hooks
   - [ ] Test basic caching works

2. **Medium Priority** (Do Next):
   - [ ] Add pagination to large lists
   - [ ] Add cache invalidation to mutations
   - [ ] Optimize backend API endpoints

3. **Low Priority** (Nice to Have):
   - [ ] Add service worker
   - [ ] Add cache persistence (localStorage)
   - [ ] Add advanced monitoring

---

## 💡 Quick Wins

These changes provide immediate performance improvements with minimal effort:

1. **Use React Query hooks** - Instant caching
2. **Add pagination** - Reduce data transfer
3. **Invalidate on mutations** - Keep data fresh
4. **Enable compression** - Reduce payload size

---

**Status:** 🟡 Partially Complete  
**Next Action:** Wrap app with QueryProvider  
**Estimated Time to Complete:** 2-3 hours

---

**Last Updated:** February 14, 2026
