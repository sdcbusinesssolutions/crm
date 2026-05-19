-- Team Staff Management Module Migration
-- Created: 2026-05-11

-- 1. team_staff table
CREATE TABLE IF NOT EXISTS "public"."team_staff" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    "tenant_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "created_by" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE,
    "phone" text,
    "password_hash" text NOT NULL,
    "role" text DEFAULT 'staff',
    "status" text DEFAULT 'active',
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- 2. team_staff_permissions table
CREATE TABLE IF NOT EXISTS "public"."team_staff_permissions" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    "tenant_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "staff_id" uuid NOT NULL REFERENCES public.team_staff(id) ON DELETE CASCADE,
    "module_name" text NOT NULL,
    "access_type" text NOT NULL CHECK (access_type IN ('read', 'read_write', 'no_access', 'all_access')),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    UNIQUE(staff_id, module_name)
);

-- 3. lead_assignments table
CREATE TABLE IF NOT EXISTS "public"."lead_assignments" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    "tenant_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "lead_id" uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    "assigned_to" uuid NOT NULL REFERENCES public.team_staff(id) ON DELETE CASCADE,
    "assigned_by" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    UNIQUE(lead_id, assigned_to)
);

-- Indexes for performance and multi-tenancy
CREATE INDEX IF NOT EXISTS idx_team_staff_tenant ON "public"."team_staff" ("tenant_id");
CREATE INDEX IF NOT EXISTS idx_team_staff_email ON "public"."team_staff" ("email");
CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff ON "public"."team_staff_permissions" ("staff_id");
CREATE INDEX IF NOT EXISTS idx_staff_permissions_tenant ON "public"."team_staff_permissions" ("tenant_id");
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON "public"."lead_assignments" ("lead_id");
CREATE INDEX IF NOT EXISTS idx_lead_assignments_staff ON "public"."lead_assignments" ("assigned_to");
CREATE INDEX IF NOT EXISTS idx_lead_assignments_tenant ON "public"."lead_assignments" ("tenant_id");

-- RLS (Row Level Security)
ALTER TABLE "public"."team_staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."team_staff_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lead_assignments" ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Owner can manage their own staff)
DROP POLICY IF EXISTS "Owners can manage their staff" ON "public"."team_staff";
CREATE POLICY "Owners can manage their staff" ON "public"."team_staff"
    FOR ALL USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Owners can manage staff permissions" ON "public"."team_staff_permissions";
CREATE POLICY "Owners can manage staff permissions" ON "public"."team_staff_permissions"
    FOR ALL USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Owners can manage lead assignments" ON "public"."lead_assignments";
CREATE POLICY "Owners can manage lead assignments" ON "public"."lead_assignments"
    FOR ALL USING (auth.uid() = tenant_id);

-- Staff can view their own record and permissions
-- Note: Simplified to directly check email to avoid RLS infinite recursion
DROP POLICY IF EXISTS "Staff can view their own profile" ON "public"."team_staff";
CREATE POLICY "Staff can view their own profile" ON "public"."team_staff"
    FOR SELECT USING (email = auth.email());

DROP POLICY IF EXISTS "Staff can view their own permissions" ON "public"."team_staff_permissions";
CREATE POLICY "Staff can view their own permissions" ON "public"."team_staff_permissions"
    FOR SELECT USING (staff_id = (SELECT id FROM public.team_staff WHERE email = auth.email() LIMIT 1));


-- Ensure assigned_staff_ids column exists on leads table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_staff_ids') THEN
        ALTER TABLE leads ADD COLUMN assigned_staff_ids UUID[] DEFAULT '{}';
    END IF;
END $$;

-- GIN index for fast array containment search on assigned staff
CREATE INDEX IF NOT EXISTS idx_leads_assigned_staff_ids ON "public"."leads" USING gin ("assigned_staff_ids");

