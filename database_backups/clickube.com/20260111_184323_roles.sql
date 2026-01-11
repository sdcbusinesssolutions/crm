--
-- PostgreSQL database cluster dump
--

\restrict l3EW02Cw0lssYzswRb3H3OzhU7ldlssCuiD62c3vjaamCXL6XJNor3bRuM3rMYL

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE anon;
ALTER ROLE anon WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticated;
ALTER ROLE authenticated WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE authenticator;
ALTER ROLE authenticator WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:Qe+fmPvp9FGR0t9HV7/v6Q==$PYokiVpT4eUpCU5Le4nLMwVhOxoNZG8D2VlMXrlKmhY=:ewrAhCVf+jjr20fEopWurXcBzjzpCNsR9PY6H8kuwRA=';
CREATE ROLE cli_login_postgres;
ALTER ROLE cli_login_postgres WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:PJIkhwNLQ3ncWtZYXsAO6w==$qb+5U6/kI1qYzTpNl/mil3dgnEWUiBsXaL1BdgaYu2U=:i3e5mxx4rrACTSEz9HCDNZ6vQYLGp7a5zhnmO8BXeW8=' VALID UNTIL '2026-01-10 19:10:30.041733+00';
CREATE ROLE dashboard_user;
ALTER ROLE dashboard_user WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB NOLOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE pgbouncer;
ALTER ROLE pgbouncer WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:QvTEloII1iAEogjFqzUfJg==$2wizDR3go14/Hj4HSoPE1e2Zvn1P124CU5bHgf7tDnA=:J4sCbIOJnAjGvIh+efLvIisb7EiyJoa0kt0lQivmVuw=';
CREATE ROLE postgres;
ALTER ROLE postgres WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:+/51EUYFWtn/GhJllVHgxQ==$Ph/GM2Uoqs1W6zqpBVWnwgo6KFnx2RvO1xQAPQu56TE=:i6fU0aMlp9Lr8MFip2KM3zKmnt2N9do21fZ1+heZzjA=';
CREATE ROLE service_role;
ALTER ROLE service_role WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION BYPASSRLS;
CREATE ROLE supabase_admin;
ALTER ROLE supabase_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:dd1nL1JLg0au8QfY0znqyQ==$8SutwEI/ccIOZIpsT9pikRqkWJydqE30uiFuh882U9o=:3bMQ9fCPbUP7cEQD24JHC314Nm3CtwlgKqjmwtKfytA=';
CREATE ROLE supabase_auth_admin;
ALTER ROLE supabase_auth_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:neZ6J7Bv9sujwi+ULHSXcg==$RLDm4wIYRCqlKOJpu9Vh4qQuIlJuDN82V3Kc7Ji45CA=:t6IV3E7na+r6/L3VjoTyR3D9SiK16duNF1wlZIOWb/w=';
CREATE ROLE supabase_etl_admin;
ALTER ROLE supabase_etl_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:sdhF7zzZlAprwE4MHzhxRg==$Xho3qtujOfH1FtFX8sEruG4xFDnCTpI5o4fJX78ol6g=:2r2njUDSA3r3saRgMMHcwQttJlShL/ZILwCc7I9WKZU=';
CREATE ROLE supabase_read_only_user;
ALTER ROLE supabase_read_only_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:MDsjh+GH5Yj/rMjZ4SHPrg==$clK8Oc4Njqi7Wk6hDdIqbX05Y6hWi1V9DICDiZ0SwWA=:lkc9iKhKLl+gJX+GN/zULtAyMOak4vy88EEP+j1jriU=';
CREATE ROLE supabase_realtime_admin;
ALTER ROLE supabase_realtime_admin WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE supabase_replication_admin;
ALTER ROLE supabase_replication_admin WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN REPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:wFwjejg+yfKzwsb3U4x4ZA==$B2gsmAWJo+rFSBC/iVb6v+7kT9ZP30VB5JCU1Dy8G64=:IjjmmGUMNRsKd52MC1ZoEbkj3f2FMpkaKC9pTLDCnug=';
CREATE ROLE supabase_storage_admin;
ALTER ROLE supabase_storage_admin WITH NOSUPERUSER NOINHERIT CREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:KjzTkcdUrHilXG04YLJKvA==$enodmXwxgGyh2hdh/zF8opc79F9t7xpQ0Jo41RGQkgA=:udd5uWcC6TWcb9CMl8Mkkk+zP/WQ51TOxCWStKFLcVo=';

--
-- User Configurations
--

--
-- User Config "anon"
--

ALTER ROLE anon SET statement_timeout TO '3s';

--
-- User Config "authenticated"
--

ALTER ROLE authenticated SET statement_timeout TO '8s';

--
-- User Config "authenticator"
--

ALTER ROLE authenticator SET session_preload_libraries TO 'safeupdate';
ALTER ROLE authenticator SET statement_timeout TO '8s';
ALTER ROLE authenticator SET lock_timeout TO '8s';

--
-- User Config "postgres"
--

ALTER ROLE postgres SET search_path TO E'\\$user', 'public', 'extensions';

--
-- User Config "supabase_admin"
--

ALTER ROLE supabase_admin SET search_path TO '$user', 'public', 'auth', 'extensions';
ALTER ROLE supabase_admin SET log_statement TO 'none';

--
-- User Config "supabase_auth_admin"
--

ALTER ROLE supabase_auth_admin SET search_path TO 'auth';
ALTER ROLE supabase_auth_admin SET idle_in_transaction_session_timeout TO '60000';
ALTER ROLE supabase_auth_admin SET log_statement TO 'none';

--
-- User Config "supabase_read_only_user"
--

ALTER ROLE supabase_read_only_user SET default_transaction_read_only TO 'on';

--
-- User Config "supabase_storage_admin"
--

ALTER ROLE supabase_storage_admin SET search_path TO 'storage';
ALTER ROLE supabase_storage_admin SET log_statement TO 'none';


--
-- Role memberships
--

GRANT anon TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT anon TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticated TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT authenticated TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticator TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT authenticator TO supabase_storage_admin WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT pg_create_subscription TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_monitor TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO supabase_etl_admin WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_read_all_data TO supabase_read_only_user WITH INHERIT TRUE GRANTED BY supabase_admin;
GRANT pg_signal_backend TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT postgres TO cli_login_postgres WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT service_role TO authenticator WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT service_role TO postgres WITH ADMIN OPTION, INHERIT TRUE GRANTED BY supabase_admin;
GRANT supabase_realtime_admin TO postgres WITH INHERIT TRUE GRANTED BY supabase_admin;




\unrestrict l3EW02Cw0lssYzswRb3H3OzhU7ldlssCuiD62c3vjaamCXL6XJNor3bRuM3rMYL

--
-- PostgreSQL database cluster dump complete
--

