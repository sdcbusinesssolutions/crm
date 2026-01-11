-- ==============================================================
-- SQL COMMANDS TO EXTRACT SCHEMA DEFINITIONS (RUN IN SUPABASE UI)
-- ==============================================================
-- Usage: Copy and paste each section into the Supabase SQL Editor
-- to see/copy the definitions.
-- ==============================================================

-- --------------------------------------------------------------
-- 1. GET ALL FUNCTIONS (Stored Procedures)
-- --------------------------------------------------------------
-- This returns the full "CREATE OR REPLACE FUNCTION..." code for every function in 'public'.
SELECT 
    proname as function_name, 
    pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;


-- --------------------------------------------------------------
-- 2. GET ALL RLS POLICIES
-- --------------------------------------------------------------
-- Shows every security policy (RLS) on your tables.
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation,
    qual as using_expression,
    with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;


-- --------------------------------------------------------------
-- 3. GET ALL INDEXES
-- --------------------------------------------------------------
-- Shows the "CREATE INDEX" commands.
SELECT 
    tablename, 
    indexname, 
    indexdef as create_statement
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- --------------------------------------------------------------
-- 4. GET ALL TABLES & COLUMNS
-- --------------------------------------------------------------
-- It is very difficult to generate a full "CREATE TABLE" statement 
-- via SQL alone. This list shows every column and its type.
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- --------------------------------------------------------------
-- 5. GET ALL VIEWS
-- --------------------------------------------------------------
SELECT 
    table_name as view_name, 
    view_definition
FROM information_schema.views
WHERE table_schema = 'public';
