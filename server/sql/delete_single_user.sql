-- =================================================================
-- DELETE USER: Complete Version (Public + Auth tables)
-- =================================================================
-- ✅ Change the UUID on line 9. Each block re-sets the variable.
-- ⚠️ Run each "RUN #" block separately in the Supabase SQL Editor.
--    Skip any "table does not exist" errors — that's fine.
-- =================================================================

-- 🎯 TARGET USER UUID: dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd

-- ═══════════════════════════════════════════════════════════════════
-- PART A: PUBLIC SCHEMA (Your app data)
-- ═══════════════════════════════════════════════════════════════════

-- ─── RUN #1 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM tasks WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #2 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM appointments WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #3 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM leads WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #4 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM notes WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #5 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM call_logs WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #6 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM contacts WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #7 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM contact_groups WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #8 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM pipeline_stages WHERE pipeline_id IN (
    SELECT id FROM pipelines WHERE user_id = current_setting('app.delete_uid')::uuid
);

-- ─── RUN #9 ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM pipelines WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #10 ────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM tags WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #11 ────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM forms WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #12 ────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM user_integrations WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #13 ────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM user_subscriptions WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #14 ────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM profiles WHERE id = current_setting('app.delete_uid')::uuid;

-- ═══════════════════════════════════════════════════════════════════
-- PART B: AUTH SCHEMA (Supabase internal — this is what causes timeout)
-- ═══════════════════════════════════════════════════════════════════

-- ─── RUN #15: Delete MFA challenges (depends on mfa_factors) ────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.mfa_challenges WHERE factor_id IN (
    SELECT id FROM auth.mfa_factors WHERE user_id = current_setting('app.delete_uid')::uuid
);

-- ─── RUN #16: Delete MFA AMR claims (depends on sessions) ───────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.mfa_amr_claims WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id = current_setting('app.delete_uid')::uuid
);

-- ─── RUN #17: Delete refresh tokens ─────────────────────────────
-- Note: refresh_tokens.user_id is VARCHAR, not UUID
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.refresh_tokens WHERE session_id IN (
    SELECT id FROM auth.sessions WHERE user_id = current_setting('app.delete_uid')::uuid
);

-- ─── RUN #18: Delete sessions ───────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.sessions WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #19: Delete MFA factors ────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.mfa_factors WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #20: Delete identities ─────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.identities WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #21: Delete one-time tokens ────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.one_time_tokens WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #22: Delete flow state ─────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.flow_state WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #23: Delete OAuth authorizations ───────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.oauth_authorizations WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #24: Delete OAuth consents ─────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.oauth_consents WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #25: Delete WebAuthn data ──────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.webauthn_credentials WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ─── RUN #26: Delete WebAuthn challenges ────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.webauthn_challenges WHERE user_id = current_setting('app.delete_uid')::uuid;

-- ═══════════════════════════════════════════════════════════════════
-- PART C: FINAL DELETE (should be instant now — no child rows left)
-- ═══════════════════════════════════════════════════════════════════

-- ─── RUN #27 (FINAL) ────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
DELETE FROM auth.users WHERE id = current_setting('app.delete_uid')::uuid;

-- ─── VERIFY ─────────────────────────────────────────────────────
SET app.delete_uid = 'dcb60993-04a1-4f54-bc6b-2cc49f1b3ecd';
SELECT COUNT(*) AS remaining FROM auth.users WHERE id = current_setting('app.delete_uid')::uuid;
-- ✅ Should return 0.
