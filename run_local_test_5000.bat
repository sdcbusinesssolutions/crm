@echo off
echo ==========================================
echo Setting up Single Port Local Test (Port 5000)
echo ==========================================

echo [0/3] Cleaning up port 5000...
call npx kill-port 5000

echo [1/3] Building Client...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo Client build failed!
    pause
    exit /b %errorlevel%
)
cd ..

echo [2/3] Generating Temporary Server...
cd server
if exist server_temp.js del server_temp.js
node scripts/generate_temp_server.js
if %errorlevel% neq 0 (
    echo Failed to generate temp server!
    pause
    exit /b %errorlevel%
)

echo [3/3] Starting Server on Port 5000...
echo (Press Ctrl+C to stop)
node server_temp.js

echo.
echo Cleaning up...
if exist server_temp.js del server_temp.js
echo Done.
pause
