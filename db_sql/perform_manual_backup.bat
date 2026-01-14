@echo off
setlocal

:: Get Date and Time in YYYY-MM-DD_HHMM format using wmic (Region Independent)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%%datetime:~10,2%"

echo ==========================================
echo Starting Supabase Database Backup
echo Timestamp: %TIMESTAMP%
echo ==========================================

:: Set the Connection String (Escaped % as %% for Batch)
set "DB_URL=postgresql://postgres.dkibqgamuxjzhiwxcfzd:sonuDEV%%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

:: 1. Dump Roles
echo.
echo [1/3] Dumping Roles...
supabase db dump --db-url "%DB_URL%" -f roles_%TIMESTAMP%.sql --role-only

:: 2. Dump Schema
echo.
echo [2/3] Dumping Schema...
supabase db dump --db-url "%DB_URL%" -f schema_%TIMESTAMP%.sql

:: 3. Dump Data
echo.
echo [3/3] Dumping Data...
supabase db dump --db-url "%DB_URL%" -f data_%TIMESTAMP%.sql --use-copy --data-only

echo.
echo ==========================================
echo Backup Complete!
echo Files saved: roles_%TIMESTAMP%.sql, schema_%TIMESTAMP%.sql, data_%TIMESTAMP%.sql
echo ==========================================
pause
