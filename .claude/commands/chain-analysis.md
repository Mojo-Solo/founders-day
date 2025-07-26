# Chain Analysis Command

Triggers the full consult7 → context7 → serena agent chain for comprehensive code analysis.

## Usage
```
/chain-analysis [codebase-path] [analysis-focus]
```

## Process
1. **consult7-agent**: Analyzes codebase size and complexity
2. **context7-agent**: Fetches relevant documentation and context
3. **serena-agent**: Performs semantic code analysis and type checking

## Example
```
/chain-analysis /path/to/project "performance optimization"
```

## Implementation
```bash
# Invoke the agent chain
claude-code task --subagent consult7-agent --prompt "Analyze codebase at $ARGUMENTS for large-scale consultation"
claude-code task --subagent context7-agent --prompt "Enrich findings with documentation and context"
claude-code task --subagent serena-agent --prompt "Perform semantic analysis and provide insights"
```

The chain will:
- Scan your codebase structure
- Gather relevant documentation
- Perform semantic analysis
- Return actionable insights
- Cache results in MongoDB for reuse