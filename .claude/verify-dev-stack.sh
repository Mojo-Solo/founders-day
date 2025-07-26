#!/bin/bash

# Ultimate Claude Dev Stack Verification Script
# This script verifies all MCP servers and repositories are properly installed

echo "🔍 Verifying Ultimate Claude Dev Stack Installation..."
echo "=================================================="

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ALL_GOOD=true

# Function to check command availability
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ALL_GOOD=false
        return 1
    fi
}

# Function to check npm package
check_npm_package() {
    if npx -y $1 --version &> /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ALL_GOOD=false
        return 1
    fi
}

# Function to check directory exists
check_directory() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ALL_GOOD=false
        return 1
    fi
}

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        ALL_GOOD=false
        return 1
    fi
}

# Function to check environment variable
check_env() {
    if [ -n "${!1}" ]; then
        echo -e "${GREEN}✓${NC} $2 is set"
        return 0
    else
        echo -e "${RED}✗${NC} $2 is not set"
        ALL_GOOD=false
        return 1
    fi
}

echo "1. Checking Prerequisites"
echo "------------------------"
check_command "node" "Node.js installed"
check_command "npm" "npm installed"
check_command "npx" "npx installed"
check_command "git" "Git installed"
check_command "php" "PHP installed (for Laravel)"
check_command "uvx" "uvx installed (for Python MCP servers)"

echo -e "\n2. Checking Environment Variables"
echo "--------------------------------"
check_env "NEON_API_KEY" "NEON_API_KEY"
check_env "CONSULT7_API_KEY" "CONSULT7_API_KEY (optional)"

echo -e "\n3. Checking MCP Servers"
echo "----------------------"

# Neon MCP
echo -n "Testing Neon MCP server... "
if npx -y @neondatabase/mcp-server-neon --help &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Available"
else
    echo -e "${RED}✗${NC} Not available"
    ALL_GOOD=false
fi

# Serena MCP
echo -n "Testing Serena MCP server... "
if uvx --from git+https://github.com/oraios/serena serena-mcp-server --help &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Available"
else
    echo -e "${YELLOW}⚠${NC} Not available (may need manual setup)"
fi

# Context7 MCP
echo -n "Testing Context7 MCP server... "
if npx -y @upstash/context7-mcp --help &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Available"
else
    echo -e "${RED}✗${NC} Not available"
    ALL_GOOD=false
fi

# Playwright MCP
echo -n "Testing Playwright MCP server... "
if npx @playwright/mcp@latest --help &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Available"
else
    echo -e "${RED}✗${NC} Not available"
    ALL_GOOD=false
fi

# Desktop Commander MCP
echo -n "Testing Desktop Commander MCP... "
if npx -y @wonderwhy-er/desktop-commander --help &> /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Available"
else
    echo -e "${RED}✗${NC} Not available"
    ALL_GOOD=false
fi

echo -e "\n4. Checking Git Repositories"
echo "---------------------------"
check_directory "$HOME/.claude/repos/indydevtools" "IndyDevTools repository"
if [ -d "$HOME/.claude/repos/indydevtools" ]; then
    check_file "$HOME/.claude/repos/indydevtools/package.json" "IndyDevTools package.json"
fi

check_directory "$HOME/.claude/repos/BMAD-METHOD" "BMAD-METHOD repository"
if [ -d "$HOME/.claude/repos/BMAD-METHOD" ]; then
    check_file "$HOME/.claude/repos/BMAD-METHOD/package.json" "BMAD-METHOD package.json"
fi

echo -e "\n5. Checking Agent Files"
echo "----------------------"
check_file "$HOME/.claude/agents/serena-agent.md" "serena-agent"
check_file "$HOME/.claude/agents/consult7-agent.md" "consult7-agent"
check_file "$HOME/.claude/agents/context7-agent.md" "context7-agent"
check_file "$HOME/.claude/agents/playwright-agent.md" "playwright-agent"
check_file "$HOME/.claude/agents/desktop-commander-agent.md" "desktop-commander-agent"
check_file "$HOME/.claude/agents/bmad-planner.md" "bmad-planner"
check_file "$HOME/.claude/agents/revo-executor.md" "revo-executor"
check_file "$HOME/.claude/agents/db-manager.md" "db-manager"
check_file "$HOME/.claude/agents/indydev-integrator.md" "indydev-integrator"

echo -e "\n6. Checking Command Files"
echo "------------------------"
check_file "$HOME/.claude/commands/chain-analysis.md" "/chain-analysis command"
check_file "$HOME/.claude/commands/bmad-plan.md" "/bmad-plan command"
check_file "$HOME/.claude/commands/db-setup.md" "/db-setup command"
check_file "$HOME/.claude/commands/quick-agent.md" "/quick-agent command"

echo -e "\n7. Checking Configuration"
echo "------------------------"
check_file "$HOME/.claude/mcp.json" "MCP configuration file"

echo -e "\n8. Checking Laravel/Neon Setup (if applicable)"
echo "---------------------------------------------"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} Laravel .env file exists"
    
    # Check if Neon is configured
    if grep -q "DB_CONNECTION=pgsql" .env && grep -q "neon.tech" .env; then
        echo -e "${GREEN}✓${NC} Neon database configured in .env"
    else
        echo -e "${YELLOW}⚠${NC} Neon database not configured in .env"
    fi
else
    echo -e "${YELLOW}⚠${NC} No Laravel .env file found"
fi

echo -e "\n=================================================="
if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ All checks passed! Your Ultimate Claude Dev Stack is ready to use.${NC}"
    echo -e "\nYou can now:"
    echo "1. Restart Claude Code to load MCP servers"
    echo "2. Use /chain-analysis for semantic code analysis"
    echo "3. Use /bmad-plan for project planning"
    echo "4. Use /db-setup to initialize Neon database"
else
    echo -e "${RED}❌ Some checks failed. Please run setup-dev-stack.sh to fix issues.${NC}"
    echo -e "\nTo fix missing components, run:"
    echo "  ./setup-dev-stack.sh"
fi

echo -e "\n💡 Quick Test Commands:"
echo "---------------------"
echo "Test Neon MCP:     npx -y @neondatabase/mcp-server-neon test"
echo "Test agent chain:  /chain-analysis . 'test analysis'"
echo "Test Playwright:   npx @playwright/mcp@latest --browser chrome --headless"