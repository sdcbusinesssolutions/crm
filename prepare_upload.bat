@echo off
setlocal EnableDelayedExpansion

echo ==========================================
echo 🛍️ CLEAN BUILD AND PACKAGE (Optimized)
echo ==========================================

set "BUILD_DIR=temp_deploy_build"
set "ZIP_NAME=deploy-package.zip"

REM 1. Cleanup previous runs
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
if exist "%ZIP_NAME%" del "%ZIP_NAME%"

echo.
echo 🧹 Creating clean temporary directory...
mkdir "%BUILD_DIR%"

REM 1a. Generate Deployment Info (Run locally where .git exists)
echo 🏷️  Generating Deployment Tag...
for /f "tokens=*" %%i in ('git rev-parse --short HEAD') do set GIT_COMMIT=%%i
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set GIT_BRANCH=%%i

REM Sanitize Branch Name (replace non-alphanumeric with -)
powershell -Command "$b='%GIT_BRANCH%'; $s=$b -replace '[^a-zA-Z0-9]','-'; Write-Output $s" > branch_sanitized.tmp
set /p GIT_BRANCH_CLEAN=<branch_sanitized.tmp
del branch_sanitized.tmp

REM Get Date
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set GIT_DATE=%datetime:~0,8%

set "IMAGE_TAG=%GIT_BRANCH_CLEAN%-%GIT_DATE%-%GIT_COMMIT%"
echo    Tag: %IMAGE_TAG%

REM 2. Copy CLIENT (Only Source Code)
echo 📂 Copying Client...
REM /XD: Exclude huge/unneeded folders (node_modules, coverage, docs)
REM /XF: Exclude unneeded files (.md, .log, .env)
mkdir "%BUILD_DIR%\client"
robocopy "client" "%BUILD_DIR%\client" /E /XD node_modules dist coverage local_testing doc docs /XF *.log .env* *.md *.txt *.sql

REM Write tag to file for remote use
echo IMAGE_TAG=%IMAGE_TAG% > "%BUILD_DIR%\deploy_env"


REM 3. Copy SERVER (Only Production Code)
echo 📂 Copying Server...
REM /XD: Exclude huge/unneeded folders (node_modules, uploads, logs, sql, doc)
REM /XF: Exclude debug files (.js), dumps (.sql), docs (.md), logs
robocopy "server" "%BUILD_DIR%\server" /E /XD node_modules node_modules_old uploads logs tests tmp doc docs documentation sql db_sql /XF debug_*.js test_*.js *.zip *.log .env* .DS_Store *.md *.sql *.txt run_sql.js
REM Explicitly ensure controllers are copied (Fix for missing module error)
robocopy "server\controllers" "%BUILD_DIR%\server\controllers" /E

REM 3b. INJECT PRODUCTION CONFIG (The "Two Env File" Strategy)
echo ==========================================
echo ⚠️  OVERWRITING .ENV WITH PRODUCTION CONFIG
echo ==========================================
copy "server\.env.production" "%BUILD_DIR%\server\.env" >nul
echo.
type "%BUILD_DIR%\server\.env"
echo.

REM 4. Copy Root Config Files
echo 📄 Copying Configs...
copy "docker-compose.yml" "%BUILD_DIR%\" >nul
copy "Dockerfile" "%BUILD_DIR%\" >nul
copy "auto_deploy.sh" "%BUILD_DIR%\" >nul
copy "bulk_deploy.sh" "%BUILD_DIR%\" >nul
copy "domains.csv" "%BUILD_DIR%\" >nul
copy ".dockerignore" "%BUILD_DIR%\" >nul
copy "docker-compose-backup.yml" "%BUILD_DIR%\" >nul
mkdir "%BUILD_DIR%\backup"
robocopy "backup" "%BUILD_DIR%\backup" /E

REM 5. Create Zip from Clean Folder
echo.
echo 🗜️  Compressing optimized files...
powershell -command "Compress-Archive -Path '%BUILD_DIR%\*' -DestinationPath '%ZIP_NAME%' -Force"

REM 6. Cleanup Temp Folder
echo 🧹 Removing temp files...
rmdir /s /q "%BUILD_DIR%"

echo.
echo ==========================================
echo ✅ DONE! 
echo Created: %ZIP_NAME%
echo Optimization:
echo  - NO node_modules
echo  - NO uploads/logs
echo  - NO docs/md/txt
echo  - NO sql dumps
echo  - NO debug scripts
echo ==========================================
REM pause
