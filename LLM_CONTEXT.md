# LLM Context - AI Assistant Guide

**Purpose**: Optimized reference for AI code assistants (GitHub Copilot, Claude, ChatGPT, etc.)
**Last Updated**: 2025-12-28
**Codebase**: Healthcare Platform Monorepo

## Quick Facts

```yaml
Project: Healthcare platform for doctor profiles and appointments
Type: Turborepo monorepo with 4 Next.js apps + 3 shared packages
Apps:
  - public (port 3000): Public doctor profiles and blog
  - doctor (port 3001): Doctor dashboard for blog management
  - admin (port 3002): Admin panel for creating doctors
  - api (port 3003): Centralized REST API
Tech Stack:
  Framework: Next.js 16.0.10 (App Router)
  React: 19.2.1
  Database: PostgreSQL with Prisma 6.2.1
  Auth: NextAuth 5.0.0-beta.25 (Google OAuth)
  Styling: Tailwind CSS 4
  Package Manager: pnpm
  Build System: Turborepo
Languages: TypeScript 5
```

---

## 1-Minute Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  User Interfaces (Next.js Apps)                     │
├──────────────┬──────────────┬──────────────┬────────┤
│  Public      │  Doctor      │  Admin       │  API   │
│  (SSR/ISR)   │  (Auth+JWT)  │  (Auth+JWT)  │  (REST)│
│  Port 3000   │  Port 3001   │  Port 3002   │  3003  │
└──────────────┴──────────────┴──────────────┴────────┘
                      │
        ┌─────────────┴────────────┐
        │  Shared Packages         │
        ├──────────┬───────┬───────┤
        │  auth    │  db   │ types │
        └──────────┴───────┴───────┘
                      │
              ┌───────┴────────┐
              │  PostgreSQL    │
              │  (Prisma ORM)  │
              └────────────────┘
```

**Data Flow**:
1. Public app → Fetches doctor data from API app → Renders profile pages
2. Doctor/Admin apps → Authenticate with NextAuth → Generate JWT → Call API → Mutate database
3. API app → Validates JWT → Uses Prisma → Returns JSON

---

## Tech Stack Details

### Frontend

```typescript
// Next.js 16 App Router (Server Components by default)
// File: apps/public/src/app/doctores/[slug]/page.tsx

export default async function DoctorPage({ params }) {
  const { slug } = await params; // Next.js 16 async params
  const doctor = await fetch(`${API_URL}/api/doctors/${slug}`, {
    next: { revalidate: 60 } // ISR: Revalidate every 60 seconds
  });

  return <DoctorProfile doctor={doctor} />;
}
```

**Key Conventions**:
- Server Components by default (no `'use client'`)
- Client Components only when needed: `'use client'` at top of file
- Dynamic imports for heavy components: `const X = dynamic(() => import(...))`
- Async params in Next.js 16: `const { slug } = await params;`

### Database

```prisma
// File: packages/database/prisma/schema.prisma

model Doctor {
  id                String   @id @default(cuid())
  slug              String   @unique  // Immutable for SEO
  doctorFullName    String   @map("doctor_full_name")
  // ... all fields use snake_case in DB, camelCase in Prisma

  services          Service[]
  articles          Article[]
  // ... relations with cascade delete
}

model Article {
  id              String        @id @default(cuid())
  slug            String        @unique
  content         String        @db.Text  // HTML content
  status          ArticleStatus @default(DRAFT)
  doctorId        String        @map("doctor_id")
  doctor          Doctor        @relation(...)

  @@index([doctorId, status])
  @@index([publishedAt])
}
```

**Database Conventions**:
- All PKs use CUID (not UUID)
- Database columns: `snake_case` (mapped with `@map`)
- Prisma models: `camelCase`
- Cascade delete on all relations
- Indexes on foreign keys and query patterns

### Authentication

```typescript
// File: packages/auth/src/nextauth-config.ts

export const authConfig = {
  providers: [GoogleProvider({...})],
  callbacks: {
    async jwt({ token, user }) {
      // Fetch user from API, attach role to token
      const dbUser = await fetch(`${API_URL}/api/auth/user`, {...});
      token.role = dbUser.role; // ADMIN or DOCTOR
      token.doctorId = dbUser.doctorId;
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      return session;
    }
  }
};
```

**Auth Pattern**:
1. User logs in with Google OAuth (NextAuth)
2. JWT callback fetches/creates user in database via API
3. Role (ADMIN/DOCTOR) attached to JWT token
4. Apps use role for authorization
5. API calls use custom JWT (5-minute expiry) with base64-encoded payload

```typescript
// File: apps/doctor/src/lib/auth.ts

export function generateToken(user: { email: string; role: string }) {
  const payload = {
    email: user.email,
    role: user.role,
    timestamp: Date.now()
  };
  return btoa(JSON.stringify(payload)); // base64 encode
}

// Usage in API calls
const token = generateToken(session.user);
await fetch(`${API_URL}/api/articles`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Common Code Patterns

### 1. API Route (Server-side)

```typescript
// File: apps/api/src/app/api/doctors/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdminAuth } from '@/lib/auth';

// GET /api/doctors (public)
export async function GET() {
  const doctors = await prisma.doctor.findMany({
    include: { services: true, articles: true }
  });
  return NextResponse.json({ success: true, data: doctors });
}

// POST /api/doctors (admin only)
export async function POST(request: Request) {
  try {
    await requireAdminAuth(request); // Throws if not admin
    const body = await request.json();

    const doctor = await prisma.doctor.create({
      data: {
        slug: body.slug,
        doctorFullName: body.doctor_full_name,
        // ... map request body to Prisma model
        services: {
          create: body.services_list.map(s => ({
            serviceName: s.service_name,
            shortDescription: s.short_description,
            // ...
          }))
        }
      }
    });

    return NextResponse.json({ success: true, data: doctor }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('required') ? 401 : 500 }
    );
  }
}
```

### 2. Server Component with Data Fetching

```typescript
// File: apps/public/src/app/doctores/[slug]/page.tsx

import { notFound } from 'next/navigation';
import { Metadata } from 'next';

// Generate metadata for SEO
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await fetch(`${API_URL}/api/doctors/${slug}`).then(r => r.json());

  return {
    title: `${doctor.doctorFullName} ${doctor.lastName} - ${doctor.primarySpecialty}`,
    description: doctor.shortBio,
    openGraph: {
      title: `${doctor.doctorFullName} ${doctor.lastName}`,
      description: doctor.shortBio,
      images: [doctor.heroImage],
    }
  };
}

// Server Component (async function)
export default async function DoctorPage({ params }) {
  const { slug } = await params;

  const res = await fetch(`${API_URL}/api/doctors/${slug}`, {
    next: { revalidate: 60 } // ISR: Cache for 60 seconds
  });

  if (!res.ok) notFound();

  const { data: doctor } = await res.json();

  return (
    <div>
      <HeroSection {...doctor} />
      <ServicesSection services={doctor.services} />
      {/* ... more sections */}
    </div>
  );
}
```

### 3. Client Component with Form

```typescript
// File: apps/doctor/src/app/dashboard/blog/new/page.tsx

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/components/blog/RichTextEditor';

export default function NewArticlePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = generateToken(session.user);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const res = await fetch(`${API_URL}/api/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        slug,
        excerpt: content.substring(0, 200),
        content,
        status
      })
    });

    if (res.ok) {
      router.push('/dashboard/blog');
    } else {
      alert('Error creating article');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del artículo"
        required
      />

      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Contenido del artículo..."
      />

      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="DRAFT">Borrador</option>
        <option value="PUBLISHED">Publicar</option>
      </select>

      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
```

### 4. Prisma Query Patterns

```typescript
// File: apps/api/src/app/api/articles/route.ts

import { prisma } from '@healthcare/database';

// Get all articles for a doctor (including drafts)
const articles = await prisma.article.findMany({
  where: { doctorId: doctor.id },
  select: {
    id: true,
    slug: true,
    title: true,
    excerpt: true,
    status: true,
    publishedAt: true,
    // Don't fetch content (large field)
  },
  orderBy: { updatedAt: 'desc' }
});

// Create article with automatic publishedAt
const article = await prisma.article.create({
  data: {
    doctorId: doctor.id,
    slug: body.slug,
    title: body.title,
    content: body.content,
    status: body.status,
    publishedAt: body.status === 'PUBLISHED' ? new Date() : null
  }
});

// Update article with SEO protection
const existing = await prisma.article.findUnique({ where: { id } });

if (body.slug !== existing.slug && existing.status === 'PUBLISHED') {
  throw new Error('Cannot change slug of published article');
}

const updated = await prisma.article.update({
  where: { id },
  data: {
    title: body.title ?? existing.title,
    content: body.content ?? existing.content,
    // Use nullish coalescing to preserve existing values
  }
});
```

---

## Important Architectural Decisions

### 1. SEO Protection - Immutable Slugs

**Rule**: Once a doctor or article is created/published, its slug **cannot be changed**.

**Reason**: Prevent broken URLs and SEO penalties

**Implementation**:
```typescript
// apps/api/src/app/api/doctors/[slug]/route.ts

if (body.slug && body.slug !== slug) {
  return NextResponse.json(
    {
      success: false,
      error: 'Cannot change slug',
      message: 'El slug no se puede modificar por razones de SEO.'
    },
    { status: 400 }
  );
}
```

### 2. Delete-and-Recreate Pattern

**Rule**: When updating a doctor profile, delete all related records and recreate them.

**Reason**: Simpler than granular updates, ensures consistency

**Implementation**:
```typescript
await prisma.$transaction(async (tx) => {
  // Delete all related records
  await tx.service.deleteMany({ where: { doctorId: existing.id } });
  await tx.education.deleteMany({ where: { doctorId: existing.id } });
  // ... delete all relations

  // Update doctor with new relations
  return await tx.doctor.update({
    where: { slug },
    data: {
      // ... main fields
      services: {
        create: body.services_list.map(s => ({ ... }))
      },
      educationItems: {
        create: body.education_items.map(e => ({ ... }))
      }
    }
  });
});
```

### 3. Staff vs Patient Identity

**Rule**: Only staff (doctors + admins) have user accounts. Patients are anonymous.

**Design**:
- Staff: Google OAuth → User table → Role-based access
- Patients: No accounts → Book via WhatsApp → Booking table with name/email/phone only

### 4. Blog Multi-Page Architecture

**Design**: Blog is a sub-section within doctor profiles, not a separate site.

**URLs**:
- `/doctores/[slug]` - Doctor profile
- `/doctores/[slug]/blog` - Article listing
- `/doctores/[slug]/blog/[articleSlug]` - Individual article

**Shared Layout**: Fixed sidebar with doctor info across all blog pages

### 5. ISR (Incremental Static Regeneration)

**Pattern**: Use ISR for public pages, fresh data for authenticated pages

```typescript
// Public pages (cache for performance)
fetch(url, { next: { revalidate: 60 } }) // 60 seconds

// Blog listing (cache longer)
fetch(url, { next: { revalidate: 3600 } }) // 1 hour

// Authenticated pages (always fresh)
fetch(url, { cache: 'no-store' })
```

---

## Common Tasks & Code Snippets

### Task: Add a new field to Doctor model

**Step 1**: Update Prisma schema
```prisma
// packages/database/prisma/schema.prisma

model Doctor {
  // ... existing fields
  newField        String?   // Add new field
}
```

**Step 2**: Generate migration
```bash
pnpm db:migrate
```

**Step 3**: Update TypeScript type
```typescript
// packages/types/src/doctor.ts

export interface DoctorProfile {
  // ... existing fields
  newField?: string;
}
```

**Step 4**: Update API route
```typescript
// apps/api/src/app/api/doctors/route.ts

const doctor = await prisma.doctor.create({
  data: {
    // ... existing fields
    newField: body.new_field, // Map from request
  }
});
```

**Step 5**: Update admin wizard
```typescript
// apps/admin/src/app/doctors/new/page.tsx

const [formData, setFormData] = useState({
  // ... existing fields
  new_field: '',
});

// Add input in appropriate wizard step
<input
  value={formData.new_field}
  onChange={(e) => setFormData({ ...formData, new_field: e.target.value })}
/>
```

### Task: Create a new API endpoint

**File**: `apps/api/src/app/api/my-endpoint/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireAdminAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // Optional: Add auth
    // await requireAdminAuth(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const data = await prisma.myModel.findMany({
      where: id ? { id } : {},
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminAuth(request);

    const body = await request.json();

    // Validate required fields
    if (!body.required_field) {
      return NextResponse.json(
        { success: false, error: 'Missing required_field' },
        { status: 400 }
      );
    }

    const created = await prisma.myModel.create({
      data: { ...body }
    });

    return NextResponse.json(
      { success: true, data: created },
      { status: 201 }
    );
  } catch (error) {
    const status = error.message.includes('required') ? 401 : 500;
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}
```

### Task: Add a new page to public app

**File**: `apps/public/src/app/my-page/page.tsx`

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Page - Healthcare Platform',
  description: 'Page description for SEO',
};

export default async function MyPage() {
  // Fetch data if needed
  const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/endpoint`, {
    next: { revalidate: 60 }
  }).then(r => r.json());

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">My Page</h1>
      <p>Content here</p>
    </div>
  );
}
```

---

## Recent Changes (Last 2 Weeks)

### Blog Feature (Dec 28, 2024)

**Added**:
- Article model to database
- Doctor dashboard blog management (list, create, edit, delete)
- Rich text editor (Tiptap)
- Public blog listing and article pages
- SEO metadata for articles

**Files Modified**:
- `packages/database/prisma/schema.prisma` - Added Article model
- `apps/api/src/app/api/articles/**` - Article API endpoints
- `apps/doctor/src/app/dashboard/blog/**` - Blog management pages
- `apps/doctor/src/components/blog/RichTextEditor.tsx` - WYSIWYG editor
- `apps/public/src/app/doctores/[slug]/blog/**` - Public blog pages

**Bug Fixes**:
- Fixed infinite reload when editing articles (RichTextEditor)
- Fixed TypeScript error in editor setContent options
- Fixed article fetch to get full content in edit page

---

## Critical Rules for AI Assistants

### DO

- Use `'use client'` only when necessary (forms, state, effects, event handlers)
- Use async/await for params in Next.js 16: `const { slug } = await params;`
- Map database snake_case fields to camelCase in Prisma queries
- Use ISR (`revalidate`) for public pages
- Use Tailwind CSS for all styling
- Validate auth before mutating data (use `requireAdminAuth`, `requireDoctorAuth`)
- Return `NextResponse.json()` in API routes
- Use `notFound()` for 404 errors in pages
- Use `dynamic()` for heavy client components
- Use Prisma transactions for multi-step database operations

### DON'T

- Don't change slugs after creation/publishing
- Don't create patient user accounts (bookings are anonymous)
- Don't use CSS-in-JS or styled-components (use Tailwind only)
- Don't use `useEffect` in Server Components
- Don't fetch data in Client Components if it can be done server-side
- Don't use `'use client'` in Server Components
- Don't bypass authentication checks in API routes
- Don't hard-code URLs (use env variables: `process.env.NEXT_PUBLIC_API_URL`)

### Watch Out For

- **Infinite re-renders**: Check useEffect dependencies, avoid setting state in render
- **Async params**: Next.js 16 requires `await params` in page components
- **JWT token expiry**: Tokens expire after 5 minutes (regenerate as needed)
- **Prisma field mapping**: Database uses snake_case, Prisma uses camelCase
- **CORS**: API must allow requests from apps on different ports
- **UploadThing domains**: Add `utfs.io` to Next.js image domains

---

## Environment Variables Checklist

```bash
# Root .env or app-specific .env

# Database (all apps need access)
DATABASE_URL="postgresql://..."

# NextAuth (doctor + admin apps)
NEXTAUTH_SECRET="random-secret"
NEXTAUTH_URL="http://localhost:3001"  # or 3002 for admin
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# API URL (all apps)
NEXT_PUBLIC_API_URL="http://localhost:3003"

# UploadThing (admin app only)
UPLOADTHING_SECRET="..."
UPLOADTHING_APP_ID="..."
```

---

## Development Workflow

```bash
# Install dependencies
pnpm install

# Start all apps in development
pnpm dev

# Start specific app
pnpm dev:public    # Port 3000
pnpm dev:doctor    # Port 3001
pnpm dev:admin     # Port 3002
pnpm dev:api       # Port 3003

# Database operations
pnpm db:generate   # Generate Prisma client
pnpm db:push       # Push schema changes (dev)
pnpm db:migrate    # Create migration
pnpm db:studio     # Open Prisma Studio

# Build all apps
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint
```

---

## Quick Reference

### File Locations

| What | Where |
|------|-------|
| Database schema | `packages/database/prisma/schema.prisma` |
| API routes | `apps/api/src/app/api/**/*.ts` |
| Public pages | `apps/public/src/app/**/*.tsx` |
| Doctor dashboard | `apps/doctor/src/app/**/*.tsx` |
| Admin wizard | `apps/admin/src/app/doctors/new/page.tsx` |
| Auth config | `packages/auth/src/nextauth-config.ts` |
| Type definitions | `packages/types/src/**/*.ts` |
| Rich text editor | `apps/doctor/src/components/blog/RichTextEditor.tsx` |

### Port Reference

| Port | App | Purpose |
|------|-----|---------|
| 3000 | public | Public doctor profiles |
| 3001 | doctor | Doctor dashboard |
| 3002 | admin | Admin panel |
| 3003 | api | REST API backend |

### Database Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | Staff auth | email, role (ADMIN/DOCTOR), doctorId |
| Doctor | Doctor profile | slug (immutable), doctorFullName, primarySpecialty |
| Article | Blog posts | slug, title, content (HTML), status (DRAFT/PUBLISHED) |
| Service | Medical services | serviceName, price, durationMinutes |
| AppointmentSlot | Availability | date, startTime, endTime, status |
| Booking | Patient bookings | patientName, patientEmail, patientPhone |

---

## Additional Resources

- **Database Schema**: See `DATABASE_SCHEMA.md` for complete Prisma schema documentation
- **API Reference**: See `API_REFERENCE.md` for all endpoint details
- **Codebase Map**: See `CODEBASE_MAP.md` for file structure
- **Component Inventory**: See `COMPONENT_INVENTORY.md` for React component catalog

---

**End of LLM Context Guide**
