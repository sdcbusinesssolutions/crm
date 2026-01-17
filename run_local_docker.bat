@echo off
echo ==========================================
echo 🐳 Starting Local Docker Test
echo ==========================================

REM Check if .env exists
if not exist .env (
    echo ❌ .env file not found!
    echo Please copy .env.example to .env and configure it.
    pause
    exit /b
)

echo 1. Stopping existing containers...
docker-compose -f docker-compose.local.yml down

echo.
echo 2. Building and Starting...
docker-compose -f docker-compose.local.yml up --build

pause
