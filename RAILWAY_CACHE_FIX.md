# Railway Cache Issue & Solution

## Problem

Railway uses aggressive caching during builds. When you push new commits to GitHub, Railway may **not pull the latest changes** and instead use cached snapshots, dependencies, and build artifacts.

### Symptoms
- Build logs show `cached` for most steps
- Same snapshot hash appears across multiple deployments
- Code changes don't appear in the build even after pushing to GitHub
- Old errors persist despite fixes being committed

## Why It Happens

Railway caches:
1. **Snapshots** - The entire codebase at a specific commit
2. **Dependencies** - `pnpm install`, `npm install` results
3. **Build artifacts** - Compiled files, generated code

When Railway determines "nothing important changed," it reuses cached layers instead of pulling fresh code from GitHub.

## Solution: Force Cache Invalidation

### Method 1: Version Bump (Recommended for Code Changes)

Bump the version in the affected service's `package.json`:

```json
{
  "name": "@healthcare/api",
  "version": "0.1.4",  // Increment this
  ...
}
```

Then commit and push:
```bash
git add apps/api/package.json
git commit -m "Bump version to force Railway rebuild"
git push origin main
```

**Why it works:** Railway detects the `package.json` change as significant and invalidates the cache.

### Method 2: Manual Redeploy

1. Go to Railway Dashboard
2. Select your service
3. Click **Deployments** tab
4. Click **Deploy** or **Redeploy** button

**Note:** This doesn't always force a fresh snapshot pull.

### Method 3: Clear Build Cache (Not Always Available)

Some Railway plans have a "Clear Build Cache" option in Settings → Service → Danger Zone. This option may not be visible on all plans.

## Best Practices

### 1. Always Bump Version for Critical Fixes
When pushing important fixes (especially for monorepos), increment the service version:

```bash
# After making your code changes
# Edit package.json version: 0.1.0 -> 0.1.1
git add .
git commit -m "Fix issue X and bump version"
git push origin main
```

### 2. Check Snapshot Hash
In build logs, look for:
```
fetched snapshot sha256:abc123...
```

If the hash is the same across deployments, Railway is using cached code.

### 3. Watch for "cached" in Logs
```
pnpm install --frozen-lockfile --prefer-offline cached
copy / /app cached
```

Too many `cached` entries = stale build.

### 4. Enable Auto-Deploy Properly
Ensure in **Service Settings → Source**:
- ✅ Branch is set correctly (e.g., `main`)
- ✅ Auto-deploy is enabled
- ⚠️ "Wait for CI" is disabled (unless you have GitHub Actions)

## When to Use Each Method

| Scenario | Method |
|----------|--------|
| Code fix not appearing | Version bump + push |
| Testing if deployment works | Manual redeploy |
| Dependency update | Version bump (forces reinstall) |
| Environment variable change only | Manual redeploy (no code change needed) |
| Emergency fix | Version bump (most reliable) |

## Example Workflow

```bash
# 1. Make your code changes
vim apps/api/src/some-file.ts

# 2. Bump version
vim apps/api/package.json  # Change "version": "0.1.1" -> "0.1.2"

# 3. Commit both changes
git add apps/api/
git commit -m "Fix bug X and bump API version"
git push origin main

# 4. Railway will now pull fresh code
```

## Troubleshooting

### "Still using old code after version bump"
- Wait 1-2 minutes for GitHub webhook to trigger
- Check Railway dashboard for new deployment
- Manually trigger deployment if webhook failed

### "Build fails but I fixed the code"
- Verify commit is on GitHub: `git log origin/main`
- Check Railway is connected to correct branch
- Look for snapshot hash change in logs

### "Changes work locally but not on Railway"
- Ensure you pushed to GitHub: `git push origin main`
- Check Railway branch settings match your push
- Verify no build-specific issues (environment vars, etc.)

## Railway-Specific Notes

- **Monorepos**: Version bumps are especially important. Railway may not detect changes in subdirectories.
- **pnpm workspaces**: Railway caches at workspace root. Change in one package may not trigger rebuild of another.
- **Turbo cache**: If using Turborepo, Railway's cache + Turbo's cache can compound issues.

---

**TL;DR:** When Railway won't pull your latest code, bump the service version in `package.json` and push. This forces cache invalidation and ensures a fresh build.
