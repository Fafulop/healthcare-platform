# Codebase Map - Complete File Inventory

**Generated**: 2025-12-28
**Project**: Healthcare Platform Monorepo
**Structure**: Turborepo with pnpm workspaces

## Project Root

```
C:\Users\52331\docs-front\
├── apps/                      # 4 Next.js applications
│   ├── public/               # Public website (port 3000)
│   ├── doctor/               # Doctor portal (port 3001)
│   ├── admin/                # Admin panel (port 3002)
│   └── api/                  # REST API backend (port 3003)
├── packages/                  # Shared libraries
│   ├── auth/                 # NextAuth configuration
│   ├── database/             # Prisma ORM
│   └── types/                # TypeScript types
├── node_modules/             # Dependencies (pnpm)
├── package.json              # Root package.json
├── pnpm-workspace.yaml       # Workspace configuration
├── pnpm-lock.yaml            # Lockfile
├── turbo.json                # Turborepo config
└── .git/                     # Git repository
```

---

## Root Configuration Files

### Core Files

| File | Purpose |
|------|---------|
| `package.json` | Root package.json with workspace scripts |
| `pnpm-workspace.yaml` | Defines workspace packages (apps/*, packages/*) |
| `turbo.json` | Turborepo task pipeline configuration |
| `.gitignore` | Git ignore patterns |
| `README.md` | Project readme (may be outdated) |

### Workspace Scripts

```json
{
  "dev": "turbo run dev",
  "dev:public": "turbo run dev --filter=@healthcare/public",
  "dev:doctor": "turbo run dev --filter=@healthcare/doctor",
  "dev:admin": "turbo run dev --filter=@healthcare/admin",
  "dev:api": "turbo run dev --filter=@healthcare/api",
  "build": "turbo run build",
  "db:generate": "turbo run db:generate --filter=@healthcare/database",
  "db:migrate": "turbo run db:migrate --filter=@healthcare/database",
  "db:push": "turbo run db:push --filter=@healthcare/database"
}
```

---

## App 1: Public Website (`apps/public`)

**Package Name**: `@healthcare/public`
**Port**: 3000
**Purpose**: Public-facing doctor profile pages and blog

### Directory Structure

```
apps/public/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Homepage (/)
│   │   ├── robots.ts              # robots.txt generator
│   │   ├── sitemap.ts             # Dynamic sitemap.xml
│   │   ├── doctores/
│   │   │   ├── page.tsx           # Doctor list page (/doctores)
│   │   │   └── [slug]/
│   │   │       ├── layout.tsx     # Doctor profile layout (sidebar)
│   │   │       ├── page.tsx       # Doctor profile (/doctores/[slug])
│   │   │       ├── not-found.tsx  # 404 page for doctor
│   │   │       └── blog/
│   │   │           ├── page.tsx   # Blog listing (/doctores/[slug]/blog)
│   │   │           └── [articleSlug]/
│   │   │               └── page.tsx  # Article page (/doctores/[slug]/blog/[articleSlug])
│   │   └── favicon.ico            # Site favicon
│   ├── components/
│   │   ├── ui/                    # Generic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Card.tsx
│   │   ├── doctor/                # Doctor profile components
│   │   │   ├── HeroSection.tsx
│   │   │   ├── ServicesSection.tsx
│   │   │   ├── ConditionsSection.tsx
│   │   │   ├── MediaCarousel.tsx
│   │   │   ├── BiographySection.tsx
│   │   │   ├── EducationSection.tsx
│   │   │   ├── CredentialsSection.tsx
│   │   │   ├── ClinicLocationSection.tsx
│   │   │   ├── FAQSection.tsx
│   │   │   ├── AppointmentCalendar.tsx  # Dynamic import
│   │   │   ├── QuickNav.tsx
│   │   │   └── DoctorProfileClient.tsx  # Client-side wrapper
│   │   └── blog/                  # Blog components
│   │       └── BlogLayoutClient.tsx     # Blog sidebar layout
│   ├── types/
│   │   └── doctor.ts              # TypeScript interfaces (duplicate of packages/types)
│   └── data/
│       └── doctors/
│           └── maria-lopez.json   # Sample doctor data (may be outdated)
├── public/                        # Static assets
│   └── (static files)
├── .next/                         # Build output
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.mjs
```

### Key Files

**Pages**:
- `src/app/page.tsx` - Homepage
- `src/app/doctores/[slug]/page.tsx` - Doctor profile (SSR/ISR with 60s revalidation)
- `src/app/doctores/[slug]/blog/page.tsx` - Blog listing page
- `src/app/doctores/[slug]/blog/[articleSlug]/page.tsx` - Individual article

**SEO**:
- `src/app/sitemap.ts` - Generates dynamic sitemap.xml
- `src/app/robots.ts` - Generates robots.txt

**Data Fetching Pattern**:
- Fetches from API app (http://localhost:3003)
- Uses Next.js `fetch()` with ISR (revalidate: 60 or 3600)

### Dependencies

```json
{
  "dependencies": {
    "@healthcare/types": "workspace:*",
    "lucide-react": "^0.560.0",
    "next": "16.0.10",
    "react": "19.2.1"
  },
  "devDependencies": {
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

---

## App 2: Doctor Portal (`apps/doctor`)

**Package Name**: `@healthcare/doctor`
**Port**: 3001
**Purpose**: Doctor dashboard for managing blog and appointments

### Directory Structure

```
apps/doctor/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with SessionProvider
│   │   ├── page.tsx               # Redirect to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx           # Google OAuth login
│   │   ├── dashboard/
│   │   │   ├── page.tsx           # Dashboard home (profile overview)
│   │   │   └── blog/
│   │   │       ├── page.tsx       # Article list
│   │   │       ├── new/
│   │   │       │   └── page.tsx   # Create new article
│   │   │       └── [id]/
│   │   │           └── edit/
│   │   │               └── page.tsx  # Edit article
│   │   ├── appointments/
│   │   │   ├── page.tsx           # Appointment slots management
│   │   │   └── CreateSlotsModal.tsx  # Modal for creating slots
│   │   ├── providers/
│   │   │   └── SessionProvider.tsx   # NextAuth session provider
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts   # NextAuth route handler
│   ├── components/
│   │   └── blog/
│   │       └── RichTextEditor.tsx # Tiptap WYSIWYG editor
│   ├── lib/
│   │   └── auth.ts               # Auth helpers (generateToken)
│   └── middleware.ts             # NextAuth middleware for protected routes
├── .next/
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

### Key Features

**Blog Management**:
- `/dashboard/blog` - List articles (published + drafts)
- `/dashboard/blog/new` - Create article with rich text editor
- `/dashboard/blog/[id]/edit` - Edit existing article
- Supports draft/publish toggle
- Auto-generates slugs from title

**Rich Text Editor** (`RichTextEditor.tsx`):
- Built with Tiptap + Tiptap StarterKit
- Extensions: Bold, Italic, H2, H3, Lists, Links, Images, Undo/Redo
- Outputs HTML content
- Recently fixed: Infinite reload bug when editing

**Authentication**:
- Google OAuth via NextAuth
- Protected routes with middleware
- JWT tokens for API calls

### Dependencies

```json
{
  "dependencies": {
    "@healthcare/auth": "workspace:*",
    "@healthcare/database": "workspace:*",
    "@tiptap/react": "^3.14.0",
    "@tiptap/starter-kit": "^3.14.0",
    "@tiptap/extension-image": "^3.14.0",
    "@tiptap/extension-link": "^3.14.0",
    "@tiptap/extension-placeholder": "^3.14.0",
    "next-auth": "^5.0.0-beta.25",
    "lucide-react": "^0.560.0"
  }
}
```

---

## App 3: Admin Panel (`apps/admin`)

**Package Name**: `@healthcare/admin`
**Port**: 3002
**Purpose**: Admin dashboard for managing doctors, users, appointments

### Directory Structure

```
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Redirect to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx           # Google OAuth login
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Admin dashboard home
│   │   ├── doctors/
│   │   │   ├── page.tsx           # Doctor list
│   │   │   ├── new/
│   │   │   │   └── page.tsx       # 10-step wizard for creating doctor
│   │   │   └── [slug]/
│   │   │       └── edit/
│   │   │           └── page.tsx   # Edit doctor (reuses wizard)
│   │   ├── users/
│   │   │   └── page.tsx           # User management
│   │   ├── appointments/
│   │   │   └── page.tsx           # Appointment management
│   │   ├── providers/
│   │   │   └── SessionProvider.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       └── uploadthing/
│   │           ├── route.ts       # UploadThing route handler
│   │           └── core.ts        # UploadThing config
│   ├── components/
│   │   └── (various UI components)
│   ├── utils/
│   │   └── uploadthing.ts        # UploadThing client
│   └── middleware.ts             # Auth middleware
├── package.json
├── next.config.ts
└── tailwind.config.ts
```

### Key Features

**Doctor Creation Wizard** (`doctors/new/page.tsx`):
- 10-step form for creating comprehensive doctor profiles
- Steps:
  1. Basic Information
  2. Services
  3. Conditions & Procedures
  4. Biography
  5. Education
  6. Credentials
  7. Clinic Information
  8. FAQs
  9. Multimedia
  10. Review & Publish
- Client-side state management with useState
- SEO protection: Slug cannot be changed after creation

**File Upload**:
- Uses UploadThing for hero images, certificates, clinic photos
- Cloud CDN storage
- Image optimization

**User Management**:
- Create/edit/delete staff users (ADMIN or DOCTOR roles)
- Link users to doctor profiles

### Dependencies

```json
{
  "dependencies": {
    "@healthcare/auth": "workspace:*",
    "@healthcare/database": "workspace:*",
    "@uploadthing/react": "^7.3.3",
    "uploadthing": "^7.7.4",
    "next-auth": "^5.0.0-beta.25",
    "lucide-react": "^0.560.0"
  }
}
```

---

## App 4: API Backend (`apps/api`)

**Package Name**: `@healthcare/api`
**Port**: 3003
**Purpose**: Centralized REST API for all applications

### Directory Structure

```
apps/api/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── doctors/
│   │       │   ├── route.ts                     # GET/POST /api/doctors
│   │       │   └── [slug]/
│   │       │       ├── route.ts                 # GET/PUT/DELETE /api/doctors/[slug]
│   │       │       ├── articles/
│   │       │       │   ├── route.ts             # GET /api/doctors/[slug]/articles
│   │       │       │   └── [articleSlug]/
│   │       │       │       └── route.ts         # GET /api/doctors/[slug]/articles/[articleSlug]
│   │       │       └── availability/
│   │       │           └── route.ts             # (future)
│   │       ├── articles/
│   │       │   ├── route.ts                     # GET/POST /api/articles (doctor auth)
│   │       │   └── [id]/
│   │       │       └── route.ts                 # GET/PUT/DELETE /api/articles/[id]
│   │       ├── users/
│   │       │   ├── route.ts                     # GET/POST /api/users
│   │       │   └── [id]/
│   │       │       └── route.ts                 # PUT/DELETE /api/users/[id]
│   │       ├── appointments/
│   │       │   ├── slots/
│   │       │   │   ├── route.ts                 # GET/POST /api/appointments/slots
│   │       │   │   ├── [id]/
│   │       │   │   │   └── route.ts             # PUT/DELETE slot
│   │       │   │   └── bulk/
│   │       │   │       └── route.ts             # Bulk operations
│   │       │   └── bookings/
│   │       │       ├── route.ts                 # GET/POST bookings
│   │       │       └── [id]/
│   │       │           └── route.ts             # PUT/DELETE booking
│   │       └── auth/
│   │           └── user/
│   │               └── route.ts                 # POST /api/auth/user (OAuth callback)
│   ├── lib/
│   │   └── auth.ts                             # Auth helpers
│   └── middleware.ts                           # (if needed)
├── package.json
├── next.config.ts
└── tsconfig.json
```

### Authentication System

**File**: `src/lib/auth.ts`

```typescript
// Token validation (5-minute expiry)
validateAuthToken(request) → { email, role, userId }

// Role-based helpers
requireAdminAuth(request)
requireDoctorAuth(request)
requireStaffAuth(request)
getAuthenticatedDoctor(request) → { user, doctor }
```

**Token Format** (base64-encoded JSON):
```json
{
  "email": "user@example.com",
  "role": "ADMIN" | "DOCTOR",
  "timestamp": 1234567890
}
```

### API Endpoints Summary

See `API_REFERENCE.md` for complete details:

- **Doctors**: CRUD operations, public + admin
- **Articles**: Blog management (public read, doctor write)
- **Users**: Staff management (admin only)
- **Appointments**: Slot creation and booking
- **Auth**: OAuth user creation

### Dependencies

```json
{
  "dependencies": {
    "@healthcare/auth": "workspace:*",
    "@healthcare/database": "workspace:*",
    "@healthcare/types": "workspace:*",
    "next-auth": "^5.0.0-beta.25",
    "zod": "^4.2.0"  // Currently disabled
  }
}
```

---

## Package 1: Auth (`packages/auth`)

**Package Name**: `@healthcare/auth`
**Purpose**: Shared NextAuth configuration for admin and doctor apps

### Directory Structure

```
packages/auth/
├── src/
│   ├── index.ts                # Exports all auth functions
│   ├── nextauth-config.ts      # NextAuth v5 configuration
│   └── middleware.ts           # Auth middleware helpers
├── package.json
└── tsconfig.json
```

### Files

**`nextauth-config.ts`**:
- NextAuth v5 config with Google OAuth
- JWT strategy (30-day expiry)
- Callbacks: signIn, jwt, session
- Calls API to create/fetch user on login
- Attaches role and doctorId to JWT token

**`middleware.ts`**:
- Helper functions for route protection
- `requireAuth()`, `requireAdmin()`, `requireDoctor()`

**Exports**:
```typescript
export { authConfig, handlers, auth, signIn, signOut } from "./nextauth-config";
export { requireAuth, requireAdmin, requireDoctor } from "./middleware";
```

### Dependencies

```json
{
  "peerDependencies": {
    "next-auth": "^5.0.0-beta.25"
  }
}
```

---

## Package 2: Database (`packages/database`)

**Package Name**: `@healthcare/database`
**Purpose**: Prisma ORM and database access layer

### Directory Structure

```
packages/database/
├── src/
│   └── index.ts                # Exports Prisma client singleton
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Database seeding script
│   └── migrations/
│       └── 20251229002458_add_article_model_for_blog/
│           └── migration.sql
├── package.json
└── tsconfig.json
```

### Files

**`schema.prisma`**:
- PostgreSQL database
- 10 models: User, Doctor, Article, Service, Education, Certificate, CarouselItem, FAQ, AppointmentSlot, Booking
- See `DATABASE_SCHEMA.md` for complete documentation

**`src/index.ts`**:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Scripts**:
```json
{
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:migrate": "prisma migrate dev",
  "db:seed": "tsx prisma/seed.ts",
  "db:studio": "prisma studio"
}
```

### Dependencies

```json
{
  "dependencies": {
    "@prisma/client": "^6.2.1",
    "prisma": "^6.2.1"
  }
}
```

---

## Package 3: Types (`packages/types`)

**Package Name**: `@healthcare/types`
**Purpose**: Shared TypeScript interfaces

### Directory Structure

```
packages/types/
├── src/
│   ├── index.ts                # Exports all types
│   └── doctor.ts               # Doctor-related types
├── package.json
└── tsconfig.json
```

### Files

**`doctor.ts`**:
```typescript
export interface Service { /* ... */ }
export interface Education { /* ... */ }
export interface Credential { /* ... */ }
export interface FAQ { /* ... */ }
export interface CarouselItem { /* ... */ }
export interface ClinicInfo { /* ... */ }
export interface DoctorProfile { /* ... */ }

// Also exports createDoctorSchema (Zod - currently unused)
```

**Purpose**:
- Type safety across all apps
- Validation schemas (Zod)
- Consistent data structures

### Dependencies

```json
{
  "dependencies": {
    "zod": "^4.2.0"
  }
}
```

---

## Configuration Files

### Next.js Configuration

All apps use similar Next.js configs:

```typescript
// next.config.ts (apps/*)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@healthcare/auth", "@healthcare/database", "@healthcare/types"],
  images: {
    domains: ["utfs.io"], // UploadThing
  },
};

export default nextConfig;
```

### Tailwind Configuration

Apps with Tailwind (public, doctor, admin):

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

### TypeScript Configuration

**Root `tsconfig.json`**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@healthcare/*": ["packages/*/src"]
    }
  }
}
```

**App/Package tsconfig.json**:
- Extends from base config
- Sets up module resolution
- Configures JSX and Next.js types

---

## Environment Variables

### Required Variables

**.env (root or each app)**:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# NextAuth
NEXTAUTH_SECRET="random-secret-string"
NEXTAUTH_URL="http://localhost:3001"  # or :3002 for admin

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# API URL
NEXT_PUBLIC_API_URL="http://localhost:3003"

# UploadThing (admin app only)
UPLOADTHING_SECRET="..."
UPLOADTHING_APP_ID="..."
```

---

## Build Output Directories

All apps generate build artifacts in `.next/` directory:

```
apps/*/
└── .next/
    ├── dev/                 # Development build
    │   ├── build/
    │   ├── server/
    │   ├── static/
    │   └── cache/
    └── (production build artifacts)
```

**Note**: `.next/` directories are gitignored

---

## Git Repository

**Current Branch**: main
**Recent Commits**:
- "Fix infinite reload: only update editor on initial content load"
- "Fix TypeScript error: use correct setContent options object"
- "Fix edit page: fetch single article with full content + prevent infinite reload"
- "Fix editor not updating when content prop changes"

**Modified Files** (uncommitted):
- `packages/database/prisma/migrations/20251229002458_add_article_model_for_blog/migration.sql`

---

## File Count Estimate

| Directory | Est. Files |
|-----------|------------|
| `apps/public` | ~30 source files |
| `apps/doctor` | ~15 source files |
| `apps/admin` | ~20 source files |
| `apps/api` | ~20 source files |
| `packages/auth` | ~3 source files |
| `packages/database` | ~3 source + schema |
| `packages/types` | ~2 source files |
| **Total Source** | **~95 TypeScript/TSX files** |

---

## Important File Locations

### Entry Points

- **Public Homepage**: `apps/public/src/app/page.tsx`
- **Doctor Dashboard**: `apps/doctor/src/app/dashboard/page.tsx`
- **Admin Dashboard**: `apps/admin/src/app/dashboard/page.tsx`
- **API Root**: `apps/api/src/app/api/` (no single entry point)

### Configuration

- **Database Schema**: `packages/database/prisma/schema.prisma`
- **NextAuth Config**: `packages/auth/src/nextauth-config.ts`
- **API Auth Helpers**: `apps/api/src/lib/auth.ts`

### Key Components

- **Rich Text Editor**: `apps/doctor/src/components/blog/RichTextEditor.tsx`
- **Doctor Profile**: `apps/public/src/components/doctor/*.tsx` (10+ components)
- **10-Step Wizard**: `apps/admin/src/app/doctors/new/page.tsx`

---

## Documentation Files

**Existing** (may be outdated):
- `PROJECT_ARCHITECTURE.md`
- `BLOG_FEATURE_SPECIFICATION.md`
- `AUTH_IMPLEMENTATION_GUIDE.md`
- `DOCTOR_EDIT_FEATURE_IMPLEMENTATION.md`
- `SEO_GUIDE.md`
- `SEO_GUIDE2.md`
- `RAILWAY_DEPLOYMENT_FIX_LOG.md`
- `DESIGN_GUIDE.md`

**New** (generated from code):
- `DATABASE_SCHEMA.md` ✅
- `API_REFERENCE.md` ✅
- `CODEBASE_MAP.md` ✅ (this file)
- `COMPONENT_INVENTORY.md` (pending)
- `LLM_CONTEXT.md` (pending)

---

**End of Codebase Map**
