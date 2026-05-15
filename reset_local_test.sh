#!/bin/bash

echo "Cleaning up temporary test files..."

if [ -f "server/server_temp.js" ]; then
    rm server/server_temp.js
    echo "Deleted server_temp.js"
else
    echo "server_temp.js not found (already clean)."
fi

echo ""
echo "Cleanup complete."
