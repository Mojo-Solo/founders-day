#!/bin/bash

# Founders Day - Start Both Frontend and Admin
# This script starts both the admin backend (CMS) and the public frontend

echo "🚀 Starting Founders Day Complete System..."
echo ""
echo "This will start:"
echo "  - Admin Backend (CMS) on http://localhost:3001"
echo "  - Public Frontend on http://localhost:3000"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill 0
    exit
}

# Set up trap to cleanup on Ctrl+C
trap cleanup SIGINT

# Start Admin Backend
echo -e "${BLUE}Starting Admin Backend (CMS)...${NC}"
cd founders-day-admin
npm run dev &
ADMIN_PID=$!

# Wait a bit for admin to start
sleep 3

# Start Frontend
echo -e "${GREEN}Starting Public Frontend...${NC}"
cd ../founders-day-frontend
npm run dev &
FRONTEND_PID=$!

# Wait for both to be ready
sleep 5

echo ""
echo -e "${GREEN}✅ Both services are starting!${NC}"
echo ""
echo -e "${YELLOW}Access Points:${NC}"
echo -e "  ${BLUE}Admin CMS:${NC} http://localhost:3001"
echo -e "  ${GREEN}Public Site:${NC} http://localhost:3000"
echo ""
echo -e "${YELLOW}For your client to edit content:${NC}"
echo "  1. Go to http://localhost:3001/content"
echo "  2. Edit any content (prices, dates, text, etc.)"
echo "  3. Click 'Publish'"
echo "  4. Changes appear instantly on http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Keep script running
wait