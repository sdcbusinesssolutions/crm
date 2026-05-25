#!/bin/bash

echo "Starting WhatsApp Flow Builder..."

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

# Start Backend in background
echo "Starting Backend Server..."
cd server
npm start &
SERVER_PID=$!
cd ..

# Start Frontend
echo "Starting Frontend Client..."
cd client
npm run dev

# Cleanup on exit
trap "kill $SERVER_PID" EXIT
