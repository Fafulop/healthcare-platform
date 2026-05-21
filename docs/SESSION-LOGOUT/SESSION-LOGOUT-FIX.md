# Frequent Random Logouts — Diagnosis & Fix

## Date
2026-05-21

## Problem
Users were getting randomly logged out of both the **doctor app** and **admin app** (Railway-deployed, Google OAuth). Logouts were not tied to deployments — they happened randomly during normal usage and affected both apps simultaneously. Users were redirected to `/login`.

## Root Cause

### Background: JWT → Database Sessions Migration (2026-04-02)
Commit `a3f9f5a6` migrated NextAuth from **JWT sessions** to **database sessions**. This means every session validation now requires a PostgreSQL query instead of being self-contained in the cookie.

### The Actual Problem: Aggressive Session Polling
The `SessionProvider` in both apps had **no `refetchInterval` or `refetchOnWindowFocus` configuration**, which meant:

1. NextAuth's default behavior polls `/api/auth/session` on **every window focus event** (tab switch, screen wake, alt-tab, etc.)
2. Each poll hits PostgreSQL to validate the database session
3. On Railway, if the DB connection is briefly slow or the container is cold, the session lookup returns empty
4. The dashboard layout uses `useSession({ required: true, onUnauthenticated() { redirect("/login") } })` which **immediately** redirects to `/login` on any failed session check — no retry, no grace period

With JWT sessions (before the migration), this wasn't a problem because session validation was local (cookie-based, no DB round-trip). After the migration, every focus event became a potential logout trigger.

### Why Both Apps Were Affected
Both doctor and admin apps share the same PostgreSQL database and the same `SessionProvider` configuration. A transient DB issue affects both simultaneously.

## Fix

### Changed Files
- `apps/doctor/src/app/providers/SessionProvider.tsx`
- `apps/admin/src/app/providers/SessionProvider.tsx`

### Change
Added two props to `NextAuthSessionProvider` in both apps:

```tsx
<NextAuthSessionProvider
  refetchInterval={5 * 60}    // Poll every 5 minutes instead of on every focus
  refetchOnWindowFocus={false} // Stop DB hit on every tab switch
>
  {children}
</NextAuthSessionProvider>
```

### Why This Works
- **`refetchInterval={300}`** — Session is revalidated every 5 minutes on a predictable schedule, not on unpredictable browser events
- **`refetchOnWindowFocus={false}`** — Eliminates the main source of rapid-fire DB queries that were causing transient failures

### Safety Nets Still in Place
- **`authFetch.ts`** catches 401 responses from the API and redirects to `/login` immediately — so if a session is truly invalid, the user is logged out on their next API call (not waiting up to 5 min)
- **Middleware** still checks cookie presence on every request (Edge runtime, no DB hit)
- **Session maxAge** remains 30 days in the database

## Tradeoffs
| Scenario | Before (on focus) | After (5-min poll) |
|----------|-------------------|-------------------|
| Session killed via kill-sessions | Detected on next tab focus | Detected on next API call (authFetch 401 handler) or within 5 min |
| Role/permission change | Detected on next tab focus | Detected within 5 min (backend validates anyway) |
| DB queries per active user | Hundreds/day (every tab switch) | ~288/day (every 5 min) |
| Random logout risk | High on Railway | Minimal |

## If Logouts Persist
If the fix doesn't fully resolve the issue, next steps to investigate:
1. **Prisma connection pooling** — Add `?connection_limit=5&pool_timeout=10` to `DATABASE_URL`
2. **`AUTH_SECRET` stability** — Verify it's a fixed env var in Railway (not auto-generated per deploy)
3. **Switch back to JWT strategy** — Keep database adapter for user/account storage but use JWT for sessions (no DB dependency per request)
