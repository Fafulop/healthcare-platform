# Database Sessions Migration

**Last Updated:** 2026-04-01

---

## Why We Are Doing This

The doctor app uses NextAuth's **JWT strategy** — sessions are stateless signed cookies that live for 30 days. There is no server-side record of who is logged in or on which device.

This means:
- A doctor can have unlimited open sessions across unlimited devices
- Logging out on one device does not affect any other device
- The kill switch only partially works — `apps/api` routes are protected via `sessionVersion`, but 50+ internal doctor app routes authenticate via NextAuth session cookie directly and ignore `sessionVersion` entirely

**The fix:** Switch NextAuth to **database strategy**. Every login creates a row in a `sessions` table. Every request looks up that row. Killing sessions = deleting rows. All devices are immediately logged out on their next request.

---

## Architecture: Before vs After

### Before (JWT Strategy — stateless)

```
Login  → NextAuth signs a JWT → stored in httpOnly cookie (30 days)
Request → NextAuth decodes JWT locally (no DB hit) → session available
Logout  → cookie deleted locally, nothing in DB changes
Kill switch → increment sessionVersion in User → apps/api Bearer JWTs rejected
               but 50+ doctor app internal routes still accept old JWT cookies
```

### After (Database Strategy — stateful)

```
Login  → NextAuth creates a Session row in DB → opaque sessionToken stored in cookie
Request → NextAuth looks up sessionToken in DB → row exists → session valid
Logout  → Session row deleted → immediately invalid everywhere
Kill switch → deleteMany Session rows for user → ALL devices logged out immediately
               sessionVersion still incremented → apps/api Bearer JWTs also invalidated
```

---

## Service-by-Service Impact Analysis

### apps/public — Zero Impact

No NextAuth. No `@healthcare/auth`. No auth of any kind. The public site handles doctor profiles, blog articles, and booking/review links via URL tokens — none of this requires authentication. The middleware only does www → non-www redirects. This service is completely unaffected by the migration.

---

### apps/api — One Change Only

Does **not** use NextAuth at all. Has no `[...nextauth]` handler, no session management, no JWT cookie handling. It only validates incoming **Bearer JWTs** via `validateAuthToken()` in `src/lib/auth.ts`.

The database sessions migration has exactly one effect here: the `kill-sessions` route must also delete Session rows from the DB in addition to incrementing `sessionVersion`.

Everything else — `validateAuthToken`, `sessionVersion` check, `AuthError`, role helpers — is completely unchanged.

---

### apps/doctor — The Main Beneficiary

Uses `@healthcare/auth` for all authentication. The strategy change in `packages/auth` automatically propagates here.

**Middleware** (`src/middleware.ts`) calls `auth()`. With database strategy, `auth()` now performs a DB session lookup on every request. This is precisely what fixes the 50+ internal routes — they all go through middleware which calls `auth()`. If the session row is deleted, `auth()` returns null, middleware redirects to login. The fix requires zero changes to any of the 50+ individual route files.

**`get-token` route** calls `auth()` then reads `session.user.*`. If the session was killed (row deleted from DB), `auth()` returns null → get-token returns 401 → authFetch redirects to login. Works correctly without changes.

**`medical-auth.ts`** (used by server components and internal API routes) also calls `auth()` internally. Same benefit. No changes needed.

**`useSession()` hooks** in 30+ pages work regardless of JWT vs database strategy as long as the session shape is maintained by the `session()` callback.

**`consent/page.tsx`** — requires a small change. See dedicated section below.

---

### apps/admin — Automatically Covered

Uses the same `@healthcare/auth` package. Stricter middleware (ADMIN role only). Same `get-token` pattern. Fully covered by the `packages/auth` change. Admin sessions go into the same `sessions` table as doctor sessions, isolated by `userId`.

No files in `apps/admin` need changes beyond the `next-auth.d.ts` type declarations.

---

### packages/auth — The Core Change

The `nextauth-config.ts` is the most significant file to change. Currently:

- `jwt()` callback runs on every request, calls `NEXT_PUBLIC_API_URL/api/auth/user` to fetch/create the user, stores Google tokens, sets custom claims
- `session()` callback copies JWT claims to the session object
- `signIn()` callback just returns `true` (no logic)

With database strategy:
- `jwt()` callback is never called — removed entirely
- `session()` callback receives the full DB `User` object directly — no API call needed
- `signIn()` callback takes over: Google token copy, doctor linking, expired session cleanup
- A custom `adapter.createUser` wrapper handles admin role assignment

---

## Critical Finding: Consent Page

`apps/doctor/src/app/consent/page.tsx` calls:
```typescript
await update({ privacyConsentAt: data.privacyConsentAt });
```

This works today because the `jwt()` callback has a special `trigger === "update"` case that immediately applies the consent timestamp to the JWT without re-fetching from the DB — avoiding a race condition where the middleware would still see `privacyConsentAt: null` on the redirect.

**With database strategy this changes completely.** The `jwt()` callback is gone. The `session()` callback re-fetches the User row from DB on every `auth()` call. So after consent is saved to the DB, calling `update()` triggers a session refresh, and `session()` automatically picks up the new `privacyConsentAt` from the DB.

The fix is minimal: remove the data argument from `update()`.

```typescript
// Before
await update({ privacyConsentAt: data.privacyConsentAt });

// After — DB is source of truth, just trigger a refresh
await update({});
```

The `trigger === "update"` special case in `jwt()` disappears naturally since `jwt()` is removed entirely.

---

## Key Design Decisions

### 1. Google OAuth Tokens Stay in User Model

The `User` model currently stores Google OAuth tokens directly (`googleAccessToken`, `googleRefreshToken`, `googleTokenExpiry`). The Prisma adapter will also write OAuth tokens to the new `Account` model automatically. We continue writing them to the `User` model via the `signIn()` callback so the Google Calendar integration (which reads `user.googleRefreshToken`) requires zero changes.

Double-write is intentional. Migrating tokens from User → Account is a separate future task.

### 2. sessionVersion Is Kept

`apps/api` authenticates via a separate Bearer JWT (created by `/api/auth/get-token`, 1-hour expiry). Deleting Session rows does not invalidate these. The `sessionVersion` increment in kill-sessions handles `apps/api`. Both operations happen together: delete Session rows + increment `sessionVersion`.

### 3. No userAgent Storage (Scoped Out)

Storing the browser/device string requires injecting the HTTP request into the adapter's `createSession` call, which has no clean mechanism in NextAuth v5. The "Sesiones activas" UI will show sessions by creation date only — no device name. Can be added later via a separate metadata approach.

### 4. adapter.createUser Must Be Overridden

The Prisma adapter auto-creates new users with only `email`, `name`, `image`. It has no knowledge of the `ADMIN_EMAILS` env var. Without an override, new admin users silently get `role: DOCTOR`. The adapter's `createUser` method is wrapped to include the role assignment logic.

---

## Known Issues and Resolutions

| Issue | Resolution |
|---|---|
| Admin role lost on new user creation | Override `adapter.createUser` to check `ADMIN_EMAILS` |
| `userAgent` has no injection point in adapter | Scoped out — sessions show date only |
| `current` session needs sessionToken in session object | Expose `session.id` via `session()` callback + type augmentation |
| `AdapterUser` missing custom fields | Extend `AdapterUser` interface in `next-auth.d.ts` |
| `privacyConsentAt` type mismatch (Date vs string) | Change type to `Date \| string \| null` |
| Expired sessions accumulate indefinitely | Delete expired sessions per user on each new login in `signIn()` |
| Consent `update()` passes data to removed `jwt()` | Change to `await update({})` — DB is now source of truth |
| `/api/auth/sessions` bypassed by middleware | Route does its own `auth()` check internally — same pattern as all `/api/auth/` routes |
| `trigger === "update"` special case in jwt() | Disappears naturally — jwt() is removed, DB handles it |

---

## Database Schema Changes

**`packages/database/prisma/schema.prisma`**

Three new models. All `@@schema("public")`. User gets two new relations.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
  @@schema("public")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  createdAt    DateTime @default(now()) @map("created_at")
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
  @@schema("public")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
  @@schema("public")
}
```

User model additions (relations only — no new columns on the `users` table):
```prisma
model User {
  // ... all existing fields unchanged ...
  accounts Account[]
  sessions Session[]
}
```

**`packages/database/prisma/migrations/add-db-sessions.sql`**

```sql
-- Migration: Add NextAuth database session tables
-- Purpose: Switch from JWT strategy to database sessions for multi-device session management
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS public.accounts (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  type                TEXT NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token       TEXT,
  access_token        TEXT,
  expires_at          INTEGER,
  token_type          TEXT,
  scope               TEXT,
  id_token            TEXT,
  session_state       TEXT,
  CONSTRAINT accounts_provider_provider_account_id_key UNIQUE (provider, provider_account_id),
  CONSTRAINT accounts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id            TEXT PRIMARY KEY,
  session_token TEXT UNIQUE NOT NULL,
  user_id       TEXT NOT NULL,
  expires       TIMESTAMP(3) NOT NULL,
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier TEXT NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires    TIMESTAMP(3) NOT NULL,
  CONSTRAINT verification_tokens_identifier_token_key UNIQUE (identifier, token)
);
```

---

## Auth Package Changes

**`packages/auth/package.json`** — add dependency:
```json
"@auth/prisma-adapter": "^1.x"
```

**`packages/auth/src/nextauth-config.ts`** — full rewrite of callbacks

```typescript
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@healthcare/database";

// Wrap adapter to inject admin role assignment on new user creation.
// The default adapter only sets email, name, image — it has no knowledge of ADMIN_EMAILS.
const adapter = PrismaAdapter(prisma);
const customAdapter = {
  ...adapter,
  createUser: async (data: any) => {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const role = adminEmails.includes(data.email) ? 'ADMIN' : 'DOCTOR';
    return prisma.user.create({ data: { ...data, role } });
  },
};

export const authConfig = {
  adapter: customAdapter,

  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // signIn() replaces all of jwt()'s first-login responsibilities:
    // 1. Copy Google OAuth tokens to User model (Google Calendar reads from here)
    // 2. Link user to doctor profile if email matches
    // 3. Clean up expired sessions to prevent table accumulation
    async signIn({ user, account }: any) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Copy OAuth tokens to User model (Google Calendar integration depends on this)
          await prisma.user.update({
            where: { email: user.email },
            data: {
              googleAccessToken: account.access_token ?? null,
              googleRefreshToken: account.refresh_token ?? null,
              googleTokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });

          // Link to doctor profile if email matches an existing doctor and not yet linked
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { doctorId: true },
          });
          if (!existingUser?.doctorId) {
            const doctor = await prisma.doctor.findFirst({
              where: { email: user.email },
              select: { id: true },
            });
            if (doctor) {
              await prisma.user.update({
                where: { email: user.email },
                data: { doctorId: doctor.id },
              });
            }
          }

          // Clean up expired sessions for this user on each new login
          await prisma.session.deleteMany({
            where: {
              userId: user.id,
              expires: { lt: new Date() },
            },
          });
        } catch (error) {
          console.error('[SIGN-IN CALLBACK] Error:', error);
          // Do not block login if these operations fail
        }
      }
      return true;
    },

    // session() callback — database strategy signature: { session, user }
    // `user` is the full DB User row loaded by the adapter (all custom fields included)
    // `session` is the Session row — session.id is this session's cuid
    // No JWT, no token — everything comes directly from the DB.
    async session({ session, user }: any) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.doctorId = user.doctorId ?? null;
      session.user.sessionVersion = user.sessionVersion ?? 0;
      session.user.privacyConsentAt = user.privacyConsentAt ?? null;
      // Expose session row id so the /api/auth/sessions route can mark the current session
      session.sessionId = session.id;
      return session;
    },

    // jwt() callback is NOT called with database strategy. Removed entirely.
    // The trigger === "update" / privacyConsentAt special case is also gone —
    // the DB is now the source of truth and session() re-reads it on every refresh.
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  debug: process.env.NODE_ENV === 'development',
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

**What disappears vs what moves:**

| Was in `jwt()` | Moves to |
|---|---|
| Call `/api/auth/user` to create/fetch user | `adapter.createUser` override (role) + `signIn()` (doctor link) |
| Store Google tokens to User model | `signIn()` callback |
| Set role, doctorId, sessionVersion, privacyConsentAt on token | `session()` reads directly from DB User row |
| `trigger === "update"` for consent race condition fix | Removed — DB is source of truth, `update({})` triggers re-read |
| Token refresh logic | Removed — no JWT to refresh |

---

## Type Declaration Changes

**`apps/doctor/src/types/next-auth.d.ts`** and **`apps/admin/src/types/next-auth.d.ts`**

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    sessionId?: string; // current session's DB id — used by /api/auth/sessions to mark current
    user: {
      id: string;
      role: string;
      doctorId: string | null;
      sessionVersion: number;
      privacyConsentAt: Date | string | null; // Date when coming from DB, string when serialized to client
    } & DefaultSession["user"];
  }
}

// Required so the session() callback can access custom fields on the `user` parameter.
// Without this, TypeScript errors on user.role, user.doctorId, etc.
declare module "next-auth/adapters" {
  interface AdapterUser {
    role: string;
    doctorId: string | null;
    sessionVersion: number;
    privacyConsentAt: Date | null;
  }
}

// JWT interface extensions below are dead code after database strategy migration
// (jwt() callback is removed). Kept to avoid breaking any imports but can be cleaned up later.
declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    doctorId?: string | null;
    sessionVersion?: number;
  }
}
```

`privacyConsentAt` is doctor-app specific and only present in `apps/doctor/src/types/next-auth.d.ts`, not admin.

---

## Consent Page Change

**`apps/doctor/src/app/consent/page.tsx`** — line 34

```typescript
// Before — passes data to jwt() trigger="update" which no longer exists
await update({ privacyConsentAt: data.privacyConsentAt });

// After — DB already has the value, just trigger a session refresh
await update({});
```

The consent flow after migration:
1. Doctor accepts → `POST /api/auth/consent` → saves `privacyConsentAt` to DB ✓
2. `await update({})` → triggers session refresh → `session()` callback re-reads User row → picks up `privacyConsentAt` ✓
3. `router.replace("/dashboard")` → middleware sees `session.user.privacyConsentAt` is set → allows through ✓

No race condition. No special-case logic. The DB is the source of truth.

---

## Kill Sessions Changes

**`apps/api/src/app/api/auth/kill-sessions/route.ts`**

```typescript
// After auth validation, do both operations atomically:

// 1. Delete all NextAuth DB sessions → doctor app + admin app immediately locked out
await prisma.session.deleteMany({
  where: { userId: authUser.userId },
});

// 2. Increment sessionVersion → apps/api Bearer JWTs rejected on next API call
await prisma.user.update({
  where: { id: authUser.userId },
  data: { sessionVersion: { increment: 1 } },
});
```

`skipVersionCheck: true` is still required. The kill-sessions endpoint is called from the doctor app via `authFetch` which uses a Bearer JWT. If that JWT has a stale `sessionVersion`, the endpoint would reject itself before it could fix anything. `skipVersionCheck` allows the endpoint to proceed even with a stale token — JWT signature and user existence are still validated.

---

## New: Active Sessions API

**`apps/doctor/src/app/api/auth/sessions/route.ts`** — new file

This route lives under `/api/auth/` which the middleware skips for all requests. The route performs its own `auth()` check — the same pattern used by every other `/api/auth/` route (`get-token`, `consent`, `user`).

```
GET    /api/auth/sessions      → list all non-expired sessions for current user
DELETE /api/auth/sessions      → delete all sessions (kill all devices)
```

Response per session:
```json
{
  "id": "cuid",
  "createdAt": "2026-04-01T10:00:00Z",
  "expires": "2026-05-01T10:00:00Z",
  "current": true
}
```

`current: true` — determined by comparing `session.sessionId` (the current session's DB id, exposed by the `session()` callback) against each row's `id`.

**`apps/doctor/src/app/api/auth/sessions/[id]/route.ts`** — new file

```
DELETE /api/auth/sessions/[id] → revoke one specific session
```

Must verify the session row's `userId` matches the authenticated user before deleting — prevents a doctor from revoking another doctor's session.

---

## Mi Perfil UI Changes

**`apps/doctor/src/app/dashboard/mi-perfil/page.tsx`**

Replace the existing "Sesiones activas" card (kill-all button only) with a full session list.

```
Sesiones activas
┌──────────────────────────────────────────────────┐
│  Sesión activa               [Este dispositivo]  │
│  Iniciado: 1 abr 2026 · 10:00 AM                 │
│                                                  │
│  Sesión activa                       [Revocar]   │
│  Iniciado: 28 mar 2026 · 06:32 PM                │
│                                                  │
│  Sesión activa                       [Revocar]   │
│  Iniciado: 15 mar 2026 · 09:15 AM                │
│                                  [Cerrar todas]  │
└──────────────────────────────────────────────────┘
```

No device names (userAgent scoped out). Sessions identified by creation date. Current session shows "Este dispositivo" with no Revoke button. "Cerrar todas" calls `DELETE /api/auth/sessions` then `signOut()`.

---

## Complete File List

### Files That Change

| File | Type | What Changes |
|------|------|-------------|
| `packages/database/prisma/schema.prisma` | Modified | Add Account, Session, VerificationToken + User relations |
| `packages/database/prisma/migrations/add-db-sessions.sql` | New | SQL for 3 new tables |
| `packages/auth/package.json` | Modified | Add `@auth/prisma-adapter` dependency |
| `packages/auth/src/nextauth-config.ts` | Rewritten | Adapter, strategy change, new signIn(), new session(), remove jwt() |
| `apps/doctor/src/types/next-auth.d.ts` | Modified | Add AdapterUser, sessionId, fix privacyConsentAt type |
| `apps/admin/src/types/next-auth.d.ts` | Modified | Add AdapterUser, sessionId |
| `apps/doctor/src/app/consent/page.tsx` | Modified | `update({})` instead of `update({ privacyConsentAt })` |
| `apps/api/src/app/api/auth/kill-sessions/route.ts` | Modified | Add `deleteMany sessions` before sessionVersion increment |
| `apps/doctor/src/app/api/auth/sessions/route.ts` | New | GET + DELETE all sessions |
| `apps/doctor/src/app/api/auth/sessions/[id]/route.ts` | New | DELETE one session |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Modified | Active sessions list UI |

### Files That Do NOT Change

| File | Why |
|------|-----|
| `apps/api/src/lib/auth.ts` | validateAuthToken and sessionVersion check unchanged |
| `apps/api/src/middleware.ts` | Does not exist — api uses validateAuthToken per-route |
| `apps/doctor/src/lib/auth-fetch.ts` | No change — 401 redirect already in place |
| `apps/doctor/src/lib/medical-auth.ts` | Calls `auth()` internally — automatically benefits |
| `apps/doctor/src/middleware.ts` | `auth()` works identically — no code change needed |
| `apps/admin/src/middleware.ts` | Same |
| `apps/doctor/src/app/api/auth/get-token/route.ts` | Reads `session.user.*` — shape preserved by session() callback |
| `apps/admin/src/app/api/auth/get-token/route.ts` | Same |
| `apps/doctor/src/app/api/auth/[...nextauth]/route.ts` | Handlers come from shared package — no change |
| `apps/admin/src/app/api/auth/[...nextauth]/route.ts` | Same |
| All `useSession()` hooks in 30+ pages | Session shape is identical |
| All 50+ internal doctor app API routes | Protected automatically via middleware DB session lookup |
| **Entire `apps/public`** | No auth — completely unaffected |

---

## Phased Implementation Plan

Each phase ends with a checkpoint. Do not start the next phase until the checkpoint passes on a local test.

---

### Phase 1 — Schema and Basic Login

**Goal:** Tables created, adapter initializes, Google OAuth login works, session row appears in DB.

Steps:
1. Add `@auth/prisma-adapter` to `packages/auth/package.json`
2. Add Account, Session, VerificationToken models to `schema.prisma`
3. Add `accounts` and `sessions` relations to User model
4. Create `add-db-sessions.sql`
5. Run migration on local DB: `cd packages/database && npx prisma db execute --file prisma/migrations/add-db-sessions.sql --schema prisma/schema.prisma`
6. Run `pnpm db:generate`
7. Add `adapter: customAdapter` and `session: { strategy: "database" }` to `nextauth-config.ts`
8. Keep `jwt()` callback in place for now — it will not run with database strategy but leave it until Phase 2

**Checkpoint:**
- Doctor logs in via Google OAuth ✓
- Session persists across page refreshes ✓
- One row in `public.sessions` table ✓
- One row in `public.accounts` table ✓
- No crash or auth loop ✓

---

### Phase 2 — Custom Fields and Middleware

**Goal:** role, doctorId, sessionVersion, privacyConsentAt all flow correctly. Middleware works. Consent redirect works. get-token works. Consent page update() fixed.

Steps:
1. Add `AdapterUser` augmentation to both `next-auth.d.ts` files
2. Add `sessionId` to `Session` interface in both `next-auth.d.ts` files
3. Fix `privacyConsentAt` type to `Date | string | null`
4. Write the `session()` callback reading from `user` (DB object) and exposing `sessionId`
5. Remove `jwt()` callback entirely
6. Fix consent page: `await update({})` instead of `await update({ privacyConsentAt })`

**Checkpoint:**
- Doctor logs in → middleware allows through (role check passes) ✓
- New doctor without consent → redirected to /consent ✓
- Doctor accepts consent → redirected to /dashboard immediately ✓
- `GET /api/auth/get-token` returns valid JWT with correct `role`, `doctorId`, `sessionVersion` ✓
- `authFetch` to `apps/api` succeeds (apps/api validates the Bearer JWT) ✓
- `useSession()` in pages returns correct `user.role`, `user.doctorId` ✓
- Admin user logs in → gets access to admin app ✓

---

### Phase 3 — Kill Sessions

**Goal:** Kill switch deletes DB session rows. All devices locked out immediately.

Steps:
1. Add `signIn()` callback: Google token copy + doctor linking + expired session cleanup
2. Add `adapter.createUser` override for admin role assignment
3. Update `kill-sessions` route: add `deleteMany sessions` before `sessionVersion` increment

**Checkpoint (requires two devices or browsers):**
- Log in on computer AND phone → two rows in `sessions` table ✓
- Use kill switch on computer → `signOut()` → redirected to /login ✓
- On phone, make any request (open a page, create a task) → immediate redirect to /login ✓
- Create a task after kill switch from phone → task is NOT created (blocked at middleware) ✓
- New admin user (email in ADMIN_EMAILS) logs in → gets role ADMIN, not DOCTOR ✓
- Re-login after kill → new session row created → everything works again ✓

---

### Phase 4 — Active Sessions UI

**Goal:** Doctor sees a list of active sessions, can revoke individual ones.

Steps:
1. Create `apps/doctor/src/app/api/auth/sessions/route.ts` — GET (list) + DELETE (kill all)
2. Create `apps/doctor/src/app/api/auth/sessions/[id]/route.ts` — DELETE (revoke one)
3. Update Mi Perfil page with sessions list card

**Checkpoint:**
- Mi Perfil → Integraciones shows session list with creation dates ✓
- Current session shows "Este dispositivo" with no Revoke button ✓
- Revoking another session → that device redirected to /login on next request ✓
- "Cerrar todas" → current device signed out, all others locked out ✓
- Revoking a session that belongs to a different user → 403 ✓

---

## Edge Cases

### All users logged out on deploy
Expected and unavoidable. JWT cookies are not recognized after switching to database strategy. Every doctor logs in once after deploy. Announce in advance.

### Google Calendar integration
OAuth tokens continue to flow to the `User` model via `signIn()`. The `Account` model also receives them from the adapter. Google Calendar code reads from User — no changes needed anywhere in the calendar integration.

### apps/api Bearer JWTs (up to 1-hour gap)
Deleting Session rows invalidates doctor app sessions immediately. Bearer JWTs (1-hour expiry, used by apps/api) are still valid until they expire OR until `sessionVersion` is incremented. The kill switch does both. Maximum exposure window: however long until the current Bearer JWT expires (worst case 1 hour). Acceptable for this use case.

### Session accumulation
The `signIn()` callback deletes expired sessions for the user on each new login. No scheduled job needed. Worst case: a doctor who hasn't logged in for months accumulates a handful of expired rows — cleaned on next login.

### Admin app shares sessions table
Both doctor and admin apps write to the same `sessions` table (same DB, same auth config). Sessions isolated by `userId`. Kill switch only affects the authenticated user's sessions.

### New admin users (ADMIN_EMAILS)
The `adapter.createUser` override checks `ADMIN_EMAILS` and assigns the correct role at creation time. Existing users already have their role in the DB and are unaffected.

### skipVersionCheck still required
The `PATCH /api/auth/kill-sessions` endpoint in `apps/api` is called with a Bearer JWT. If the Bearer JWT carries a stale `sessionVersion`, the endpoint would reject itself before it could fix anything. `skipVersionCheck: true` lets the endpoint proceed even with a stale token — JWT signature and user existence are still fully validated.

### Doctor linking race condition
`signIn()` checks `existingUser.doctorId` before querying for a matching doctor — avoids an unnecessary DB query for already-linked users. The query is safe to run multiple times (idempotent).

---

## Deploy Checklist

```
1.  Add @auth/prisma-adapter to packages/auth/package.json
2.  Add 3 models + User relations to schema.prisma
3.  Create packages/database/prisma/migrations/add-db-sessions.sql
4.  Run migration locally:
    cd packages/database
    npx prisma db execute --file prisma/migrations/add-db-sessions.sql --schema prisma/schema.prisma
5.  pnpm db:generate
6.  Implement Phase 1 → test checkpoint
7.  Implement Phase 2 → test checkpoint
8.  Implement Phase 3 → test checkpoint (two devices)
9.  Implement Phase 4 → test checkpoint
10. Run migration against Railway BEFORE pushing code:
    npx prisma db execute --file packages/database/prisma/migrations/add-db-sessions.sql --url "postgresql://postgres:PASSWORD@yamanote.proxy.rlwy.net:51502/railway"
11. git push → Railway deploys
12. All existing JWT sessions invalidated → doctors log in fresh (expected)
```

---

## Recovery

If the migration breaks authentication entirely:

```sql
-- Safe — drops only session tracking tables
-- Zero patient data, zero medical records, zero financial data affected
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.accounts;
DROP TABLE IF EXISTS public.verification_tokens;
```

Then revert `nextauth-config.ts` to JWT strategy (`strategy: "jwt"`, restore `jwt()` callback, remove adapter) and redeploy. Doctors log in again with fresh JWT cookies. The `consent/page.tsx` `update()` call should also be reverted.
