@echo off
setlocal

echo ===================================================
echo      WhatsApp Webhook Local Tester
echo ===================================================
echo.

:: unbronzed-parotic-sage.ngrok-free.dev
::  https://unbronzed-parotic-sage.ngrok-free.dev
:: 1. Configuration
set USER_ID=5ae5999e-1eb2-4425-adf4-858156709d2d
set VERIFY_TOKEN=test-test
set BASE_URL=http://localhost:5000/api


echo.
echo [1/2] Testing GET Verification...
echo ---------------------------------------------------
echo URL: %BASE_URL%/%USER_ID%/webhook
echo Params: hub.mode=subscribe, hub.verify_token=%VERIFY_TOKEN%, hub.challenge=12345
echo.

:: Send GET request
curl -i -X GET "%BASE_URL%/%USER_ID%/webhook?hub.mode=subscribe&hub.verify_token=%VERIFY_TOKEN%&hub.challenge=12345"

echo.
echo.
echo [2/2] Testing POST Message (Text Message)...
echo ---------------------------------------------------
echo Payload: {"object":"whatsapp_business_account", ... "body":"Hello World"}
echo.

:: Send POST request
curl -i -X POST -H "Content-Type: application/json" -d "{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"123456789\",\"changes\":[{\"value\":{\"messaging_product\":\"whatsapp\",\"metadata\":{\"display_phone_number\":\"15550251111\",\"phone_number_id\":\"100000000000000\"},\"contacts\":[{\"profile\":{\"name\":\"Test User\"},\"wa_id\":\"15550251111\"}],\"messages\":[{\"from\":\"15550251111\",\"id\":\"wamid.HBgLM...\",\"timestamp\":\"1700000000\",\"text\":{\"body\":\"Hello World from Local Test!\"},\"type\":\"text\"}]},\"field\":\"messages\"}]}]}" "%BASE_URL%/%USER_ID%/webhook"

echo.
echo.
echo ===================================================
echo Test Complete. 
echo Check your server console for logs.
echo Check your 'webhook_logs' table in Supabase for the record.
echo ===================================================
pause
