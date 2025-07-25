#!/bin/bash

# 🚀 Founders Day Complete System Startup Script
# This script starts both frontend and backend applications

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
HERD_DIR="/Users/david/Herd/founders-day"
BACKEND_DIR="$HERD_DIR/founders-day-admin"
FRONTEND_DIR="$HERD_DIR/founders-day-frontend"

echo -e "${PURPLE}🎉 FOUNDERS DAY MINNESOTA 2025 - SYSTEM STARTUP${NC}"
echo "=================================================="
echo -e "${BLUE}🚀 Starting complete Founders Day platform...${NC}"
echo ""

# Check if we're in the right directory
cd "$HERD_DIR"

# Function to check if a directory exists
check_directory() {
    if [ ! -d "$1" ]; then
        echo -e "${RED}❌ Directory not found: $1${NC}"
        exit 1
    fi
}

# Validate directories exist
echo -e "${YELLOW}🔍 Validating project structure...${NC}"
check_directory "$BACKEND_DIR"
check_directory "$FRONTEND_DIR"
echo -e "${GREEN}✅ Project structure validated${NC}"
echo ""

# Function to start application in background
start_app() {
    local app_name="$1"
    local script_path="$2"
    local port="$3"
    local log_file="$4"
    
    echo -e "${BLUE}🔄 Starting $app_name...${NC}"
    
    # Kill existing process on port if any
    local pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  Killing existing process on port $port${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
    
    # Start the application in background
    nohup bash "$script_path" > "$log_file" 2>&1 &
    local app_pid=$!
    
    echo -e "${YELLOW}📝 $app_name started with PID: $app_pid${NC}"
    echo -e "${YELLOW}📄 Logs: $log_file${NC}"
    
    # Wait a moment for startup
    sleep 3
    
    # Check if process is still running
    if kill -0 $app_pid 2>/dev/null; then
        echo -e "${GREEN}✅ $app_name is running successfully${NC}"
    else
        echo -e "${RED}❌ $app_name failed to start${NC}"
        echo -e "${YELLOW}📄 Check logs: $log_file${NC}"
        exit 1
    fi
    
    echo ""
}

# Start backend first
start_app "Backend (Admin)" "$BACKEND_DIR/start-backend.sh" "3001" "$HERD_DIR/backend.log"

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
sleep 5

# Test backend health
backend_health=$(curl -s http://localhost:3001/api/health || echo "failed")
if [[ "$backend_health" == *"ok"* ]] || [[ "$backend_health" == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Backend health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Backend health check returned: $backend_health${NC}"
    echo -e "${YELLOW}   (This is normal if external services aren't configured)${NC}"
fi
echo ""

# Start frontend
start_app "Frontend (Website)" "$FRONTEND_DIR/start-frontend.sh" "3000" "$HERD_DIR/frontend.log"

# Wait for frontend to be ready
echo -e "${YELLOW}⏳ Waiting for frontend to be ready...${NC}"
sleep 5

# Test frontend
frontend_test=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "failed")
if [ "$frontend_test" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend returned status: $frontend_test${NC}"
fi

echo ""
echo "=================================================="
echo -e "${PURPLE}🎉 FOUNDERS DAY PLATFORM IS RUNNING!${NC}"
echo "=================================================="
echo ""
echo -e "${GREEN}🌐 Frontend (Public Website):${NC}"
echo -e "${GREEN}   • Main Site:       http://localhost:3000${NC}"
echo -e "${GREEN}   • Registration:    http://localhost:3000/register${NC}"
echo -e "${GREEN}   • Volunteer:       http://localhost:3000/volunteer${NC}"
echo -e "${GREEN}   • Schedule:        http://localhost:3000/schedule${NC}"
echo ""
echo -e "${GREEN}🏢 Backend (Admin Dashboard):${NC}"
echo -e "${GREEN}   • Admin Dashboard: http://localhost:3001${NC}"
echo -e "${GREEN}   • Health Check:    http://localhost:3001/api/health${NC}"
echo -e "${GREEN}   • Public APIs:     http://localhost:3001/api/public/*${NC}"
echo ""
echo -e "${YELLOW}📄 Logs:${NC}"
echo -e "${YELLOW}   • Backend:  tail -f $HERD_DIR/backend.log${NC}"
echo -e "${YELLOW}   • Frontend: tail -f $HERD_DIR/frontend.log${NC}"
echo ""
echo -e "${YELLOW}🛑 To stop both applications:${NC}"
echo -e "${YELLOW}   kill \$(lsof -ti:3000,3001)${NC}"
echo ""
echo -e "${BLUE}💡 Applications are running in the background.${NC}"
echo -e "${BLUE}   You can close this terminal and they'll keep running.${NC}"
echo "=================================================="