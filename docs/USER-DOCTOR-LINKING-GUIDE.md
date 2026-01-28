# User & Doctor Profile Linking Guide

## Overview

This healthcare platform has a dual authentication system where **Users** (authentication accounts) can be linked to **Doctor** profiles (public-facing professional profiles). Understanding this relationship is crucial for managing the platform.

---

## Table of Contents

1. [User Roles & Types](#user-roles--types)
2. [Database Schema](#database-schema)
3. [User-Doctor Relationship](#user-doctor-relationship)
4. [Authentication Flow](#authentication-flow)
5. [Why Admins Need Doctor Profiles](#why-admins-need-doctor-profiles)
6. [Common Scenarios](#common-scenarios)
7. [Troubleshooting](#troubleshooting)
8. [How to Link Users to Doctors](#how-to-link-users-to-doctors)

---

## User Roles & Types

### User Model (Authentication)
The `User` model represents an authentication account in the system.

**Fields:**
- `id`: Unique identifier
- `email`: Login email (from Google OAuth)
- `name`: Display name
- `image`: Profile picture URL
- `role`: Either `ADMIN` or `DOCTOR`
- `doctorId`: Foreign key linking to Doctor profile (can be null)

**Roles:**
1. **ADMIN** - Full platform access, can manage users, doctors, appointments
2. **DOCTOR** - Limited access to their own doctor portal and content

---

## Database Schema

### User Table
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  image     String?
  role      String   // "ADMIN" or "DOCTOR"
  doctorId  String?  @unique  // Links to Doctor.id
  doctor    Doctor?  @relation(fields: [doctorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Doctor Table
```prisma
model Doctor {
  id               String   @id @default(cuid())
  slug             String   @unique
  doctorFullName   String
  lastName         String
  primarySpecialty String
  // ... many other fields for public profile

  // Relations
  user             User?    // 1:1 relation - optional
  articles         Article[]
  appointments     Appointment[]
  // ... other relations
}
```

**Key Points:**
- One User can link to ONE Doctor (1:1 relationship)
- One Doctor can have ZERO or ONE User account
- A Doctor profile can exist without a User account (public directory listing)
- A User MUST have a linked Doctor profile to access doctor-specific endpoints

---

## User-Doctor Relationship

### Relationship Types

#### 1. Admin User WITH Doctor Profile
```
User (ADMIN) ──linked via doctorId──> Doctor Profile
```
- Can access Admin UI ✅
- Can access Doctor Portal ✅
- Can create articles, manage appointments ✅
- Most common for platform owners who are also doctors

#### 2. Admin User WITHOUT Doctor Profile
```
User (ADMIN)     Doctor Profile (unlinked)
```
- Can access Admin UI ✅
- **CANNOT** access Doctor Portal ❌
- **CANNOT** create articles ❌
- Will get 403 "Doctor profile required" errors
- **This configuration causes issues** - see below

#### 3. Doctor User WITH Doctor Profile
```
User (DOCTOR) ──linked via doctorId──> Doctor Profile
```
- Cannot access Admin UI ❌
- Can access their own Doctor Portal ✅
- Can create articles, manage their appointments ✅
- Standard configuration for doctors

#### 4. Doctor Profile WITHOUT User Account
```
Doctor Profile (standalone)
```
- No login access ❌
- Visible in public directory ✅
- Profile managed by admins ✅
- Used for directory listings only

---

## Authentication Flow

### 1. Login (Google OAuth)
```mermaid
User logs in with Google
    ↓
NextAuth creates session
    ↓
/api/auth/user endpoint called
    ↓
Check if user exists in database
    ↓
If exists: Return user data (id, email, role, doctorId)
If not: Create new user (role based on ADMIN_EMAILS env var)
    ↓
Session includes: user.id, user.email, user.role, user.doctorId
```

### 2. API Authentication
```mermaid
Frontend calls /api/auth/get-token
    ↓
Endpoint uses auth() to get session
    ↓
Creates JWT token with user data
    ↓
Frontend sends JWT in Authorization header
    ↓
API validates JWT and extracts user info
    ↓
getAuthenticatedDoctor() checks doctorId
    ↓
If doctorId exists: Return doctor profile
If doctorId null: Throw error "No doctor profile linked"
```

### 3. Key Authentication Functions

#### `getAuthenticatedDoctor(request)` - API (apps/api)
```typescript
// Located in: apps/api/src/lib/auth.ts
export async function getAuthenticatedDoctor(request: Request) {
  const user = await requireDoctorAuth(request);

  // REQUIRES doctorId - will throw error if null
  if (!user.doctorId) {
    throw new Error('No doctor profile linked to this account');
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: user.doctorId }
  });

  return { user, doctor };
}
```

**Used by:**
- `/api/articles` - Create/list articles
- `/api/articles/[id]` - Edit/delete articles
- `/api/practice-management/*` - All practice management endpoints
- Any endpoint that needs doctor-specific data

#### `requireAdminAuth(request)` - API
```typescript
// Only checks role, doesn't require doctor profile
export async function requireAdminAuth(request: Request) {
  const user = await validateAuthToken(request);

  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }

  return user;
}
```

**Used by:**
- Admin-only API endpoints
- User management
- System configuration

---

## Why Admins Need Doctor Profiles

### The Problem

Many API endpoints use `getAuthenticatedDoctor()` which **requires** a linked doctor profile:

```typescript
// This pattern is used throughout the API
const { doctor } = await getAuthenticatedDoctor(request);

// Then accesses doctor.id
const articles = await prisma.article.findMany({
  where: { doctorId: doctor.id }
});
```

**If admin has no doctor profile:**
- `getAuthenticatedDoctor()` throws error ❌
- API returns 403 "Doctor profile required" ❌
- Admin UI can't fetch data ❌
- Frontend shows 401 errors ❌

### The Solution

**Every user who needs to access doctor endpoints MUST have a linked doctor profile.**

This includes:
- ✅ Admins who manage content
- ✅ Admins who write articles
- ✅ All DOCTOR role users
- ❌ NOT needed for read-only admins (if we build separate endpoints)

---

## Common Scenarios

### Scenario 1: New Admin Setup
**Problem:** Created admin user, but can't access doctor features

**Solution:**
```sql
-- Option A: Link to existing doctor
UPDATE "public"."User"
SET "doctorId" = 'existing-doctor-id'
WHERE email = 'admin@example.com';

-- Option B: Create placeholder doctor profile
-- See "How to Link Users to Doctors" section
```

### Scenario 2: Admin Without Doctor Access
**Problem:** Admin can see admin UI but gets 403 errors loading data

**Cause:** Admin user has `doctorId = null`

**Solution:** Link admin to a doctor profile (see below)

### Scenario 3: Doctor Can't Login
**Problem:** Doctor exists in directory but can't login

**Cause:** Doctor has no User account linked

**Solution:**
1. Doctor logs in with Google (creates User with DOCTOR role)
2. Admin links the User to the Doctor profile:
```sql
UPDATE "public"."User"
SET "doctorId" = 'doctor-profile-id'
WHERE email = 'doctor@example.com';
```

### Scenario 4: Multiple Doctors, One Admin
**Problem:** One admin managing multiple doctor profiles

**Current Limitation:** One user can only link to ONE doctor profile

**Workaround:**
- Link admin to one "primary" doctor profile for content creation
- Create separate DOCTOR users for other profiles
- Or create separate admin accounts for each doctor

---

## Troubleshooting

### Error: "Failed to get auth token: 401"

**Symptoms:**
- Admin UI loads but shows no data
- Browser console shows 401 errors
- `/api/auth/get-token` returns 401

**Cause:** Session not being read correctly

**Solution:**
- Check that `auth()` function is used (not `getToken()`)
- Clear browser cookies and re-login
- Check NextAuth configuration

### Error: "Doctor profile required"

**Symptoms:**
- 403 errors from API
- Can't create articles
- Can't access practice management

**Cause:** User has no linked doctor profile (`doctorId` is null)

**Solution:**
```bash
# Run this script:
cd packages/database
DATABASE_URL="your-db-url" node link-admin.js
```

### Error: "Unique constraint failed on doctor_id"

**Symptoms:**
- Can't link user to doctor
- SQL update fails

**Cause:** Another user is already linked to that doctor profile

**Solution:**
```sql
-- Find who has the doctor profile
SELECT id, email, role, "doctorId"
FROM "public"."User"
WHERE "doctorId" = 'target-doctor-id';

-- Unlink the other user first (if appropriate)
UPDATE "public"."User"
SET "doctorId" = NULL
WHERE "doctorId" = 'target-doctor-id';

-- Then link your user
UPDATE "public"."User"
SET "doctorId" = 'target-doctor-id'
WHERE email = 'your-admin@example.com';
```

### Session has doctorId but still getting errors

**Cause:** Session is cached with old data

**Solution:**
1. Log out completely
2. Clear browser cookies for the site
3. Log back in fresh
4. Verify session has doctorId in browser DevTools:
```javascript
// In browser console:
fetch('/api/auth/session').then(r => r.json()).then(console.log)
// Should show: user.doctorId = "some-id"
```

---

## How to Link Users to Doctors

### Method 1: Using Node Script (Recommended)

Create a script in `packages/database`:

```javascript
// packages/database/link-user-doctor.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function linkUserToDoctor() {
  const userEmail = 'admin@example.com';
  const doctorId = 'doctor-id-here';

  try {
    const user = await prisma.user.update({
      where: { email: userEmail },
      data: { doctorId: doctorId }
    });

    console.log('✅ Linked:', user.email, 'to doctor:', user.doctorId);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

linkUserToDoctor();
```

Run it:
```bash
cd packages/database
DATABASE_URL="postgresql://..." node link-user-doctor.js
```

### Method 2: Direct SQL (Railway CLI)

```bash
railway run --service pgvector -- bash -c 'psql $DATABASE_URL'
```

Then run:
```sql
-- Update user
UPDATE "public"."User"
SET "doctorId" = 'doctor-id-here'
WHERE email = 'admin@example.com';

-- Verify
SELECT id, email, role, "doctorId"
FROM "public"."User"
WHERE email = 'admin@example.com';
```

### Method 3: Create Placeholder Doctor Profile

If admin doesn't need a real doctor profile, create a placeholder:

```javascript
// packages/database/create-admin-doctor.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAdminDoctor() {
  // Copy structure from existing doctor
  const template = await prisma.doctor.findFirst();

  const doctor = await prisma.doctor.create({
    data: {
      slug: 'admin-placeholder',
      doctorFullName: 'Admin User',
      lastName: 'Admin',
      primarySpecialty: template.primarySpecialty,
      subspecialties: [],
      heroImage: template.heroImage,
      locationSummary: 'Admin',
      city: 'Admin',
      shortBio: 'Admin placeholder',
      longBio: 'Admin access profile',
      yearsExperience: 0,
      conditions: [],
      procedures: [],
      appointmentModes: ['in_person'],
      clinicAddress: 'Admin',
      clinicPhone: '0000000000',
      clinicHours: { "monday": "9-5" }
    }
  });

  // Link to admin user
  await prisma.user.update({
    where: { email: 'admin@example.com' },
    data: { doctorId: doctor.id }
  });

  console.log('✅ Created and linked doctor:', doctor.id);
}

createAdminDoctor();
```

---

## Best Practices

### 1. Always Link Admins to Doctor Profiles
If your admin will:
- Create articles
- Manage appointments
- Use practice management features

**Then they MUST have a doctor profile.**

### 2. Use Placeholder Profiles for Non-Doctor Admins
Create a generic "Admin" doctor profile for admins who aren't real doctors:
- Slug: `admin-placeholder`
- Name: `Admin User`
- Don't show in public directory (use status field)

### 3. Verify Links After User Creation
```sql
-- Run this query to check all users
SELECT
  u.email,
  u.role,
  u."doctorId",
  d."doctorFullName"
FROM "public"."User" u
LEFT JOIN "public"."Doctor" d ON u."doctorId" = d.id
ORDER BY u.role, u.email;
```

### 4. Document Your Admin/Doctor Mappings
Keep a record of which admin users link to which doctor profiles:

```
Admin Users:
- admin@example.com → admin-placeholder profile
- doctor1@example.com → Dr. Smith profile
- doctor2@example.com → Dr. Jones profile
```

### 5. Set ADMIN_EMAILS Environment Variable
```env
# In Railway or .env
ADMIN_EMAILS=admin@example.com,owner@example.com
```

This ensures new users with these emails get ADMIN role automatically.

---

## Database Queries Reference

### Check User Status
```sql
SELECT id, email, role, "doctorId"
FROM "public"."User"
WHERE email = 'user@example.com';
```

### List All Users and Their Doctor Links
```sql
SELECT
  u.id,
  u.email,
  u.role,
  u."doctorId",
  d.slug as doctor_slug,
  d."doctorFullName"
FROM "public"."User" u
LEFT JOIN "public"."Doctor" d ON u."doctorId" = d.id
ORDER BY u.role DESC, u.email;
```

### Find Unlinked Admins
```sql
SELECT email, role, "doctorId"
FROM "public"."User"
WHERE role = 'ADMIN' AND "doctorId" IS NULL;
```

### Find Unlinked Doctor Profiles
```sql
SELECT d.id, d.slug, d."doctorFullName"
FROM "public"."Doctor" d
LEFT JOIN "public"."User" u ON d.id = u."doctorId"
WHERE u.id IS NULL;
```

### Link User to Doctor
```sql
UPDATE "public"."User"
SET "doctorId" = 'doctor-id-here'
WHERE email = 'user@example.com'
RETURNING id, email, "doctorId";
```

### Unlink User from Doctor
```sql
UPDATE "public"."User"
SET "doctorId" = NULL
WHERE email = 'user@example.com'
RETURNING id, email, "doctorId";
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION LAYER                     │
│                                                              │
│  User (Google OAuth)                                         │
│  ├─ id: "user-123"                                          │
│  ├─ email: "admin@example.com"                              │
│  ├─ role: "ADMIN"                                           │
│  └─ doctorId: "doctor-456" ──┐                              │
│                               │                              │
└───────────────────────────────┼──────────────────────────────┘
                                │
                                │ 1:1 Link
                                │
┌───────────────────────────────┼──────────────────────────────┐
│                     PROFILE LAYER             │              │
│                                               ↓              │
│  Doctor (Public Profile)                                     │
│  ├─ id: "doctor-456"                                        │
│  ├─ slug: "dr-smith"                                        │
│  ├─ doctorFullName: "Dr. Smith"                             │
│  ├─ primarySpecialty: "Cardiology"                          │
│  └─ ... (public profile fields)                             │
│                                                              │
│  Relations:                                                  │
│  ├─ articles[]     (can create)                             │
│  ├─ appointments[] (can manage)                             │
│  ├─ reviews[]      (receives)                               │
│  └─ bookings[]     (receives)                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

**Key Takeaways:**

1. ✅ **Users authenticate** (login accounts)
2. ✅ **Doctors are profiles** (public-facing information)
3. ✅ **Users link to Doctors** via `doctorId` field (1:1 relationship)
4. ✅ **All users accessing doctor endpoints need a linked doctor profile**
5. ✅ **Admins need doctor profiles** to access doctor features
6. ✅ **One user = one doctor** (can't manage multiple doctors from one account)
7. ✅ **Doctor profiles can exist without users** (directory listings)
8. ✅ **Always verify links after user creation** to avoid 403 errors

**When in doubt:** Link every admin user to a doctor profile (even if it's a placeholder).

---

## Related Files

- `apps/api/src/lib/auth.ts` - Authentication functions
- `apps/admin/src/app/api/auth/get-token/route.ts` - Token generation
- `packages/auth/src/nextauth-config.ts` - NextAuth configuration
- `packages/database/prisma/schema.prisma` - Database schema
- `apps/api/src/app/api/auth/user/route.ts` - User creation/lookup

---

Last Updated: January 28, 2026
