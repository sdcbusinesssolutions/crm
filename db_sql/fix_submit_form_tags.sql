-- Create secure submit_form function to bypass RLS for inserts
-- FIXED: Added tags to LEADS insert
CREATE OR REPLACE FUNCTION public.submit_form(
    p_form_token TEXT,
    p_submission_data JSONB,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_form RECORD;
    v_contact_id UUID;
    v_lead_id UUID;
    v_submission_id UUID;
    v_name TEXT;
    v_email TEXT;
    v_phone TEXT;
    v_company TEXT;
    v_tags TEXT[];
    v_group_ids TEXT[];
BEGIN
    -- Get Form
    SELECT * INTO v_form
    FROM public.forms
    WHERE form_token = p_form_token AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Form not found or inactive';
    END IF;

    -- Extract fields
    v_name := p_submission_data->>'name';
    v_email := p_submission_data->>'email';
    v_phone := p_submission_data->>'phone';
    v_company := p_submission_data->>'company';

    -- Extract tags and groups from settings
    -- Use COALESCE to handle nulls and ensure array type
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(v_form.settings->'default_tags') = 'array' 
                THEN v_form.settings->'default_tags' 
                ELSE '[]'::jsonb 
            END
        )
    ) INTO v_tags;

    SELECT ARRAY(
        SELECT jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(v_form.settings->'default_group_ids') = 'array' 
                THEN v_form.settings->'default_group_ids' 
                ELSE '[]'::jsonb 
            END
        )
    ) INTO v_group_ids;

    -- Create Contact
    INSERT INTO public.contacts (
        user_id, name, email, phone, status, source, tags, group_ids, custom_data
    ) VALUES (
        v_form.user_id,
        COALESCE(v_name, 'Unknown'),
        v_email,
        v_phone,
        'New',
        'Web Form',
        v_tags,
        v_group_ids,
        p_submission_data
    ) RETURNING id INTO v_contact_id;

    -- Create Lead
    IF v_form.pipeline_id IS NOT NULL THEN
        INSERT INTO public.leads (
            user_id, pipeline_id, stage_id, name, email, phone, company, custom_data, source, status, tags
        ) VALUES (
            v_form.user_id,
            v_form.pipeline_id,
            v_form.stage_id,
            COALESCE(v_name, 'Unknown'),
            v_email,
            v_phone,
            v_company,
            p_submission_data,
            'web_form',
            'active',
            v_tags
        ) RETURNING id INTO v_lead_id;
    END IF;

    -- Create Submission
    INSERT INTO public.form_submissions (
        form_id, lead_id, submission_data, ip_address, user_agent
    ) VALUES (
        v_form.id,
        v_lead_id,
        p_submission_data,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_submission_id;

    -- Update Count
    UPDATE public.forms
    SET submission_count = submission_count + 1
    WHERE id = v_form.id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission_id,
        'lead_id', v_lead_id,
        'contact_id', v_contact_id,
        'message', v_form.success_message
    );
END;
$$;
