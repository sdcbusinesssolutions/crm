@echo off
echo Cleaning up temporary test files...
cd server
if exist server_temp.js (
    del server_temp.js
    echo Deleted server_temp.js
) else (
    echo server_temp.js not found (already clean).
)
echo.
echo Cleanup complete.
pause
