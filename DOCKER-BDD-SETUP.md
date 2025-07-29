# Docker BDD Test Environment Setup

## Quick Start

```bash
# Build and run all tests
docker-compose -f docker-compose.test.yml up --build

# Run tests without rebuilding
docker-compose -f docker-compose.test.yml up

# Clean up
docker-compose -f docker-compose.test.yml down -v
```

## What This Solves

1. **Consistency**: Everyone runs tests in the same environment
2. **Isolation**: Test data doesn't affect development database
3. **Reproducibility**: "Works on my machine" is no longer an excuse
4. **Speed**: Parallel container startup, automated health checks

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │     Admin       │     │   Test DB       │
│   (Port 3000)   │────▶│   (Port 3001)   │────▶│  (Port 5433)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         ▲                       ▲                        ▲
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                             │
                    ┌─────────────────┐
                    │  Test Runner    │
                    │ (BDD/Cucumber)  │
                    └─────────────────┘
```

## Prerequisites

1. **Create Dockerfiles for apps** (if not exists):

```dockerfile
# founders-day-frontend/Dockerfile.test
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```dockerfile
# founders-day-admin/Dockerfile.test
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

2. **Create test data files**:

```sql
-- test-data/init.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    display_name VARCHAR(255),
    role VARCHAR(50),
    year_graduated INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- test-data/seed.sql
-- Password is 'TestPass123!' (bcrypt hash)
INSERT INTO users (email, password_hash) VALUES
('test@example.com', '$2b$10$YourHashHere'),
('admin@example.com', '$2b$10$YourHashHere');

INSERT INTO profiles (user_id, display_name, role, year_graduated) VALUES
((SELECT id FROM users WHERE email = 'test@example.com'), 'Test User', 'Alumni', 2020),
((SELECT id FROM users WHERE email = 'admin@example.com'), 'Admin User', 'Admin', 2015);
```

3. **Update package.json**:

```json
{
  "scripts": {
    "test:bdd": "cucumber-js",
    "test:bdd:docker": "cucumber-js --format json:reports/cucumber-report.json --format html:reports/cucumber-report.html",
    "docker:test": "docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit",
    "docker:test:clean": "docker-compose -f docker-compose.test.yml down -v"
  }
}
```

## Running Tests

### Full Test Suite
```bash
npm run docker:test
```

### Specific Feature
```bash
docker-compose -f docker-compose.test.yml run test-runner npm run test:bdd -- features/login.feature
```

### Debug Mode
```bash
# Run with browser visible
docker-compose -f docker-compose.test.yml run -e HEADLESS=false test-runner npm run test:bdd
```

### View Reports
Reports are generated in the `./reports` directory:
- `cucumber-report.html` - Human-readable HTML report
- `cucumber-report.json` - Machine-readable JSON report
- Screenshots on failure in `./screenshots`

## Troubleshooting

### Services Not Starting
```bash
# Check logs
docker-compose -f docker-compose.test.yml logs frontend
docker-compose -f docker-compose.test.yml logs admin
docker-compose -f docker-compose.test.yml logs test-db
```

### Database Connection Issues
```bash
# Test database connection
docker-compose -f docker-compose.test.yml exec test-db psql -U test -d founders_test
```

### Clean Slate
```bash
# Remove everything and start fresh
docker-compose -f docker-compose.test.yml down -v
docker system prune -a
```

## Next Steps

1. Add health check endpoints to frontend/admin if missing
2. Create proper test data seeds
3. Add CI/CD integration (GitHub Actions example):

```yaml
# .github/workflows/bdd-tests.yml
name: BDD Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run BDD Tests
        run: |
          docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: reports/
```