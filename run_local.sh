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
