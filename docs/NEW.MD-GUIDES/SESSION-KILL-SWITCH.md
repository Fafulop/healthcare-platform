# Session Kill Switch

**Last Updated:** 2026-04-01

---

## What It Does

A "Cerrar todas las sesiones" button in **Mi Perfil → Integraciones** that invalidates all active sessions for that user across every device and browser tab.

### User Flow

1. Doctor clicks **"Cerrar todas las sesiones"**
2. App calls `PATCH /api/auth/kill-sessions` — DB increments `sessionVersion` from N → N+1
3. App calls `signOut()` — current browser session cleared, doctor redirected to `/login`
4. Doctor logs back in on the devices they want → new JWT issued with the new version
5. Any other device holding an old JWT makes an API call → rejected → redirected to `/login`

```
Doctor logs in  →  JWT issued with sessionVersion: 3
Doctor clicks "kill all"  →  DB sets sessionVersion: 4
Old tab makes API call  →  token has 3, DB has 4  →  rejected  →  redirect to login
Doctor logs in fresh  →  JWT issued with sessionVersion: 4  →  works
```

### What Does NOT Happen

- Other devices are not kicked out instantly — only when they next make an API call
- The middleware still lets page shells load (it reads the JWT without hitting the DB) — but no data loads, so the broken session is obvious on the first action

### Key Insight: Zero Extra DB Cost

`validateAuthToken` in `apps/api/src/lib/auth.ts` **already queries the database on every request** to verify the user exists. The `sessionVersion` check piggybacks on that same existing query — no additional round trip.

### Middleware Limitation

The doctor app middleware reads from the JWT directly and does not hit the DB. After killing sessions, old browser tabs still load page shells. The moment any page makes an API call, `validateAuthToken` catches the version mismatch and returns 401. In practice the doctor sees a broken page and gets bounced to `/login` on the first data fetch.

---

## Architecture

### AuthError Class

`auth.ts` exports an `AuthError` class that carries an HTTP status code. All authentication and authorization failures in `validateAuthToken` and the role-check helpers throw `AuthError` instead of a generic `Error`. API routes catch it explicitly to return the correct status (401/403) rather than a misleading 500.

```typescript
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}
```

### skipVersionCheck Option

`validateAuthToken` accepts an optional `{ skipVersionCheck: boolean }` parameter. The `kill-sessions` endpoint passes `skipVersionCheck: true` so that a doctor with a stale token can still call the endpoint — that's precisely the situation it needs to fix. JWT signature and user existence are still validated; only the version comparison is skipped.

### sessionVersion Flow (End-to-End)

```
DB (users.session_version)
  ↓ /api/auth/user (select includes sessionVersion)
  ↓ jwt() callback in nextauth-config.ts (token.sessionVersion = dbUser.sessionVersion)
  ↓ session() callback in nextauth-config.ts (session.user.sessionVersion = token.sessionVersion ?? 0)
  ↓ get-token route — doctor app OR admin app (sessionVersion included in signed API JWT)
  ↓ validateAuthToken in auth.ts ((payload.sessionVersion ?? 0) !== user.sessionVersion → reject)
```

---

## Files Changed

### Database

**`packages/database/prisma/schema.prisma`**
```prisma
model User {
  sessionVersion    Int       @default(0) @map("session_version")
  // ...
}
```

**`packages/database/prisma/migrations/add-session-version.sql`**
```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
```

---

### API (`apps/api`)

**`src/lib/auth.ts`** — 4 changes:
- Added `AuthError` class (exported)
- Added `sessionVersion?: number` to `JWTPayload` interface
- Added `skipVersionCheck` option to `validateAuthToken`
- Version check: `(payload.sessionVersion ?? 0) !== user.sessionVersion` — treats missing version as 0 so pre-feature tokens are correctly rejected after kill is used
- All auth failures now throw `AuthError` with the correct status code

**`src/app/api/auth/user/route.ts`**
- Added `sessionVersion: true` to both `findUnique` and `create` selects so it is returned to the JWT callback

**`src/app/api/auth/kill-sessions/route.ts`** *(new file)*
- `PATCH` endpoint
- Uses `validateAuthToken(request, { skipVersionCheck: true })` — avoids deadlock
- Updates only `authUser.userId` — no privilege escalation possible
- Auth failures (401/403) and DB failures (500) in separate try/catch blocks

**`src/app/api/doctors/[slug]/google-calendar/status/route.ts`**
- Imports `AuthError`, catch block now returns `error.status` instead of always 500

**`src/app/api/doctors/[slug]/telegram/route.ts`**
- Same fix applied to GET, PUT, and DELETE handlers

---

### Auth Package (`packages/auth`)

**`src/nextauth-config.ts`** — 2 changes:
- `jwt()` callback: `token.sessionVersion = dbUser.sessionVersion`
- `session()` callback: `session.user.sessionVersion = token.sessionVersion as number ?? 0`

---

### Doctor App (`apps/doctor`)

**`src/app/api/auth/get-token/route.ts`**
- Includes `sessionVersion: (session.user as any).sessionVersion ?? 0` in the signed API JWT

**`src/types/next-auth.d.ts`**
- `sessionVersion: number` added to `Session.user` interface
- `sessionVersion?: number` added to `JWT` interface

**`src/app/dashboard/mi-perfil/page.tsx`**
- Added "Sesiones activas" card in the Integraciones tab
- `handleKillSessions` calls PATCH then `signOut({ callbackUrl: '/login' })`
- Loading state, error state, and disabled button while in flight

---

### Admin App (`apps/admin`)

**`src/app/api/auth/get-token/route.ts`**
- Includes `sessionVersion: (session.user as any).sessionVersion ?? 0` in the signed API JWT

**`src/types/next-auth.d.ts`**
- `sessionVersion: number` added to `Session.user` interface
- `sessionVersion?: number` added to `JWT` interface

---

## Bugs Found During Implementation

### 1. Deadlock on first use
**Problem:** The `kill-sessions` endpoint called `validateAuthToken` which checked `sessionVersion`. If the doctor's current token had a stale version (e.g. issued before the feature was deployed), the endpoint rejected the request before it could increment the version.

**Fix:** Added `skipVersionCheck: true` option to `validateAuthToken`, used only by `kill-sessions`.

### 2. sessionVersion never reached the API token
**Problem:** `sessionVersion` was stored in the NextAuth JWT (by the `jwt()` callback) but was never copied into `session.user`. The `get-token` routes read from `session.user`, so the signed API JWT never carried `sessionVersion`. `validateAuthToken` always received `payload.sessionVersion = undefined` → treated as 0 → every session was invalidated after the first kill.

**Fix:** Added `session.user.sessionVersion = token.sessionVersion ?? 0` to the `session()` callback in `nextauth-config.ts`.

### 3. Old tokens pass through after kill (wrong backward-compat guard)
**Problem:** The initial version check was `payload.sessionVersion !== undefined && payload.sessionVersion !== user.sessionVersion`. Old tokens (no `sessionVersion` field) had `payload.sessionVersion = undefined`, so the guard short-circuited and the check was skipped entirely. Old sessions on other devices were never rejected.

**Fix:** Changed to `(payload.sessionVersion ?? 0) !== user.sessionVersion`. Missing version is treated as 0. After kill increments DB to 1, both old tokens (undefined → 0) and stale new tokens (0) are correctly rejected.

### 4. google-calendar and telegram returning 500 for auth failures
**Problem:** Both routes caught all errors and returned 500 for anything that didn't match "access required". A sessionVersion mismatch threw a different message, so it fell through to 500 instead of 401.

**Fix:** Added `AuthError` class to `auth.ts`. All auth failures thrown as `AuthError` with correct status. Routes catch `AuthError` and use `error.status` directly.

---

## Recovery: If sessionVersion Gets Out of Sync

If doctors are locked out (token version doesn't match DB and they can't log in), reset all versions via SQL:

```sql
UPDATE public.users SET session_version = 0;
```

This resets only the `session_version` column. Zero data loss — no patients, appointments, medical records, or any other data is affected. After reset, everyone can log in normally with their current tokens.

---

## Deployment Checklist

Follow the rule from `database-architecture.md` — schema must reach the DB **before** code is deployed:

```
1. Edit schema.prisma
2. Create SQL migration file
3. Run migration against local DB:
   cd packages/database
   npx prisma db execute --file prisma/migrations/add-session-version.sql --schema prisma/schema.prisma
4. pnpm db:generate
5. Edit all TypeScript files
6. Test locally
7. Run migration against Railway BEFORE pushing code:
   npx prisma db execute --file packages/database/prisma/migrations/add-session-version.sql --url "RAILWAY_PUBLIC_URL"
8. git push → Railway deploys
```
