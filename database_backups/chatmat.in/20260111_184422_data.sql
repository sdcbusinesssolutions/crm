--
-- PostgreSQL database dump
--

\restrict dbVIm4bExo4yhTq0JuBkx4MnPzVUm2JMgvAX8Kuw3GHKbCJ6idImTUctJi78aGj

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	9262c56e-5847-42e1-9326-78d193bf5bf9	authenticated	authenticated	kd31967@gmail.com	$2a$10$R0Sh39HgG0ejvFmTWW0hEOqjqDT1XZf9JVaJIlk9zpfbMRheecKe6	2026-01-11 11:06:08.635226+00	\N		\N		\N			\N	2026-01-11 18:05:10.115633+00	{"provider": "email", "providers": ["email"]}	{"sub": "9262c56e-5847-42e1-9326-78d193bf5bf9", "email": "kd31967@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-01-11 11:06:08.615085+00	2026-01-11 18:05:10.119663+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
9262c56e-5847-42e1-9326-78d193bf5bf9	9262c56e-5847-42e1-9326-78d193bf5bf9	{"sub": "9262c56e-5847-42e1-9326-78d193bf5bf9", "email": "kd31967@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-01-11 11:06:08.631427+00	2026-01-11 11:06:08.631481+00	2026-01-11 11:06:08.631481+00	e90572f9-ac8a-468f-a6b8-10541ef168ef
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
0024d9e8-e6c4-419f-aee0-e764f2b87f55	9262c56e-5847-42e1-9326-78d193bf5bf9	2026-01-11 11:06:08.640865+00	2026-01-11 15:38:52.935256+00	\N	aal1	\N	2026-01-11 15:38:52.935165	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	103.58.7.96	\N	\N	\N	\N	\N
186882db-b519-4d84-b6ba-d198ead31ff2	9262c56e-5847-42e1-9326-78d193bf5bf9	2026-01-11 18:05:10.115728+00	2026-01-11 18:05:10.115728+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	103.58.7.96	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
0024d9e8-e6c4-419f-aee0-e764f2b87f55	2026-01-11 11:06:08.646885+00	2026-01-11 11:06:08.646885+00	password	a3d7a1c2-128a-4e8f-ac99-6ebdc8cd9100
186882db-b519-4d84-b6ba-d198ead31ff2	2026-01-11 18:05:10.120647+00	2026-01-11 18:05:10.120647+00	password	3a59480b-63fe-4081-87a4-9080966c01d6
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	1	nmj2pkfx4zs6	9262c56e-5847-42e1-9326-78d193bf5bf9	t	2026-01-11 11:06:08.643267+00	2026-01-11 12:55:00.641878+00	\N	0024d9e8-e6c4-419f-aee0-e764f2b87f55
00000000-0000-0000-0000-000000000000	2	lkfqy5wvh4d4	9262c56e-5847-42e1-9326-78d193bf5bf9	t	2026-01-11 12:55:00.642824+00	2026-01-11 13:56:36.984622+00	nmj2pkfx4zs6	0024d9e8-e6c4-419f-aee0-e764f2b87f55
00000000-0000-0000-0000-000000000000	3	2fegglrnu3px	9262c56e-5847-42e1-9326-78d193bf5bf9	t	2026-01-11 13:56:36.985406+00	2026-01-11 15:38:52.9315+00	lkfqy5wvh4d4	0024d9e8-e6c4-419f-aee0-e764f2b87f55
00000000-0000-0000-0000-000000000000	4	etckdr3ma6oz	9262c56e-5847-42e1-9326-78d193bf5bf9	f	2026-01-11 15:38:52.932297+00	2026-01-11 15:38:52.932297+00	2fegglrnu3px	0024d9e8-e6c4-419f-aee0-e764f2b87f55
00000000-0000-0000-0000-000000000000	5	rln76r4qr3bl	9262c56e-5847-42e1-9326-78d193bf5bf9	f	2026-01-11 18:05:10.1179+00	2026-01-11 18:05:10.1179+00	\N	186882db-b519-4d84-b6ba-d198ead31ff2
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pipelines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pipelines (id, user_id, name, description, color, is_active, created_at, updated_at, is_default) FROM stdin;
\.


--
-- Data for Name: pipeline_stages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pipeline_stages (id, user_id, pipeline_id, name, description, color, display_order, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leads (id, user_id, pipeline_id, stage_id, name, email, phone, company, tags, custom_data, status, priority, estimated_value, source, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, lead_id, user_id, title, description, start_time, end_time, created_at, updated_at, status) FROM stdin;
\.


--
-- Data for Name: branding_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branding_settings (id, user_id, theme_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: call_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.call_logs (id, lead_id, user_id, call_type, duration, notes, called_at, created_at) FROM stdin;
\.


--
-- Data for Name: whatsapp_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_templates (id, user_id, name, language, category, template_type, header_format, header_text, header_media_handle, body_text, footer_text, buttons, status, meta_template_id, created_at, updated_at, quality_score) FROM stdin;
\.


--
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campaigns (id, user_id, title, template_id, template_name, language_code, contact_group_id, scheduled_at, variable_mapping, status, total_contacts, success_count, failed_count, created_at, media_url, media_type, location_header) FROM stdin;
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contacts (id, user_id, name, phone, email, status, source, tags, group_ids, custom_data, created_at, last_active) FROM stdin;
e64d2b8c-0365-4962-b3aa-27bbf9bf4215	9262c56e-5847-42e1-9326-78d193bf5bf9	test	918408907516	dev@gmail.com	New	Manual	{f2}	{}	{}	2026-01-11 11:18:24.558458+00	2026-01-11 11:18:24.558458+00
\.


--
-- Data for Name: campaign_queue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.campaign_queue (id, campaign_id, contact_id, phone_number, status, message_id, error_message, sent_at, retry_count, next_retry_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contact_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contact_groups (id, user_id, name, description, status, created_at, org_id) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.conversations (id, user_id, contact_phone, contact_name, last_message, unread_count, status, tags, assigned_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: custom_fields; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.custom_fields (id, user_id, name, type, placeholder, created_at) FROM stdin;
\.


--
-- Data for Name: flows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flows (id, user_id, name, description, status, nodes, edges, created_at, updated_at, trigger_keywords) FROM stdin;
\.


--
-- Data for Name: flow_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flow_sessions (id, user_id, contact_phone, flow_id, current_node_id, status, variables, last_interaction_at, created_at) FROM stdin;
\.


--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_submissions (id, form_id, lead_id, submission_data, ip_address, user_agent, submitted_at) FROM stdin;
\.


--
-- Data for Name: forms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.forms (id, user_id, pipeline_id, stage_id, name, description, form_token, fields, settings, is_active, created_at, updated_at, styling, success_message, submission_count, default_group_ids, default_tags, default_owner_id, success_redirect_url, last_submission_at) FROM stdin;
\.


--
-- Data for Name: integration_facebook_pages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.integration_facebook_pages (id, user_id, page_id, page_name, page_access_token, is_connected, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, conversation_id, type, text, media_url, filename, mime_type, latitude, longitude, direction, status, created_at, whatsapp_message_id, updated_at) FROM stdin;
\.


--
-- Data for Name: meta_limits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.meta_limits (id, user_id, waba_id, tier, daily_limit, updated_at) FROM stdin;
\.


--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notes (id, lead_id, user_id, title, content, tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: onboarding_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.onboarding_settings (user_id, manual_enabled, embedded_enabled, embedded_app_id, embedded_app_secret, embedded_config_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans (id, created_at, name, is_active, limits, pricing, ai_bot_enabled, api_access_enabled) FROM stdin;
515f7c46-02c1-4553-b7a0-e1019bc5985d	2026-01-11 11:16:48.757524+00	test	t	{"contacts": -1, "bot_flows": -1, "campaigns": -1, "bot_replies": -1, "team_members": -1, "custom_fields": -1}	[{"id": "monthly", "name": "Monthly", "amount": 500, "enabled": true, "interval": "month", "price_id": "", "interval_count": 1}, {"id": "quarterly", "name": "Quarterly", "amount": 0, "enabled": false, "interval": "month", "price_id": "", "interval_count": 3}, {"id": "half_yearly", "name": "Half Yearly", "amount": 0, "enabled": false, "interval": "month", "price_id": "", "interval_count": 6}, {"id": "yearly", "name": "Yearly", "amount": 0, "enabled": false, "interval": "year", "price_id": "", "interval_count": 1}]	f	f
\.


--
-- Data for Name: stages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stages (id, pipeline_id, name, description, color, "position", is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tags (id, user_id, name, description, color, created_at, updated_at) FROM stdin;
ab9d93d4-ab13-4756-9b92-91e74e1655aa	9262c56e-5847-42e1-9326-78d193bf5bf9	f2	\N	#10b981	2026-01-11 11:18:24.276877+00	2026-01-11 11:18:24.276877+00
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, lead_id, user_id, title, description, due_date, completed, created_at, updated_at, is_completed, reminder_sent, metadata) FROM stdin;
\.


--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.team_members (id, owner_id, user_id, first_name, last_name, email, phone, role, status, permissions, last_login, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_integrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_integrations (id, user_id, provider, connection_name, credentials, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_security; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_security (id, user_id, two_factor_secret, two_factor_enabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_subscriptions (id, created_at, user_id, plan_id, start_date, end_date, status, payment_term, amount, currency) FROM stdin;
\.


--
-- Data for Name: webhook_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.webhook_logs (id, user_id, http_method, raw_payload, processed_status, message_type, sender_phone, extracted_content, error_message, created_at, updated_at, phone_number_id, webhook_id) FROM stdin;
\.


--
-- Data for Name: whatsapp_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_config (id, user_id, phone_number, phone_number_id, whatsapp_business_account_id, meta_app_id, meta_access_token, verify_token, created_at, updated_at, name, access_token) FROM stdin;
\.


--
-- Data for Name: whatsapp_flow_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_flow_submissions (id, user_id, flow_id, flow_name, contact_phone, contact_name, submission_data, submitted_at, created_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-01-10 18:44:14
20211116045059	2026-01-10 18:44:15
20211116050929	2026-01-10 18:44:16
20211116051442	2026-01-10 18:44:16
20211116212300	2026-01-10 18:44:17
20211116213355	2026-01-10 18:44:18
20211116213934	2026-01-10 18:44:18
20211116214523	2026-01-10 18:44:19
20211122062447	2026-01-10 18:44:20
20211124070109	2026-01-10 18:44:20
20211202204204	2026-01-10 18:44:21
20211202204605	2026-01-10 18:44:21
20211210212804	2026-01-10 18:44:24
20211228014915	2026-01-10 18:44:24
20220107221237	2026-01-10 18:44:25
20220228202821	2026-01-10 18:44:25
20220312004840	2026-01-10 18:44:26
20220603231003	2026-01-10 18:44:27
20220603232444	2026-01-10 18:44:28
20220615214548	2026-01-10 18:44:28
20220712093339	2026-01-10 18:44:29
20220908172859	2026-01-10 18:44:30
20220916233421	2026-01-10 18:44:30
20230119133233	2026-01-10 18:44:31
20230128025114	2026-01-10 18:44:32
20230128025212	2026-01-10 18:44:32
20230227211149	2026-01-10 18:44:33
20230228184745	2026-01-10 18:44:34
20230308225145	2026-01-10 18:44:34
20230328144023	2026-01-10 18:44:35
20231018144023	2026-01-10 18:44:36
20231204144023	2026-01-10 18:44:37
20231204144024	2026-01-10 18:44:37
20231204144025	2026-01-10 18:44:38
20240108234812	2026-01-10 18:44:38
20240109165339	2026-01-10 18:44:39
20240227174441	2026-01-10 18:44:40
20240311171622	2026-01-10 18:44:41
20240321100241	2026-01-10 18:44:42
20240401105812	2026-01-10 18:44:44
20240418121054	2026-01-10 18:44:45
20240523004032	2026-01-10 18:44:47
20240618124746	2026-01-10 18:44:48
20240801235015	2026-01-10 18:44:48
20240805133720	2026-01-10 18:44:49
20240827160934	2026-01-10 18:44:50
20240919163303	2026-01-10 18:44:50
20240919163305	2026-01-10 18:44:51
20241019105805	2026-01-10 18:44:52
20241030150047	2026-01-10 18:44:54
20241108114728	2026-01-10 18:44:55
20241121104152	2026-01-10 18:44:56
20241130184212	2026-01-10 18:44:56
20241220035512	2026-01-10 18:44:57
20241220123912	2026-01-10 18:44:58
20241224161212	2026-01-10 18:44:58
20250107150512	2026-01-10 18:44:59
20250110162412	2026-01-10 18:44:59
20250123174212	2026-01-10 18:45:00
20250128220012	2026-01-10 18:45:01
20250506224012	2026-01-10 18:45:01
20250523164012	2026-01-10 18:45:02
20250714121412	2026-01-10 18:45:02
20250905041441	2026-01-10 18:45:03
20251103001201	2026-01-10 18:45:04
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: -
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
campaign-media	campaign-media	\N	2026-01-11 13:05:03.44113+00	2026-01-11 13:05:03.44113+00	t	f	52428800	{image/png,image/jpeg,image/jpg,image/gif,image/webp,video/mp4,video/3gpp,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation}	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-01-10 18:44:13.643179
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-01-10 18:44:13.651747
2	storage-schema	5c7968fd083fcea04050c1b7f6253c9771b99011	2026-01-10 18:44:13.655786
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-01-10 18:44:13.669884
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-01-10 18:44:13.678544
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-01-10 18:44:13.682639
6	change-column-name-in-get-size	f93f62afdf6613ee5e7e815b30d02dc990201044	2026-01-10 18:44:13.688898
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-01-10 18:44:13.693751
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-01-10 18:44:13.697975
9	fix-search-function	3a0af29f42e35a4d101c259ed955b67e1bee6825	2026-01-10 18:44:13.702667
10	search-files-search-function	68dc14822daad0ffac3746a502234f486182ef6e	2026-01-10 18:44:13.707325
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-01-10 18:44:13.71216
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-01-10 18:44:13.716817
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-01-10 18:44:13.720996
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-01-10 18:44:13.725651
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-01-10 18:44:13.74189
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-01-10 18:44:13.746487
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-01-10 18:44:13.750926
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-01-10 18:44:13.755122
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-01-10 18:44:13.760071
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-01-10 18:44:13.764623
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-01-10 18:44:13.773399
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-01-10 18:44:13.787284
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-01-10 18:44:13.797476
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-01-10 18:44:13.803522
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-01-10 18:44:13.808099
26	objects-prefixes	ef3f7871121cdc47a65308e6702519e853422ae2	2026-01-10 18:44:13.813882
27	search-v2	33b8f2a7ae53105f028e13e9fcda9dc4f356b4a2	2026-01-10 18:44:13.825001
28	object-bucket-name-sorting	ba85ec41b62c6a30a3f136788227ee47f311c436	2026-01-10 18:44:13.885616
29	create-prefixes	a7b1a22c0dc3ab630e3055bfec7ce7d2045c5b7b	2026-01-10 18:44:13.891331
30	update-object-levels	6c6f6cc9430d570f26284a24cf7b210599032db7	2026-01-10 18:44:13.895374
31	objects-level-index	33f1fef7ec7fea08bb892222f4f0f5d79bab5eb8	2026-01-10 18:44:13.901929
32	backward-compatible-index-on-objects	2d51eeb437a96868b36fcdfb1ddefdf13bef1647	2026-01-10 18:44:13.90889
33	backward-compatible-index-on-prefixes	fe473390e1b8c407434c0e470655945b110507bf	2026-01-10 18:44:13.915937
34	optimize-search-function-v1	82b0e469a00e8ebce495e29bfa70a0797f7ebd2c	2026-01-10 18:44:13.917888
35	add-insert-trigger-prefixes	63bb9fd05deb3dc5e9fa66c83e82b152f0caf589	2026-01-10 18:44:13.923844
36	optimise-existing-functions	81cf92eb0c36612865a18016a38496c530443899	2026-01-10 18:44:13.92949
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-01-10 18:44:13.938052
38	iceberg-catalog-flag-on-buckets	19a8bd89d5dfa69af7f222a46c726b7c41e462c5	2026-01-10 18:44:13.942801
39	add-search-v2-sort-support	39cf7d1e6bf515f4b02e41237aba845a7b492853	2026-01-10 18:44:13.951058
40	fix-prefix-race-conditions-optimized	fd02297e1c67df25a9fc110bf8c8a9af7fb06d1f	2026-01-10 18:44:13.956145
41	add-object-level-update-trigger	44c22478bf01744b2129efc480cd2edc9a7d60e9	2026-01-10 18:44:13.964484
42	rollback-prefix-triggers	f2ab4f526ab7f979541082992593938c05ee4b47	2026-01-10 18:44:13.96995
43	fix-object-level	ab837ad8f1c7d00cc0b7310e989a23388ff29fc6	2026-01-10 18:44:13.975707
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-01-10 18:44:13.980407
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-01-10 18:44:13.98776
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-01-10 18:44:14.001243
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-01-10 18:44:14.006033
48	iceberg-catalog-ids	2666dff93346e5d04e0a878416be1d5fec345d6f	2026-01-10 18:44:14.01036
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-01-10 18:44:14.024805
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, level) FROM stdin;
\.


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.prefixes (bucket_id, name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: -
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 5, true);


--
-- Name: meta_limits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.meta_limits_id_seq', 1, false);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: -
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict dbVIm4bExo4yhTq0JuBkx4MnPzVUm2JMgvAX8Kuw3GHKbCJ6idImTUctJi78aGj

