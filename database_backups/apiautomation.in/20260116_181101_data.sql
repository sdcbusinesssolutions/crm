--
-- PostgreSQL database dump
--

\restrict bROsM6Nj1XOpUWAPo0U0KneP8U7X2auCrV7n6h8ECnohtw0Ns0wOpARKYW3FKD8

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
00000000-0000-0000-0000-000000000000	399867dc-80ae-44e9-bcb3-caf923003291	authenticated	authenticated	kd31967@gmail.com	$2a$10$t8NA2lfGg4Jzi5ul6LHcv.6/iTy.iH/xzbUdLEzwaWq3SW8Ymlk2K	2026-01-14 16:56:04.572633+00	\N		\N		2026-01-16 08:37:24.165542+00			\N	2026-01-16 15:31:48.663606+00	{"provider": "email", "providers": ["email"]}	{"sub": "399867dc-80ae-44e9-bcb3-caf923003291", "email": "kd31967@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-01-14 16:56:04.54853+00	2026-01-16 15:31:48.665729+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	2dd4a1d4-6d81-4fb1-9ca2-7d133d91de7f	authenticated	authenticated	ram1@gmail.com	$2a$10$me6AF22QqNluJMjnhGK1SeCE5U9fIspkwCTrXp4VWGVQxMOOT946q	2026-01-15 14:57:47.933543+00	\N		\N		2026-01-15 18:02:24.925241+00			\N	2026-01-15 18:02:25.338454+00	{"provider": "email", "providers": ["email"]}	{"role": "admin", "phone": "", "full_name": "ramkumar", "signup_domain": "apiautomation.in", "email_verified": true}	\N	2026-01-15 14:57:47.927654+00	2026-01-15 18:02:25.341275+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	523e0049-94aa-4dfd-8b9f-fac1129c8ae7	authenticated	authenticated	ap2@gmail.com	$2a$10$LrRdMZ/5n1ZRRYi/Brrd5.W0sOnCukOuo1hvuHK9G9dYGL69y9pPm	2026-01-15 18:35:48.472602+00	\N		\N		2026-01-16 15:33:23.166801+00			\N	2026-01-16 15:33:23.765016+00	{"provider": "email", "providers": ["email"]}	{"sub": "523e0049-94aa-4dfd-8b9f-fac1129c8ae7", "email": "ap2@gmail.com", "signup_domain": "apiautomation.in", "email_verified": true, "phone_verified": false}	\N	2026-01-15 18:35:48.46363+00	2026-01-16 15:33:23.768102+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b7962153-b41d-4132-bc41-73cb84600760	authenticated	authenticated	koshik865@gmail.com	$2a$10$KOOJajEyZ6Pc4BvHxV5v.OEciZj5XTwwy52kmQg/uw3BwE5C/l8pW	2026-01-16 15:58:44.302817+00	\N		\N		\N			\N	2026-01-16 16:46:51.681727+00	{"provider": "email", "providers": ["email"]}	{"sub": "b7962153-b41d-4132-bc41-73cb84600760", "email": "koshik865@gmail.com", "signup_domain": "apiautomation.in", "email_verified": true, "phone_verified": false}	\N	2026-01-16 15:58:44.292792+00	2026-01-16 16:46:51.684553+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	35d4fe7d-753d-43da-85fb-a32b6f66133e	authenticated	authenticated	ap1@gmail.com	$2a$10$qe7wlsukWDHt6EfJwNf.9eWD1BO1CpB34UpvjV2h8oyCfd7jd8O7K	2026-01-15 13:00:59.508547+00	\N		\N		2026-01-16 15:35:27.608651+00			\N	2026-01-16 15:38:16.078569+00	{"provider": "email", "providers": ["email"]}	{"sub": "35d4fe7d-753d-43da-85fb-a32b6f66133e", "email": "ap1@gmail.com", "phone": "", "full_name": "User", "email_verified": true, "phone_verified": false}	\N	2026-01-15 13:00:59.499174+00	2026-01-16 18:07:33.625751+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b812fe65-ce42-452c-9732-956818cf8d89	authenticated	authenticated	dev@gmail.com	$2a$10$/RLSFfee3caN1fEBHuIsmeqhgL7XcV8poZ/GZh829zoQ4aKgBNvlG	2026-01-16 06:05:29.519432+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "admin", "phone": "", "full_name": "dev", "signup_domain": "clickube.com", "email_verified": true}	\N	2026-01-16 06:05:29.513668+00	2026-01-16 06:05:29.520594+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
399867dc-80ae-44e9-bcb3-caf923003291	399867dc-80ae-44e9-bcb3-caf923003291	{"sub": "399867dc-80ae-44e9-bcb3-caf923003291", "email": "kd31967@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-01-14 16:56:04.568781+00	2026-01-14 16:56:04.568849+00	2026-01-14 16:56:04.568849+00	ecbc8af7-4739-4897-b882-aeab0be924ea
2dd4a1d4-6d81-4fb1-9ca2-7d133d91de7f	2dd4a1d4-6d81-4fb1-9ca2-7d133d91de7f	{"sub": "2dd4a1d4-6d81-4fb1-9ca2-7d133d91de7f", "email": "ram1@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-01-15 14:57:47.931733+00	2026-01-15 14:57:47.931809+00	2026-01-15 14:57:47.931809+00	c90bfd26-fc0c-4709-8e1b-95e9efed4d09
35d4fe7d-753d-43da-85fb-a32b6f66133e	35d4fe7d-753d-43da-85fb-a32b6f66133e	{"sub": "35d4fe7d-753d-43da-85fb-a32b6f66133e", "email": "ap1@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-01-15 13:00:59.505463+00	2026-01-15 13:00:59.505531+00	2026-01-15 13:00:59.505531+00	30c99df6-1584-4ffb-ab14-97fcb7e4135a
523e0049-94aa-4dfd-8b9f-fac1129c8ae7	523e0049-94aa-4dfd-8b9f-fac1129c8ae7	{"sub": "523e0049-94aa-4dfd-8b9f-fac1129c8ae7", "email": "ap2@gmail.com", "signup_domain": "apiautomation.in", "email_verified": false, "phone_verified": false}	email	2026-01-15 18:35:48.469658+00	2026-01-15 18:35:48.469709+00	2026-01-15 18:35:48.469709+00	687187d5-3ee9-412e-9ad4-2408f692af7c
b812fe65-ce42-452c-9732-956818cf8d89	b812fe65-ce42-452c-9732-956818cf8d89	{"sub": "b812fe65-ce42-452c-9732-956818cf8d89", "email": "dev@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-01-16 06:05:29.517225+00	2026-01-16 06:05:29.517283+00	2026-01-16 06:05:29.517283+00	6e4a4165-6f60-4d6e-b851-37ba87f98e65
b7962153-b41d-4132-bc41-73cb84600760	b7962153-b41d-4132-bc41-73cb84600760	{"sub": "b7962153-b41d-4132-bc41-73cb84600760", "email": "koshik865@gmail.com", "signup_domain": "apiautomation.in", "email_verified": false, "phone_verified": false}	email	2026-01-16 15:58:44.299535+00	2026-01-16 15:58:44.29959+00	2026-01-16 15:58:44.29959+00	cc205fb5-49ec-4ee8-b74d-e6cae616802c
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
595d74ec-bfe6-4513-a24b-7c2fa164c6b6	399867dc-80ae-44e9-bcb3-caf923003291	2026-01-16 11:40:20.915098+00	2026-01-16 11:40:20.915098+00	\N	aal1	\N	\N	undici	145.79.15.115	\N	\N	\N	\N	\N
e5455816-6b9f-4c12-a1e2-c833d81634b2	399867dc-80ae-44e9-bcb3-caf923003291	2026-01-16 11:40:21.260046+00	2026-01-16 11:40:21.260046+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	103.58.7.96	\N	\N	\N	\N	\N
a702fd83-ed6b-4e76-a86c-eb45cfb6db3c	399867dc-80ae-44e9-bcb3-caf923003291	2026-01-16 15:31:48.088013+00	2026-01-16 15:31:48.088013+00	\N	aal1	\N	\N	undici	145.79.15.115	\N	\N	\N	\N	\N
f571d7b4-9199-402b-87b3-1258a065ff09	399867dc-80ae-44e9-bcb3-caf923003291	2026-01-16 15:31:48.663723+00	2026-01-16 15:31:48.663723+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	103.58.7.96	\N	\N	\N	\N	\N
a99e8c68-35b7-4c5e-951e-fb04e69f8556	523e0049-94aa-4dfd-8b9f-fac1129c8ae7	2026-01-16 15:33:23.765129+00	2026-01-16 15:33:23.765129+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	103.58.7.96	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
595d74ec-bfe6-4513-a24b-7c2fa164c6b6	2026-01-16 11:40:20.920022+00	2026-01-16 11:40:20.920022+00	password	199434f2-1793-4e35-9d57-43f8394c3d33
e5455816-6b9f-4c12-a1e2-c833d81634b2	2026-01-16 11:40:21.262753+00	2026-01-16 11:40:21.262753+00	password	2048ab1c-1790-45a0-8f83-05ef6ef32f2c
a702fd83-ed6b-4e76-a86c-eb45cfb6db3c	2026-01-16 15:31:48.093768+00	2026-01-16 15:31:48.093768+00	password	139fb4e6-175d-4d99-8dde-caf654903486
f571d7b4-9199-402b-87b3-1258a065ff09	2026-01-16 15:31:48.666092+00	2026-01-16 15:31:48.666092+00	password	9b927e89-162b-4b60-b57a-343169c2f42a
a99e8c68-35b7-4c5e-951e-fb04e69f8556	2026-01-16 15:33:23.768596+00	2026-01-16 15:33:23.768596+00	otp	69388787-bd70-4dba-a0db-290069aaf050
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
00000000-0000-0000-0000-000000000000	105	ho2gjptle52a	399867dc-80ae-44e9-bcb3-caf923003291	f	2026-01-16 11:40:20.917368+00	2026-01-16 11:40:20.917368+00	\N	595d74ec-bfe6-4513-a24b-7c2fa164c6b6
00000000-0000-0000-0000-000000000000	106	mr7ks26gy64h	399867dc-80ae-44e9-bcb3-caf923003291	f	2026-01-16 11:40:21.261205+00	2026-01-16 11:40:21.261205+00	\N	e5455816-6b9f-4c12-a1e2-c833d81634b2
00000000-0000-0000-0000-000000000000	108	6awpofatznda	399867dc-80ae-44e9-bcb3-caf923003291	f	2026-01-16 15:31:48.089928+00	2026-01-16 15:31:48.089928+00	\N	a702fd83-ed6b-4e76-a86c-eb45cfb6db3c
00000000-0000-0000-0000-000000000000	109	nldq647alqad	399867dc-80ae-44e9-bcb3-caf923003291	f	2026-01-16 15:31:48.664738+00	2026-01-16 15:31:48.664738+00	\N	f571d7b4-9199-402b-87b3-1258a065ff09
00000000-0000-0000-0000-000000000000	110	virmcx5pll2h	523e0049-94aa-4dfd-8b9f-fac1129c8ae7	f	2026-01-16 15:33:23.76656+00	2026-01-16 15:33:23.76656+00	\N	a99e8c68-35b7-4c5e-951e-fb04e69f8556
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
64a29c02-b1cb-43a0-8f45-c7d9c81eb0a3	35d4fe7d-753d-43da-85fb-a32b6f66133e	{"id": "ocean", "name": "Ocean Blue", "colors": {"text": "#0c4a6e", "brand": "#0ea5e9", "border": "#e2e8f0", "inputBg": "#ffffff", "surface": "#ffffff", "background": "#f8fafc", "sidebarText": "#0369a1", "sidebarActiveBg": "#e0f2fe"}, "appName": "ap1", "buttonStyle": "rounded", "sidebarDisplay": "both"}	2026-01-15 18:06:08.740533+00	2026-01-15 19:15:17.575+00
99326484-76f3-46ff-8186-35d21fbcde00	523e0049-94aa-4dfd-8b9f-fac1129c8ae7	{"id": "default", "name": "Default", "colors": {"text": "#0f172a", "brand": "#ea580c", "border": "#e2e8f0", "inputBg": "#ffffff", "surface": "#ffffff", "background": "#f8fafc", "sidebarText": "#475569", "sidebarActiveBg": "#fff7ed"}, "appName": "ap2", "appNameType": "image", "buttonStyle": "rounded", "maxFileSize": 16, "sidebarDisplay": "both", "appNameImageUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAIAAACWMwO2AAAACXBIWXMAAA7EAAAOxAGVKw4bAAAFE2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSfvu78nIGlkPSdXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQnPz4KPHg6eG1wbWV0YSB4bWxuczp4PSdhZG9iZTpuczptZXRhLyc+CjxyZGY6UkRGIHhtbG5zOnJkZj0naHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyc+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpBdHRyaWI9J2h0dHA6Ly9ucy5hdHRyaWJ1dGlvbi5jb20vYWRzLzEuMC8nPgogIDxBdHRyaWI6QWRzPgogICA8cmRmOlNlcT4KICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0nUmVzb3VyY2UnPgogICAgIDxBdHRyaWI6Q3JlYXRlZD4yMDI2LTAxLTA5PC9BdHRyaWI6Q3JlYXRlZD4KICAgICA8QXR0cmliOkV4dElkPjY3MmIxMWMwLWM1NTMtNDg1Mi04ZTU2LTJlZmQ3NDFmMjA3ODwvQXR0cmliOkV4dElkPgogICAgIDxBdHRyaWI6RmJJZD41MjUyNjU5MTQxNzk1ODA8L0F0dHJpYjpGYklkPgogICAgIDxBdHRyaWI6VG91Y2hUeXBlPjI8L0F0dHJpYjpUb3VjaFR5cGU+CiAgICA8L3JkZjpsaT4KICAgPC9yZGY6U2VxPgogIDwvQXR0cmliOkFkcz4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6ZGM9J2h0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvJz4KICA8ZGM6dGl0bGU+CiAgIDxyZGY6QWx0PgogICAgPHJkZjpsaSB4bWw6bGFuZz0neC1kZWZhdWx0Jz5rdWJlICgyMDAgeCA1MCBweCkgLSAxPC9yZGY6bGk+CiAgIDwvcmRmOkFsdD4KICA8L2RjOnRpdGxlPgogPC9yZGY6RGVzY3JpcHRpb24+CgogPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9JycKICB4bWxuczpwZGY9J2h0dHA6Ly9ucy5hZG9iZS5jb20vcGRmLzEuMy8nPgogIDxwZGY6QXV0aG9yPmt1bWFyIGRldjwvcGRmOkF1dGhvcj4KIDwvcmRmOkRlc2NyaXB0aW9uPgoKIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PScnCiAgeG1sbnM6eG1wPSdodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvJz4KICA8eG1wOkNyZWF0b3JUb29sPkNhbnZhIChSZW5kZXJlcikgZG9jPURBRzk2eWMyWWo0IHVzZXI9VUFHcmtCR1lBVFkgYnJhbmQ9UFMgTUFTVEVSQ0xBU1MgMjAyNSB0ZW1wbGF0ZT1CbGFjayBhbmQgV2hpdGUgTWluaW1hbGlzdCBNb2Rlcm4gQ2xhc3NpYyBUeXBvZ3JhcGh5IE1hcmtldGluZyBBZ2VuY3kgQnJhbmQgTG9nbzwveG1wOkNyZWF0b3JUb29sPgogPC9yZGY6RGVzY3JpcHRpb24+CjwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cjw/eHBhY2tldCBlbmQ9J3InPz40orjzAAAIGElEQVR4nO3be1BTVx4H8F9AIQHRNOAlGHCEzhDAWl4V5NVdqxWUx+5sa3c7tlqntfIQqq4IVStbldVdLa2121JbUdBWFGyEZd3yKo8EUYhgQVdxIYHtQMg7IeZxE8LdP9JhXURrHW+4hfP5Kznnd5nfmfnOuefeCTSVUgoI8qQ5THUDyPSEgoWQAgULIQUKFkIKFCyEFChYCClQsBBSoGAhpEDBQkiBgoWQAgULIQUKFkIKFCyEFChYCClQsBBSoGDZg8Vi6erq7u3tfZTiwcHBrq7ukREd2V2RCgXLHrRa7brXNuTl7X+U4hNFp9a9tqGrq5vsrkiFgoWQYtZUNzATabVahVIJBAAN3ObMwTAMAHS6uzK5jDmPOV6mVqt7eu5gGObn5zs+ODws7e/vZzKZXK4/jUabgu4fzS8gWBKJpLv7hsFg5HA4S5Y8IxaLR63WsrJyM24+dCh/0ks0Gu231dW1tfXpaZvDw8Ps3PDDyeWK19e/IZPJN27ccPz4lynJSfn5+wBA0NKyc+e7GzdusJU1NjZt277DZDIBQHz8i4cO5gPAgfyDPF7F2NgYAAQHP/vx0QIWizV1S3kYSt8KRSJxZta24uLTPj4+zz8fi+OmxKSUqn9cWvLMYr1e7zHfAwBy391dVHRqwoVM5rzQkJDOzusBAdwp6PvBdDpdWvoWiWT4wP73o5ZFPqSymS/45NhHpWfPPBceXl1dW37hm6KiUxcu8DIzM9rbLpeXlQ4MDBz54EO7df5zUXfHqq6p3b//z385lB8TE20biY2N2fTWm5gnRhBEZ+f3r6x9GQCe9vNbwFlw/+VX29rDwkJdXV3t2vRD4WZ869Y/9vTc2bUrZ82aBKHw2kOK09M2R0ZGAEBubvbLa//Q8F3j4NCQs7NzdNQykUgMACHBwQ0Njfbp/DFQNFhXrrTl5u7Oy9szniobbx/voMDAW7du6/X60NAQANi06c1J/wKfL4iLi7FHr49MJBJbLJZ58+Ymrlk9yTTxf9882Z62D2y2JwBotSMKhRLH8Ywt74zX0OkMk8lEp9PJ6/mxUTFYRqPpvb15i4OCfpOSPGEqNiYaAMovfBMZsbSvTyQQtAxJJHl79wCAQqHk8wUs1lOjo9aoqMiOjs6cnB0AUFtbd/36994+3qteXOnu7m7/5YwLDAhYGvHciRMns7K2FxZ+4uTkBAAGo9E2OzAwcG9xb2+f7V7Z1ycCAMwTs1gsQ5Khqr/zKLUNPwgVg1VTUzs8LM3K3PKgpx6BoCU5OTEwMOCrr87iOA4At27fPnbs08N/PSiTydMzMnN27vDw8Hjaz89qtYpE4sjIiLi4WCo8Q72TtcWgN5wtPZe9M/f9P+XNnj1bIGgpKTmD43jJ6TP3VhafKnF2dnKb4/bpZ4UAkJKcqNZo9u3LT03b8sral5zp9K6u7lmOs7ZuzZyipfwEKgbr6tU2AAgLC510VqvVdnV1Hzp4AAD+dev2xjfWazSarKxthZ/9zdXVlUaTZ6SnNfMFMTFRKpWqurr21Vd/P3fuXLsu4MFoNFpubrbRaLxYUXnkg4Ls7O0fFhw9fKTAy4uduvntw0cKxitTU9/+/PgXw8NSOp2enp66cuUKgiDMuLnoZPGu3XsBgMVirX993dQt5SfQKPgv9hkZWc18QdvVFgaDcf/st9U1nxd+weOVSSSShNXJ39VXFxUV/+eHH459/OMjEkEQCauTUlKS6usaNm9+Kz5+lX3b/3lMJpNarcYwzNHRccKU1WqVyeVPMZn3nqLGxsaUKpV11Iph8x0cqPtQT8XOON7eACCVyiadbW4WxMRGA4Cg5XJQUKC7u3tdfX1c7P/O6X19IrlcERMdvXz5ryorq+zT82Oj0+leXl73pwoAHB0dvdjsCWdzBweH+R4ebLYnlVMF1AzWS7/77ezZs86dL5sw3tTUrNFoWltb42JjcBxvauLHxcbqdHdVKpWLq4utxmw219XVh4WFhoQEJyUnXm69olAoAUCtVtt7GTMbFYPF5fq/t2f3+fPlHx09plKpAECpVJ0tPYdh2LBUqlAozWazuL9f2C5ks7G2tvbw8PCKi5Umk0kmkzU0NLa1t9s2MN9FixYvDio5faamts72ChuxG8ecnOyp7mESgYEBLyz/9Y0bN3m8inah8K7ubnJy0oIFXmMEodVoo6KWcbn+w8NSDoeTkLBq2bJIkUjc1Mx3cXFdseIFhVyxenW8m5sbAPj5+d64eTNxTQKbzZ7qNc0sVDy8I9MARXcsKisuPi2TyxkuDN7FyoAA7tdfl6pU6o6OTr3e0Np6xWq1Xrr0Tycn556enoaGRq1WK5PL79y54+u7CAC+PHEyOPhZHq+CzqBXVV1yneNaWVml1WqlUunAwIBEIrnW0cH1p/TPFh4RFc9YFOfi4jI4ONQv7gcg+PwWg9FoNuNKpQI342q1WqfT+Sz04XL9DQajpyfW1i7U39W3C6+ZcLzz+nUGg94uFGo0GqHwmlyuMOgNP9bo9TQaLSJiqQPNYRqkCtCt0D4Igrg3LgRBAMCEAE2o+aWj4pv36WdCYiYN0HRKFaBgPXG9fX0Ws2V0dFSj0TAYDAaD4eXFViiUcrmcxWIZjUYOh+PpiU11m6RDwXrCev/dC0CTSCQBAdyRkRGpTMZkMkUisUgkWrjQhyCIkZGRmRAsdMYixf0HJtvIpKeraQntWKS4Pzq2kZkQKRv0ugEhBQoWQgoULIQUKFgIKVCwEFKgYCGkQMFCSIGChZACBQshxX8B8a5Xm14YW+kAAAAASUVORK5CYII="}	2026-01-15 19:16:22.805261+00	2026-01-15 19:16:53.382+00
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
be3f3fb9-ae26-404e-8931-ed47bcd9a1f8	399867dc-80ae-44e9-bcb3-caf923003291	~	919373393645	\N	active	\N	{}	{}	{}	2026-01-14 17:25:59.269799+00	2026-01-15 07:55:45+00
3345687a-d78d-41c4-8d5e-2efcc0c9efac	35d4fe7d-753d-43da-85fb-a32b6f66133e	kk	918408907516	kk@gm.com	New	Web Form	{}	{}	{"name": "kk", "email": "kk@gm.com", "phone": "918408907516"}	2026-01-15 14:39:16.819288+00	2026-01-15 14:39:16.819288+00
d2631112-8046-42b9-92b8-787d65583989	35d4fe7d-753d-43da-85fb-a32b6f66133e	~	919373393645	\N	active	\N	{}	{}	{}	2026-01-15 18:33:23.14398+00	2026-01-15 18:34:58+00
b1c42459-bd02-4569-8ee2-f53e5db34693	b7962153-b41d-4132-bc41-73cb84600760	MyCoder	919876757613	\N	active	\N	{}	{}	{}	2026-01-16 16:07:39.790002+00	2026-01-16 16:07:25+00
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
8a578472-9106-4f1e-8194-2779b1220c87	399867dc-80ae-44e9-bcb3-caf923003291	919373393645	~	jj	0	open	{}	\N	2026-01-14 17:25:59.622642+00	2026-01-15 07:55:59.448+00
dced935b-1ebc-42ba-a354-4acc3d3672de	35d4fe7d-753d-43da-85fb-a32b6f66133e	919373393645	~	from api	0	open	{}	\N	2026-01-15 18:33:23.242796+00	2026-01-15 18:35:01.955122+00
11f87a40-789c-44f6-aef8-517493885746	b7962153-b41d-4132-bc41-73cb84600760	919876757613	MyCoder	hlo	0	open	{}	\N	2026-01-16 16:07:39.908517+00	2026-01-16 16:07:59.422+00
581bb7a0-67f5-4455-8fde-ff1cf2d87a56	b7962153-b41d-4132-bc41-73cb84600760	919373393645	~	hello	0	open	{}	\N	2026-01-16 16:07:39.824101+00	2026-01-16 16:08:03.873+00
\.


--
-- Data for Name: custom_fields; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.custom_fields (id, user_id, name, type, placeholder, created_at) FROM stdin;
\.


--
-- Data for Name: domain_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.domain_settings (domain, brand_name, logo_url, favicon_url, primary_color, secondary_color, support_email, created_at, updated_at) FROM stdin;
clickube.com	ClicKube	\N	\N	#ea580c	#1e40af	support@clickube.com	2026-01-15 10:17:05.585714+00	2026-01-15 10:17:05.585714+00
chatmat.in	ChatMat	\N	\N	#16a34a	#1e40af	help@chatmat.in	2026-01-15 10:17:05.585714+00	2026-01-15 10:17:05.585714+00
apidashboard.in	Apidashboard	\N	\N	#2563eb	#1e40af	\N	2026-01-16 10:47:53.880628+00	2026-01-16 10:47:53.880628+00
apiautomation.in	Apiautomation	\N	\N	#2563eb	#1e40af	\N	2026-01-16 11:16:00.822802+00	2026-01-16 11:16:00.822802+00
\.


--
-- Data for Name: flows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flows (id, user_id, name, description, status, nodes, edges, created_at, updated_at, trigger_keywords) FROM stdin;
c092f08d-5975-4276-9110-690c494bb02f	35d4fe7d-753d-43da-85fb-a32b6f66133e	Untitled Flow	No description	Published	[{"id": "OnMessage-1768502035063", "data": {"label": "On Message", "keywords": ["kk"], "messageType": "Text", "phoneNumbers": []}, "type": "onMessage", "position": {"x": 50, "y": 50}}, {"id": "mediaMessage-1768502053744", "data": {"url": "https://ssckorsnhjhzqxyukexm.supabase.co/storage/v1/object/public/campaign-media/35d4fe7d-753d-43da-85fb-a32b6f66133e/outbound/2026-01-15/1768502074657-12720749.png", "label": "Send Media", "caption": "from api", "mediaType": "Image"}, "type": "mediaMessage", "position": {"x": 536, "y": 36.19999694824219}}]	[{"id": "e-OnMessage-1768502035063-default-mediaMessage-1768502053744", "source": "OnMessage-1768502035063", "target": "mediaMessage-1768502053744", "sourceHandle": "default"}]	2026-01-15 18:33:53.635452+00	2026-01-15 18:34:47.759+00	{kk}
\.


--
-- Data for Name: flow_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flow_sessions (id, user_id, contact_phone, flow_id, current_node_id, status, variables, last_interaction_at, created_at) FROM stdin;
511cfd2f-0a20-40fd-87e6-5edd6ef2c8bc	35d4fe7d-753d-43da-85fb-a32b6f66133e	919373393645	c092f08d-5975-4276-9110-690c494bb02f	mediaMessage-1768502053744	completed	{"trigger": {"lead": {}, "name": "~", "text": "kk", "phone": "919373393645", "contact": {"id": "d2631112-8046-42b9-92b8-787d65583989", "name": "~", "tags": [], "email": null, "phone": "919373393645", "source": null, "status": "active", "user_id": "35d4fe7d-753d-43da-85fb-a32b6f66133e", "group_ids": [], "created_at": "2026-01-15T18:33:23.14398+00:00", "custom_data": {}, "last_active": "2026-01-15T18:34:58+00:00"}, "timestamp": "2026-01-15T18:34:59.886Z"}, "OnMessage-1768502035063": {"lead": {}, "name": "~", "text": "kk", "phone": "919373393645", "contact": {"id": "d2631112-8046-42b9-92b8-787d65583989", "name": "~", "tags": [], "email": null, "phone": "919373393645", "source": null, "status": "active", "user_id": "35d4fe7d-753d-43da-85fb-a32b6f66133e", "group_ids": [], "created_at": "2026-01-15T18:33:23.14398+00:00", "custom_data": {}, "last_active": "2026-01-15T18:34:58+00:00"}, "timestamp": "2026-01-15T18:34:59.886Z"}, "mediaMessage-1768502053744": {"url": "https://ssckorsnhjhzqxyukexm.supabase.co/storage/v1/object/public/campaign-media/35d4fe7d-753d-43da-85fb-a32b6f66133e/outbound/2026-01-15/1768502074657-12720749.png", "status": "sent", "mediaType": "image", "messageId": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNEFFNDI1OTY5MUVCQjc5RjkzAA==", "timestamp": "2026-01-15T18:35:01.940Z"}}	2026-01-15 18:35:02.01804+00	2026-01-15 18:35:00.058742+00
\.


--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.form_submissions (id, form_id, lead_id, submission_data, ip_address, user_agent, submitted_at) FROM stdin;
32be506e-5ae3-4856-be7c-c16a81911112	78152bc0-4531-4571-990b-f3b481a92dac	\N	{"name": "kk", "email": "kk@gm.com", "phone": "918408907516"}	::ffff:172.18.0.3	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-15 14:39:16.819288+00
\.


--
-- Data for Name: forms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.forms (id, user_id, pipeline_id, stage_id, name, description, form_token, fields, settings, is_active, created_at, updated_at, styling, success_message, submission_count, default_group_ids, default_tags, default_owner_id, success_redirect_url, last_submission_at) FROM stdin;
78152bc0-4531-4571-990b-f3b481a92dac	35d4fe7d-753d-43da-85fb-a32b6f66133e	\N	\N	dfasd		6HdzKnZd	[{"name": "name", "type": "text", "label": "NAME", "required": true, "placeholder": "Enter your name"}, {"name": "email", "type": "email", "label": "EMAIL", "required": true, "placeholder": "Enter your email"}, {"name": "phone", "type": "phone", "label": "PHONE", "required": false, "placeholder": "Enter your phone"}]	{"declaration": {"link": "", "title": "", "enabled": false}}	t	2026-01-15 14:38:45.82632	2026-01-15 14:39:16.871829	{"buttonText": "Enquire Now", "primaryColor": "#0f172a", "backgroundColor": "#ffffff", "buttonTextColor": "#ffffff"}	Thank you for your submission!	1	{}	{}	\N	\N	2026-01-15 14:39:16.847+00
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
6f791a8a-7a4d-4da9-aaa0-ec735b488a62	8a578472-9106-4f1e-8194-2779b1220c87	text	Hi	\N	\N	\N	\N	\N	in	delivered	2026-01-14 17:25:57+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNEMTE5OEEyOEQ3MThERTlCNEUxRjIyQzY1NURBNTQA	2026-01-14 17:25:59.679348+00
dc4f1afd-fb52-494f-b7c9-97315e7099f2	8a578472-9106-4f1e-8194-2779b1220c87	text	hi	\N	\N	\N	\N	\N	out	delivered	2026-01-14 17:26:08.641+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSQTlGRkREOTMyRTI0RDJDNzU3AA==	2026-01-14 17:26:12.070537+00
c4624a62-f682-47d6-8533-6a421800f9df	8a578472-9106-4f1e-8194-2779b1220c87	text	Hi	\N	\N	\N	\N	\N	in	delivered	2026-01-15 07:55:45+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNFMDJFRDgwMERCMTE1NDU2MzZDRDQ1QTdGQzEyREQA	2026-01-15 07:55:47.278699+00
927d1199-6295-4e9e-9d36-87a654121268	8a578472-9106-4f1e-8194-2779b1220c87	text	jj	\N	\N	\N	\N	\N	out	delivered	2026-01-15 07:55:59.384+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNTYwMDY2MTBFNDlFNDYwNEExAA==	2026-01-15 07:56:02.883302+00
87e7d244-7187-460c-91c4-612fcb28e126	dced935b-1ebc-42ba-a354-4acc3d3672de	text	Test	\N	\N	\N	\N	\N	in	delivered	2026-01-15 18:33:21+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNCMjJGQzU0OTA5RjhBNEU0RDk0N0QwOTBBN0I4QjAA	2026-01-15 18:33:23.294526+00
5e2a9232-ded9-4f3d-9f72-fcdd9f0d8f96	dced935b-1ebc-42ba-a354-4acc3d3672de	text	ok	\N	\N	\N	\N	\N	out	delivered	2026-01-15 18:33:32.342+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNjNFM0E4NDBGOTdGMTE0M0Y5AA==	2026-01-15 18:33:34.874387+00
8276b7e7-6471-4fd8-921a-b605411079d2	dced935b-1ebc-42ba-a354-4acc3d3672de	text	kk	\N	\N	\N	\N	\N	in	delivered	2026-01-15 18:34:58+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUMzNjVGRjEyRjg0MTkxNEQ0NUMwQjA2MDkxMjM2MDAA	2026-01-15 18:34:59.668377+00
bef2e0e1-38f5-4190-a8b5-25006da1cc33	dced935b-1ebc-42ba-a354-4acc3d3672de	image	from api	https://ssckorsnhjhzqxyukexm.supabase.co/storage/v1/object/public/campaign-media/35d4fe7d-753d-43da-85fb-a32b6f66133e/outbound/2026-01-15/1768502074657-12720749.png	\N	\N	\N	\N	out	delivered	2026-01-15 18:35:01.955122+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNEFFNDI1OTY5MUVCQjc5RjkzAA==	2026-01-15 18:35:07.012857+00
236a8990-5eff-4d87-9484-c10a72e441e1	581bb7a0-67f5-4455-8fde-ff1cf2d87a56	text	Test	\N	\N	\N	\N	\N	in	delivered	2026-01-16 16:07:29+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUM3Q0U4QTZBMDY1RkM4MjlCNDYzQkQ4NTYzNkYwNDQA	2026-01-16 16:07:39.896641+00
43760eaa-0252-4d0a-b97d-a15090aacea7	11f87a40-789c-44f6-aef8-517493885746	text	Hi	\N	\N	\N	\N	\N	in	delivered	2026-01-16 16:07:25+00	wamid.HBgMOTE5ODc2NzU3NjEzFQIAEhggQTU5MDZEMzVGRkI5NDI3NjI2MjY1OEU4QURFQkE5QUIA	2026-01-16 16:07:39.971933+00
7cb212b3-01de-4e98-a4cd-72a26043b95e	11f87a40-789c-44f6-aef8-517493885746	text	hlo	\N	\N	\N	\N	\N	out	delivered	2026-01-16 16:07:59.363+00	wamid.HBgMOTE5ODc2NzU3NjEzFQIAERgSMTJCQjJDM0I2RTk3Rjc2MzY2AA==	2026-01-16 16:08:03.381079+00
dc2b4f9d-76ef-4f41-82d7-b7eae9d84933	581bb7a0-67f5-4455-8fde-ff1cf2d87a56	text	hello	\N	\N	\N	\N	\N	out	delivered	2026-01-16 16:08:03.793+00	wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSMDE4OENEQzYyNzRCNTMyRDVFAA==	2026-01-16 16:08:07.235693+00
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

COPY public.onboarding_settings (id, user_id, manual_enabled, embedded_enabled, embedded_app_id, embedded_app_secret, embedded_config_id, bridge_domain, created_at, updated_at, domain) FROM stdin;
a2a4d0fc-d52c-4306-9d05-882e3e72f1a1	system	t	t	123click	c0ac659ed464fb22cd8fad654860bab6	976277771227161	https://cloudospire.in	2026-01-14 17:22:07.098453+00	2026-01-15 16:48:29.686+00	clickube.com
c51b7983-ee1c-459f-b855-b694d47a27c6	system	t	t	1046904630557061	c0ac659ed464fb22cd8fad654860bab6	976277771227161	https://clickube.com	2026-01-15 16:46:16.12244+00	2026-01-15 18:21:10.731+00	apiautomation.in
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plans (id, created_at, name, is_active, limits, pricing, ai_bot_enabled, api_access_enabled) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, email, signup_domain, role, created_at, updated_at, plan_name, plan_status, plan_expires_at, last_notification_sent_at) FROM stdin;
35d4fe7d-753d-43da-85fb-a32b6f66133e	ap1@gmail.com	apiautomation.in	user	2026-01-15 13:00:59.498817+00	2026-01-15 13:00:59.498817+00	Free	active	\N	\N
2dd4a1d4-6d81-4fb1-9ca2-7d133d91de7f	ram1@gmail.com	apiautomation.in	admin	2026-01-15 14:57:47.927311+00	2026-01-15 14:57:47.927311+00	Free	active	\N	\N
523e0049-94aa-4dfd-8b9f-fac1129c8ae7	ap2@gmail.com	apiautomation.in	user	2026-01-15 18:35:48.463305+00	2026-01-15 18:35:48.463305+00	Free	active	\N	\N
399867dc-80ae-44e9-bcb3-caf923003291	kd31967@gmail.com	clickube.com	super_admin	2026-01-15 10:13:44.126749+00	2026-01-15 10:13:44.126749+00	Free	active	\N	\N
b812fe65-ce42-452c-9732-956818cf8d89	dev@gmail.com	clickube.com	admin	2026-01-16 06:05:29.513297+00	2026-01-16 06:05:29.513297+00	Free	active	\N	\N
b7962153-b41d-4132-bc41-73cb84600760	koshik865@gmail.com	apiautomation.in	user	2026-01-16 15:58:44.292435+00	2026-01-16 15:58:44.292435+00	Free	active	\N	\N
\.


--
-- Data for Name: sheet_automations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sheet_automations (id, user_id, name, spreadsheet_id, sheet_name, automation_type, schedule_config, trigger_condition, template_config, mapping_config, status, last_run_at, created_at) FROM stdin;
\.


--
-- Data for Name: sheet_automation_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sheet_automation_logs (id, automation_id, row_data_hash, triggered_at, status) FROM stdin;
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
-- Data for Name: tenant_limits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_limits (domain, user_limit, created_at, updated_at) FROM stdin;
clickube.com	10	2026-01-15 10:17:05.585714+00	2026-01-16 10:47:08.423594+00
chatmat.in	5	2026-01-15 10:17:05.585714+00	2026-01-16 10:47:27.113955+00
apidashboard.in	10	2026-01-16 10:47:53.880628+00	2026-01-16 10:48:11.51221+00
apiautomation.in	10	2026-01-16 11:16:00.822802+00	2026-01-16 15:32:09.424029+00
\.


--
-- Data for Name: tenant_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tenant_plans (domain, plan_name, status, expires_at, created_at, updated_at) FROM stdin;
clickube.com	Enterprise	active	2099-12-31 00:00:00+00	2026-01-15 10:17:05.585714+00	2026-01-15 10:17:05.585714+00
chatmat.in	Pro	active	2026-02-14 11:15:45.847395+00	2026-01-15 10:17:05.585714+00	2026-01-15 10:17:05.585714+00
apidashboard.in	Free	active	2026-02-15 10:47:53.880628+00	2026-01-16 10:47:53.880628+00	2026-01-16 10:47:53.880628+00
apiautomation.in	Free	active	2026-02-15 11:16:00.822802+00	2026-01-16 11:16:00.822802+00	2026-01-16 11:16:00.822802+00
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
863e514a-8b7c-41cc-bfa6-2c14fcd5557e	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "1439101874213500", "changes": [{"field": "messages", "value": {"contacts": [{"wa_id": "919373393645", "profile": {"name": "~"}}], "messages": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNEMTE5OEEyOEQ3MThERTlCNEUxRjIyQzY1NURBNTQA", "from": "919373393645", "text": {"body": "Hi"}, "type": "text", "timestamp": "1768411557"}], "metadata": {"phone_number_id": "955135457680464", "display_phone_number": "15558564282"}, "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processed	text	919373393645	{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNEMTE5OEEyOEQ3MThERTlCNEUxRjIyQzY1NURBNTQA", "raw": {"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNEMTE5OEEyOEQ3MThERTlCNEUxRjIyQzY1NURBNTQA", "from": "919373393645", "text": {"body": "Hi"}, "type": "text", "timestamp": "1768411557"}, "from": "919373393645", "text": "Hi", "type": "text", "timestamp": "1768411557"}	\N	2026-01-14 17:25:59.0988+00	2026-01-14 17:25:59.744433+00	955135457680464	\N
d3408417-a8de-45c9-a5d6-e845e3c24ffb	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "1439101874213500", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "955135457680464", "display_phone_number": "15558564282"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSQTlGRkREOTMyRTI0RDJDNzU3AA==", "status": "sent", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768411569", "conversation": {"id": "41f3a291f25722f34793da4382b131f0", "origin": {"type": "service"}, "expiration_timestamp": "1768411569"}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-14 17:26:11.314186+00	2026-01-14 17:26:11.314186+00	955135457680464	\N
5aaab836-c808-4af2-829f-d1d501d91d46	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "1439101874213500", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "955135457680464", "display_phone_number": "15558564282"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSQTlGRkREOTMyRTI0RDJDNzU3AA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768411570", "conversation": {"id": "41f3a291f25722f34793da4382b131f0", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-14 17:26:11.457941+00	2026-01-14 17:26:11.457941+00	955135457680464	\N
a8228e46-f4ec-4f44-b0bb-3a40d3ae8441	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "1439101874213500", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "955135457680464", "display_phone_number": "15558564282"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSQTlGRkREOTMyRTI0RDJDNzU3AA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768411570", "conversation": {"id": "41f3a291f25722f34793da4382b131f0", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-14 17:26:12.011695+00	2026-01-14 17:26:12.011695+00	955135457680464	\N
6ac9563f-ad6a-4483-87af-25683925d349	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "2152067388897404", "changes": [{"field": "messages", "value": {"contacts": [{"wa_id": "919373393645", "profile": {"name": "~"}}], "messages": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNFMDJFRDgwMERCMTE1NDU2MzZDRDQ1QTdGQzEyREQA", "from": "919373393645", "text": {"body": "Hi"}, "type": "text", "timestamp": "1768463745"}], "metadata": {"phone_number_id": "1002220912965986", "display_phone_number": "15558389032"}, "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processed	text	919373393645	{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNFMDJFRDgwMERCMTE1NDU2MzZDRDQ1QTdGQzEyREQA", "raw": {"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNFMDJFRDgwMERCMTE1NDU2MzZDRDQ1QTdGQzEyREQA", "from": "919373393645", "text": {"body": "Hi"}, "type": "text", "timestamp": "1768463745"}, "from": "919373393645", "text": "Hi", "type": "text", "timestamp": "1768463745"}	\N	2026-01-15 07:55:46.82618+00	2026-01-15 07:55:47.340206+00	1002220912965986	\N
c55111c9-40f7-4522-8f89-e01ec86103e9	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "2152067388897404", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1002220912965986", "display_phone_number": "15558389032"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNTYwMDY2MTBFNDlFNDYwNEExAA==", "status": "sent", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768463761", "conversation": {"id": "b8997ab4c5733f718f700abd45974097", "origin": {"type": "service"}, "expiration_timestamp": "1768463761"}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-15 07:56:02.562396+00	2026-01-15 07:56:02.562396+00	1002220912965986	\N
fa6fd771-d1cd-4355-a96a-b23785ec730c	399867dc-80ae-44e9-bcb3-caf923003291	POST	{"entry": [{"id": "2152067388897404", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1002220912965986", "display_phone_number": "15558389032"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNTYwMDY2MTBFNDlFNDYwNEExAA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768463761", "conversation": {"id": "b8997ab4c5733f718f700abd45974097", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-15 07:56:02.798711+00	2026-01-15 07:56:02.798711+00	1002220912965986	\N
edc54a18-b6f5-4ae7-a4ae-2c25959541af	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "statuses": [{"id": "wamid.HBgMOTE5ODc2NzU3NjEzFQIAERgSMTJCQjJDM0I2RTk3Rjc2MzY2AA==", "status": "sent", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768579680", "conversation": {"id": "c7009ef27fa26c0eb71c8a3f2241a0a1", "origin": {"type": "service"}, "expiration_timestamp": "1768579680"}, "recipient_id": "919876757613"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-16 16:08:01.67617+00	2026-01-16 16:08:01.67617+00	877030968837691	\N
1428d530-4af5-4d7e-a273-086c8aedad71	35d4fe7d-753d-43da-85fb-a32b6f66133e	POST	{"entry": [{"id": "827120177024778", "changes": [{"field": "messages", "value": {"contacts": [{"wa_id": "919373393645", "profile": {"name": "~"}}], "messages": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNCMjJGQzU0OTA5RjhBNEU0RDk0N0QwOTBBN0I4QjAA", "from": "919373393645", "text": {"body": "Test"}, "type": "text", "timestamp": "1768502001"}], "metadata": {"phone_number_id": "1017887818063867", "display_phone_number": "15558423709"}, "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processed	text	919373393645	{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNCMjJGQzU0OTA5RjhBNEU0RDk0N0QwOTBBN0I4QjAA", "raw": {"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUNCMjJGQzU0OTA5RjhBNEU0RDk0N0QwOTBBN0I4QjAA", "from": "919373393645", "text": {"body": "Test"}, "type": "text", "timestamp": "1768502001"}, "from": "919373393645", "text": "Test", "type": "text", "timestamp": "1768502001"}	\N	2026-01-15 18:33:22.996343+00	2026-01-15 18:33:23.34452+00	1017887818063867	\N
8de11047-74ef-4574-a1fb-9cfc5b7d83e2	35d4fe7d-753d-43da-85fb-a32b6f66133e	POST	{"entry": [{"id": "827120177024778", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1017887818063867", "display_phone_number": "15558423709"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNjNFM0E4NDBGOTdGMTE0M0Y5AA==", "status": "sent", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768502013", "conversation": {"id": "8834dc1b49c532068ee6f5f4130efed7", "origin": {"type": "service"}, "expiration_timestamp": "1768502013"}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-15 18:33:34.183571+00	2026-01-15 18:33:34.183571+00	1017887818063867	\N
1443b422-64a2-4018-8567-96bceb827e40	35d4fe7d-753d-43da-85fb-a32b6f66133e	POST	{"entry": [{"id": "827120177024778", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1017887818063867", "display_phone_number": "15558423709"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNjNFM0E4NDBGOTdGMTE0M0Y5AA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768502013", "conversation": {"id": "8834dc1b49c532068ee6f5f4130efed7", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-15 18:33:34.823739+00	2026-01-15 18:33:34.823739+00	1017887818063867	\N
c21ccf7b-bfeb-456b-8fb0-77126dfe2653	35d4fe7d-753d-43da-85fb-a32b6f66133e	POST	{"entry": [{"id": "827120177024778", "changes": [{"field": "messages", "value": {"contacts": [{"wa_id": "919373393645", "profile": {"name": "~"}}], "messages": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUMzNjVGRjEyRjg0MTkxNEQ0NUMwQjA2MDkxMjM2MDAA", "from": "919373393645", "text": {"body": "kk"}, "type": "text", "timestamp": "1768502098"}], "metadata": {"phone_number_id": "1017887818063867", "display_phone_number": "15558423709"}, "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processed	text	919373393645	{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUMzNjVGRjEyRjg0MTkxNEQ0NUMwQjA2MDkxMjM2MDAA", "raw": {"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUMzNjVGRjEyRjg0MTkxNEQ0NUMwQjA2MDkxMjM2MDAA", "from": "919373393645", "text": {"body": "kk"}, "type": "text", "timestamp": "1768502098"}, "from": "919373393645", "text": "kk", "type": "text", "timestamp": "1768502098"}	\N	2026-01-15 18:34:59.313334+00	2026-01-15 18:34:59.71695+00	1017887818063867	\N
55cf9cc9-5d6e-47e7-82a0-8bac8ce7c5a4	35d4fe7d-753d-43da-85fb-a32b6f66133e	POST	{"entry": [{"id": "827120177024778", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1017887818063867", "display_phone_number": "15558423709"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNEFFNDI1OTY5MUVCQjc5RjkzAA==", "status": "sent", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768502105", "conversation": {"id": "26238b68462da8bb89d731d8862e68cb", "origin": {"type": "service"}, "expiration_timestamp": "1768502105"}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-15 18:35:06.687544+00	2026-01-15 18:35:06.687544+00	1017887818063867	\N
f7651567-7fe1-40f5-a735-d96e630f5d0f	35d4fe7d-753d-43da-85fb-a32b6f66133e	POST	{"entry": [{"id": "827120177024778", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "1017887818063867", "display_phone_number": "15558423709"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSNEFFNDI1OTY5MUVCQjc5RjkzAA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768502105", "conversation": {"id": "26238b68462da8bb89d731d8862e68cb", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-15 18:35:06.962912+00	2026-01-15 18:35:06.962912+00	1017887818063867	\N
982e70bf-9c8a-468e-b631-bab1984f88a2	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"contacts": [{"wa_id": "919876757613", "profile": {"name": "MyCoder"}}], "messages": [{"id": "wamid.HBgMOTE5ODc2NzU3NjEzFQIAEhggQTU5MDZEMzVGRkI5NDI3NjI2MjY1OEU4QURFQkE5QUIA", "from": "919876757613", "text": {"body": "Hi"}, "type": "text", "timestamp": "1768579645"}], "metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processed	text	919876757613	{"id": "wamid.HBgMOTE5ODc2NzU3NjEzFQIAEhggQTU5MDZEMzVGRkI5NDI3NjI2MjY1OEU4QURFQkE5QUIA", "raw": {"id": "wamid.HBgMOTE5ODc2NzU3NjEzFQIAEhggQTU5MDZEMzVGRkI5NDI3NjI2MjY1OEU4QURFQkE5QUIA", "from": "919876757613", "text": {"body": "Hi"}, "type": "text", "timestamp": "1768579645"}, "from": "919876757613", "text": "Hi", "type": "text", "timestamp": "1768579645"}	\N	2026-01-16 16:07:39.59497+00	2026-01-16 16:07:40.029675+00	877030968837691	\N
39cced88-6fe0-48eb-afa0-d9f5fdd33c3a	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"contacts": [{"wa_id": "919373393645", "profile": {"name": "~"}}], "messages": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUM3Q0U4QTZBMDY1RkM4MjlCNDYzQkQ4NTYzNkYwNDQA", "from": "919373393645", "text": {"body": "Test"}, "type": "text", "timestamp": "1768579649"}], "metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processed	text	919373393645	{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUM3Q0U4QTZBMDY1RkM4MjlCNDYzQkQ4NTYzNkYwNDQA", "raw": {"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAEhggQUM3Q0U4QTZBMDY1RkM4MjlCNDYzQkQ4NTYzNkYwNDQA", "from": "919373393645", "text": {"body": "Test"}, "type": "text", "timestamp": "1768579649"}, "from": "919373393645", "text": "Test", "type": "text", "timestamp": "1768579649"}	\N	2026-01-16 16:07:39.484222+00	2026-01-16 16:07:39.955235+00	877030968837691	\N
b9f801f9-a4e9-4224-8fd2-a06ef8d79803	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "statuses": [{"id": "wamid.HBgMOTE5ODc2NzU3NjEzFQIAERgSMTJCQjJDM0I2RTk3Rjc2MzY2AA==", "status": "read", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768579680", "conversation": {"id": "c7009ef27fa26c0eb71c8a3f2241a0a1", "origin": {"type": "service"}}, "recipient_id": "919876757613"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-16 16:08:02.363807+00	2026-01-16 16:08:02.363807+00	877030968837691	\N
f1187071-07e3-42f5-bf93-9eaf1e77b90c	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSMDE4OENEQzYyNzRCNTMyRDVFAA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768579685", "conversation": {"id": "878c3b8a5dbe30161774a357e02656c6", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-16 16:08:07.147653+00	2026-01-16 16:08:07.147653+00	877030968837691	\N
d768a81e-7595-474f-8167-b3163805fde9	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "statuses": [{"id": "wamid.HBgMOTE5ODc2NzU3NjEzFQIAERgSMTJCQjJDM0I2RTk3Rjc2MzY2AA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768579680", "conversation": {"id": "c7009ef27fa26c0eb71c8a3f2241a0a1", "origin": {"type": "service"}}, "recipient_id": "919876757613"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-16 16:08:03.323306+00	2026-01-16 16:08:03.323306+00	877030968837691	\N
83286fa7-1e3e-4c84-8427-d43bc52321f5	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSMDE4OENEQzYyNzRCNTMyRDVFAA==", "status": "sent", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768579685", "conversation": {"id": "878c3b8a5dbe30161774a357e02656c6", "origin": {"type": "service"}, "expiration_timestamp": "1768579685"}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-16 16:08:06.537025+00	2026-01-16 16:08:06.537025+00	877030968837691	\N
0f0df8f4-3444-486f-ab06-a76b6b46dd95	b7962153-b41d-4132-bc41-73cb84600760	POST	{"entry": [{"id": "4403209136667870", "changes": [{"field": "messages", "value": {"metadata": {"phone_number_id": "877030968837691", "display_phone_number": "15558895777"}, "statuses": [{"id": "wamid.HBgMOTE5MzczMzkzNjQ1FQIAERgSMDE4OENEQzYyNzRCNTMyRDVFAA==", "status": "delivered", "pricing": {"type": "free_customer_service", "billable": false, "category": "service", "pricing_model": "PMP"}, "timestamp": "1768579685", "conversation": {"id": "878c3b8a5dbe30161774a357e02656c6", "origin": {"type": "service"}}, "recipient_id": "919373393645"}], "messaging_product": "whatsapp"}}]}], "object": "whatsapp_business_account"}	processing	\N	\N	\N	\N	2026-01-16 16:08:07.134706+00	2026-01-16 16:08:07.134706+00	877030968837691	\N
\.


--
-- Data for Name: whatsapp_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_config (id, user_id, phone_number, phone_number_id, whatsapp_business_account_id, meta_app_id, meta_access_token, verify_token, created_at, updated_at, name, access_token) FROM stdin;
ce4e36f4-aa8b-4abc-ad2a-f526740dcffc	399867dc-80ae-44e9-bcb3-caf923003291	15558389032	1002220912965986	2152067388897404	1046904630557061	EAAO4J3qeOYUBQc1k2c42quTstXinbCqWEtoNG9eWHAZAYsz8KhpyvdoZB9TVnfTEoQkMYQnAzJXXb8RrJ4A8x3rLj34TbUXCBSsAQ4j6hyk93KYv3AjmdEZADiZA1l2oAKi9ZCdvKJSUgfIefrUNDbZBXZB2ZB1sJZBZCjQC3iEQipTBLL60ZBo8P15qoLwsIHZAyVKTKnEFkAr9P3ZBL8YiSsfX3XXOI493WTbd1BduhHW4A0fog5alFLEkyNiL3U1RePhg0jQcZB3UrZCSrlDK2Df7yeIUEZBJBf4GE0QySTwl	399867dc-80ae-44e9-bcb3-caf923003291	2026-01-15 07:54:26.904762+00	2026-01-15 07:55:10.275+00	15558389032	\N
af931e1f-8753-4dae-ade3-5657f14565b3	35d4fe7d-753d-43da-85fb-a32b6f66133e	15558423709	1017887818063867	827120177024778	1046904630557061	EAAO4J3qeOYUBQcUvgXVYsgoEZANvZBBFa2ZBQBbf2MX75wW7JxKto4jjnSWTlyz671NoFIGwlHgEjuKUo2VkZAvZCHbbYuV3WTFbhQF8dgmJiyfhCZADL5RQ52f3phkZCqsmZBNW4QtMGVcdn10zbJVZBMurZBUiPdhIFzW79Y6qOwy5zZBjwwg6PrlPMZBh7ZCSr0RuT5NQYsTVklk7ezg37p0m8ZA3n3MlhRAl0OE4JW3JkxdkSKF8HAyWBWARUWPqRmHClIuIXLEMOQQOEfjg4OaZBiKap1ccOnAiQPgmPAx	35d4fe7d-753d-43da-85fb-a32b6f66133e	2026-01-15 18:31:27.32686+00	2026-01-15 18:31:27.32686+00	15558423709	\N
84285870-124e-4b1f-ae99-8d32f465242c	b7962153-b41d-4132-bc41-73cb84600760	15558895777	877030968837691	4403209136667870	1046904630557061	EAAO4J3qeOYUBQaNo6NPgbNsynOKobMZBY9o6ZCxoZBvbpN6KxO92IrjGzhwMbbuqkXcSZAODj9l96WpVMoPPxtFYULJhIZBfNnuTEe6pQPAMkQiRd86sD2h2w1Yr70lUI18CUckY0QoDej0k07ysbs3SqHZBrvpZBFnZASdTa4lTfQKKMdmZCG6ZBvI55U1UwIk0aY3sSPBZC1sQvVHotGuFx1yWgVjvgmUZCNlcxpZCahQtEGLn7Kzj4kNnzsgYvDJzuSP7Y7UXf2wnDJJ6a5i3M1cmFZCq3T9iTUpnFb	b7962153-b41d-4132-bc41-73cb84600760	2026-01-16 16:06:41.91331+00	2026-01-16 16:06:41.91331+00	15558895777	\N
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
20211116024918	2026-01-14 14:09:46
20211116045059	2026-01-14 14:09:46
20211116050929	2026-01-14 14:09:46
20211116051442	2026-01-14 14:09:46
20211116212300	2026-01-14 14:09:46
20211116213355	2026-01-14 14:09:46
20211116213934	2026-01-14 14:09:46
20211116214523	2026-01-14 14:09:46
20211122062447	2026-01-14 14:09:46
20211124070109	2026-01-14 14:09:46
20211202204204	2026-01-14 14:09:46
20211202204605	2026-01-14 14:09:46
20211210212804	2026-01-14 14:09:46
20211228014915	2026-01-14 14:09:46
20220107221237	2026-01-14 14:09:47
20220228202821	2026-01-14 14:09:47
20220312004840	2026-01-14 14:09:47
20220603231003	2026-01-14 14:09:47
20220603232444	2026-01-14 14:09:47
20220615214548	2026-01-14 14:09:47
20220712093339	2026-01-14 14:09:47
20220908172859	2026-01-14 14:09:47
20220916233421	2026-01-14 14:09:47
20230119133233	2026-01-14 14:09:47
20230128025114	2026-01-14 14:09:47
20230128025212	2026-01-14 14:09:47
20230227211149	2026-01-14 14:09:47
20230228184745	2026-01-14 14:09:47
20230308225145	2026-01-14 14:09:47
20230328144023	2026-01-14 14:09:47
20231018144023	2026-01-14 14:09:47
20231204144023	2026-01-14 14:09:47
20231204144024	2026-01-14 14:09:47
20231204144025	2026-01-14 14:09:47
20240108234812	2026-01-14 14:09:47
20240109165339	2026-01-14 14:09:47
20240227174441	2026-01-14 14:09:47
20240311171622	2026-01-14 14:09:47
20240321100241	2026-01-14 14:09:47
20240401105812	2026-01-14 14:09:47
20240418121054	2026-01-14 14:09:47
20240523004032	2026-01-14 14:09:47
20240618124746	2026-01-14 14:09:47
20240801235015	2026-01-14 14:09:47
20240805133720	2026-01-14 14:09:47
20240827160934	2026-01-14 14:09:47
20240919163303	2026-01-14 14:09:47
20240919163305	2026-01-14 14:09:47
20241019105805	2026-01-14 14:09:47
20241030150047	2026-01-14 14:09:47
20241108114728	2026-01-14 14:09:47
20241121104152	2026-01-14 14:09:47
20241130184212	2026-01-14 14:09:47
20241220035512	2026-01-14 14:09:47
20241220123912	2026-01-14 14:09:47
20241224161212	2026-01-14 14:09:47
20250107150512	2026-01-14 14:09:47
20250110162412	2026-01-14 14:09:47
20250123174212	2026-01-14 14:09:47
20250128220012	2026-01-14 14:09:47
20250506224012	2026-01-14 14:09:47
20250523164012	2026-01-14 14:09:47
20250714121412	2026-01-14 14:09:47
20250905041441	2026-01-14 14:09:47
20251103001201	2026-01-14 14:09:47
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
campaign-media	campaign-media	\N	2026-01-14 16:21:23.411022+00	2026-01-14 16:21:23.411022+00	t	f	52428800	{image/png,image/jpeg,image/jpg,image/gif,image/webp,video/mp4,video/3gpp,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a,application/pdf,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation}	\N	STANDARD
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
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-01-14 14:09:46.074465
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-01-14 14:09:46.081194
2	storage-schema	5c7968fd083fcea04050c1b7f6253c9771b99011	2026-01-14 14:09:46.087251
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-01-14 14:09:46.103246
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-01-14 14:09:46.111652
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-01-14 14:09:46.115426
6	change-column-name-in-get-size	f93f62afdf6613ee5e7e815b30d02dc990201044	2026-01-14 14:09:46.120755
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-01-14 14:09:46.125185
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-01-14 14:09:46.128689
9	fix-search-function	3a0af29f42e35a4d101c259ed955b67e1bee6825	2026-01-14 14:09:46.132545
10	search-files-search-function	68dc14822daad0ffac3746a502234f486182ef6e	2026-01-14 14:09:46.136513
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-01-14 14:09:46.140825
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-01-14 14:09:46.14536
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-01-14 14:09:46.148888
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-01-14 14:09:46.152748
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-01-14 14:09:46.168914
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-01-14 14:09:46.172958
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-01-14 14:09:46.176572
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-01-14 14:09:46.180711
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-01-14 14:09:46.184805
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-01-14 14:09:46.188669
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-01-14 14:09:46.194061
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-01-14 14:09:46.205034
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-01-14 14:09:46.213845
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-01-14 14:09:46.21799
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-01-14 14:09:46.221447
26	objects-prefixes	ef3f7871121cdc47a65308e6702519e853422ae2	2026-01-14 14:09:46.225075
27	search-v2	33b8f2a7ae53105f028e13e9fcda9dc4f356b4a2	2026-01-14 14:09:46.235542
28	object-bucket-name-sorting	ba85ec41b62c6a30a3f136788227ee47f311c436	2026-01-14 14:09:46.245061
29	create-prefixes	a7b1a22c0dc3ab630e3055bfec7ce7d2045c5b7b	2026-01-14 14:09:46.249404
30	update-object-levels	6c6f6cc9430d570f26284a24cf7b210599032db7	2026-01-14 14:09:46.253243
31	objects-level-index	33f1fef7ec7fea08bb892222f4f0f5d79bab5eb8	2026-01-14 14:09:46.259754
32	backward-compatible-index-on-objects	2d51eeb437a96868b36fcdfb1ddefdf13bef1647	2026-01-14 14:09:46.267255
33	backward-compatible-index-on-prefixes	fe473390e1b8c407434c0e470655945b110507bf	2026-01-14 14:09:46.275587
34	optimize-search-function-v1	82b0e469a00e8ebce495e29bfa70a0797f7ebd2c	2026-01-14 14:09:46.27734
35	add-insert-trigger-prefixes	63bb9fd05deb3dc5e9fa66c83e82b152f0caf589	2026-01-14 14:09:46.283305
36	optimise-existing-functions	81cf92eb0c36612865a18016a38496c530443899	2026-01-14 14:09:46.288839
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-01-14 14:09:46.303161
38	iceberg-catalog-flag-on-buckets	19a8bd89d5dfa69af7f222a46c726b7c41e462c5	2026-01-14 14:09:46.309265
39	add-search-v2-sort-support	39cf7d1e6bf515f4b02e41237aba845a7b492853	2026-01-14 14:09:46.324657
40	fix-prefix-race-conditions-optimized	fd02297e1c67df25a9fc110bf8c8a9af7fb06d1f	2026-01-14 14:09:46.331104
41	add-object-level-update-trigger	44c22478bf01744b2129efc480cd2edc9a7d60e9	2026-01-14 14:09:46.351641
42	rollback-prefix-triggers	f2ab4f526ab7f979541082992593938c05ee4b47	2026-01-14 14:09:46.363506
43	fix-object-level	ab837ad8f1c7d00cc0b7310e989a23388ff29fc6	2026-01-14 14:09:46.375246
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-01-14 14:09:46.379739
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-01-14 14:09:46.38472
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-01-14 14:09:46.40644
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-01-14 14:09:46.413189
48	iceberg-catalog-ids	2666dff93346e5d04e0a878416be1d5fec345d6f	2026-01-14 14:09:46.417818
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-01-14 14:09:46.431084
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, level) FROM stdin;
696aba7c-0fc4-4501-b1fa-59e6bc906d20	campaign-media	35d4fe7d-753d-43da-85fb-a32b6f66133e/outbound/2026-01-15/1768502074657-12720749.png	\N	2026-01-15 18:34:34.932413+00	2026-01-15 18:34:34.932413+00	2026-01-15 18:34:34.932413+00	{"eTag": "\\"f0801321f502ca37aa5ff5cd79251e49\\"", "size": 1092279, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-15T18:34:35.000Z", "contentLength": 1092279, "httpStatusCode": 200}	35386672-d82f-4da1-b6df-abe962646ea3	\N	{}	4
\.


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: -
--

COPY storage.prefixes (bucket_id, name, created_at, updated_at) FROM stdin;
campaign-media	35d4fe7d-753d-43da-85fb-a32b6f66133e	2026-01-15 18:34:34.932413+00	2026-01-15 18:34:34.932413+00
campaign-media	35d4fe7d-753d-43da-85fb-a32b6f66133e/outbound	2026-01-15 18:34:34.932413+00	2026-01-15 18:34:34.932413+00
campaign-media	35d4fe7d-753d-43da-85fb-a32b6f66133e/outbound/2026-01-15	2026-01-15 18:34:34.932413+00	2026-01-15 18:34:34.932413+00
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

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 120, true);


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

\unrestrict bROsM6Nj1XOpUWAPo0U0KneP8U7X2auCrV7n6h8ECnohtw0Ns0wOpARKYW3FKD8

