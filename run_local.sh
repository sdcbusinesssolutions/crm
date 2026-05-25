#!/bin/bash

echo "Starting WhatsApp Flow Builder..."

# ----------------------------------------------------------------------------------
# 0. SELECT DOMAIN/DATABASE FROM CSV
# ----------------------------------------------------------------------------------
CSV_FILE="domains.csv"
if [ -f "$CSV_FILE" ]; then
    echo -e "\e[36mReading '$CSV_FILE' for configuration...\e[0m"
    
    # Extract the first row where RunLocal (column 12) is true (case insensitive)
    # Strip carriage returns to prevent broken .env files
    SELECTED_ROW=$(awk -F',' 'NR>1 && (tolower($12)=="true") {print $0; exit}' "$CSV_FILE" | tr -d '\r')
    
    if [ -n "$SELECTED_ROW" ]; then
        # Parse the columns based on domains.csv format
        IFS=',' read -r DOMAIN VPSIP VPSPASSWORD DEPLOYENABLED TRAEFIKNETWORK SB_URL SB_KEY SB_SERVICE CERTRESOLVER DBCONNECTION MASTER RUNLOCAL TRIAL_DAYS DELETE_WINDOW DEV <<< "$SELECTED_ROW"
        
        echo -e "\e[32m✅ Auto-selected configuration from CSV: $DOMAIN\e[0m"
        
        # Fallbacks
        if [ -z "$TRIAL_DAYS" ]; then TRIAL_DAYS="7"; fi
        if [ -z "$DELETE_WINDOW" ]; then DELETE_WINDOW="9"; fi
        if [ -z "$MASTER" ]; then MASTER="https://$DOMAIN"; fi
        
        # Create valid local .env content
        ENV_CONTENT="PORT=5000
NODE_ENV=development
DOMAIN=$DOMAIN
CLIENT_URL=http://localhost:3000
APP_URL=http://localhost:3000
SUPABASE_URL=$SB_URL
SUPABASE_KEY=$SB_KEY
SUPABASE_SERVICE_KEY=$SB_SERVICE
SUPABASE_ANON_KEY=$SB_KEY
VITE_SUPABASE_URL=$SB_URL
VITE_SUPABASE_ANON_KEY=$SB_KEY
VITE_CLIENT_URL=http://localhost:3000
VITE_API_URL=http://localhost:5000
VITE_MASTER_URL=$MASTER
BRIDGE_DOMAIN=$MASTER
JWT_SECRET=super-secret-dev-jwt-key-change-in-prod
TRIAL_DAYS=$TRIAL_DAYS
TENANT_ADMIN_DELETE_WINDOW_DAYS=$DELETE_WINDOW"

        echo -e "\e[36mUpdating local .env files...\e[0m"
        
        # Update Server .env
        if [ -f "server/.env" ]; then cp "server/.env" "server/.env.bak"; fi
        echo "$ENV_CONTENT" > "server/.env"
        echo -e "\e[90mUpdated server/.env\e[0m"
        
        # Update Client .env
        if [ -f "client/.env" ]; then cp "client/.env" "client/.env.bak"; fi
        echo "$ENV_CONTENT" > "client/.env"
        echo -e "\e[90mUpdated client/.env\e[0m"
        
        echo -e "\e[32mNew environment configured for '$DOMAIN'!\e[0m"
    else
        echo -e "\e[33m⚠️ No 'RunLocal=TRUE' found in CSV. Using existing .env if present.\e[0m"
    fi
else
    echo -e "\e[33m⚠️ domains.csv not found! Using existing .env if present.\e[0m"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Node.js is not installed. Please install it first."
    exit 1
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
fi

# Check if port 5000 is already in use and free it if needed
echo "Checking port 5000..."
PORT_PID=$(lsof -t -i:5000)
if [ ! -z "$PORT_PID" ]; then
    echo "Port 5000 is occupied by PID(s): $PORT_PID. Terminating process to free the port..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

# Release port 3000 too (frontend)
echo "Checking port 3000..."
PORT_3000_PID=$(lsof -t -i:3000)
if [ ! -z "$PORT_3000_PID" ]; then
    echo "Port 3000 is occupied by PID(s): $PORT_3000_PID. Terminating process to free the port..."
    kill -9 $PORT_3000_PID 2>/dev/null
    sleep 1
fi

# Start Backend in background
echo -e "\e[32mStarting Backend Server...\e[0m"
cd server
npm start &
SERVER_PID=$!
cd ..

# Wait a moment for backend to initialize
sleep 2

# Start Frontend
echo -e "\e[32mStarting Frontend Client...\e[0m"
cd client
npm run dev

# Cleanup on exit
trap "kill $SERVER_PID" EXIT
