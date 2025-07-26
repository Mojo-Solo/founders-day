# Quick Agent Command

Quickly invoke any agent from the Ultimate Claude Dev Stack.

## Usage
```
/quick-agent [agent-name] [prompt]
```

## Available Agents
- `serena`: Semantic code analysis
- `consult7`: Large codebase consultation
- `context7`: Documentation fetching
- `playwright`: Browser automation
- `desktop-commander`: System commands
- `bmad-planner`: BMAD workflows
- `revo-executor`: Code generation/refactoring
- `db-manager`: MongoDB operations
- `indydev-integrator`: Modular agent building

## Examples
```
# Semantic analysis
/quick-agent serena "Analyze types in src/components"

# Browser automation
/quick-agent playwright "Scrape product data from example.com"

# Code generation
/quick-agent revo-executor "Generate React component UserProfile with TypeScript"

# System command
/quick-agent desktop-commander "Find all .log files older than 7 days"
```

## Advanced Usage
```
# Chain multiple agents
/quick-agent chain "consult7,context7,serena" "Analyze authentication system"

# Use with caching
/quick-agent serena --cache "Find all API endpoints"

# Parallel execution
/quick-agent parallel "playwright,desktop-commander" "Scrape while monitoring system"
```