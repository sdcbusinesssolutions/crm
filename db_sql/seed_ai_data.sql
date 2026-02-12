-- Create necessary tags if they don't exist
INSERT INTO public.tags (name, color, user_id)
SELECT 'AI_INTERESTED', '#22c55e', auth.uid()
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'AI_INTERESTED' AND user_id = auth.uid());

INSERT INTO public.tags (name, color, user_id)
SELECT 'AI_NOT_INTERESTED', '#ef4444', auth.uid()
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'AI_NOT_INTERESTED' AND user_id = auth.uid());

INSERT INTO public.tags (name, color, user_id)
SELECT 'AI_LATER', '#f59e0b', auth.uid()
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'AI_LATER' AND user_id = auth.uid());

INSERT INTO public.tags (name, color, user_id)
SELECT 'AI_QUESTION', '#3b82f6', auth.uid()
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE name = 'AI_QUESTION' AND user_id = auth.uid());

-- Ensure Pipeline Stages Exist (Using a default pipeline if available, or creating one)
DO $$
DECLARE
    u_id uuid;
    p_id uuid;
BEGIN
    FOR u_id IN SELECT id FROM auth.users LOOP
        -- Get or Create Default Pipeline
        SELECT id INTO p_id FROM public.pipelines WHERE user_id = u_id LIMIT 1;
        
        IF p_id IS NULL THEN
            INSERT INTO public.pipelines (user_id, name, is_default)
            VALUES (u_id, 'Sales Pipeline', true)
            RETURNING id INTO p_id;
        END IF;

        -- Create Stages for this pipeline
        INSERT INTO public.pipeline_stages (pipeline_id, name, type, "order", user_id)
        SELECT p_id, 'Hot Leads', 'OPEN', 2, u_id
        WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id = p_id AND name = 'Hot Leads');

        INSERT INTO public.pipeline_stages (pipeline_id, name, type, "order", user_id)
        SELECT p_id, 'Cold Leads', 'OPEN', 3, u_id
        WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id = p_id AND name = 'Cold Leads');

        INSERT INTO public.pipeline_stages (pipeline_id, name, type, "order", user_id)
        SELECT p_id, 'Need Response', 'OPEN', 4, u_id
        WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE pipeline_id = p_id AND name = 'Need Response');
        
    END LOOP;
END $$;
