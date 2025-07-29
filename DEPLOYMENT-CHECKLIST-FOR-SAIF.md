# Deployment Checklist for Saif - Founders Day Project

## Overview
This checklist will help you deploy both the frontend and admin repositories to Vercel tomorrow morning.

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Ensure you have access to both GitHub repositories:
  - `Mojo-Solo/founders-day-frontend`
  - `Mojo-Solo/founders-day-admin`
- [ ] Have Vercel CLI installed: `npm i -g vercel`
- [ ] Have access to the Vercel account/team

### 2. Local Testing (Both Repos)
```bash
# Test Frontend (in founders-day-frontend directory)
cd founders-day-frontend
npm install
npm run build
npm run lint

# Test Admin (in founders-day-admin directory)
cd ../founders-day-admin
npm install  
npm run build
npm run lint
```

## Frontend Deployment Steps

### 1. Update Environment Variables
The frontend needs to know where the admin backend is hosted. Currently in `vercel.json`, it points to an old deployment URL.

**Action Required:**
- First deploy the admin backend (see below)
- Then update `NEXT_PUBLIC_ADMIN_API_URL` in the frontend's Vercel environment settings

### 2. Deploy Frontend to Vercel
```bash
cd founders-day-frontend
vercel --prod
```

### 3. Configure Frontend Environment Variables on Vercel Dashboard
```
NEXT_PUBLIC_ADMIN_API_URL=https://[your-admin-deployment].vercel.app
NEXT_PUBLIC_SQUARE_APPLICATION_ID=[from Square dashboard]
NEXT_PUBLIC_SQUARE_LOCATION_ID=[from Square dashboard]
NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[from Stripe dashboard]
NEXT_PUBLIC_GA_MEASUREMENT_ID=[optional - for analytics]
```

## Admin Deployment Steps

### 1. Deploy Admin to Vercel FIRST
```bash
cd founders-day-admin
vercel --prod
```

### 2. Configure Admin Environment Variables on Vercel Dashboard
```
# Database
DATABASE_URL=[Neon PostgreSQL connection string]

# Authentication
NEXTAUTH_URL=https://[your-admin-deployment].vercel.app
NEXTAUTH_SECRET=[generate with: openssl rand -base64 32]

# Square Payments
SQUARE_APPLICATION_ID=[from Square dashboard]
SQUARE_ACCESS_TOKEN=[from Square dashboard - KEEP SECRET]
SQUARE_LOCATION_ID=[from Square dashboard]
SQUARE_ENVIRONMENT=sandbox

# Email (if using)
SENDGRID_API_KEY=[if using SendGrid]
EMAIL_FROM=[sender email address]
```

### 3. Important Admin Notes
- The admin runs on port 3001 locally but Vercel handles ports automatically
- Make sure the `package.json` name is updated from "my-v0-project" to something meaningful

## Post-Deployment Verification

### 1. Test Admin Backend
- [ ] Visit: `https://[admin-deployment].vercel.app/api/health`
- [ ] Should return a health check response
- [ ] Check login page loads: `https://[admin-deployment].vercel.app/login`

### 2. Test Frontend
- [ ] Visit: `https://[frontend-deployment].vercel.app`
- [ ] Check that the homepage loads
- [ ] Test registration flow (it should call the admin API)
- [ ] Check browser console for any API errors

### 3. Update Frontend to Point to Admin
After admin is deployed:
1. Go to Vercel Dashboard → Frontend Project → Settings → Environment Variables
2. Update `NEXT_PUBLIC_ADMIN_API_URL` to the admin's production URL
3. Redeploy frontend: `vercel --prod` (in frontend directory)

## Common Issues & Solutions

### Issue: Build Failures
- **Square SDK errors**: Already fixed in the codebase, should build successfully
- **Type errors**: Run `npm run lint` locally first to catch issues

### Issue: API Connection Errors
- **Frontend can't reach admin**: Verify `NEXT_PUBLIC_ADMIN_API_URL` is set correctly
- **CORS errors**: The admin should have CORS configured for the frontend domain

### Issue: Database Connection
- **Admin can't connect to database**: Verify `DATABASE_URL` in Vercel env vars
- **SSL errors**: Neon requires SSL, the connection string should include `?sslmode=require`

## Deployment Order (IMPORTANT!)
1. **Deploy Admin FIRST** - You need its URL for the frontend
2. **Deploy Frontend SECOND** - Configure it to point to the admin URL
3. **Update Frontend Config** - After both are deployed, update the frontend's admin URL if needed

## Quick Commands Reference
```bash
# Deploy to Vercel (production)
vercel --prod

# Deploy to Vercel (preview)
vercel

# Link existing project
vercel link

# View deployment logs
vercel logs [deployment-url]

# List environment variables
vercel env ls
```

## Contact for Issues
- Check the build logs in Vercel dashboard
- Review the CLAUDE.md files in each repository for architecture details
- Frontend runs standalone and gracefully handles backend unavailability
- Admin requires database connection to function

Good luck with the deployment! 🚀