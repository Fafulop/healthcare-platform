# Authentication Implementation Guide

**Date:** December 15, 2024
**Status:** Architecture Finalized, Ready for Implementation
**Estimated Time:** 4-5 hours for complete staff authentication

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Philosophy](#core-philosophy)
3. [Two Identity Systems](#two-identity-systems)
4. [Google OAuth Setup](#google-oauth-setup)
5. [Implementation Plan](#implementation-plan)
6. [Code Examples](#code-examples)
7. [Testing & Verification](#testing--verification)

---

## Architecture Overview

### The Complete Picture

```
┌─────────────────────────────────────────────────────────────┐
│                    Healthcare Platform                      │
└─────────────────────────────────────────────────────────────┘

Staff Identity (Google OAuth)              Patient Identity (Tokens)
├─ apps/doctor  ─┐                        └─ apps/public
├─ apps/admin   ─┤→ Same OAuth app           ├─ /my-appointment/:token
└─ apps/api     ─┘   Different roles          └─ WhatsApp delivery
                     (enforced in DB)
```

### Critical Design Decisions

#### ✅ What We DO Have:

- **ONE Google OAuth app** for the entire platform
- **TWO identity systems** (staff vs patients)
- **ZERO patient accounts** (intentional)
- **WhatsApp as patient interface**
- **Role enforcement in API** (not Google)

#### ❌ What We DO NOT Have:

- No patient OAuth
- No patient login/signup
- No patient app (apps/patient)
- No multiple OAuth projects
- No patient dashboards

---

## Core Philosophy

### Staff vs Patient Asymmetry

This platform recognizes a fundamental difference:

| User Type | Behavior | Identity Needs | Solution |
|-----------|----------|----------------|----------|
| **Doctors** | Repeat users, need dashboards | Persistent identity | Google OAuth |
| **Admins** | Repeat users, need control | Persistent identity | Google OAuth |
| **Patients** | Infrequent, arrive via SEO | Temporary access | Token URLs |

### Why This Matters

**Patients:**
- Do NOT want accounts
- Do NOT want logins
- Do NOT return frequently
- Arrive via SEO
- Communicate via WhatsApp

**Staff (Doctors + Admins):**
- Are repeat users
- Need dashboards
- Require authentication
- Use Google accounts professionally

**This asymmetry drives all auth decisions.**

---

## Two Identity Systems

### System 1: Staff Authentication (Google OAuth)

**Who:** Doctors + Admins
**How:** Google OAuth 2.0
**Where:** apps/doctor + apps/admin
**Shared:** ONE OAuth app, same credentials

```
Google OAuth Flow:
1. User clicks "Sign in with Google"
2. Redirects to Google consent screen
3. User approves
4. Google redirects back with token
5. API validates token with Google
6. API checks user.email in database
7. API retrieves user.role from database
8. Session created with role attached
9. Middleware enforces role on routes
```

**Key Insight:** Google provides identity, API provides authorization.

### System 2: Patient Access (Token-based)

**Who:** Patients
**How:** Secure tokens in URLs
**Where:** apps/public only
**Shared:** Nothing (completely separate)

```
Patient Access Flow:
1. Patient books appointment (provides name + WhatsApp)
2. API creates appointment with unique token
3. API sends WhatsApp message with link
4. Link: /my-appointment/:token
5. Patient clicks link
6. apps/public validates token exists in DB
7. Shows appointment details
8. No login, no OAuth, no session
```

**Key Insight:** WhatsApp delivery = soft identity verification.

---

## Google OAuth Setup

### Single OAuth Project Strategy

**Important:** One OAuth app serves both doctor and admin portals.

### Google Cloud Console Setup

**Step 1: Create OAuth Project**

```
1. Go to: https://console.cloud.google.com/
2. Create new project: "Healthcare Platform Production"
3. Enable Google+ API (required for OAuth)
4. Go to: APIs & Services > Credentials
5. Click: Create Credentials > OAuth Client ID
6. Application type: Web application
7. Name: "Healthcare Platform Staff Auth"
```

**Step 2: Configure Redirect URIs**

```
Authorized redirect URIs:

Development:
http://localhost:3001/api/auth/callback/google   # apps/doctor
http://localhost:3002/api/auth/callback/google   # apps/admin

Production:
https://doctor.yoursite.com/api/auth/callback/google
https://admin.yoursite.com/api/auth/callback/google
```

**Step 3: Get Credentials**

```
Client ID:
xxxxx-xxxxxx.apps.googleusercontent.com

Client Secret:
GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

**Save these - you'll need them for environment variables.**

### OAuth Consent Screen

**Configure:**
```
User Type: External (or Internal if Google Workspace)
App Name: Healthcare Platform
Support Email: your-email@example.com
Scopes:
  - email
  - profile
  - openid
```

### Environment Variables

**Same variables for BOTH apps/doctor and apps/admin:**

```env
# .env.local (apps/doctor and apps/admin)

# Google OAuth (SHARED credentials)
GOOGLE_CLIENT_ID=xxxxx-xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx

# NextAuth
NEXTAUTH_URL=http://localhost:3001  # Change to 3002 for admin
NEXTAUTH_SECRET=your-random-secret-min-32-chars-generate-with-openssl

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docs_mono
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## Implementation Plan

### Overview: Build Doctor + Admin Auth Together

**Why Together?**
- ✅ They use identical OAuth config
- ✅ They share the same `packages/auth`
- ✅ Only difference is role check in middleware
- ✅ Saves 1.5 hours vs building separately
- ✅ No rework needed

**Total Time:** 4-5 hours

---

### Phase 1: Database Models (30 minutes)

#### Step 1.1: Update Prisma Schema

**File:** `packages/database/prisma/schema.prisma`

```prisma
// Add User model for authentication
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?  // Google profile picture
  role      Role     @default(DOCTOR)

  // Optional: Link to doctor profile if user is a doctor
  doctorId  String?  @unique
  doctor    Doctor?  @relation(fields: [doctorId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum Role {
  ADMIN
  DOCTOR
}

// Update Doctor model to add user relation
model Doctor {
  // ... existing fields ...

  user      User?    // 1:1 relation (optional - can have doctors without user accounts)

  // ... existing relations ...
}
```

#### Step 1.2: Create Migration

```bash
# Generate migration
pnpm db:migrate

# When prompted, name it: "add_user_authentication"
```

#### Step 1.3: Seed Admin User (Optional)

**File:** `packages/database/prisma/seed.ts`

```typescript
// Add this to your seed script
async function seedUsers() {
  // Create an admin user
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Platform Admin',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created: admin@example.com');
}

// Call in main seed function
await seedUsers();
```

```bash
pnpm db:seed
```

**Important:** Change `admin@example.com` to your actual Google account email.

---

### Phase 2: Shared Auth Package (1.5 hours)

#### Step 2.1: Create Package Structure

```bash
mkdir -p packages/auth/src
cd packages/auth
```

**File:** `packages/auth/package.json`

```json
{
  "name": "@healthcare/auth",
  "version": "1.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/nextauth-config.ts",
    "./middleware": "./src/middleware.ts"
  },
  "dependencies": {
    "next-auth": "^5.0.0-beta.25",
    "@healthcare/database": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

#### Step 2.2: NextAuth Configuration

**File:** `packages/auth/src/nextauth-config.ts`

```typescript
import GoogleProvider from "next-auth/providers/google";
import { AuthOptions } from "next-auth";
import { prisma } from "@healthcare/database";

export const authConfig: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if user exists in database
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! },
      });

      if (!existingUser) {
        // First time login - create user
        // By default, assign DOCTOR role
        // Admins must be set manually in database
        await prisma.user.create({
          data: {
            email: user.email!,
            name: user.name,
            image: user.image,
            role: "DOCTOR", // Default role for new users
          },
        });

        console.log(`✅ New user created: ${user.email} (role: DOCTOR)`);
      }

      return true;
    },

    async jwt({ token, user, account }) {
      // On sign in, fetch user from database to get role
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: {
            id: true,
            role: true,
            doctorId: true,
            name: true,
            image: true,
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
          token.doctorId = dbUser.doctorId;
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Attach user info to session
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.doctorId = token.doctorId as string | null;
      }

      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};
```

#### Step 2.3: Middleware Helpers

**File:** `packages/auth/src/middleware.ts`

```typescript
import { getServerSession } from "next-auth";
import { authConfig } from "./nextauth-config";

/**
 * Require any authenticated user
 */
export async function requireAuth() {
  const session = await getServerSession(authConfig);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  return session;
}

/**
 * Require ADMIN role
 */
export async function requireAdmin() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }

  return session;
}

/**
 * Require DOCTOR role
 */
export async function requireDoctor() {
  const session = await requireAuth();

  if (session.user.role !== "DOCTOR") {
    throw new Error("Forbidden: Doctor access required");
  }

  return session;
}

/**
 * Require either ADMIN or DOCTOR (any staff member)
 */
export async function requireStaff() {
  const session = await requireAuth();

  if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
    throw new Error("Forbidden: Staff access required");
  }

  return session;
}

/**
 * Check if user owns the doctor profile
 */
export async function requireDoctorOwnership(doctorId: string) {
  const session = await requireAuth();

  // Admins can access any doctor
  if (session.user.role === "ADMIN") {
    return session;
  }

  // Doctors can only access their own profile
  if (session.user.role === "DOCTOR") {
    if (session.user.doctorId !== doctorId) {
      throw new Error("Forbidden: Can only access your own profile");
    }
  }

  return session;
}
```

#### Step 2.4: TypeScript Types

**File:** `packages/auth/src/types.ts`

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      doctorId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    doctorId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    doctorId?: string | null;
  }
}
```

#### Step 2.5: Package Index

**File:** `packages/auth/src/index.ts`

```typescript
export { authConfig } from "./nextauth-config";
export {
  requireAuth,
  requireAdmin,
  requireDoctor,
  requireStaff,
  requireDoctorOwnership,
} from "./middleware";
export type * from "./types";
```

---

### Phase 3: Admin App Authentication (1 hour)

#### Step 3.1: Install Dependencies

```bash
cd apps/admin
pnpm add next-auth
```

#### Step 3.2: NextAuth Route Handler

**File:** `apps/admin/src/app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth from "next-auth";
import { authConfig } from "@healthcare/auth/config";

const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
```

#### Step 3.3: Login Page

**File:** `apps/admin/src/app/login/page.tsx`

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in with your Google account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">
              {error === "AccessDenied"
                ? "You do not have admin access. Contact support."
                : "Authentication failed. Please try again."}
            </p>
          </div>
        )}

        {/* Sign In Button */}
        <div>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          Only authorized admins can access this panel
        </p>
      </div>
    </div>
  );
}
```

#### Step 3.4: Middleware (Route Protection)

**File:** `apps/admin/src/middleware.ts`

```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      // Only allow users with ADMIN role
      return token?.role === "ADMIN";
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect all routes except login and public assets
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

#### Step 3.5: Session Provider

**File:** `apps/admin/src/app/layout.tsx`

```typescript
import { SessionProvider } from "next-auth/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

#### Step 3.6: Add Logout Button

**File:** `apps/admin/src/components/Navbar.tsx`

```typescript
"use client";

import { signOut, useSession } from "next-auth/react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin Panel</h1>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session?.user?.email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
```

---

### Phase 4: Doctor App Authentication (1 hour)

**Good News:** This is almost identical to admin app.

#### Step 4.1: Create Doctor App Structure (if doesn't exist)

```bash
mkdir -p apps/doctor/src/app/api/auth/[...nextauth]
mkdir -p apps/doctor/src/app/login
mkdir -p apps/doctor/src/app/dashboard
```

#### Step 4.2: Install Dependencies

```bash
cd apps/doctor
pnpm add next-auth
```

#### Step 4.3: NextAuth Route Handler

**File:** `apps/doctor/src/app/api/auth/[...nextauth]/route.ts`

```typescript
// EXACT SAME as admin
import NextAuth from "next-auth";
import { authConfig } from "@healthcare/auth/config";

const handler = NextAuth(authConfig);

export { handler as GET, handler as POST };
```

#### Step 4.4: Login Page

**File:** `apps/doctor/src/app/login/page.tsx`

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function DoctorLoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Doctor Portal</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to manage your profile and appointments
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">
              Authentication failed. Please try again.
            </p>
          </div>
        )}

        {/* Sign In Button */}
        <div>
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 transition"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              {/* Same Google icon SVG as admin */}
            </svg>
            Sign in with Google
          </button>
        </div>

        <p className="text-center text-xs text-gray-500">
          Sign in with the email associated with your doctor profile
        </p>
      </div>
    </div>
  );
}
```

#### Step 4.5: Middleware (Route Protection)

**File:** `apps/doctor/src/middleware.ts`

```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => {
      // Only allow users with DOCTOR role
      return token?.role === "DOCTOR";
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

#### Step 4.6: Basic Dashboard

**File:** `apps/doctor/src/app/dashboard/page.tsx`

```typescript
import { getServerSession } from "next-auth";
import { authConfig } from "@healthcare/auth/config";
import { redirect } from "next/navigation";

export default async function DoctorDashboard() {
  const session = await getServerSession(authConfig);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Welcome, Dr. {session.user.name}</h1>
      <p className="mt-2 text-gray-600">Email: {session.user.email}</p>

      {session.user.doctorId && (
        <p className="mt-2 text-sm text-gray-500">
          Doctor Profile ID: {session.user.doctorId}
        </p>
      )}

      {/* TODO: Add profile preview, appointments, etc. */}
    </div>
  );
}
```

#### Step 4.7: Package.json Configuration

**File:** `apps/doctor/package.json`

```json
{
  "name": "@healthcare/doctor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001"
  },
  "dependencies": {
    "next": "^16.0.8",
    "next-auth": "^5.0.0-beta.25",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "@healthcare/auth": "workspace:*",
    "@healthcare/database": "workspace:*",
    "@healthcare/types": "workspace:*"
  }
}
```

---

### Phase 5: API Authentication (1 hour)

#### Step 5.1: Auth Middleware for API

**File:** `apps/api/src/middleware/auth.ts`

```typescript
import { getServerSession } from "next-auth";
import { authConfig } from "@healthcare/auth/config";

export async function requireAuth(req: Request) {
  const session = await getServerSession(authConfig);

  if (!session) {
    return Response.json(
      { error: "Unauthorized", message: "Please sign in" },
      { status: 401 }
    );
  }

  return session;
}

export async function requireAdmin(req: Request) {
  const session = await requireAuth(req);

  // If requireAuth returned a Response (error), pass it through
  if (session instanceof Response) {
    return session;
  }

  if (session.user.role !== "ADMIN") {
    return Response.json(
      { error: "Forbidden", message: "Admin access required" },
      { status: 403 }
    );
  }

  return session;
}

export async function requireDoctor(req: Request) {
  const session = await requireAuth(req);

  if (session instanceof Response) {
    return session;
  }

  if (session.user.role !== "DOCTOR") {
    return Response.json(
      { error: "Forbidden", message: "Doctor access required" },
      { status: 403 }
    );
  }

  return session;
}

export async function requireStaff(req: Request) {
  const session = await requireAuth(req);

  if (session instanceof Response) {
    return session;
  }

  if (!["ADMIN", "DOCTOR"].includes(session.user.role)) {
    return Response.json(
      { error: "Forbidden", message: "Staff access required" },
      { status: 403 }
    );
  }

  return session;
}
```

#### Step 5.2: Protect Doctor Creation

**File:** `apps/api/src/app/api/doctors/route.ts`

```typescript
import { requireAdmin } from "@/middleware/auth";
import { prisma } from "@healthcare/database";

export async function GET(req: Request) {
  // Public endpoint - no auth required
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        services: true,
        education: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
      },
    });

    return Response.json({
      success: true,
      count: doctors.length,
      data: doctors,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: "Failed to fetch doctors" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // PROTECTED: Only admins can create doctors
  const session = await requireAdmin(req);

  // If session is a Response (error), return it
  if (session instanceof Response) {
    return session;
  }

  try {
    const data = await req.json();

    // Create doctor with all related data
    const doctor = await prisma.doctor.create({
      data: {
        // Basic info
        slug: data.slug,
        doctorFullName: data.doctorFullName,
        primarySpecialty: data.primarySpecialty,
        // ... rest of fields

        // Relations
        services: {
          create: data.services || [],
        },
        education: {
          create: data.education || [],
        },
        certificates: {
          create: data.certificates || [],
        },
        carouselItems: {
          create: data.carouselItems || [],
        },
        faqs: {
          create: data.faqs || [],
        },
      },
      include: {
        services: true,
        education: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
      },
    });

    return Response.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    console.error("Error creating doctor:", error);
    return Response.json(
      { success: false, error: "Failed to create doctor" },
      { status: 500 }
    );
  }
}
```

#### Step 5.3: Protect Doctor Updates

**File:** `apps/api/src/app/api/doctors/[slug]/route.ts`

```typescript
import { requireAuth } from "@/middleware/auth";
import { prisma } from "@healthcare/database";

export async function PUT(
  req: Request,
  { params }: { params: { slug: string } }
) {
  // Require authentication
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  try {
    const data = await req.json();
    const doctor = await prisma.doctor.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!doctor) {
      return Response.json(
        { error: "Doctor not found" },
        { status: 404 }
      );
    }

    // Authorization: Admins can edit any doctor, doctors can only edit their own
    if (session.user.role === "DOCTOR") {
      if (session.user.doctorId !== doctor.id) {
        return Response.json(
          { error: "Forbidden: You can only edit your own profile" },
          { status: 403 }
        );
      }

      // Doctors can only edit operational fields
      // Remove SEO-critical fields from data
      delete data.slug;
      delete data.doctorFullName;
      delete data.primarySpecialty;
      delete data.city;
      delete data.locationSummary;
    }

    // Update doctor
    const updated = await prisma.doctor.update({
      where: { slug: params.slug },
      data,
      include: {
        services: true,
        education: true,
        certificates: true,
        carouselItems: true,
        faqs: true,
      },
    });

    return Response.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to update doctor" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { slug: string } }
) {
  // Only admins can delete doctors
  const session = await requireAdmin(req);
  if (session instanceof Response) return session;

  try {
    await prisma.doctor.delete({
      where: { slug: params.slug },
    });

    return Response.json({
      success: true,
      message: "Doctor deleted successfully",
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to delete doctor" },
      { status: 500 }
    );
  }
}
```

---

### Phase 6: Patient Token System (Separate - 1.5 hours)

**Important:** This is completely separate from OAuth.

#### Step 6.1: Add Token to Appointments Table

**File:** `packages/database/prisma/schema.prisma`

```prisma
model Appointment {
  id           String   @id @default(cuid())
  token        String   @unique @default(cuid()) // Patient access token

  // Patient info (no account required)
  patientName  String
  patientPhone String   // WhatsApp number
  patientEmail String?

  // Appointment details
  doctorId     String
  doctor       Doctor   @relation(fields: [doctorId], references: [id])
  scheduledAt  DateTime
  duration     Int      // minutes
  mode         AppointmentMode
  status       AppointmentStatus @default(PENDING)
  reason       String?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("appointments")
}

enum AppointmentMode {
  IN_PERSON
  TELECONSULT
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}
```

```bash
pnpm db:migrate
```

#### Step 6.2: Appointment API (Token-based)

**File:** `apps/api/src/app/api/appointments/[token]/route.ts`

```typescript
import { prisma } from "@healthcare/database";

// NO AUTH REQUIRED - Token validates access
export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { token: params.token },
      include: {
        doctor: {
          select: {
            doctorFullName: true,
            primarySpecialty: true,
            heroImage: true,
            clinicName: true,
            streetAddress: true,
            phone: true,
            whatsappNumber: true,
          },
        },
      },
    });

    if (!appointment) {
      return Response.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch appointment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { status, scheduledAt } = await req.json();

    const appointment = await prisma.appointment.update({
      where: { token: params.token },
      data: {
        ...(status && { status }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      },
      include: { doctor: true },
    });

    return Response.json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}
```

#### Step 6.3: Patient Appointment Page

**File:** `apps/public/src/app/my-appointment/[token]/page.tsx`

```typescript
import { notFound } from "next/navigation";

async function getAppointment(token: string) {
  const res = await fetch(
    `http://localhost:3003/api/appointments/${token}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;

  const { data } = await res.json();
  return data;
}

export default async function MyAppointmentPage({
  params,
}: {
  params: { token: string };
}) {
  const appointment = await getAppointment(params.token);

  if (!appointment) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-bold">Your Appointment</h1>

        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Doctor</h2>
            <p>{appointment.doctor.doctorFullName}</p>
            <p className="text-sm text-gray-600">
              {appointment.doctor.primarySpecialty}
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Date & Time</h2>
            <p>{new Date(appointment.scheduledAt).toLocaleString()}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Status</h2>
            <p className="capitalize">{appointment.status.toLowerCase()}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Location</h2>
            <p>{appointment.doctor.clinicName}</p>
            <p className="text-sm text-gray-600">
              {appointment.doctor.streetAddress}
            </p>
          </div>

          {/* Reschedule/Cancel buttons */}
          <div className="flex gap-4 pt-6">
            <button className="rounded bg-blue-600 px-4 py-2 text-white">
              Reschedule
            </button>
            <button className="rounded border px-4 py-2">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Code Examples

### Example 1: Admin Creating a Doctor

```typescript
// apps/admin - API call with auth
async function createDoctor(data: DoctorFormData) {
  const session = await getSession();

  const res = await fetch("http://localhost:3003/api/doctors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // NextAuth handles sending the session cookie
    },
    body: JSON.stringify(data),
  });

  // API will return 401 if not authenticated
  // API will return 403 if not admin
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message);
  }

  return res.json();
}
```

### Example 2: Doctor Editing Own Profile

```typescript
// apps/doctor - API call with auth
async function updateMyProfile(data: Partial<DoctorFormData>) {
  const session = await getSession();

  const res = await fetch(
    `http://localhost:3003/api/doctors/${session.user.doctorId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  // API enforces:
  // - Doctor can only edit their own profile
  // - Doctor cannot edit SEO-critical fields
  if (!res.ok) {
    throw new Error("Failed to update profile");
  }

  return res.json();
}
```

### Example 3: Patient Accessing Appointment

```typescript
// apps/public - NO auth needed, just token in URL
// Patient clicks: https://site.com/my-appointment/clx123abc

async function getAppointment(token: string) {
  const res = await fetch(
    `http://localhost:3003/api/appointments/${token}`
  );

  // No auth header needed - token validates access
  if (!res.ok) return null;

  return res.json();
}
```

---

## Testing & Verification

### Test Checklist

#### ✅ Admin Authentication

- [ ] Admin can access login page at `/login`
- [ ] Clicking "Sign in with Google" redirects to Google
- [ ] After Google auth, redirects to `/dashboard`
- [ ] Admin email must exist in database with role=ADMIN
- [ ] Non-admin emails are rejected
- [ ] Middleware protects all routes except `/login`
- [ ] Logout button signs out successfully

#### ✅ Doctor Authentication

- [ ] Doctor can access login page at `/login`
- [ ] Clicking "Sign in with Google" redirects to Google
- [ ] After Google auth, redirects to `/dashboard`
- [ ] Doctor email must exist in database with role=DOCTOR
- [ ] Non-doctor emails are rejected
- [ ] Middleware protects all routes except `/login`
- [ ] Dashboard shows doctor's name and email

#### ✅ API Protection

- [ ] POST `/api/doctors` returns 401 if not authenticated
- [ ] POST `/api/doctors` returns 403 if not admin
- [ ] POST `/api/doctors` succeeds for admin
- [ ] PUT `/api/doctors/[slug]` allows admin to edit any field
- [ ] PUT `/api/doctors/[slug]` allows doctor to edit own profile only
- [ ] PUT `/api/doctors/[slug]` prevents doctor from editing SEO fields
- [ ] DELETE `/api/doctors/[slug]` only allows admin

#### ✅ Patient Token Access

- [ ] Appointment created with unique token
- [ ] Token is 25+ characters (cuid)
- [ ] `/my-appointment/:token` shows appointment details
- [ ] Invalid token returns 404
- [ ] No authentication required to access

### Manual Testing Steps

**1. Test Admin Login:**
```bash
# Start admin app
cd apps/admin
pnpm dev

# Open browser: http://localhost:3002/login
# Click "Sign in with Google"
# Use admin email (set in database)
# Should redirect to /dashboard
# Try accessing /doctors - should work
# Sign out - should redirect to /login
# Try accessing /doctors - should redirect to /login
```

**2. Test Doctor Login:**
```bash
# Start doctor app
cd apps/doctor
pnpm dev

# Open browser: http://localhost:3001/login
# Click "Sign in with Google"
# Use doctor email (set in database)
# Should see dashboard with name
```

**3. Test API Protection:**
```bash
# Try creating doctor without auth (should fail)
curl -X POST http://localhost:3003/api/doctors \
  -H "Content-Type: application/json" \
  -d '{"doctorFullName": "Test Doctor"}'

# Should return: {"error": "Unauthorized"}

# Now create doctor as admin (through admin app)
# Should succeed
```

**4. Test Patient Token:**
```bash
# Create appointment (returns token)
# Visit: http://localhost:3000/my-appointment/clx123abc
# Should show appointment details
# Try random token - should 404
```

---

## Environment Variables Reference

### apps/admin/.env.local

```env
# Google OAuth (shared credentials)
GOOGLE_CLIENT_ID=xxxxx-xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx

# NextAuth
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=your-random-secret-32-chars-min

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docs_mono

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3003
```

### apps/doctor/.env.local

```env
# Google OAuth (SAME credentials as admin)
GOOGLE_CLIENT_ID=xxxxx-xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx

# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-random-secret-32-chars-min

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docs_mono

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3003
```

### apps/api/.env.local

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docs_mono

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

---

## Common Issues & Solutions

### Issue 1: "Client authentication failed"

**Cause:** Invalid Google Client ID or Secret

**Solution:**
```bash
# Verify credentials in Google Cloud Console
# Check .env.local files have correct values
# Restart Next.js dev servers after changing .env
```

### Issue 2: "Callback URL mismatch"

**Cause:** Redirect URI not configured in Google Console

**Solution:**
```
Google Cloud Console > Credentials > OAuth 2.0 Client
Add: http://localhost:3001/api/auth/callback/google
Add: http://localhost:3002/api/auth/callback/google
```

### Issue 3: User can login but gets "Forbidden"

**Cause:** User role in database doesn't match app requirement

**Solution:**
```sql
-- Check user role
SELECT email, role FROM users WHERE email = 'user@example.com';

-- Update role to ADMIN
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';

-- Update role to DOCTOR
UPDATE users SET role = 'DOCTOR' WHERE email = 'doctor@example.com';
```

### Issue 4: Session not persisting

**Cause:** NEXTAUTH_SECRET not set or different between restarts

**Solution:**
```bash
# Generate secure secret
openssl rand -base64 32

# Add to .env.local (keep it the same always)
NEXTAUTH_SECRET=<generated-secret>
```

### Issue 5: "prisma.user is not a function"

**Cause:** Prisma client not regenerated after schema changes

**Solution:**
```bash
pnpm db:generate
```

---

## Next Steps After Implementation

### Immediate (Required for MVP)

1. **Link Doctors to Users**
   - When creating doctor in admin, optionally assign to user
   - Add email field to doctor creation wizard
   - Auto-create User if doesn't exist

2. **Profile Preview in Doctor Portal**
   - Show read-only view of public profile
   - Link to public site: `/doctors/[slug]`

3. **Appointment Management**
   - Build appointment creation API
   - Add booking form to apps/public
   - WhatsApp integration for confirmations

### Medium-term (Phase 2-3)

4. **Field-Level Permissions**
   - Create separate forms for SEO-critical vs operational fields
   - Admin can edit all fields
   - Doctor can only edit operational fields

5. **Approval Workflow**
   - Doctor submits changes → pending status
   - Admin reviews and approves
   - Email notifications

6. **WhatsApp Integration**
   - Send appointment confirmation via WhatsApp API
   - Send reminders 24 hours before
   - Handle cancellation/rescheduling via WhatsApp

### Long-term (Scaling)

7. **Advanced Role Management**
   - Add more roles (MODERATOR, SUPPORT, etc.)
   - Fine-grained permissions
   - Audit logging

8. **Multi-factor Authentication**
   - Add MFA for admin accounts
   - SMS verification for doctors

9. **API Rate Limiting**
   - Protect endpoints from abuse
   - Different limits per role

---

## Summary

This authentication system provides:

✅ **Single OAuth app** for staff (doctor + admin)
✅ **Shared auth package** (`@healthcare/auth`) used by both apps
✅ **Role-based access control** enforced in API
✅ **Token-based patient access** (no OAuth for patients)
✅ **WhatsApp as patient interface** (intentional design)
✅ **Clear separation** between staff and patient identity systems

**Time to implement:** 4-5 hours total
**Result:** Complete authentication for staff, foundation for patient booking

**Next:** Choose to build booking system or doctor portal features.

---

**Document Version:** 1.0
**Last Updated:** December 15, 2024
**Ready for Implementation:** Yes ✅
