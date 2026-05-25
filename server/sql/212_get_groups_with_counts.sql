-- =================================================================
-- GET GROUPS WITH COUNTS RPC
-- Description: Efficiently fetches all groups for a user and calculates
-- the exact contact count for each group using the GIN index on contacts.
-- This reduces 1+N API calls to a single, highly optimized database query.
-- =================================================================

DROP FUNCTION IF EXISTS public.get_groups_with_counts(UUID);
DROP FUNCTION IF EXISTS public.get_groups_with_counts();

CREATE OR REPLACE FUNCTION public.get_groups_with_counts(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    contactCount BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.description,
        g.status,
        g.created_at,
        (
            SELECT COUNT(*) 
            FROM contacts c 
            WHERE c.user_id = p_user_id 
              AND c.group_ids @> ARRAY[g.id::text]
        )::BIGINT AS contactCount
    FROM contact_groups g
    WHERE g.user_id = p_user_id
    ORDER BY g.created_at DESC;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_groups_with_counts(UUID) TO anon, authenticated, service_role;
