#!/bin/bash

# Comprehensive MCP Server Installation Script
# This script installs ALL MCP servers and dependencies properly

echo "🚀 Installing Ultimate Claude Dev Stack - Complete Setup"
echo "======================================================="

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Create all necessary directories
echo -e "\n${BLUE}📁 Creating directory structure...${NC}"
mkdir -p ~/.claude/{agents,commands,repos,mcp-logs}
mkdir -p ~/.claude/repos/{indydevtools,BMAD-METHOD,claude-code-is-programmable}

# Install Python package manager tools if needed
echo -e "\n${BLUE}🐍 Setting up Python tools...${NC}"
if ! command -v pip &> /dev/null; then
    echo -e "${YELLOW}Installing pip...${NC}"
    curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
    python3 get-pip.py
    rm get-pip.py
fi

if ! command -v uvx &> /dev/null; then
    echo -e "${YELLOW}Installing uvx...${NC}"
    pip install --user uvx
    # Add to PATH if needed
    export PATH="$HOME/.local/bin:$PATH"
fi

# Install pipx for isolated Python environments
if ! command -v pipx &> /dev/null; then
    echo -e "${YELLOW}Installing pipx...${NC}"
    pip install --user pipx
    pipx ensurepath
fi

# 1. Install Neon MCP Server
echo -e "\n${BLUE}1. Installing Neon MCP Server...${NC}"
npm install -g @neondatabase/mcp-server-neon
echo -e "${GREEN}✓ Neon MCP Server installed${NC}"

# 2. Install Serena MCP Server
echo -e "\n${BLUE}2. Installing Serena MCP Server...${NC}"
# Clone and install Serena
if [ ! -d ~/.claude/repos/serena ]; then
    git clone https://github.com/oraios/serena.git ~/.claude/repos/serena
fi
cd ~/.claude/repos/serena
pip install -e .
echo -e "${GREEN}✓ Serena MCP Server installed${NC}"

# 3. Install Consult7 MCP Server
echo -e "\n${BLUE}3. Installing Consult7 MCP Server...${NC}"
pipx install consult7
echo -e "${GREEN}✓ Consult7 MCP Server installed${NC}"

# 4. Install Context7 MCP Server
echo -e "\n${BLUE}4. Installing Context7 MCP Server...${NC}"
npm install -g @upstash/context7-mcp
echo -e "${GREEN}✓ Context7 MCP Server installed${NC}"

# 5. Install Playwright MCP Server
echo -e "\n${BLUE}5. Installing Playwright MCP Server...${NC}"
npm install -g @playwright/mcp
# Install browsers for Playwright
npx playwright install chromium
echo -e "${GREEN}✓ Playwright MCP Server installed${NC}"

# 6. Install Desktop Commander MCP
echo -e "\n${BLUE}6. Installing Desktop Commander MCP...${NC}"
npm install -g @wonderwhy-er/desktop-commander
echo -e "${GREEN}✓ Desktop Commander MCP installed${NC}"

# 7. Clone and setup BMAD-METHOD
echo -e "\n${BLUE}7. Setting up BMAD-METHOD...${NC}"
if [ ! -d ~/.claude/repos/BMAD-METHOD/.git ]; then
    rm -rf ~/.claude/repos/BMAD-METHOD
    git clone https://github.com/bmadcode/BMAD-METHOD.git ~/.claude/repos/BMAD-METHOD
fi
cd ~/.claude/repos/BMAD-METHOD
if [ -f package.json ]; then
    npm install
fi
echo -e "${GREEN}✓ BMAD-METHOD repository cloned${NC}"

# 8. Clone and setup IndyDevTools
echo -e "\n${BLUE}8. Setting up IndyDevTools...${NC}"
if [ ! -d ~/.claude/repos/indydevtools/.git ]; then
    rm -rf ~/.claude/repos/indydevtools
    git clone https://github.com/disler/indydevtools.git ~/.claude/repos/indydevtools
fi
cd ~/.claude/repos/indydevtools
if [ -f package.json ]; then
    npm install
fi
echo -e "${GREEN}✓ IndyDevTools repository cloned${NC}"

# 9. Clone claude-code-is-programmable
echo -e "\n${BLUE}9. Setting up claude-code-is-programmable...${NC}"
if [ ! -d ~/.claude/repos/claude-code-is-programmable/.git ]; then
    rm -rf ~/.claude/repos/claude-code-is-programmable
    git clone https://github.com/indydevdan/claude-code-is-programmable.git ~/.claude/repos/claude-code-is-programmable
fi
cd ~/.claude/repos/claude-code-is-programmable
if [ -f package.json ]; then
    npm install
fi
echo -e "${GREEN}✓ claude-code-is-programmable repository cloned${NC}"

# Create environment configuration file
echo -e "\n${BLUE}📝 Creating environment configuration...${NC}"
cat > ~/.claude/.env << 'EOL'
# Ultimate Claude Dev Stack Environment Configuration
# Add your API keys here

# Neon Database
export NEON_API_KEY="your-neon-api-key-here"

# Consult7 (for OpenRouter/Gemini)
export CONSULT7_API_KEY="your-consult7-api-key-here"

# Rovo (if using Atlassian)
export ROVO_API_KEY="your-rovo-api-key-here"

# Paths
export CLAUDE_HOME="$HOME/.claude"
export PATH="$HOME/.local/bin:$PATH"
EOL

echo -e "${YELLOW}⚠️  Please edit ~/.claude/.env and add your API keys${NC}"

# Create a test script for each MCP server
echo -e "\n${BLUE}🧪 Creating test scripts...${NC}"
cat > ~/.claude/test-mcp-servers.sh << 'EOL'
#!/bin/bash

echo "🧪 Testing MCP Servers..."
echo "======================="

# Source environment
source ~/.claude/.env

# Test each server
echo -e "\n1. Testing Neon MCP..."
npx @neondatabase/mcp-server-neon --version 2>/dev/null && echo "✓ Neon MCP OK" || echo "✗ Neon MCP FAILED"

echo -e "\n2. Testing Serena MCP..."
python -m serena.mcp_server --version 2>/dev/null && echo "✓ Serena MCP OK" || echo "✗ Serena MCP FAILED"

echo -e "\n3. Testing Consult7..."
consult7 --version 2>/dev/null && echo "✓ Consult7 OK" || echo "✗ Consult7 FAILED"

echo -e "\n4. Testing Context7..."
npx @upstash/context7-mcp --version 2>/dev/null && echo "✓ Context7 OK" || echo "✗ Context7 FAILED"

echo -e "\n5. Testing Playwright MCP..."
npx @playwright/mcp --version 2>/dev/null && echo "✓ Playwright MCP OK" || echo "✗ Playwright MCP FAILED"

echo -e "\n6. Testing Desktop Commander..."
npx @wonderwhy-er/desktop-commander --version 2>/dev/null && echo "✓ Desktop Commander OK" || echo "✗ Desktop Commander FAILED"
EOL

chmod +x ~/.claude/test-mcp-servers.sh

# Update the MCP configuration with correct paths
echo -e "\n${BLUE}📋 Updating MCP configuration...${NC}"
cat > ~/.claude/mcp.json << 'EOL'
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": [
        "@neondatabase/mcp-server-neon",
        "start"
      ],
      "env": {
        "NEON_API_KEY": "${NEON_API_KEY}"
      },
      "description": "Neon Postgres MCP server for natural language DB operations"
    },
    "serena": {
      "command": "python",
      "args": [
        "-m",
        "serena.mcp_server"
      ],
      "cwd": "${HOME}/.claude/repos/serena",
      "description": "Semantic code analysis and retrieval toolkit"
    },
    "consult7": {
      "command": "consult7",
      "args": [
        "openrouter"
      ],
      "env": {
        "CONSULT7_API_KEY": "${CONSULT7_API_KEY}"
      },
      "description": "Large codebase consultation via secondary LLMs"
    },
    "context7": {
      "command": "npx",
      "args": [
        "@upstash/context7-mcp"
      ],
      "description": "Up-to-date documentation and context retrieval"
    },
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp",
        "--browser",
        "chromium",
        "--headless"
      ],
      "description": "Browser automation and web scraping"
    },
    "desktop-commander": {
      "command": "npx",
      "args": [
        "@wonderwhy-er/desktop-commander"
      ],
      "description": "Terminal and file system operations"
    }
  }
}
EOL

echo -e "\n${GREEN}✅ Installation complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Edit ~/.claude/.env and add your API keys"
echo "2. Run: source ~/.claude/.env"
echo "3. Test installations: ~/.claude/test-mcp-servers.sh"
echo "4. Restart Claude Code to load MCP servers"
echo -e "\n${BLUE}Your agents are ready at: ~/.claude/agents/${NC}"
echo -e "${BLUE}Your commands are ready at: ~/.claude/commands/${NC}"