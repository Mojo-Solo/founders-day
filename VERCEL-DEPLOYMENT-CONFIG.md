# Vercel Deployment Configuration for Monorepo

## Overview

This monorepo contains two Next.js applications that need to be deployed separately on Vercel:
- **Frontend**: The main user-facing website at `apps/frontend`
- **Admin**: The admin dashboard at `apps/admin`

## Setup Instructions

### 1. Create Two Separate Vercel Projects

You need to create two separate projects in Vercel:
1. `founders-day-frontend` - For the main website
2. `founders-day-admin` - For the admin dashboard

### 2. Configure Each Project

#### Frontend Project Settings:
- **Root Directory**: `apps/frontend`
- **Build Command**: Automatically detected from `vercel.json`
- **Install Command**: Automatically detected from `vercel.json`
- **Output Directory**: `.next`

#### Admin Project Settings:
- **Root Directory**: `apps/admin`
- **Build Command**: Automatically detected from `vercel.json`
- **Install Command**: Automatically detected from `vercel.json`
- **Output Directory**: `.next`

### 3. Environment Variables

Set these environment variables in each Vercel project:

#### Frontend Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_ADMIN_API_URL=
NEXT_PUBLIC_SQUARE_APPLICATION_ID=
NEXT_PUBLIC_SQUARE_LOCATION_ID=
NEXT_PUBLIC_SQUARE_ENVIRONMENT=
SQUARE_ACCESS_TOKEN=
SQUARE_WEBHOOK_SIGNATURE_KEY=
```

#### Admin Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
DATABASE_URL=
SQUARE_APPLICATION_ID=
SQUARE_ACCESS_TOKEN=
```

### 4. Deployment Process

1. **Initial Setup**:
   ```bash
   # Link frontend project
   cd apps/frontend
   vercel link
   # Select the founders-day-frontend project
   
   # Link admin project
   cd ../admin
   vercel link
   # Select the founders-day-admin project
   ```

2. **Deploy Frontend**:
   ```bash
   cd apps/frontend
   vercel --prod
   ```

3. **Deploy Admin**:
   ```bash
   cd apps/admin
   vercel --prod
   ```

### 5. Automatic Deployments

Both projects will automatically deploy when you push to the main branch. The monorepo structure is handled by the `vercel.json` files in each app directory.

### 6. Important Notes

- Each app has its own `vercel.json` that configures the build to run from the monorepo root
- The `installCommand` navigates to the root and runs `pnpm install` to install all dependencies
- The `buildCommand` uses pnpm workspace filters to build only the specific app
- Make sure to set the correct root directory in Vercel project settings

### 7. Troubleshooting

If builds fail:
1. Check that the root directory is set correctly in Vercel project settings
2. Ensure all environment variables are set
3. Verify that the `package.json` names match the filter names in `vercel.json`
4. Check the build logs for specific errors

### 8. Domain Configuration

- Frontend: Configure your main domain (e.g., `foundersday.mn`)
- Admin: Configure a subdomain (e.g., `admin.foundersday.mn`)