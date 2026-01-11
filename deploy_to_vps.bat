@echo off
set VPS_IP=82.29.162.225
set REMOTE_DIR=/www/wwwroot/whatsapp-app

echo ===================================================
echo 🚀 AUTOMATED DEPLOYMENT TO %VPS_IP%
echo ===================================================

REM 1. Build the zip file
call prepare_upload.bat

echo.
echo ---------------------------------------------------
echo [STEP 1/3] Preparing VPS Folder...
echo ---------------------------------------------------
echo 🔒 You will be asked for the VPS password (password)
ssh root@%VPS_IP% "mkdir -p %REMOTE_DIR%"

echo.
echo ---------------------------------------------------
echo [STEP 2/3] Uploading Code...
echo ---------------------------------------------------
echo 🔒 Enter password again...
scp deploy-package.zip root@%VPS_IP%:%REMOTE_DIR%/

echo.
echo ---------------------------------------------------
echo [STEP 3/3] Installing and Starting...
echo ---------------------------------------------------
echo 🔒 Enter password one last time...

REM Fix CRLF issues by converting the script to Unix format on the fly using sed
REM We also explicitly call bash on the script
ssh -t root@%VPS_IP% "cd %REMOTE_DIR% && unzip -o deploy-package.zip && dos2unix bulk_deploy.sh 2>/dev/null || sed -i 's/\r$//' bulk_deploy.sh && chmod +x bulk_deploy.sh && ./bulk_deploy.sh"

echo.
echo ===================================================
echo ✅ DEPLOYMENT COMPLETE!
echo ===================================================
pause
