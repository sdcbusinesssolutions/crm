# White Label SaaS Architecture Guide: Multi-Tenant Strategy

## 1. Executive Summary
**Recommended Strategy:** **Single Shared Database (Multi-Tenant)**
**Why:** This architecture is the industry standard for modern SaaS (e.g., Slack, HubSpot, Salesforce). It maximizes profit margins by sharing resources while using **Row Level Security (RLS)** to guarantee 100% data isolation between clients.

**Verdict:**
- **Do NOT** use "Container-per-Client". It is too expensive and hard to maintain.
- **DO** use "Shared Infrastructure" with strict Logical Isolation.

---

## 2. Technical Architecture

### The Stack
1.  **Frontend**: Single React App (SPA). It reads `window.location.hostname` to determine which Logo/Colors to show.
2.  **Backend**: Single Node.js API Cluster. It checks the Domain Header to know which "Agency" is making the request.
3.  **Database**: Single PostgreSQL Instance. Uses RLS to ensure Agency A never sees Agency B's data.
4.  **Routing**: Traefik (Reverse Proxy). Handles **Wildcard DNS** and **On-Demand SSL** for unlimited custom domains.

### The Flow
1.  User visits `crm.agency-a.com`.
2.  Traefik intercepts request -> Generates SSL automatically -> Forwards to Node.js.
3.  Node.js Middleware looks up `crm.agency-a.com` in `agencies` table.
4.  App attaches `agency_id` to the request context.
5.  Database queries automatically apply `WHERE agency_id = '...'`.

---

## 3. Cost Calculation & Comparison

**Assumption:** You have **100 Paying Clients**.

### 🔴 Option A: Container-per-Client (The "Bad" Way)
*You provision a separate Node.js + DB container for every customer.*

| Item | Cost per Client | Cost for 100 Clients | Notes |
| :--- | :--- | :--- | :--- |
| **Compute (RAM/CPU)** | $5.00 / mo | **$500 / mo** | 100 containers running idle consume huge RAM. |
| **Database Storage** | $2.00 / mo | **$200 / mo** | Checkpoints & overhead for 100 DBs. |
| **Maintenance Ops** | 1 hour / mo | **100 hours / mo** | Updates require rebuilding 100 images. |
| **Total Monthly** | **$7.00** | **$700.00** | **Low Margins**. Costs grow linearly with revenue. |

### 🟢 Option B: Shared Architecture (The "Best" Way)
*All 100 clients share one powerful server and one optimized database.*

| Item | Cost per Client | Cost for 100 Clients | Notes |
| :--- | :--- | :--- | :--- |
| **Compute (VPS)** | $0.40 / mo | **$40.00 / mo** | One robust VPS (e.g., 8GB RAM) handles everyone. |
| **Database (Managed)** | $0.30 / mo | **$30.00 / mo** | One managed DB instance (e.g., Supabase Pro). |
| **SSL / Domains** | $0.00 | **$0.00** | Free via Let's Encrypt + Traefik. |
| **Total Monthly** | **$0.70** | **$70.00** | **90% Cheaper**. Costs stay flat as you add users. |

**💰 Profit Margin Difference:**
- If you charge $50/month:
    - **Option A Profit**: $4,300/mo
    - **Option B Profit**: **$4,930/mo** (+$7,560/year extra profit)

---

## 4. Implementation Guide

### Phase 1: Database Schema (The Foundation)
You need a hierarchy: `Agencies` -> `Users` -> `Data`.

```sql
-- 1. The Tenants (White Label Agencies)
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    custom_domain TEXT UNIQUE, -- e.g. "app.agency.com"
    branding_config JSONB DEFAULT '{}', -- Logo, Colors
    subscription_status TEXT DEFAULT 'active'
);

-- 2. The Users (Linked to Agencies)
ALTER TABLE profiles 
ADD COLUMN agency_id UUID REFERENCES agencies(id);

-- 3. RLS Policy (The Security Layer)
-- Example: Only show contacts belonging to my agency
CREATE POLICY "Agency Isolation" ON contacts
USING (
    agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);
```

### Phase 2: Domain Handling (The "Magic" Part)

This is how you allow `client.com` to point to your server securely.

#### 1. DNS Setup (Instructions for your Clients)
You must give these instructions to your Agency Admins:
> "To use your custom domain, go to your DNS Provider (GoDaddy, Namecheap) and create a **CNAME Record**:
> - **Host/Name**: `app` (or `www`, or `@`)
> - **Value/Target**: `cname.yoursaas.com`"

*(Note: `cname.yoursaas.com` should point to your VPS IP Address)*

#### 2. Traefik Configuration (Automatic SSL)
You don't need to touch the server when a client adds a domain. **Traefik** handles it automatically.

**`traefik.yml` Configuration:**
```yaml
# EntryPoints: Listen on HTTP (80) and HTTPS (443)
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

# Certificate Resolver (The Automated SSL)
certificatesResolvers:
  myresolver:
    acme:
      email: your-email@admin.com
      storage: acme.json
      httpChallenge:
        entryPoint: web
      # CRITICAL: This enables SSL for ANY domain that points to you
      onDemand: true 
```

**`docker-compose.yml` Labels for your Node App:**
```yaml
labels:
  - "traefik.enable=true"
  # Rule: Accept traffic from your main domain AND any other domain
  - "traefik.http.routers.myapp.rule=Host(`app.yoursaas.com`) || HostRegexp(`{subdomain:[a-z0-9-]+}.[a-z0-9-]+.[a-z]+`)"
  - "traefik.http.routers.myapp.tls.certresolver=myresolver"
  # Critical: Ask Traefik to get a cert for the specific domain being visited
  - "traefik.http.routers.myapp.tls.domains[0].main=app.yoursaas.com"
  - "traefik.http.routers.myapp.tls.domains[0].sans=*"
```

#### 3. Resolving the Domain (Code Logic)
When a request hits your Node.js server, you need to know *which* agency it is.

**`middleware/tenantResolver.js`:**
```javascript
const tenantResolver = async (req, res, next) => {
  // 1. Get the Hostname (e.g., "dashboard.agency-x.com")
  const host = req.headers.host; 

  // 2. Skip if it's your own main domain
  if (host === 'app.yoursaas.com') return next();

  // 3. Lookup in Database (Cache this!)
  const { data: agency } = await supabase
    .from('agencies')
    .select('id, branding_config, status')
    .eq('custom_domain', host)
    .single();

  if (!agency) {
    // Domain points to us, but we don't know it.
    return res.status(404).send('<h1>Agency Not Found</h1><p>Please contact support.</p>');
  }

  if (agency.status === 'suspended') {
     return res.status(402).send('<h1>Account Suspended</h1>');
  }

  // 4. Attach Agency to Request
  req.agency = agency;
  next();
};

// Use it in server.js
app.use(tenantResolver);
```

## 5. Risk Mitigation

| Risk | Solution |
| :--- | :--- |
| **"Noisy Neighbor"** (One client slows down DB) | Set **Rate Limits** per `agency_id` in your API middleware. |
| **Data Leak** | Write strict **RLS Tests**. Ensure a user from Agency A gets 0 results when querying Agency B. |
| **Custom Code** | If a client needs custom backend logic, **charge them premium** and spin up a separate Serverless Function for just that part. |

---

## 6. Final Recommendation

**Build for Multi-Tenancy from Day 1.**
It is significantly harder to "refactor" into multi-tenancy later.
1.  Add the `agencies` table now.
2.  Add `agency_id` to all your data tables (`contacts`, `leads`, `flows`).
3.  Use the cost savings to invest in better marketing or features.
