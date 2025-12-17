# Railway Deployment Issue - Port Configuration Not Updating

## Problem Summary

Railway is deploying **cached Docker images** with old port configurations despite fresh code being pushed to GitHub and new builds being triggered.

### Symptoms
- GitHub has correct code (verified via web)
- Railway pulls fresh snapshots (new snapshot hashes in build logs)
- Railway builds successfully
- **BUT** Deploy logs show old version and old start script

### Expected vs Actual

**Expected (what's on GitHub):**
```json
// apps/admin/package.json
{
  "version": "0.1.3",
  "scripts": {
    "start": "next start"  // No hardcoded port
  }
}

// apps/doctor/package.json
{
  "version": "0.1.3",
  "scripts": {
    "start": "next start"  // No hardcoded port
  }
}
```

**Actual (what Railway deploys):**
```
> @healthcare/admin@0.1.0 start /app/apps/admin
> next start -p 3002
```

```
> @healthcare/doctor@0.1.0 start /app/apps/doctor
> next start -p 3001
```

---

## What We've Tried

### ✅ Version Bumps (Standard Cache Fix)
- Bumped from 0.1.0 → 0.1.1 → 0.1.2 → 0.1.3
- **Result:** Railway pulls new snapshots but deploys old image

### ✅ Manual Redeploy
- Clicked "Redeploy" in Railway dashboard
- **Result:** Restarts old container, doesn't rebuild

### ✅ Disabled Turborepo Cache
- Added `"cache": false` to build task in turbo.json
- **Result:** Railway still uses cached Docker layers

### ✅ Verified GitHub
- Checked GitHub web interface - code is correct (v0.1.3, no port flags)
- Local git shows commits pushed successfully

---

## Root Cause

**Railway is caching Docker image layers** even when:
1. New snapshot is pulled from GitHub
2. Version numbers change in package.json
3. Turborepo cache is disabled

Railway's Railpack build system caches:
- Layer 1: Base image (node, pnpm)
- Layer 2: Dependencies (`node_modules`)
- Layer 3: **Build output** (`.next/`)
- Layer 4: **Docker image** with baked-in start command

The issue is **Layer 4 caching** - Railway reuses the old Docker image with the old `start` command from package.json despite rebuilding source.

---

## Current State

### Services Status

| Service | GitHub Version | GitHub Start Script | Railway Deploys | Status |
|---------|----------------|---------------------|-----------------|--------|
| API | 0.1.5 | `next start` | ✅ v0.1.5, correct port | **WORKING** |
| Public | 0.1.1 | `next start` | ✅ v0.1.1, correct port | **WORKING** |
| Admin | 0.1.3 | `next start` | ❌ v0.1.0, port 3002 | **BROKEN** |
| Doctor | 0.1.3 | `next start` | ❌ v0.1.0, port 3001 | **BROKEN** |
| Database | - | - | ✅ Schema pushed | **WORKING** |

### Environment Variables (Already Configured)

**API Service:**
```bash
DATABASE_URL=<railway-provided-database-url>
NEXTAUTH_URL=https://healthcareapi-production-fb70.up.railway.app
NEXTAUTH_SECRET=<your-nextauth-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
NEXT_PUBLIC_API_URL=https://healthcareapi-production-fb70.up.railway.app
ALLOWED_ORIGINS=https://healthcarepublic-production.up.railway.app,https://healthcareadmin-production-bdb6.up.railway.app,https://healthcaredoctor-production.up.railway.app
NIXPACKS_TURBO_APP_NAME=@healthcare/api
```

**Doctor Dashboard:**
```bash
NEXT_PUBLIC_API_URL=https://healthcareapi-production-fb70.up.railway.app
NEXTAUTH_URL=https://healthcaredoctor-production.up.railway.app
NEXTAUTH_SECRET=<your-nextauth-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
NIXPACKS_TURBO_APP_NAME=@healthcare/doctor
```

**Admin Panel:**
```bash
NEXT_PUBLIC_API_URL=https://healthcareapi-production-fb70.up.railway.app
NEXTAUTH_URL=https://healthcareadmin-production-bdb6.up.railway.app
NEXTAUTH_SECRET=<your-nextauth-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
UPLOADTHING_TOKEN=<needs to be added>
NEXT_PUBLIC_UPLOADTHING_APP_ID=<needs to be added>
NIXPACKS_TURBO_APP_NAME=@healthcare/admin
```

**Public App:**
```bash
NEXT_PUBLIC_API_URL=https://healthcareapi-production-fb70.up.railway.app
NIXPACKS_TURBO_APP_NAME=@healthcare/public
```

---

## Next Steps to Try

### Option 1: Set Root Directory (RECOMMENDED)
Forces Railway to invalidate all caches by changing service configuration.

**For Admin Service:**
1. Railway Dashboard → Admin service → Settings
2. Find **"Root Directory"** field
3. Set to: `apps/admin`
4. Save and redeploy

**For Doctor Service:**
1. Railway Dashboard → Doctor service → Settings
2. Set **"Root Directory"** to: `apps/doctor`
3. Save and redeploy

### Option 2: Add Dummy Environment Variable
Changing environment variables forces Railway to rebuild Docker image.

**For Admin:**
```
FORCE_REBUILD=2025-12-16
```

**For Doctor:**
```
FORCE_REBUILD=2025-12-16
```

Then redeploy both services.

### Option 3: Temporary Build Command Override
Forces different build command = invalidates cache.

**Admin service → Settings → Build Command:**
```
pnpm --filter @healthcare/admin build --force
```

**Doctor service → Settings → Build Command:**
```
pnpm --filter @healthcare/doctor build --force
```

Then redeploy and **remove the override** after successful deploy.

### Option 4: Delete and Recreate Services (NUCLEAR)
If nothing else works:

1. Create NEW Railway services for admin and doctor
2. Point to same GitHub repo
3. Configure environment variables
4. Deploy fresh
5. Delete old services

---

## Important Files Modified

### Fixed Files (on GitHub):
- ✅ `apps/api/package.json` - version 0.1.5, correct start script
- ✅ `apps/admin/package.json` - version 0.1.3, correct start script
- ✅ `apps/doctor/package.json` - version 0.1.3, correct start script
- ✅ `apps/public/package.json` - version 0.1.1, correct start script
- ✅ `turbo.json` - build cache disabled
- ✅ `packages/database/.env` - renamed to `.env.local` (then restored)

### Git Commits:
```
289e7ae - Disable Turbo cache and bump versions to 0.1.3
3ece64c - Force Railway rebuild - bump admin and doctor to 0.1.2
6a58ffd - Fix port configuration for admin and doctor services
c92aac5 - Fix API service port configuration for Railway deployment
```

---

## Railway Service URLs

- **API**: https://healthcareapi-production-fb70.up.railway.app
- **Public**: https://healthcarepublic-production.up.railway.app
- **Admin**: https://healthcareadmin-production-bdb6.up.railway.app
- **Doctor**: https://healthcaredoctor-production.up.railway.app
- **Database**: `<railway-database-public-url>`

---

## Google OAuth Configuration

### Authorized JavaScript origins:
```
https://healthcareapi-production-fb70.up.railway.app
https://healthcaredoctor-production.up.railway.app
https://healthcareadmin-production-bdb6.up.railway.app
https://healthcarepublic-production.up.railway.app
```

### Authorized redirect URIs:
```
https://healthcareapi-production-fb70.up.railway.app/api/auth/callback/google
https://healthcaredoctor-production.up.railway.app/api/auth/callback/google
https://healthcareadmin-production-bdb6.up.railway.app/api/auth/callback/google
```

---

## References

- See `RAILWAY_CACHE_FIX.md` for general Railway caching issues
- GitHub repo: https://github.com/Fafulop/healthcare-platform
- Railway project: daring-possibility (Gerardo López's Projects)

---

**Last Updated:** Dec 16, 2025, 8:30 PM
**Status:** Admin and Doctor services need cache invalidation fix
