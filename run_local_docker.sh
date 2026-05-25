#!/bin/bash

echo "=========================================="
echo "🐳 Starting Local Docker Test"
echo "=========================================="

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

echo "1. Stopping existing containers..."
docker-compose -f docker-compose.local.yml down

echo ""
echo "2. Building and Starting..."
docker-compose -f docker-compose.local.yml up --build
