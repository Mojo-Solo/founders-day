# Ultimate Claude Dev Stack - Complete Guide

## Overview

The Ultimate Claude Dev Stack is a comprehensive set of 9 specialized agents designed to enhance Claude Code's capabilities. These agents implement advanced patterns including:

- **Sequential Chain Processing**: consult7 → context7 → serena
- **Browser Automation**: Playwright integration
- **System Control**: Desktop Commander MCP
- **Agile Workflows**: BMAD methodology
- **State Management**: MongoDB persistence
- **Modular Development**: IndyDev tools integration

## Agent Directory

### 1. Core Analysis Chain

#### consult7-agent
- **Purpose**: Handle large codebases beyond standard context limits
- **Tools**: Bash, Read
- **Usage**: First step in the analysis chain
- **Example**: Analyzing a 50K+ file React codebase

#### context7-agent
- **Purpose**: Fetch and enrich with documentation/context
- **Tools**: Read, Write, WebSearch, WebFetch
- **Usage**: Second step, bridges consult7 and serena
- **Example**: Finding React performance documentation

#### serena-agent
- **Purpose**: Semantic code analysis and type checking
- **Tools**: Read, Grep, Glob
- **Usage**: Final step, provides refined insights
- **Example**: Type inference and pattern detection

### 2. Automation Agents

#### playwright-agent
- **Purpose**: Browser automation and web scraping
- **Tools**: Bash, WebSearch, mcp__ide__executeCode
- **Usage**: Automate UI tasks, scrape dynamic content
- **Example**: E-commerce product data extraction

#### desktop-commander-agent
- **Purpose**: System file and process management
- **Tools**: Bash, Read, Edit, Glob, LS
- **Usage**: Safe system operations
- **Example**: Batch file operations, service management

### 3. Development Workflow Agents

#### bmad-planner
- **Purpose**: BMAD methodology implementation
- **Tools**: Write, mcp__ide__executeCode, TodoWrite
- **Usage**: Generate PRDs, architecture, sprint planning
- **Example**: Full project lifecycle management

#### revo-executor
- **Purpose**: Code generation and refactoring
- **Tools**: Bash, Edit, MultiEdit, Write, mcp__ide__executeCode
- **Usage**: Automate code creation and optimization
- **Example**: Generate React components with tests

### 4. Infrastructure Agents

#### db-manager
- **Purpose**: MongoDB state management
- **Tools**: Bash, Read, Write, mcp__ide__executeCode
- **Usage**: Cache results, track state, analytics
- **Example**: API response caching, rate limit tracking

#### indydev-integrator
- **Purpose**: Modular agent building
- **Tools**: Bash, Grep, Write, mcp__ide__executeCode
- **Usage**: Create single-file agents, build workflows
- **Example**: Rapid agent prototyping

## Quick Start

### 1. Initialize the Stack
```bash
# Setup MongoDB
/db-setup

# Verify agents are loaded
ls ~/.claude/agents/
```

### 2. Run Your First Chain Analysis
```bash
# Analyze your codebase
/chain-analysis . "performance optimization"
```

### 3. Generate a Component
```bash
# Quick component generation
/quick-agent revo-executor "Generate React component UserDashboard with TypeScript and tests"
```

## Common Workflows

### Large Codebase Analysis
```bash
# Full chain for comprehensive analysis
/chain-analysis /path/to/large-project "security audit"
```

### Web Scraping with Caching
```bash
# Scrape and cache results
/quick-agent playwright "Scrape product prices from example.com --cache"
```

### Project Planning with BMAD
```bash
# Start new project with BMAD
/bmad-plan "ai-chatbot" "Customer service AI chatbot with sentiment analysis"
```

### Batch Code Refactoring
```bash
# Refactor multiple files
/quick-agent revo-executor "Refactor all utils/*.js --extract-duplicates --simplify"
```

## Advanced Features

### Agent Chaining
Chain multiple agents for complex workflows:
```javascript
// Custom chain example
const chain = [
  { agent: 'consult7', task: 'scan codebase' },
  { agent: 'context7', task: 'fetch React docs' },
  { agent: 'serena', task: 'analyze patterns' },
  { agent: 'revo-executor', task: 'generate improvements' }
];
```

### Parallel Execution
Run agents in parallel for efficiency:
```bash
/quick-agent parallel "playwright,desktop-commander" "Monitor while scraping"
```

### Custom Agent Creation
Build your own agents:
```bash
/quick-agent indydev-integrator "Create agent for API testing"
```

## MongoDB Schema

### Key Collections
1. **agent_states**: Execution state tracking
2. **cache_entries**: Response caching
3. **agent_logs**: Comprehensive logging
4. **rate_limits**: API limit management

### Example Queries
```javascript
// Get cached results
db.cache_entries.find({ key: /playwright_/ }).sort({ created_at: -1 })

// View agent performance
db.agent_logs.aggregate([
  { $group: { _id: "$agent", avg_duration: { $avg: "$duration_ms" } } }
])
```

## Best Practices

### 1. Chain Usage
- Always use the full chain for large codebases
- Cache intermediate results
- Monitor chain performance

### 2. Resource Management
- Set appropriate timeouts
- Implement rate limiting
- Clean old cache entries

### 3. Error Handling
- All agents have retry logic
- Errors are logged to MongoDB
- Graceful degradation

### 4. Security
- Path validation in all file operations
- Command sanitization
- No destructive operations without confirmation

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB status
pgrep mongod || echo "MongoDB not running"

# Restart MongoDB
mongod --dbpath ~/.claude/mongodb/data --fork
```

### Agent Not Found
```bash
# Verify agent exists
ls ~/.claude/agents/

# Reload agents
/quick-agent reload-all
```

### Chain Execution Failures
```bash
# Check chain state
mongo claude_dev_stack --eval "db.agent_states.find().sort({timestamp:-1}).limit(5)"
```

## Performance Tips

1. **Use Caching**: All agents support MongoDB caching
2. **Batch Operations**: Group similar tasks
3. **Parallel Processing**: Use parallel execution when possible
4. **Index Optimization**: Ensure MongoDB indexes are created

## Future Enhancements

- [ ] Visual workflow builder
- [ ] Agent marketplace integration
- [ ] Real-time collaboration features
- [ ] Advanced ML-based optimizations
- [ ] Cloud deployment options

## Contributing

To add new agents:
1. Follow the agent template format
2. Include comprehensive documentation
3. Add integration tests
4. Update this guide

## Support

For issues or questions:
1. Check agent logs in MongoDB
2. Review error messages
3. Consult individual agent documentation
4. Use `/quick-agent help [agent-name]`