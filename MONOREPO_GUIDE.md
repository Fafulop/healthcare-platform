# Monorepo Architecture Guide

## Overview

This document describes the Turborepo + pnpm monorepo architecture for the healthcare platform with 4 apps (public, doctor, admin, API) and 6 shared packages.

---

## Architecture Goals

Transform a single Next.js app into a modular, scalable multi-tenant platform:
- ✅ **Modularity**: Shared code across apps (types, components, utilities)
- ✅ **Scalability**: Independent deployment of each app
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **Type Safety**: End-to-end TypeScript
- ✅ **Developer Experience**: Fast builds, hot reload, unified tooling

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Monorepo** | Turborepo + pnpm workspaces | Latest |
| **Frontends** | Next.js (App Router) | 16.0.8 |
| **Backend** | Next.js API Routes | 16.0.8 |
| **Database** | PostgreSQL + Prisma ORM | Latest |
| **UI** | Tailwind CSS + shared components | 4.x |
| **Auth** | NextAuth.js | Latest |
| **Language** | TypeScript | 5.x |

---

## Monorepo Structure

```
docs-front/
├── apps/                      # Applications
│   ├── public/               # Patient-facing website (Port 3000)
│   ├── doctor/               # Doctor portal (Port 3001)
│   ├── admin/                # Admin panel (Port 3002)
│   └── api/                  # Centralized backend API (Port 3003) ⭐
│
├── packages/                 # Shared packages
│   ├── ui/                   # React component library
│   ├── types/                # TypeScript type definitions
│   ├── database/             # Prisma schema + client
│   ├── utils/                # Utilities (SEO, formatting)
│   ├── config/               # Shared configs (Tailwind, ESLint)
│   └── auth/                 # NextAuth configuration
│
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # PNPM workspace definition
├── package.json              # Root workspace scripts
├── .gitignore                # Monorepo patterns
└── README.md                 # Getting started guide
```

---

## Applications

### 1. apps/public - Public Website (Patient-Facing)

**Port:** 3000
**Purpose:** Patient-facing doctor profiles, search, booking
**Access:** Public (no auth required)

**Key Features:**
- Doctor profile pages with SEO optimization
- JSON-LD structured data (Physician, MedicalBusiness, FAQPage schemas)
- Server-side rendering for SEO
- Doctor search & filtering (future)
- Appointment booking flow (future)

**Technology:**
- Next.js 16 with App Router
- Tailwind CSS 4
- Lucide React icons
- Imports from `@healthcare/*` packages

**URLs:**
- `/` - Homepage
- `/doctors/[slug]` - Doctor profile pages
- `/search` - Doctor search (future)
- `/appointments` - Booking flow (future)

---

### 2. apps/doctor - Doctor Portal

**Port:** 3001
**Purpose:** Doctor dashboard to manage profiles, appointments, patients
**Access:** Authenticated (doctor role only)

**MVP Features:**
- Login page (NextAuth)
- Dashboard showing doctor's own profile
- Placeholder pages for future features

**Future Features:**
- Profile editor (reuse wizard from admin)
- Appointment management (view, confirm, cancel)
- Patient records viewer
- Schedule/availability manager
- Analytics dashboard

**Technology:**
- Next.js 16 with App Router
- NextAuth.js for authentication
- API client (calls apps/api)
- Imports from `@healthcare/*` packages

**URLs:**
- `/` - Dashboard
- `/login` - Login page
- `/profile` - Profile editor (future)
- `/appointments` - Appointments (future)
- `/patients` - Patient records (future)

---

### 3. apps/admin - Admin Panel

**Port:** 3002
**Purpose:** Platform management for admins
**Access:** Authenticated (admin role only)

**MVP Features:**
- Admin login (NextAuth with role check)
- Dashboard showing list of doctors
- **Doctor Profile Creation Wizard** (10-step form) ⭐

**Future Features:**
- Doctor editing (reuse creation wizard)
- Doctor deletion (soft delete)
- Platform analytics (charts, metrics)
- Patient management
- Platform settings (specialties, locations, pricing)

**Technology:**
- Next.js 16 with App Router
- NextAuth.js with role-based access
- API client (calls apps/api)
- Wizard components for profile creation
- Imports from `@healthcare/*` packages

**URLs:**
- `/` - Admin dashboard
- `/login` - Admin login
- `/doctors` - Doctor list
- `/doctors/new` - **Create doctor wizard** ⭐
- `/doctors/[id]/edit` - Edit doctor (future)
- `/analytics` - Analytics (future)
- `/settings` - Settings (future)

---

### 4. apps/api - Centralized Backend API ⭐

**Port:** 3003
**Purpose:** Single backend API for all frontends
**Access:** CORS-enabled for all apps + auth middleware

**Why Centralized:**
- Single source of truth for business logic
- Centralized authentication, rate limiting, caching
- Easier to scale independently
- Clear API boundaries between frontend/backend

**API Endpoints (MVP):**
```
GET    /api/doctors              # List all doctors
GET    /api/doctors/:id          # Get doctor by ID
POST   /api/doctors              # Create doctor (admin only) ⭐
PUT    /api/doctors/:id          # Update doctor (auth required)
DELETE /api/doctors/:id          # Delete doctor (admin only)

POST   /api/appointments         # Create appointment
GET    /api/appointments         # List appointments (auth required)
GET    /api/appointments/:id     # Get appointment

GET    /api/patients             # List patients (admin only)
GET    /api/patients/:id         # Get patient

POST   /api/upload               # Upload images/certificates ⭐

POST   /api/auth/[...nextauth]   # NextAuth endpoints
```

**Technology:**
- Next.js 16 (API routes only, no UI)
- Prisma Client for database access
- NextAuth.js for authentication
- CORS middleware
- Role-based authorization

**File Structure:**
```
apps/api/src/app/api/
├── doctors/
│   ├── route.ts              # List/create doctors
│   └── [id]/
│       ├── route.ts          # CRUD single doctor
│       └── appointments/
│           └── route.ts      # Doctor's appointments
├── appointments/
│   ├── route.ts              # List/create appointments
│   └── [id]/route.ts         # CRUD single appointment
├── patients/
│   ├── route.ts              # List patients
│   └── [id]/route.ts         # CRUD single patient
├── auth/
│   └── [...nextauth]/route.ts # NextAuth
├── upload/
│   └── route.ts              # File uploads ⭐
└── analytics/
    └── route.ts              # Analytics data (admin only)
```

---

## Shared Packages

### 1. packages/ui - Component Library

**Purpose:** Shared React components with Tailwind CSS
**Package Name:** `@healthcare/ui`

**Contents:**
```
packages/ui/src/
├── button/
│   ├── Button.tsx            # Primary, secondary, tertiary variants
│   └── index.ts
├── card/
│   ├── Card.tsx              # Container with shadow/padding
│   └── index.ts
├── badge/
│   ├── Badge.tsx             # Status badges
│   └── index.ts
├── forms/
│   ├── Input.tsx             # Form input component
│   ├── Select.tsx            # Select dropdown
│   └── index.ts
├── doctor/                   # Domain-specific components
│   ├── HeroSection.tsx       # Doctor intro (circular photo)
│   ├── BiographySection.tsx  # Biography with read more
│   ├── ServicesSection.tsx   # Services grid
│   ├── CredentialsSection.tsx# Certificate carousel
│   └── index.ts
├── styles/
│   ├── design-tokens.css     # CSS custom properties
│   └── globals.css           # Base styles
└── index.ts                  # Main export
```

**Usage:**
```typescript
// In apps/public, apps/doctor, or apps/admin
import { Button, Card, Badge } from '@healthcare/ui';
import { HeroSection, BiographySection } from '@healthcare/ui/doctor';
```

**Design System:**
- Color palette: Warm Yellow (#FFEC1A) + Deep Green (#1D5B63)
- Inter font family
- 8px spacing base unit
- Border radius: small, medium, large, pill
- Box shadows: light, medium

---

### 2. packages/types - Type Definitions

**Purpose:** Shared TypeScript interfaces
**Package Name:** `@healthcare/types`

**Contents:**
```typescript
// packages/types/src/doctor.ts
export interface DoctorProfile {
  id: string;
  slug: string;
  doctor_full_name: string;
  primary_specialty: string;
  subspecialties: string[];
  services_list: Service[];
  // ... all other fields
}

export interface Service {
  service_name: string;
  short_description: string;
  duration_minutes: number;
  price_usd?: number;
}

// packages/types/src/appointment.ts
export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date;
  mode: 'IN_PERSON' | 'TELECONSULT';
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}
```

**Usage:**
```typescript
import type { DoctorProfile, Appointment } from '@healthcare/types';
```

---

### 3. packages/database - Prisma Schema & Client

**Purpose:** Single source of truth for database schema
**Package Name:** `@healthcare/database`

**Contents:**
```
packages/database/
├── prisma/
│   ├── schema.prisma         # Database schema
│   ├── migrations/           # Migration history
│   └── seed.ts               # Seed data
├── src/
│   ├── client.ts             # Prisma client singleton
│   ├── seed.ts               # Seed script
│   └── index.ts
└── package.json
```

**Prisma Schema:**
```prisma
// packages/database/prisma/schema.prisma
model Doctor {
  id                String   @id @default(cuid())
  slug              String   @unique
  doctorFullName    String
  primarySpecialty  String
  services          Service[]
  appointments      Appointment[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("doctors")
}

model Patient {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  appointments  Appointment[]

  @@map("patients")
}

model Appointment {
  id          String   @id @default(cuid())
  doctorId    String
  patientId   String
  doctor      Doctor   @relation(fields: [doctorId], references: [id])
  patient     Patient  @relation(fields: [patientId], references: [id])
  scheduledAt DateTime
  mode        AppointmentMode
  status      AppointmentStatus @default(PENDING)

  @@map("appointments")
}
```

**Usage:**
```typescript
// Only in apps/api (centralized database access)
import { prisma } from '@healthcare/database';

const doctors = await prisma.doctor.findMany();
```

---

### 4. packages/utils - Utility Functions

**Purpose:** Shared business logic and helpers
**Package Name:** `@healthcare/utils`

**Contents:**
```
packages/utils/src/
├── seo/
│   ├── metadata.ts           # Meta tag generation
│   └── structured-data.ts    # JSON-LD schemas
├── validation/
│   ├── doctor.ts             # Doctor validation
│   └── appointment.ts        # Appointment validation
├── formatting/
│   ├── date.ts               # Date formatting
│   ├── currency.ts           # Currency formatting
│   └── phone.ts              # Phone formatting
└── index.ts
```

**Usage:**
```typescript
import { generateDoctorMetadata, generatePhysicianSchema } from '@healthcare/utils/seo';
import { formatCurrency, formatPhoneNumber } from '@healthcare/utils/formatting';
```

---

### 5. packages/config - Shared Configuration

**Purpose:** Tailwind, ESLint, TypeScript configs
**Package Name:** `@healthcare/config`

**Contents:**
```
packages/config/src/
├── tailwind/
│   └── base.ts               # Base Tailwind preset
├── eslint/
│   └── base.js               # ESLint config
└── typescript/
    └── base.json             # Base tsconfig
```

**Usage in apps:**
```javascript
// apps/public/tailwind.config.ts
import { baseTailwindConfig } from '@healthcare/config/tailwind';

export default {
  ...baseTailwindConfig,
  content: ['./src/**/*.{ts,tsx}'],
};
```

---

### 6. packages/auth - Authentication

**Purpose:** NextAuth.js configuration
**Package Name:** `@healthcare/auth`

**Contents:**
```
packages/auth/src/
├── next-auth/
│   ├── config.ts             # NextAuth options
│   └── providers.ts          # OAuth providers
├── middleware/
│   └── auth-guard.ts         # Auth middleware
└── index.ts
```

**Usage:**
```typescript
import { authOptions } from '@healthcare/auth';
import { getServerSession } from 'next-auth';

const session = await getServerSession(authOptions);
```

---

## Communication Flow

### Architecture Diagram

```
┌─────────────────┐
│ apps/public     │
│ (Port 3000)     │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │    ┌──────────────────┐      ┌─────────────────┐
│ apps/doctor     │  │    │   apps/api       │      │ PostgreSQL DB   │
│ (Port 3001)     │──┼───→│   (Port 3003)    │─────→│                 │
└─────────────────┘  │    │                  │      │ - doctors       │
                     │    │ API Routes:      │      │ - appointments  │
┌─────────────────┐  │    │ /api/doctors     │      │ - patients      │
│ apps/admin      │  │    │ /api/appointments│      │ - users         │
│ (Port 3002)     │──┘    │ /api/patients    │      └─────────────────┘
└─────────────────┘       │ /api/auth        │
                          │ /api/upload      │
                          └──────────────────┘
```

### Data Flow

1. **Frontends → API:**
   ```typescript
   // apps/public/src/lib/api-client.ts
   const response = await fetch('http://localhost:3003/api/doctors');
   const doctors = await response.json();
   ```

2. **API → Database:**
   ```typescript
   // apps/api/src/app/api/doctors/route.ts
   import { prisma } from '@healthcare/database';

   export async function GET() {
     const doctors = await prisma.doctor.findMany();
     return Response.json(doctors);
   }
   ```

3. **API → Frontends:**
   ```json
   {
     "id": "clx123",
     "slug": "maria-lopez",
     "doctor_full_name": "Dr. María López Hernández"
   }
   ```

---

## Development Workflow

### Initial Setup

```bash
# Install pnpm globally (if not installed)
npm install -g pnpm

# Clone repository
git clone <repo-url>
cd docs-front

# Install all dependencies (monorepo-wide)
pnpm install

# Generate Prisma client
pnpm db:generate

# Set up database
pnpm db:migrate

# Seed database with sample data
pnpm db:seed
```

### Running Apps

```bash
# Start all apps simultaneously (4 servers)
pnpm dev

# Start specific app
pnpm dev:api      # Port 3003 - Backend API (start this first)
pnpm dev:public   # Port 3000 - Public website
pnpm dev:doctor   # Port 3001 - Doctor portal
pnpm dev:admin    # Port 3002 - Admin panel

# Build all apps for production
pnpm build

# Build specific app
pnpm build:public
```

### Development Commands

```bash
# Type checking across all packages
pnpm type-check

# Linting across all packages
pnpm lint

# Run tests across all packages
pnpm test

# Clean all build artifacts
pnpm clean

# Format code with Prettier
pnpm format
```

### Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (dev)
pnpm db:push

# Create migration
pnpm db:migrate

# Deploy migrations (production)
pnpm db:migrate:deploy

# Seed database
pnpm db:seed

# Open Prisma Studio (database GUI)
pnpm db:studio
```

---

## Configuration Files

### turbo.json - Turborepo Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "type-check": {
      "dependsOn": ["^type-check"]
    },
    "db:generate": {
      "cache": false,
      "outputs": ["node_modules/.prisma/**"]
    }
  }
}
```

### pnpm-workspace.yaml - Workspace Definition

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root package.json - Workspace Scripts

```json
{
  "name": "healthcare-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo run dev",
    "dev:api": "turbo run dev --filter=@healthcare/api",
    "dev:public": "turbo run dev --filter=@healthcare/public",
    "dev:doctor": "turbo run dev --filter=@healthcare/doctor",
    "dev:admin": "turbo run dev --filter=@healthcare/admin",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "db:generate": "turbo run db:generate --filter=@healthcare/database",
    "db:migrate": "turbo run db:migrate --filter=@healthcare/database",
    "db:seed": "turbo run db:seed --filter=@healthcare/database",
    "db:studio": "turbo run db:studio --filter=@healthcare/database"
  }
}
```

---

## Environment Variables

### .env.example

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/healthcare"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-min-32-chars"

# OAuth Providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Base URLs for each app
NEXT_PUBLIC_PUBLIC_URL="http://localhost:3000"
NEXT_PUBLIC_DOCTOR_URL="http://localhost:3001"
NEXT_PUBLIC_ADMIN_URL="http://localhost:3002"
NEXT_PUBLIC_API_URL="http://localhost:3003"

# File Upload
UPLOADTHING_TOKEN=""
UPLOAD_MAX_SIZE=10485760  # 10MB

# Email (future)
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
```

### App-Specific .env Files

Each app can have its own `.env.local` file:
- `apps/public/.env.local` - Public website vars
- `apps/doctor/.env.local` - Doctor portal vars
- `apps/admin/.env.local` - Admin panel vars
- `apps/api/.env.local` - API vars

---

## Deployment

### Vercel (Recommended)

**Step 1:** Create separate Vercel projects for each app

| App | Project Name | Root Directory | Build Command |
|-----|--------------|----------------|---------------|
| Public | `healthcare-public` | `apps/public` | `cd ../.. && pnpm turbo run build --filter=@healthcare/public` |
| Doctor | `healthcare-doctor` | `apps/doctor` | `cd ../.. && pnpm turbo run build --filter=@healthcare/doctor` |
| Admin | `healthcare-admin` | `apps/admin` | `cd ../.. && pnpm turbo run build --filter=@healthcare/admin` |
| API | `healthcare-api` | `apps/api` | `cd ../.. && pnpm turbo run build --filter=@healthcare/api` |

**Step 2:** Configure environment variables in Vercel dashboard

**Step 3:** Deploy each app independently

### Docker (Alternative)

```dockerfile
# Multi-stage build example for apps/public
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo
WORKDIR /app

FROM base AS pruner
COPY . .
RUN turbo prune --scope=@healthcare/public --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@healthcare/public

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/public/.next/standalone ./
COPY --from=builder /app/apps/public/.next/static ./apps/public/.next/static
EXPOSE 3000
CMD ["node", "apps/public/server.js"]
```

---

## Migration from Single App

### Before Migration

```
docs-front/
├── frontend/          # Current single Next.js app
├── DESIGN_GUIDE.md
├── SEO_GUIDE.md
└── WIZARD_GUIDE.md
```

### After Migration

```
docs-front/
├── apps/
│   ├── public/        # Moved from frontend/
│   ├── doctor/        # New
│   ├── admin/         # New
│   └── api/           # New
├── packages/          # New (extracted from frontend/)
│   ├── ui/
│   ├── types/
│   ├── database/
│   ├── utils/
│   ├── config/
│   └── auth/
├── turbo.json         # New
├── pnpm-workspace.yaml # New
├── DESIGN_GUIDE.md
├── SEO_GUIDE.md
├── WIZARD_GUIDE.md
└── MONOREPO_GUIDE.md  # This file
```

### Migration Steps Summary

1. **Phase 1:** Initialize Turborepo (30 min)
2. **Phase 2:** Move `frontend/` → `apps/public/` (15 min)
3. **Phase 3:** Extract shared packages (2 hours)
4. **Phase 4:** Update imports in apps/public (1 hour)
5. **Phase 5:** Create apps/api backend (1 hour)
6. **Phase 6:** Create apps/doctor + apps/admin + wizard (3 hours)
7. **Phase 7:** Set up database (1 hour)
8. **Phase 8:** Set up authentication (1 hour)
9. **Phase 9:** Testing & verification (1 hour)

**Total:** ~10.5 hours

---

## Best Practices

### 1. Package Boundaries
- **Never** import from `apps/*` in `packages/*`
- **Always** import shared code from `@healthcare/*` packages
- **Only** `apps/api` should import from `@healthcare/database`

### 2. Versioning
- Use `workspace:*` protocol for internal dependencies
- Pin external dependencies to specific versions
- Update dependencies across all apps simultaneously

### 3. Code Sharing
- **UI components** → `@healthcare/ui`
- **Types** → `@healthcare/types`
- **Business logic** → `@healthcare/utils`
- **Configs** → `@healthcare/config`

### 4. Testing
- Write tests for shared packages
- Test apps independently
- Integration tests across API + frontends

### 5. Git Workflow
- Commit changes to multiple packages atomically
- Use conventional commits
- Tag releases with app names

---

## Troubleshooting

### Issue: Package not found

```bash
# Solution: Reinstall dependencies
pnpm install
```

### Issue: Prisma client not generated

```bash
# Solution: Generate Prisma client
pnpm db:generate
```

### Issue: Port already in use

```bash
# Solution: Kill process on port (Windows)
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Solution: Kill process on port (Mac/Linux)
lsof -i :3000
kill -9 <pid>
```

### Issue: Type errors after package update

```bash
# Solution: Clear cache and rebuild
pnpm clean
pnpm install
pnpm type-check
```

---

## Success Criteria

MVP is complete when:
- [ ] All 4 apps run simultaneously without errors
- [ ] Shared packages resolve correctly
- [ ] API endpoints work (CRUD operations)
- [ ] Frontends can call API successfully
- [ ] Database operations work (Prisma CRUD)
- [ ] Authentication works with role-based access
- [ ] Type checking passes (`pnpm type-check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Public app shows doctor profiles from database
- [ ] Doctor app shows basic dashboard
- [ ] Admin app has working profile creation wizard
- [ ] Wizard creates doctor with all 10 sections
- [ ] Created doctor appears on public website with SEO optimization

---

## Future Enhancements

### Phase 2
- Doctor profile editing (reuse wizard)
- Appointment booking flow
- Patient management interface
- Email notifications
- File upload to S3/CDN

### Phase 3
- Platform analytics dashboard
- Multi-language support (Spanish/English)
- Reviews & ratings system
- Doctor search with filters
- Advanced admin features

---

## Resources

- **Turborepo Docs:** https://turbo.build/repo/docs
- **pnpm Workspaces:** https://pnpm.io/workspaces
- **Next.js App Router:** https://nextjs.org/docs
- **Prisma ORM:** https://www.prisma.io/docs
- **NextAuth.js:** https://next-auth.js.org/

---

## Summary

This monorepo architecture provides:
- ✅ **Modularity** - Shared code across all apps
- ✅ **Scalability** - Independent deployment
- ✅ **Type Safety** - End-to-end TypeScript
- ✅ **Developer Experience** - Fast builds, unified tooling
- ✅ **Maintainability** - Clear separation of concerns

The platform is ready to scale from MVP to production with proper structure, testing, and deployment workflows in place.
