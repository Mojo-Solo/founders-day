# Deployment Checklist for Saif - Founders Day Project

## Overview
This checklist will help you deploy both the frontend and admin repositories to Vercel tomorrow morning. Since all environment variables are stored in GitHub secrets and Vercel is connected to GitHub, the deployment process is streamlined.

## Pre-Deployment Checklist

### 1. Verify Access
- [ ] Ensure you have access to both GitHub repositories:
  - `Mojo-Solo/founders-day-frontend`
  - `Mojo-Solo/founders-day-admin`
- [ ] Verify you can see the GitHub Secrets in both repositories (Settings → Secrets and variables → Actions)
- [ ] Confirm access to the Vercel team/organization dashboard

### 2. Local Testing (Optional but Recommended)
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

## Deployment via Vercel Dashboard (Recommended)

### 1. Deploy Admin Backend FIRST
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import `Mojo-Solo/founders-day-admin` from GitHub
4. **Important**: Vercel will automatically detect and use GitHub secrets as environment variables
5. Click "Deploy"
6. Note the deployment URL (e.g., `https://founders-day-admin.vercel.app`)

### 2. Deploy Frontend SECOND
1. In Vercel Dashboard, click "Add New..." → "Project"
2. Import `Mojo-Solo/founders-day-frontend` from GitHub
3. **Before deploying**, add this environment variable:
   - `NEXT_PUBLIC_ADMIN_API_URL` = `[URL from admin deployment above]`
4. Click "Deploy"

## Alternative: Deploy via GitHub (If Configured)

If the repositories have GitHub Actions configured for Vercel deployment:
1. Go to the repository on GitHub
2. Go to Actions tab
3. Run the deployment workflow manually
4. Monitor the deployment progress

## Environment Variables (Already in GitHub Secrets)

### Frontend Secrets (Should Auto-Import)
```
NEXT_PUBLIC_SQUARE_APPLICATION_ID
NEXT_PUBLIC_SQUARE_LOCATION_ID
NEXT_PUBLIC_SQUARE_ENVIRONMENT
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_GA_MEASUREMENT_ID
```
**Note**: You'll need to manually add `NEXT_PUBLIC_ADMIN_API_URL` after admin is deployed

### Admin Secrets (Should Auto-Import)
```
DATABASE_URL (Neon PostgreSQL)
NEXTAUTH_URL
NEXTAUTH_SECRET
SQUARE_APPLICATION_ID
SQUARE_ACCESS_TOKEN
SQUARE_LOCATION_ID
SQUARE_ENVIRONMENT
SENDGRID_API_KEY
EMAIL_FROM
```

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

## Deployment Order (CRITICAL!)
1. **Deploy Admin FIRST** - You need its URL for the frontend
2. **Deploy Frontend SECOND** - Add `NEXT_PUBLIC_ADMIN_API_URL` pointing to admin
3. **Verify Both** - Test the integration between frontend and admin

## Quick Tips
- Vercel automatically imports GitHub secrets as environment variables
- The only manual step is setting `NEXT_PUBLIC_ADMIN_API_URL` for the frontend
- Both repos have been tested and build successfully (Square SDK issues fixed)
- If you see build errors, check the Vercel build logs for details

## Notes
- Frontend runs on port 3000 locally, admin on 3001
- Vercel handles ports automatically in production
- Frontend gracefully handles backend unavailability
- Admin requires database connection to function

Good luck with the deployment! 🚀