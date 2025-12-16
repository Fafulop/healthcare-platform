# Healthcare Platform - Project Architecture

## Overview

This is a monorepo healthcare platform built with Next.js 16, featuring a multi-application architecture for managing and displaying doctor profiles. The platform is organized into 4 independent Next.js applications that communicate via REST API.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Applications](#applications)
  - [Public App](#1-public-app-port-3000)
  - [Admin Panel](#2-admin-panel-port-3002)
  - [Doctor Portal](#3-doctor-portal-port-3001)
  - [API Backend](#4-api-backend-port-3003)
- [Shared Packages](#shared-packages)
- [Technology Stack](#technology-stack)
- [Authentication & Authorization](#authentication--authorization)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [File Upload System](#file-upload-system)
- [Development Setup](#development-setup)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Monorepo Structure                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Public     │  │    Admin     │  │   Doctor     │      │
│  │  (Port 3000) │  │ (Port 3002)  │  │ (Port 3001)  │      │
│  │              │  │              │  │              │      │
│  │   Next.js    │  │   Next.js    │  │   Next.js    │      │
│  │   SSR/ISR    │  │     SPA      │  │     SPA      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                           │                                 │
│                           ▼                                 │
│                  ┌──────────────────┐                       │
│                  │   API Backend    │                       │
│                  │   (Port 3003)    │                       │
│                  │                  │                       │
│                  │  REST API Layer  │                       │
│                  │  + CORS Enabled  │                       │
│                  └────────┬─────────┘                       │
│                           │                                 │
│                           ▼                                 │
│                  ┌──────────────────┐                       │
│                  │  Prisma ORM      │                       │
│                  │  Database Layer  │                       │
│                  └────────┬─────────┘                       │
│                           │                                 │
│                           ▼                                 │
│                  ┌──────────────────┐                       │
│                  │   PostgreSQL DB  │                       │
│                  │   (Production)   │                       │
│                  └──────────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Applications

### 1. Public App (Port 3000)

**Purpose**: Public-facing website for displaying doctor profiles with SEO optimization.

#### Features
- **Dynamic Doctor Profiles** at `/doctors/[slug]`
- **Static Site Generation (ISR)** with 60-second revalidation
- **SEO-Optimized** content structure
- **Responsive Design** with mobile-first approach

#### Page Structure

```
/doctors/[slug]
├── Hero Section (Name, Specialty, Image, CTA)
├── Quick Navigation Menu
├── Media Carousel (Videos & Photos)
├── Services Section
├── Conditions & Procedures Treated
├── Biography Section
├── Clinic Location & Hours
├── Education & Training
├── Credentials & Certificates
└── FAQ Section

Sidebar (Desktop Only):
├── Appointment Calendar
└── Contact Information
```

#### Tech Stack
- Next.js 16.0.8 (App Router)
- React 19.2.1
- Tailwind CSS 4
- Lucide React (Icons)

#### Key Files
```
apps/public/
├── src/
│   ├── app/
│   │   ├── doctors/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx          # Main profile page
│   │   │       ├── layout.tsx        # SEO metadata
│   │   │       └── not-found.tsx     # 404 handler
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # Homepage
│   ├── components/
│   │   ├── doctor/                   # Profile sections
│   │   └── ui/                       # Reusable UI components
│   ├── lib/
│   │   ├── data.ts                   # API data fetching
│   │   ├── seo.ts                    # SEO utilities
│   │   └── structured-data.ts        # Schema.org markup
│   └── types/
│       └── doctor.ts                 # TypeScript types
└── package.json
```

#### Data Fetching

```typescript
// apps/public/src/lib/data.ts
export async function getDoctorBySlug(slug: string): Promise<DoctorProfile | null> {
  const response = await fetch(`${API_URL}/api/doctors/${slug}`, {
    next: { revalidate: 60 }, // ISR with 60s revalidation
  });
  // Transform and return data
}
```

---

### 2. Admin Panel (Port 3002)

**Purpose**: Administrative interface for creating and managing doctor profiles.

#### Features
- **10-Step Doctor Creation Wizard**
- **File Upload** via UploadThing (images, certificates, videos)
- **User Management**
- **Doctor Listing**
- **Role-Based Access** (ADMIN only)

#### Wizard Steps

1. **Basic Information**
   - Full Name, Last Name
   - Slug (auto-generated)
   - Primary Specialty
   - Professional License (Cédula)
   - City
   - Hero Image Upload

2. **Services**
   - Service Name
   - Description
   - Duration (minutes)
   - Price (USD)
   - Multiple services supported

3. **Conditions & Procedures**
   - Conditions Treated (newline-separated)
   - Procedures Performed (newline-separated)

4. **Biography**
   - Short Bio (max 300 chars)
   - Long Bio (detailed)
   - Years of Experience

5. **Education**
   - Institution
   - Program/Degree
   - Year
   - Notes
   - Multiple entries supported

6. **Credentials**
   - Certificate Images Upload
   - Issued By
   - Year
   - Description

7. **Clinic Information**
   - Address
   - Phone Number
   - WhatsApp Number
   - Hours (predefined defaults)

8. **FAQs**
   - Question
   - Answer
   - Multiple FAQs supported

9. **Multimedia**
   - Clinic Photos Upload
   - Videos Upload
   - Captions

10. **Review & Publish**
    - Summary of all data
    - Final submission

#### Tech Stack
- Next.js 16.0.8
- NextAuth 5.0.0-beta.25
- UploadThing 7.7.4
- Tailwind CSS 4
- Lucide React

#### Key Files
```
apps/admin/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts    # NextAuth handler
│   │   │   └── uploadthing/
│   │   │       ├── core.ts                    # Upload endpoints
│   │   │       └── route.ts                   # Upload handler
│   │   ├── doctors/
│   │   │   ├── new/
│   │   │   │   └── page.tsx                   # 10-step wizard
│   │   │   └── page.tsx                       # Doctor listing
│   │   ├── users/
│   │   │   └── page.tsx                       # User management
│   │   ├── dashboard/
│   │   │   └── page.tsx                       # Admin dashboard
│   │   ├── login/
│   │   │   └── page.tsx                       # Login page
│   │   ├── layout.tsx                         # Root layout
│   │   └── page.tsx                           # Redirect to dashboard
│   ├── components/
│   │   └── Navbar.tsx
│   ├── middleware.ts                          # Auth middleware
│   └── utils/
│       └── uploadthing.ts                     # Upload config
└── package.json
```

#### Upload Endpoints

```typescript
// apps/admin/src/app/api/uploadthing/core.ts
export const ourFileRouter = {
  doctorHeroImage: f({ image: { maxFileSize: "4MB" } }),
  doctorCertificates: f({ image: { maxFileSize: "4MB", maxFileCount: 10 } }),
  clinicPhotos: f({ image: { maxFileSize: "4MB", maxFileCount: 20 } }),
  doctorVideos: f({ video: { maxFileSize: "32MB", maxFileCount: 5 } }),
};
```

#### Submission Flow

```typescript
// apps/admin/src/app/doctors/new/page.tsx
const handleSubmit = async () => {
  const response = await fetch("http://localhost:3003/api/doctors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(formData),
  });

  // On success: redirect to dashboard and open public profile
};
```

---

### 3. Doctor Portal (Port 3001)

**Purpose**: Portal for doctors to view and manage their profiles.

#### Features
- **Dashboard** with profile summary
- **View Public Profile** link
- **Session Management**
- **Role-Based Access** (DOCTOR only)

#### Dashboard Components
- User profile display (name, email, avatar)
- Doctor profile card:
  - Hero image
  - Full name
  - Specialty & city
  - Short bio
  - Years of experience
  - Contact information
- Link to public profile page
- Logout button

#### Tech Stack
- Next.js 16.0.8
- NextAuth 5.0.0-beta.25
- Tailwind CSS 4
- Lucide React

#### Key Files
```
apps/doctor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── auth/[...nextauth]/route.ts    # NextAuth handler
│   │   ├── dashboard/
│   │   │   └── page.tsx                       # Main dashboard
│   │   ├── login/
│   │   │   └── page.tsx                       # Login page
│   │   ├── providers/
│   │   │   └── SessionProvider.tsx            # NextAuth provider
│   │   ├── layout.tsx
│   │   └── page.tsx                           # Redirect to dashboard
│   └── middleware.ts                          # Auth middleware
└── package.json
```

#### Profile Fetching

```typescript
// apps/doctor/src/app/dashboard/page.tsx
const fetchDoctorProfile = async (doctorId: string) => {
  const response = await fetch(`http://localhost:3003/api/doctors`);
  const result = await response.json();

  const doctor = result.data.find((d: any) => d.id === doctorId);
  setDoctorProfile(doctor);
};
```

---

### 4. API Backend (Port 3003)

**Purpose**: REST API layer for all data operations.

#### Endpoints

**Doctors**
- `GET /api/doctors` - List all doctors with relations
- `POST /api/doctors` - Create new doctor (admin only)
- `GET /api/doctors/[slug]` - Get doctor by slug
- `PUT /api/doctors/[slug]` - Update doctor (TODO)
- `DELETE /api/doctors/[slug]` - Delete doctor (TODO)

**Users**
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user by ID
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user

#### Tech Stack
- Next.js 16.0.8
- Prisma ORM
- Zod 4.2.0 (validation - currently disabled)

#### Key Files
```
apps/api/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── doctors/
│   │   │   │   ├── route.ts              # GET, POST /api/doctors
│   │   │   │   └── [slug]/
│   │   │   │       └── route.ts          # GET /api/doctors/[slug]
│   │   │   └── users/
│   │   │       ├── route.ts              # User CRUD
│   │   │       └── [id]/
│   │   │           └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── middleware.ts                     # CORS middleware
└── package.json
```

#### CORS Configuration

```typescript
// apps/api/src/middleware.ts
const allowedOrigins = [
  'http://localhost:3000', // public
  'http://localhost:3001', // doctor
  'http://localhost:3002', // admin
];

// Handles preflight requests and sets CORS headers
// Allows credentials (cookies) for cross-origin requests
```

#### Authentication

```typescript
// apps/api/src/app/api/doctors/route.ts
export async function POST(request: Request) {
  // In development: Allow requests from admin app
  const origin = request.headers.get('origin');
  const isFromAdminApp = origin === 'http://localhost:3002';

  if (!isLocalDev || !isFromAdminApp) {
    await requireAdmin(); // Check admin role
  }

  // Create doctor logic...
}
```

---

## Shared Packages

### @healthcare/auth

Authentication utilities and NextAuth configuration.

**Exports:**
- `requireAdmin()` - Middleware to verify admin role
- NextAuth configuration
- JWT helpers

**Location:** `packages/auth/`

### @healthcare/database

Prisma client and database configuration.

**Exports:**
- `prisma` - Prisma client instance
- Database types

**Location:** `packages/database/`

### @healthcare/types

Shared TypeScript types across all apps.

**Exports:**
- `DoctorProfile` - Main doctor type
- `createDoctorSchema` - Zod validation schema
- Other shared types

**Location:** `packages/types/`

---

## Technology Stack

### Frontend
- **Framework:** Next.js 16.0.8 (App Router)
- **React:** 19.2.1
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React 0.560.0
- **Forms:** Native HTML5

### Backend
- **API Framework:** Next.js API Routes
- **Database ORM:** Prisma
- **Validation:** Zod 4.2.0

### Authentication
- **Library:** NextAuth 5.0.0-beta.25
- **Strategy:** JWT
- **Session:** Database-backed sessions

### File Upload
- **Service:** UploadThing 7.7.4
- **Storage:** Cloud-based (UploadThing CDN)

### Development
- **Package Manager:** pnpm (workspace)
- **TypeScript:** 5.x
- **ESLint:** 9.x

---

## Authentication & Authorization

### NextAuth Configuration

```typescript
// Shared across all apps
export const authOptions = {
  providers: [
    CredentialsProvider({
      // Username/password authentication
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // Add user role to token
      if (user) {
        token.role = user.role;
        token.doctorId = user.doctorId;
      }
      return token;
    },
    session({ session, token }) {
      // Add role to session
      session.user.role = token.role;
      session.user.doctorId = token.doctorId;
      return session;
    },
  },
};
```

### Roles

- **ADMIN** - Full access to admin panel, can create doctors
- **DOCTOR** - Access to doctor portal, view own profile
- **USER** - Basic user (future use)

### Middleware Protection

**Admin App:**
```typescript
// apps/admin/src/middleware.ts
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Allow login and auth routes
  if (isLoginPage || isAuthPage || isUploadThingRoute) {
    return NextResponse.next();
  }

  // Require token
  if (!token) {
    return NextResponse.redirect(loginUrl);
  }

  // Require ADMIN role
  if (token.role !== "ADMIN") {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
```

**Doctor App:**
```typescript
// apps/doctor/src/middleware.ts
// Similar but requires DOCTOR role
if (token.role !== "DOCTOR") {
  return NextResponse.redirect(loginUrl);
}
```

---

## Data Flow

### Doctor Creation Flow

```
┌─────────────┐
│ Admin User  │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Fill 10-step wizard
       │ 2. Upload files via UploadThing
       │ 3. Click "Publish"
       │
       ▼
┌──────────────────┐
│   Admin App      │
│  (Port 3002)     │
└────────┬─────────┘
         │
         │ POST /api/doctors
         │ { doctor_full_name, services_list, ... }
         │
         ▼
┌──────────────────┐
│   API Backend    │
│  (Port 3003)     │
└────────┬─────────┘
         │
         │ 1. Verify admin role
         │ 2. Validate data (Zod - disabled)
         │ 3. Create doctor + relations
         │
         ▼
┌──────────────────┐
│  Prisma Client   │
└────────┬─────────┘
         │
         │ prisma.doctor.create({
         │   data: { ...doctor, services: { create: [...] } }
         │ })
         │
         ▼
┌──────────────────┐
│   PostgreSQL     │
│   Database       │
└──────────────────┘
```

### Public Profile Display Flow

```
┌─────────────┐
│ Public User │
│  (Browser)  │
└──────┬──────┘
       │
       │ Visit /doctors/juan-perez
       │
       ▼
┌──────────────────┐
│   Public App     │
│  (Port 3000)     │
└────────┬─────────┘
         │
         │ getDoctorBySlug("juan-perez")
         │
         ▼
┌──────────────────┐
│   API Backend    │
│  (Port 3003)     │
└────────┬─────────┘
         │
         │ GET /api/doctors/juan-perez
         │
         ▼
┌──────────────────┐
│  Prisma Client   │
└────────┬─────────┘
         │
         │ prisma.doctor.findUnique({
         │   where: { slug },
         │   include: { services, educationItems, ... }
         │ })
         │
         ▼
┌──────────────────┐
│   PostgreSQL     │
└────────┬─────────┘
         │
         │ Return doctor data + relations
         │
         ▼
┌──────────────────┐
│   Public App     │
│ Transform to     │
│ DoctorProfile    │
└────────┬─────────┘
         │
         │ Render profile sections
         │
         ▼
┌──────────────────┐
│   HTML Page      │
│  (SEO-optimized) │
└──────────────────┘
```

---

## Database Schema

### Doctor (Main Entity)

```prisma
model Doctor {
  id                String   @id @default(cuid())
  slug              String   @unique
  doctorFullName    String
  lastName          String
  primarySpecialty  String
  subspecialties    String[]
  cedulaProfesional String?
  heroImage         String
  locationSummary   String
  city              String

  // Biography
  shortBio          String
  longBio           String?
  yearsExperience   Int

  // Conditions & Procedures
  conditions        String[]
  procedures        String[]

  // Appointment
  nextAvailableDate DateTime?
  appointmentModes  String[]

  // Clinic Info
  clinicAddress     String
  clinicPhone       String
  clinicWhatsapp    String?
  clinicHours       Json
  clinicGeoLat      Float?
  clinicGeoLng      Float?

  // Social
  socialLinkedin    String?
  socialTwitter     String?

  // Relations
  services          Service[]
  educationItems    EducationItem[]
  certificates      Certificate[]
  carouselItems     CarouselItem[]
  faqs              FAQ[]

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### Service

```prisma
model Service {
  id                String   @id @default(cuid())
  doctorId          String
  doctor            Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  serviceName       String
  shortDescription  String
  durationMinutes   Int
  price             Float?

  createdAt         DateTime @default(now())
}
```

### EducationItem

```prisma
model EducationItem {
  id            String   @id @default(cuid())
  doctorId      String
  doctor        Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  institution   String
  program       String
  year          String
  notes         String?

  createdAt     DateTime @default(now())
}
```

### Certificate

```prisma
model Certificate {
  id            String   @id @default(cuid())
  doctorId      String
  doctor        Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  src           String
  alt           String
  issuedBy      String
  year          String

  createdAt     DateTime @default(now())
}
```

### CarouselItem

```prisma
model CarouselItem {
  id            String   @id @default(cuid())
  doctorId      String
  doctor        Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  type          String   // "image" | "video"
  src           String
  thumbnail     String?
  alt           String
  caption       String?
  name          String?
  description   String?
  uploadDate    String?
  duration      String?

  createdAt     DateTime @default(now())
}
```

### FAQ

```prisma
model FAQ {
  id            String   @id @default(cuid())
  doctorId      String
  doctor        Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  question      String
  answer        String

  createdAt     DateTime @default(now())
}
```

---

## File Upload System

### UploadThing Configuration

**Provider:** UploadThing (Cloud CDN)

**Upload Endpoints:**

1. **doctorHeroImage**
   - Type: Image
   - Max Size: 4MB
   - Max Count: 1
   - Purpose: Doctor profile photo

2. **doctorCertificates**
   - Type: Image
   - Max Size: 4MB
   - Max Count: 10
   - Purpose: Professional certificates and diplomas

3. **clinicPhotos**
   - Type: Image
   - Max Size: 4MB
   - Max Count: 20
   - Purpose: Clinic facility photos

4. **doctorVideos**
   - Type: Video
   - Max Size: 32MB
   - Max Count: 5
   - Purpose: Introduction and clinic tour videos

### Upload Flow

```typescript
// 1. User selects file in wizard
<UploadButton
  endpoint="doctorHeroImage"
  onClientUploadComplete={(res) => {
    const uploadedUrl = res[0]?.url;
    updateField("hero_image", uploadedUrl);
  }}
  onUploadError={(error) => {
    console.error(error);
  }}
/>

// 2. UploadThing handles upload to CDN
// 3. Returns permanent URL
// 4. URL stored in form state
// 5. URL sent to API on form submission
// 6. URL stored in database
```

---

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL (production) or SQLite (development)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd docs-front

# Install dependencies
pnpm install

# Set up environment variables
cp apps/admin/.env.example apps/admin/.env
cp apps/doctor/.env.local.example apps/doctor/.env.local
cp apps/api/.env.example apps/api/.env

# Run database migrations
pnpm db:migrate

# Seed database (optional)
pnpm db:seed
```

### Running Applications

```bash
# Run all apps simultaneously (from root)
pnpm dev

# Or run individually
cd apps/public && pnpm dev    # Port 3000
cd apps/admin && pnpm dev     # Port 3002
cd apps/doctor && pnpm dev    # Port 3001
cd apps/api && pnpm dev       # Port 3003
```

### Environment Variables

**Admin App (.env)**
```env
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3002
UPLOADTHING_SECRET=your-uploadthing-secret
UPLOADTHING_APP_ID=your-uploadthing-app-id
```

**Doctor App (.env.local)**
```env
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3001
```

**API App (.env)**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/healthcare
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002
```

**Public App (.env.local)**
```env
NEXT_PUBLIC_API_URL=http://localhost:3003
```

---

## Key Design Decisions

### 1. Monorepo Architecture
- **Why:** Share code between apps, unified development experience
- **Trade-off:** More complex setup vs. code duplication

### 2. Separate API App
- **Why:** Centralized data layer, CORS control, future scalability
- **Trade-off:** Extra HTTP calls vs. direct database access

### 3. NextAuth v5 Beta
- **Why:** Modern authentication, role-based access
- **Trade-off:** Beta stability vs. latest features

### 4. UploadThing for Files
- **Why:** Easy setup, CDN-backed, no infrastructure management
- **Trade-off:** Third-party dependency vs. self-hosted S3

### 5. ISR for Public Profiles
- **Why:** SEO benefits, fast page loads, low server load
- **Trade-off:** Slight data staleness (60s) vs. real-time updates

### 6. 10-Step Wizard
- **Why:** Complex data collection in digestible steps
- **Trade-off:** More clicks vs. overwhelming single form

---

## Future Enhancements

### Planned Features
- [ ] PUT /api/doctors/[slug] - Update doctor profiles
- [ ] DELETE /api/doctors/[slug] - Soft delete doctors
- [ ] Doctor self-editing in portal
- [ ] Appointment booking system
- [ ] Patient reviews and ratings
- [ ] Search and filter doctors
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Email notifications
- [ ] Backup and restore

### Technical Improvements
- [ ] Re-enable Zod validation in API
- [ ] Add API rate limiting
- [ ] Implement Redis caching
- [ ] Set up CI/CD pipeline
- [ ] Add E2E tests (Playwright)
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)
- [ ] Database backups
- [ ] Production deployment guide

---

## Port Reference

| Application | Port | URL                      | Purpose                  |
|-------------|------|--------------------------|--------------------------|
| Public      | 3000 | http://localhost:3000    | Public doctor profiles   |
| Doctor      | 3001 | http://localhost:3001    | Doctor portal            |
| Admin       | 3002 | http://localhost:3002    | Admin panel              |
| API         | 3003 | http://localhost:3003    | REST API backend         |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

[License Type] - See [LICENSE.md](./LICENSE.md)
