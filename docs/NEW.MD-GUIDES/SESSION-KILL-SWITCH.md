# Session Kill Switch

**Last Updated:** 2026-04-01

---

## What We Want to Build

A "Cerrar todas las sesiones" button in the doctor app that immediately invalidates all active sessions for that user across every device and browser tab.

### The Problem Today

The app uses **stateless JWT sessions** (30-day expiry). The server never tracks how many sessions are open. If a doctor leaves a session open on a computer they no longer control, there is no way to close it remotely — not from the app, not from the admin panel. The only options today are:

- Wait 30 days for the JWT to expire naturally
- Revoke Google OAuth access from Google account settings (breaks calendar integration too)

### The Solution

Add a `sessionVersion` integer to the `User` model. Every JWT token issued at login carries the current version. On each API request, the server compares the token's version against the database. If they don't match, the session is rejected.

When the doctor clicks "Cerrar todas las sesiones", the server increments `sessionVersion` by 1. All existing JWTs now carry a stale version and are rejected on their next API call. The doctor logs in fresh on the devices they want to use.

```
Doctor logs in  →  JWT issued with sessionVersion: 3
Doctor clicks "kill all"  →  DB sets sessionVersion: 4
Old tab makes API call  →  token has 3, DB has 4  →  rejected  →  redirect to login
Doctor logs in fresh  →  JWT issued with sessionVersion: 4  →  works
```

### Key Insight: Zero Extra DB Cost

`validateAuthToken` in `apps/api/src/lib/auth.ts` **already queries the database on every request** to verify the user exists. The `sessionVersion` check is added to that same existing query — no additional round trip.

### Middleware Limitation

The doctor app middleware (`middleware.ts`) reads from the JWT directly and does not hit the DB. After killing sessions, old browser tabs will still load page shells (middleware passes). However, the moment any page makes an API call, `validateAuthToken` catches the version mismatch and returns 401. In practice the user sees a broken page and gets bounced to `/login` on the first data fetch. This is acceptable behavior without significant architecture changes.

---

## Files to Touch

### 4 Files to Edit

**1. `packages/database/prisma/schema.prisma`**

Add `sessionVersion` to the `User` model:

```prisma
model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  name               String?
  image              String?
  role               Role      @default(DOCTOR)
  sessionVersion     Int       @default(0)   // <-- ADD THIS
  doctorId           String?   @unique @map("doctor_id")
  // ... rest of fields unchanged
}
```

---

**2. `apps/api/src/app/api/auth/user/route.ts`**

Add `sessionVersion` to the Prisma `select` in both the `findUnique` and `create` calls so it is returned to the JWT callback:

```typescript
// In findUnique select:
select: {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  doctorId: true,
  privacyConsentAt: true,
  sessionVersion: true,   // <-- ADD THIS
},

// In create select (same addition):
select: {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  doctorId: true,
  privacyConsentAt: true,
  sessionVersion: true,   // <-- ADD THIS
},
```

---

**3. `packages/auth/src/nextauth-config.ts`**

Store `sessionVersion` in the JWT token inside the `jwt()` callback, alongside the other fields already being stored:

```typescript
if (response.ok) {
  const dbUser = await response.json();
  token.userId = dbUser.id;
  token.role = dbUser.role;
  token.doctorId = dbUser.doctorId;
  token.name = dbUser.name;
  token.picture = dbUser.image;
  token.privacyConsentAt = dbUser.privacyConsentAt ?? null;
  token.sessionVersion = dbUser.sessionVersion;   // <-- ADD THIS
}
```

---

**4. `apps/api/src/lib/auth.ts`**

Two changes here:

**a) Extend the `JWTPayload` interface** to include `sessionVersion`:

```typescript
interface JWTPayload {
  email: string;
  sub?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  sessionVersion?: number;   // <-- ADD THIS
}
```

**b) Add the version check inside `validateAuthToken`**, in the existing `prisma.user.findUnique` block. Add `sessionVersion` to the select and compare:

```typescript
const user = await prisma.user.findUnique({
  where: { email: payload.email },
  select: {
    id: true,
    email: true,
    role: true,
    doctorId: true,
    sessionVersion: true,   // <-- ADD THIS
  },
});

if (!user) {
  throw new Error('User not found in database');
}

// Reject stale sessions
if (payload.sessionVersion !== undefined && payload.sessionVersion !== user.sessionVersion) {
  throw new Error('Session has been invalidated - please log in again');
}
```

> Note: `payload.sessionVersion !== undefined` guard ensures backward compatibility with any tokens issued before this feature was deployed.

---

### 3 New Files to Create

**5. `packages/database/prisma/migrations/add-session-version.sql`**

```sql
-- Migration: Add session_version to users table
-- Purpose: Enables server-side session invalidation ("kill all sessions")
-- Date: 2026-04-01

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
```

---

**6. `apps/api/src/app/api/auth/kill-sessions/route.ts`**

New PATCH endpoint. The authenticated user can only kill their own sessions:

```typescript
import { prisma } from '@healthcare/database';
import { NextResponse } from 'next/server';
import { validateAuthToken } from '@/lib/auth';

export async function PATCH(request: Request) {
  try {
    const authUser = await validateAuthToken(request);

    await prisma.user.update({
      where: { id: authUser.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 401 }
    );
  }
}
```

---

**7. Doctor app UI — button in profile/settings**

Add a "Cerrar todas las sesiones" button to the doctor's profile page (likely `apps/doctor/src/app/dashboard/mi-perfil/`). On click:

```typescript
async function handleKillSessions() {
  await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/kill-sessions`, {
    method: 'PATCH',
  });
  // Sign out current session too so doctor re-authenticates cleanly
  await signOut({ callbackUrl: '/login' });
}
```

> Calling `signOut()` after the PATCH ensures the doctor's current session is also cleared from the browser, and they get a fresh JWT with the new `sessionVersion` when they log back in.

---

## Implementation Order

Follow the deployment checklist from `database-architecture.md` — schema must reach the DB before code is deployed:

```
1. Edit schema.prisma         (add sessionVersion field)
2. Create the SQL migration file
3. Run migration against local DB:
   cd packages/database
   npx prisma db execute --file prisma/migrations/add-session-version.sql --schema prisma/schema.prisma

4. pnpm db:generate           (regenerate Prisma client)
5. Edit the 3 TypeScript files (auth/user route, nextauth-config, auth.ts)
6. Create the new API endpoint (kill-sessions route)
7. Add the UI button
8. Test locally end-to-end
9. Run migration against Railway BEFORE deploying:
   npx prisma db execute --file packages/database/prisma/migrations/add-session-version.sql --url "RAILWAY_PUBLIC_URL"
10. git push → Railway deploys
```

---

## Summary

| Item | Count |
|------|-------|
| Files to edit | 4 |
| New files to create | 3 |
| Extra DB queries per request | 0 (check added to existing query) |
| Estimated effort | ~1 day |

The `sessionVersion` column defaults to `0` for all existing users, so existing sessions are unaffected until a user explicitly clicks the kill switch for the first time.
