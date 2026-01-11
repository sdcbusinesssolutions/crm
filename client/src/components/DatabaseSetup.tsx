import React, { useState } from 'react';
import Modal from './Modal';
import { CopyIcon, CheckIcon } from './icons';

interface DatabaseSetupProps {
    isOpen: boolean;
    onClose: () => void;
}

const FIX_RLS_SCRIPT = `-- =====================================================
-- FIX RLS RECURSION IN ORG POLICIES (FINAL FIX)
-- =====================================================

-- 1. Create a SECURITY DEFINER function to get user's org IDs
-- This bypasses RLS to prevent recursion when querying org_members
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN ARRAY(
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid()
  );
END;
$$;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view orgs they are members of" ON public.orgs;
DROP POLICY IF EXISTS "Users can view members of their orgs" ON public.org_members;
DROP POLICY IF EXISTS "Users can view org members" ON public.org_members;

-- 3. Re-create policies using the helper function
-- This avoids the table self-reference within the policy check

-- Policy for Orgs
CREATE POLICY "Users can view orgs they are members of"
  ON public.orgs FOR SELECT
  USING (
    id = ANY(get_my_org_ids())
  );

-- Policy for Org Members
CREATE POLICY "Users can view members of their orgs"
  ON public.org_members FOR SELECT
  USING (
    org_id = ANY(get_my_org_ids())
  );

-- Enable INSERT for Orgs (Authenticated users can create orgs)
DROP POLICY IF EXISTS "Users can create organizations" ON public.orgs;
CREATE POLICY "Users can create organizations" 
  ON public.orgs FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Enable INSERT for Org Members (Users can add themselves when creating org)
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.org_members;
CREATE POLICY "Users can insert their own membership" 
  ON public.org_members FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- ENSURE FORM DEFINITIONS COLUMNS EXIST
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'form_definitions' AND column_name = 'settings'
  ) THEN
    ALTER TABLE public.form_definitions 
    ADD COLUMN settings JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- =====================================================
-- UPDATE SUBMIT_FORM FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_form(
  p_form_token TEXT,
  p_submission_data JSONB,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_form_id UUID;
  v_org_id UUID;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_owner_id UUID;
  v_tags TEXT[];
  v_group_ids UUID[];
  v_lead_id UUID;
  v_submission_id UUID;
  v_name TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_company TEXT;
  v_custom_fields JSONB;
BEGIN
  -- Get form details
  SELECT 
    id, org_id, pipeline_id, stage_id, default_owner_id, 
    default_tags, default_group_ids, is_active
  INTO 
    v_form_id, v_org_id, v_pipeline_id, v_stage_id, v_owner_id,
    v_tags, v_group_ids
  FROM public.form_definitions
  WHERE form_token = p_form_token AND is_active = true;

  -- Check if form exists
  IF v_form_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Form not found or inactive'
    );
  END IF;

  -- Extract standard fields
  v_name := p_submission_data->>'name';
  v_email := p_submission_data->>'email';
  v_phone := p_submission_data->>'phone';
  v_company := p_submission_data->>'company';

  -- Build custom fields (exclude standard fields)
  v_custom_fields := p_submission_data - ARRAY['name', 'email', 'phone', 'company'];

  -- Create lead
  INSERT INTO public.leads (
    org_id,
    name,
    email,
    phone,
    company,
    pipeline_id,
    stage_id,
    owner_id,
    tags,
    group_ids,
    custom_fields,
    source,
    source_details,
    status
  ) VALUES (
    v_org_id,
    v_name,
    v_email,
    v_phone,
    v_company,
    v_pipeline_id,
    v_stage_id,
    v_owner_id,
    v_tags,
    v_group_ids,
    v_custom_fields,
    'web_form',
    jsonb_build_object(
      'form_id', v_form_id,
      'form_token', p_form_token,
      'ip_address', p_ip_address,
      'user_agent', p_user_agent,
      'referrer', p_referrer
    ),
    'active'
  ) RETURNING id INTO v_lead_id;

  -- Create form submission record
  INSERT INTO public.form_submissions (
    form_id,
    lead_id,
    submission_data,
    ip_address,
    user_agent,
    referrer
  ) VALUES (
    v_form_id,
    v_lead_id,
    v_submission_data,
    p_ip_address::INET,
    p_user_agent,
    p_referrer
  ) RETURNING id INTO v_submission_id;

  -- Update form submission count
  UPDATE public.form_definitions
  SET 
    submission_count = submission_count + 1,
    last_submission_at = timezone('utc'::text, now())
  WHERE id = v_form_id;

  -- Log event
  INSERT INTO public.lead_events (
    lead_id,
    org_id,
    event_type,
    event_data
  ) VALUES (
    v_lead_id,
    v_org_id,
    'form_submitted',
    jsonb_build_object(
      'form_id', v_form_id,
      'submission_id', v_submission_id
    )
  );

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'lead_id', v_lead_id,
    'submission_id', v_submission_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

const DatabaseSetup: React.FC<DatabaseSetupProps> = ({ isOpen, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(FIX_RLS_SCRIPT);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Database Setup Required"
            footer={
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                    I've Run the Script
                </button>
            }
        >
            <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                    <p className="font-bold mb-1">Action Required</p>
                    <p>
                        We detected a database configuration issue (RLS Policy Recursion). This prevents creating pipelines and forms.
                        Please run the SQL script below in your Supabase SQL Editor to fix it.
                    </p>
                </div>

                <div className="relative">
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-medium transition-colors border border-white/20"
                        >
                            {copied ? (
                                <>
                                    <CheckIcon className="w-3 h-3" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <CopyIcon className="w-3 h-3" />
                                    Copy SQL
                                </>
                            )}
                        </button>
                    </div>
                    <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg text-xs overflow-x-auto font-mono h-64 custom-scrollbar">
                        {FIX_RLS_SCRIPT}
                    </pre>
                </div>

                <div className="text-xs text-slate-500">
                    <p className="font-bold mb-1">How to run this:</p>
                    <ol className="list-decimal list-inside space-y-1">
                        <li>Go to your Supabase Dashboard</li>
                        <li>Navigate to the <strong>SQL Editor</strong></li>
                        <li>Click <strong>New Query</strong></li>
                        <li>Paste the code above and click <strong>Run</strong></li>
                    </ol>
                </div>
            </div>
        </Modal>
    );
};

export default DatabaseSetup;
