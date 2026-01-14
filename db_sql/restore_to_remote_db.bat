@echo off
setlocal
echo ==========================================
echo Restore Large SQL File using Node.js
echo ==========================================

:: 1. Ask for Target DB URL
echo Please paste the connection string for the DESTINATION database (e.g., postgresql://user:pass@host:5432/db)
set /p DB_URL="Target DB URL: "

:: 2. Ask for File
echo.
echo Drag and drop the .sql file you want to run into this window and press Enter:
set /p SQL_FILE="SQL File: "

:: Remove quotes if added by drag-and-drop
set SQL_FILE=%SQL_FILE:"=%

if not exist "%SQL_FILE%" (
    echo.
    echo [ERROR] File not found: %SQL_FILE%
    pause
    exit /b
)

echo.
echo [Running] Restoring %SQL_FILE% using Node.js...
echo.

:: Execute using Node script
:: We need to look for node_modules in the parent "server" directory if running from db_sql
cd /d "%~dp0"
if exist "..\server\node_modules" (
    :: Temporarily set NODE_PATH to find modules
    set NODE_PATH=..\server\node_modules
) else (
    echo [WARNING] node_modules not found in ..\server. Trying global or local lookup.
)

:: Run the script (Assuming restore_db_node.js is in the same folder as this bat)
node restore_db_node.js "%DB_URL%" "%SQL_FILE%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node script failed.
) else (
    echo.
    echo [SUCCESS] Script finished.
)

pause
