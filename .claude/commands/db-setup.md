# Database Setup Command

Initialize MongoDB for the Ultimate Claude Dev Stack with proper collections and indexes.

## Usage
```
/db-setup [options]
```

## Options
- `--fresh`: Drop existing database and start fresh
- `--indexes`: Create performance indexes only
- `--sample`: Load sample data for testing

## Example
```
/db-setup
/db-setup --fresh
/db-setup --sample
```

## Implementation
```bash
# Initialize MongoDB
claude-code task --subagent db-manager --prompt "Initialize MongoDB with collections: agent_states, cache_entries, agent_logs, rate_limits, browser_sessions, system_operations, agent_registry"

# Create indexes for performance
claude-code task --subagent db-manager --prompt "Create indexes: cache_entries(key,expires_at), agent_logs(timestamp,agent), agent_states(session_id,chain_position)"
```

## Collections Created
1. **agent_states**: Track agent execution states
2. **cache_entries**: Cache API responses and computations
3. **agent_logs**: Log all agent interactions
4. **rate_limits**: Monitor API rate limits
5. **browser_sessions**: Store Playwright sessions
6. **system_operations**: Log system commands
7. **agent_registry**: Register custom agents

## Verification
After setup, verify with:
```bash
mongo claude_dev_stack --eval "db.stats()"
```