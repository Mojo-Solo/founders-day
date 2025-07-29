#!/bin/bash

# Founders Day - Development Environment Startup Script
# This script ensures both frontend and admin start on the correct ports

echo "🚀 Starting Founders Day Development Environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo "Killing process on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill 0
    exit
}

# Set up trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Check and handle port 3000
if check_port 3000; then
    echo -e "${YELLOW}Port 3000 is in use.${NC}"
    read -p "Kill process on port 3000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 3000
        echo -e "${GREEN}Port 3000 cleared!${NC}"
    else
        echo -e "${BLUE}Frontend will use next available port.${NC}"
    fi
fi

# Check and handle port 3001
if check_port 3001; then
    echo -e "${YELLOW}Port 3001 is in use.${NC}"
    read -p "Kill process on port 3001? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 3001
        echo -e "${GREEN}Port 3001 cleared!${NC}"
    else
        echo -e "${RED}Admin backend needs port 3001!${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}Starting Admin Backend (CMS) on port 3001...${NC}"
cd founders-day-admin
npm run dev &
ADMIN_PID=$!

# Wait for admin to start
echo "Waiting for admin backend to start..."
sleep 5

echo ""
echo -e "${GREEN}Starting Frontend on port 3000...${NC}"
cd ../founders-day-frontend
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 5

echo ""
echo -e "${GREEN}✅ Both services are running!${NC}"
echo ""
echo -e "${YELLOW}Access Points:${NC}"
echo -e "  ${GREEN}Frontend:${NC} http://localhost:3000"
echo -e "  ${BLUE}Admin CMS:${NC} http://localhost:3001"
echo ""
echo -e "${YELLOW}Testing:${NC}"
echo "  Run tests: ./TEST-ALL.sh"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "  - If frontend uses port 3003, restart this script"
echo "  - Check browser console for API errors"
echo "  - Admin login: Use /login on admin site"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Keep script running
wait