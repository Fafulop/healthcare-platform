# Database Sessions Migration

**Last Updated:** 2026-04-02
**Status:** ✅ Implemented and deployed

---

## Why We Did This

The doctor app used NextAuth's **JWT strategy** — sessions were stateless signed cookies with no server-side record. This meant:

- A doctor could have unlimited open sessions across unlimited devices
- Logging out on one device did not affect any other device
- The kill switch only partially worked — `apps/api` routes were protected via `sessionVersion`, but 50+ internal doctor app routes authenticated via NextAuth session cookie directly and ignored `sessionVersion` entirely

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

## What Changed From the Original Plan

Several things worked differently in practice than expected. These are documented here so future developers understand the decisions.

### 1. `emailVerified` Field Required on User Model

**Problem:** `@auth/prisma-adapter` v2 requires an `emailVerified DateTime?` field on the User model. Without it, the adapter's internal queries fail silently during the OAuth callback, redirecting users to `/auth/error`.

**Fix:** Added `emailVerified DateTime? @map("email_verified")` to the User model and ran a separate migration (`add-email-verified-to-users.sql`).

### 2. `allowDangerousEmailAccountLinking` Required for Existing Users

**Problem:** After deploying, existing users who had accounts in the `users` table but no row in the new `accounts` table triggered `OAuthAccountNotLinked` — NextAuth refused to link their Google identity to their existing user record as a security measure.

**Fix:** Added `allowDangerousEmailAccountLinking: true` to the Google provider config. This is safe because the app is Google-only — there is no password auth that could be used to hijack accounts by email.

### 3. Doctor Auto-Linking Removed

**Plan said:** `signIn()` would auto-link users to doctor profiles by matching `user.email` against `doctor.email`.

**Reality:** The `Doctor` model has no `email` field. Additionally, the old `jwt()` callback called `/api/auth/user` which also did NOT do auto-linking — it just returned whatever `doctorId` was already in the DB. Auto-linking was never happening in production.

**Result:** Doctor linking is done manually by admin during onboarding. The `session()` callback reads `doctorId` directly from the DB User row — if it's already set, it works. The auto-linking code was removed.

### 4. Middleware Cannot Use Prisma (Edge Runtime)

**Problem:** Next.js middleware runs on the **Edge runtime**. Prisma standard client requires Node.js. With database sessions strategy, every `auth()` call in middleware triggers a Prisma session lookup — this fails on Edge with:
```
PrismaClientValidationError: In order to run Prisma Client on edge runtime
```

**Plan said:** The middleware would call `auth()` for session lookup, role check, and consent check.

**Reality:** This is architecturally impossible with Prisma on Edge.

**Fix:** Split into two layers:
- **Middleware (Edge):** Lightweight session cookie check only — no Prisma, no `auth()`. If the cookie `authjs.session-token` (or `__Secure-authjs.session-token` in production) is absent, redirect to `/login`.
- **Dashboard layout (Node.js):** Full auth check using `useSession()` — handles role check and consent redirect.

### 5. `@healthcare/database` Must Be an Explicit Dependency

**Problem:** Railway's build could not resolve `@healthcare/database` in `packages/auth` because it was not declared as a dependency — it was resolved implicitly via workspace hoisting locally but not in the Railway build environment.

**Fix:** Added `"@healthcare/database": "workspace:*"` to `packages/auth/package.json` dependencies.

### 6. Kill Sessions Wrapped in Transaction

The plan showed two separate `await` calls. The actual implementation wraps them in `prisma.$transaction([...])` so both succeed or both fail atomically.

---

## Service-by-Service Impact

### apps/public — Zero Impact
No NextAuth, no auth of any kind. Completely unaffected.

### apps/api — One Change Only
Only the `kill-sessions` route changed — it now deletes Session rows before incrementing `sessionVersion`. Everything else (`validateAuthToken`, `sessionVersion` check, role helpers) is unchanged.

### apps/doctor — The Main Beneficiary
50+ internal API routes now benefit from DB session validation without any individual route changes. The middleware redirects to login when the session cookie is missing. Role and consent checks happen in the dashboard layout.

### apps/admin — Automatically Covered
Uses the same `@healthcare/auth` package. Admin sessions go into the same `sessions` table. No files changed beyond `next-auth.d.ts` type declarations.

---

## Database Schema Changes

**Two migrations were required** (not one as originally planned):

### Migration 1: `add-db-sessions.sql`

Three new tables. All in `public` schema.

```sql
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

### Migration 2: `add-email-verified-to-users.sql`

Required by `@auth/prisma-adapter` v2. Not in the original plan.

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP(3);
```

### Schema.prisma Changes

User model gains `emailVerified` field + two relations:

```prisma
model User {
  // ... existing fields ...
  emailVerified DateTime? @map("email_verified")  // NEW — required by prisma adapter
  accounts      Account[]                          // NEW relation
  sessions      Session[]                          // NEW relation
}
```

Three new models added: `Account`, `Session`, `VerificationToken` (all `@@schema("public")`).

---

## Auth Package Changes

### `packages/auth/package.json`

```json
"dependencies": {
  "@auth/prisma-adapter": "^2.11.1",
  "@healthcare/database": "workspace:*"
}
```

Both are required. `@healthcare/database` must be explicit (not just hoisted) for Railway builds.

### `packages/auth/src/nextauth-config.ts`

```typescript
import NextAuth, { type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@healthcare/database";

// Wrap adapter to assign correct role on new user creation.
// Default adapter only sets email, name, image — no knowledge of ADMIN_EMAILS.
const adapter = PrismaAdapter(prisma);
const customAdapter = {
  ...adapter,
  createUser: async (data: any) => {
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim()).filter(Boolean);
    const role = adminEmails.includes(data.email) ? 'ADMIN' : 'DOCTOR';
    return prisma.user.create({ data: { ...data, role } });
  },
};

export const authConfig: NextAuthConfig = {
  adapter: customAdapter as any,
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // Required for existing users migrating from JWT
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }: any) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Copy OAuth tokens to User model (Google Calendar integration reads from here)
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

    // session() with database strategy receives:
    //   session — the Session row (session.id is this session's cuid)
    //   user    — the full DB User row loaded by the adapter
    // No JWT, no token — everything comes directly from the DB.
    async session({ session, user }: any) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.doctorId = user.doctorId ?? null;
      session.user.sessionVersion = user.sessionVersion ?? 0;
      session.user.privacyConsentAt = user.privacyConsentAt ?? null;
      // Expose session row id so /api/auth/sessions can identify the current session
      session.sessionId = session.id;
      return session;
    },

    // jwt() callback is NOT present — database strategy does not call it.
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  session: {
    strategy: "database" as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

**What moved vs what disappeared from the old `jwt()` callback:**

| Was in `jwt()` | Now |
|---|---|
| Call `/api/auth/user` to create/fetch user | `adapter.createUser` override handles role; user creation is automatic |
| Store Google tokens to User model | `signIn()` callback |
| Set role, doctorId, sessionVersion, privacyConsentAt | `session()` reads directly from DB User row |
| `trigger === "update"` for consent race condition | Removed — DB is source of truth, `update({})` triggers re-read |
| Doctor auto-linking by email | Removed — Doctor model has no email field; linking is manual |

---

## Middleware Change (Edge Runtime Constraint)

**`apps/doctor/src/middleware.ts`** — completely rewritten.

The original plan assumed `auth()` could be called in middleware. This is impossible because Next.js middleware runs on the **Edge runtime** and Prisma cannot run there.

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/uploadthing"];

// Middleware runs on Edge runtime — Prisma cannot run here.
// We do a lightweight session cookie check only.
// Role and consent checks happen in the dashboard layout (Node.js).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for NextAuth v5 database session cookie
  // Production uses __Secure- prefix (HTTPS), development does not
  const sessionCookie =
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token");

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
```

**Role and consent checks** moved to `apps/doctor/src/app/dashboard/layout.tsx` via `useSession()`:

```typescript
// Role check — only DOCTOR and ADMIN can access the doctor portal
useEffect(() => {
  if (status === "authenticated" && session?.user?.role) {
    const allowedRoles = ["DOCTOR", "ADMIN"];
    if (!allowedRoles.includes(session.user.role)) {
      redirect("/login");
    }
  }
}, [status, session?.user?.role]);

// Consent check — redirect to /consent if doctor hasn't accepted privacy policy
useEffect(() => {
  if (status === "authenticated" && session?.user?.privacyConsentAt == null) {
    redirect("/consent");
  }
}, [status, session?.user?.privacyConsentAt]);
```

**Trade-off:** Cookie existence check in middleware means a user with a deleted session token passes middleware (cookie still exists) but hits a 401 in any API call or server component that calls `auth()` (Node.js), redirecting them to login. The gap is one request — acceptable.

---

## Type Declaration Changes

**`apps/doctor/src/types/next-auth.d.ts`:**
```typescript
declare module "next-auth" {
  interface Session {
    sessionId?: string;
    user: {
      id: string;
      role: string;
      doctorId: string | null;
      privacyConsentAt: Date | string | null; // Date from DB, string when serialized
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: string;
    doctorId: string | null;
    sessionVersion: number;
    privacyConsentAt: Date | null;
  }
}
```

`privacyConsentAt` is doctor-app specific and not in `apps/admin/src/types/next-auth.d.ts`.

---

## Consent Page Change

```typescript
// Before — passes data to jwt() trigger="update" which no longer exists
await update({ privacyConsentAt: data.privacyConsentAt });

// After — DB is source of truth, just trigger a session refresh
await update({});
```

Flow: `POST /api/auth/consent` saves timestamp to DB → `update({})` triggers session refresh → `session()` re-reads User row → picks up `privacyConsentAt` → `router.replace("/dashboard")` proceeds.

---

## Kill Sessions Changes

**`apps/api/src/app/api/auth/kill-sessions/route.ts`**

Both operations wrapped in a transaction so they succeed or fail together:

```typescript
await prisma.$transaction([
  // 1. Delete all NextAuth DB sessions → doctor + admin apps immediately locked out
  prisma.session.deleteMany({
    where: { userId: authUser.userId },
  }),
  // 2. Increment sessionVersion → apps/api Bearer JWTs rejected on next call
  prisma.user.update({
    where: { id: authUser.userId },
    data: { sessionVersion: { increment: 1 } },
  }),
]);
```

`skipVersionCheck: true` still required — the endpoint is called via Bearer JWT which may have a stale `sessionVersion`. Without it the endpoint would reject itself.

---

## Active Sessions API (New)

### `apps/doctor/src/app/api/auth/sessions/route.ts`

```
GET    /api/auth/sessions   → list non-expired sessions for current user
DELETE /api/auth/sessions   → delete all sessions (used by "Cerrar todas")
```

Response per session:
```json
{
  "id": "cuid",
  "createdAt": "2026-04-02T10:00:00Z",
  "expires": "2026-05-02T10:00:00Z",
  "current": true
}
```

`current` is determined by comparing `session.sessionId` (exposed by `session()` callback) against each row's `id`. The `sessionToken` field is never returned.

### `apps/doctor/src/app/api/auth/sessions/[id]/route.ts`

```
DELETE /api/auth/sessions/[id] → revoke one specific session
```

Verifies `target.userId === session.user.id` before deleting — prevents a doctor from revoking another doctor's session. Returns 403 if ownership check fails.

---

## Complete File List

### Files That Changed

| File | What Changed |
|------|-------------|
| `packages/database/prisma/schema.prisma` | `emailVerified` on User; Account, Session, VerificationToken models; User relations |
| `packages/database/prisma/migrations/add-db-sessions.sql` | New — 3 new tables |
| `packages/database/prisma/migrations/add-email-verified-to-users.sql` | New — `email_verified` column on users |
| `packages/auth/package.json` | Added `@auth/prisma-adapter` + `@healthcare/database` dependencies |
| `packages/auth/src/nextauth-config.ts` | Full rewrite — adapter, database strategy, new signIn()/session(), removed jwt() |
| `apps/doctor/src/types/next-auth.d.ts` | AdapterUser augmentation, sessionId, privacyConsentAt type fix |
| `apps/admin/src/types/next-auth.d.ts` | AdapterUser augmentation, sessionId |
| `apps/doctor/src/middleware.ts` | Rewritten — lightweight cookie check only (no Prisma) |
| `apps/doctor/src/app/dashboard/layout.tsx` | Added role + consent checks via useSession() |
| `apps/doctor/src/app/consent/page.tsx` | `update({})` instead of `update({ privacyConsentAt })` |
| `apps/api/src/app/api/auth/kill-sessions/route.ts` | deleteMany sessions + sessionVersion in $transaction |
| `apps/doctor/src/app/api/auth/sessions/route.ts` | New — GET + DELETE all sessions |
| `apps/doctor/src/app/api/auth/sessions/[id]/route.ts` | New — DELETE one session |
| `apps/doctor/src/app/dashboard/mi-perfil/page.tsx` | Active sessions list UI |

### Files That Did NOT Change

| File | Why |
|------|-----|
| `apps/api/src/lib/auth.ts` | validateAuthToken and sessionVersion check unchanged |
| `apps/doctor/src/lib/auth-fetch.ts` | 401 redirect already in place |
| `apps/doctor/src/lib/medical-auth.ts` | Calls `auth()` on Node.js — automatically benefits |
| `apps/doctor/src/app/api/auth/get-token/route.ts` | Session shape preserved by session() callback |
| `apps/admin/src/app/api/auth/get-token/route.ts` | Same |
| All `useSession()` hooks in 30+ pages | Session shape is identical |
| All 50+ internal doctor app API routes | Protected by middleware cookie check + Node.js auth() |
| **Entire `apps/public`** | No auth — completely unaffected |

---

## Edge Cases

### All users logged out on deploy
Expected. JWT cookies are not recognized after switching to database strategy. Every doctor logs in once after deploy.

### Existing users with no accounts row
Handled by `allowDangerousEmailAccountLinking: true` on the Google provider. On first login after migration, the adapter auto-creates the accounts row linking their Google identity to their existing user record.

### Google Calendar integration
OAuth tokens continue to flow to the `User` model via `signIn()`. Google Calendar code reads from User — no changes needed.

### apps/api Bearer JWTs
Deleting Session rows invalidates doctor app sessions immediately. Bearer JWTs (1-hour expiry) are invalidated by the `sessionVersion` increment. Maximum exposure window after kill switch: up to 1 hour for API calls. Acceptable.

### Session accumulation
The `signIn()` callback deletes expired sessions per user on each new login. No scheduled job needed.

### skipVersionCheck still required
The kill-sessions endpoint is called with a Bearer JWT that may carry a stale `sessionVersion`. Without `skipVersionCheck: true`, the endpoint would reject itself. JWT signature and user existence are still fully validated.

### Cookie check gap in middleware
With the new middleware, a user whose session was deleted (killed) still passes the cookie check on the next request — the cookie exists but the DB row is gone. On that next request, any `auth()` call (in a server component or `/api/auth/` route) returns null and redirects to login. Gap: one request. Acceptable trade-off for Edge compatibility.

---

## Deploy Checklist (What Was Actually Run)

```
1.  Add @auth/prisma-adapter and @healthcare/database to packages/auth/package.json
2.  Add emailVerified to User model in schema.prisma
3.  Add Account, Session, VerificationToken models to schema.prisma
4.  Create add-db-sessions.sql and add-email-verified-to-users.sql
5.  Run both migrations on local DB:
      cd packages/database
      npx prisma db execute --file prisma/migrations/add-db-sessions.sql --schema prisma/schema.prisma
      npx prisma db execute --file prisma/migrations/add-email-verified-to-users.sql --schema prisma/schema.prisma
6.  pnpm db:generate
7.  Run both migrations on Railway BEFORE pushing code:
      npx prisma db execute --file prisma/migrations/add-db-sessions.sql --url "RAILWAY_URL"
      npx prisma db execute --file prisma/migrations/add-email-verified-to-users.sql --url "RAILWAY_URL"
8.  git push → Railway deploys
9.  All existing JWT sessions invalidated → doctors log in fresh (expected)
    On first login, accounts rows are auto-created (allowDangerousEmailAccountLinking)
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
ALTER TABLE public.users DROP COLUMN IF EXISTS email_verified;
```

Then in `nextauth-config.ts`:
- Remove `adapter`, `allowDangerousEmailAccountLinking`
- Change `strategy: "database"` back to `strategy: "jwt"`
- Restore `jwt()` callback
- Remove `signIn()` DB operations

In `apps/doctor/src/middleware.ts`:
- Restore the `auth()` call and role/consent checks

In `apps/doctor/src/app/consent/page.tsx`:
- Restore `await update({ privacyConsentAt: data.privacyConsentAt })`

Redeploy. Doctors log in fresh with new JWT cookies.
