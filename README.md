# Founders Day Monorepo

This is the consolidated monorepo for the Founders Day platform, containing both the frontend and admin applications.

## Structure

```
founders-day/
├── apps/
│   ├── frontend/      # Main frontend application
│   └── admin/         # Admin dashboard
├── packages/
│   └── shared-types/  # Shared TypeScript types
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run development servers:
   ```bash
   # Run both apps
   pnpm dev

   # Run specific app
   pnpm dev:frontend
   pnpm dev:admin
   ```

3. Build for production:
   ```bash
   # Build all apps
   pnpm build

   # Build specific app
   pnpm build:frontend
   pnpm build:admin
   ```

## Deployment

Both applications are deployed via Vercel:
- Frontend: Set root directory to `apps/frontend`
- Admin: Set root directory to `apps/admin`

## Development

- Frontend: http://localhost:3000
- Admin: http://localhost:3001 (or configured port)
