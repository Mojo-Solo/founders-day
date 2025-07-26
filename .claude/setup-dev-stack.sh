#!/bin/bash

# Ultimate Claude Dev Stack Setup Script
# This script sets up all MCP servers and configurations

echo "🚀 Setting up Ultimate Claude Dev Stack..."

# Check for required environment variables
if [ -z "$NEON_API_KEY" ]; then
    echo "❌ Error: NEON_API_KEY not set. Please export it from GitHub Secrets."
    exit 1
fi

if [ -z "$CONSULT7_API_KEY" ]; then
    echo "⚠️  Warning: CONSULT7_API_KEY not set. Consult7 agent will have limited functionality."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p ~/.claude/{agents,commands,mongodb/data,mongodb/logs,repos}

# Install MCP servers
echo "📦 Installing MCP servers..."

# Neon MCP
echo "  - Installing Neon MCP..."
npx -y @neondatabase/mcp-server-neon test || echo "⚠️  Neon MCP test failed"

# Serena MCP
echo "  - Installing Serena MCP..."
uvx --from git+https://github.com/oraios/serena serena-mcp-server --version || echo "⚠️  Serena MCP not available"

# Context7 MCP
echo "  - Installing Context7 MCP..."
npx -y @smithery/cli@latest install @upstash/context7-mcp --client claude

# Playwright MCP
echo "  - Installing Playwright MCP..."
npx @playwright/mcp@latest --version || echo "⚠️  Playwright MCP not available"

# Desktop Commander MCP
echo "  - Installing Desktop Commander MCP..."
npx -y @smithery/cli install @wonderwhy-er/desktop-commander --client claude

# Clone additional repos
echo "📚 Cloning additional repositories..."

# IndyDev tools
if [ ! -d ~/.claude/repos/indydevtools ]; then
    git clone https://github.com/disler/indydevtools.git ~/.claude/repos/indydevtools
    cd ~/.claude/repos/indydevtools && npm install
fi

# BMAD Method
if [ ! -d ~/.claude/repos/BMAD-METHOD ]; then
    git clone https://github.com/bmadcode/BMAD-METHOD.git ~/.claude/repos/BMAD-METHOD
    cd ~/.claude/repos/BMAD-METHOD && npm run install:bmad 2>/dev/null || echo "⚠️  BMAD install script not found"
fi

# Setup Laravel/Neon environment
echo "🐘 Setting up Laravel environment..."
if [ -f .env.example ]; then
    cp .env.example .env
    php artisan key:generate
    
    # Add Neon database configuration
    cat >> .env << EOL

# Neon Database
DB_CONNECTION=pgsql
DB_HOST=your-project.neon.tech
DB_PORT=5432
DB_DATABASE=claude_dev_stack
DB_USERNAME=your_username
DB_PASSWORD=your_password
NEON_API_KEY=$NEON_API_KEY
EOL
    
    echo "  ✅ Laravel .env configured (update DB credentials)"
fi

# Create MCP config if it doesn't exist
if [ ! -f ~/.claude/mcp.json ]; then
    echo "📝 Creating MCP configuration..."
    cp "$(dirname "$0")/mcp.json" ~/.claude/mcp.json
    echo "  ✅ MCP configuration created at ~/.claude/mcp.json"
fi

# Test database connection
echo "🔍 Testing database connection..."
if command -v php &> /dev/null; then
    php artisan db:show 2>/dev/null || echo "⚠️  Database connection not configured"
fi

echo "
✅ Ultimate Claude Dev Stack setup complete!

Next steps:
1. Update database credentials in .env file
2. Run 'php artisan migrate' to create tables
3. Restart Claude Code to load MCP servers
4. Use '/db-setup' to initialize the database
5. Use '/chain-analysis' to test the agent chain

Agents available:
- serena-agent: Semantic code analysis
- consult7-agent: Large codebase consultation  
- context7-agent: Documentation fetching
- playwright-agent: Browser automation
- desktop-commander-agent: System commands
- bmad-planner: BMAD workflows
- revo-executor: Code generation
- db-manager: Neon Postgres operations
- indydev-integrator: Modular agent building

Happy coding! 🎉
"