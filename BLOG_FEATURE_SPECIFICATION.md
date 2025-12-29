# Blog Feature for Doctor Profiles - Complete Specification

**Date:** December 28, 2024
**Status:** 📋 Planning Phase
**Priority:** High
**Estimated Effort:** 11-15 hours

---

## Table of Contents

1. [Overview](#overview)
2. [Current vs Desired Architecture](#current-vs-desired-architecture)
3. [What Needs to Be Built](#what-needs-to-be-built)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Fixed Sidebar Strategy](#fixed-sidebar-strategy)
7. [SEO Optimization Strategy](#seo-optimization-strategy)
8. [User Flows](#user-flows)
9. [Implementation Phases](#implementation-phases)
10. [Design Decisions to Confirm](#design-decisions-to-confirm)
11. [Technical Requirements](#technical-requirements)
12. [Files to Create/Modify](#files-to-createmodify)

---

## Overview

### Goal
Transform the doctor profile from **single-page** to **multi-page** by adding a blog section where:
- ✅ Doctors can write and publish articles from their dashboard
- ✅ Published articles appear on their public profile
- ✅ The blog is SEO-optimized (meta tags, schema.org, sitemap)
- ✅ The fixed sidebar remains visible across all doctor pages
- ✅ Each article has its own URL for better SEO and sharing

### Why This Matters
1. **SEO Benefits:** More content = more keywords = better rankings
2. **E-E-A-T Signals:** Demonstrates expertise, experience, authority, trustworthiness
3. **Patient Engagement:** Educational content builds trust and attracts patients
4. **Internal Linking:** Blog → Services → Profile (authority flow)
5. **Long-tail Keywords:** Articles target specific patient questions

---

## Current vs Desired Architecture

### Current State (Single Page)
```
/doctores/maria-lopez
├── All sections in one page:
│   ├── Hero Section
│   ├── Services Section
│   ├── Biography Section
│   ├── Education Section
│   ├── Credentials Section
│   ├── Clinic Location
│   └── FAQ Section
└── Fixed Sidebar (desktop only)
    ├── Appointment Calendar
    └── Booking Widget
```

**Problem:** All content is bundled in one long page. No room for articles or additional content.

### Desired State (Multi-Page)

```
/doctores/maria-lopez/
├── /                                    ← Main profile (existing)
│   └── Fixed Sidebar ✅
│
└── /blog/                               ← NEW: Blog section
    ├── page.tsx                         ← Blog listing (all articles)
    │   └── Fixed Sidebar ✅
    │
    └── [articleSlug]/
        └── page.tsx                     ← Individual article
            └── Fixed Sidebar ✅

URL Examples:
- /doctores/maria-lopez                               (Profile)
- /doctores/maria-lopez/blog                          (Blog listing)
- /doctores/maria-lopez/blog/como-cuidar-tu-piel      (Article 1)
- /doctores/maria-lopez/blog/beneficios-del-botox     (Article 2)
```

---

## What Needs to Be Built

### 1. Public-Facing Blog (apps/public)

#### A. Blog Listing Page
**URL:** `/doctores/maria-lopez/blog`

**Features:**
- Grid/list of all published articles by this doctor
- Article cards showing:
  - Thumbnail image
  - Title
  - Excerpt (150-200 chars)
  - Published date
  - "Read more" link
- Pagination (if > 10 articles)
- Fixed sidebar visible (same as profile)
- SEO metadata (title, description)
- Schema.org `Blog` structured data

**Visual:**
```
┌─────────────────────────────────────┬────────────────┐
│  Blog de Dra. María López           │  Fixed Sidebar │
│  ─────────────────────────────────  │                │
│                                     │  📅 Calendar   │
│  ┌──────────┐  ┌──────────┐        │                │
│  │ [Image]  │  │ [Image]  │        │  📞 Contact    │
│  │ Title 1  │  │ Title 2  │        │                │
│  │ Excerpt  │  │ Excerpt  │        │  🔘 Book Now   │
│  └──────────┘  └──────────┘        │                │
│                                     │                │
│  ┌──────────┐  ┌──────────┐        │                │
│  │ [Image]  │  │ [Image]  │        │                │
│  │ Title 3  │  │ Title 4  │        │                │
│  │ Excerpt  │  │ Excerpt  │        │                │
│  └──────────┘  └──────────┘        │                │
└─────────────────────────────────────┴────────────────┘
```

#### B. Individual Article Page
**URL:** `/doctores/maria-lopez/blog/como-cuidar-tu-piel-en-verano`

**Features:**
- Full article content (rich HTML)
- Article header:
  - Title (H1)
  - Author info (doctor name, photo, specialty)
  - Published date
  - Reading time estimate
- Article body (rich text with images)
- Navigation:
  - Back to blog listing
  - Back to profile
  - Previous/Next article
- Fixed sidebar visible
- SEO metadata (unique per article)
- Schema.org `BlogPosting` structured data
- Social sharing buttons (optional)

**Visual:**
```
┌─────────────────────────────────────┬────────────────┐
│  ← Blog   ← Perfil                  │  Fixed Sidebar │
│                                     │                │
│  Cómo Cuidar Tu Piel en Verano (H1) │  📅 Calendar   │
│  By Dra. María López | 15 Dic 2024 │                │
│  ─────────────────────────────────  │  📞 Contact    │
│                                     │                │
│  [Featured Image]                   │  🔘 Book Now   │
│                                     │                │
│  Lorem ipsum dolor sit amet...      │                │
│  consectetur adipiscing elit...     │                │
│                                     │                │
│  ## Subtítulo (H2)                  │                │
│  Más contenido...                   │                │
│                                     │                │
│  [Inline Image]                     │                │
│  Más texto...                       │                │
│                                     │                │
│  ─────────────────────────────────  │                │
│  ← Anterior | Siguiente →           │                │
└─────────────────────────────────────┴────────────────┘
```

### 2. Doctor Dashboard (apps/doctor)

#### A. Blog Management Page
**URL:** `/dashboard/blog`

**Features:**
- List of all articles (published + drafts)
- Table columns:
  - Title
  - Status (Draft/Published)
  - Published date
  - Views (future)
  - Actions (Edit, Delete, Preview)
- "New Article" button (prominent)
- Filter by status (All, Published, Drafts)
- Search by title

**Visual:**
```
┌────────────────────────────────────────────────────┐
│  My Blog                       [+ New Article]     │
│  ─────────────────────────────────────────────────│
│                                                    │
│  Filter: [All] [Published] [Drafts]               │
│                                                    │
│  Title                    Status    Date    Actions│
│  ────────────────────────────────────────────────│
│  Cómo cuidar tu piel      ✅ Pub   15 Dec  [Edit] │
│  Beneficios del botox     ✅ Pub   10 Dec  [Edit] │
│  Nuevo artículo           📝 Draft  -      [Edit] │
│  ────────────────────────────────────────────────│
└────────────────────────────────────────────────────┘
```

#### B. Article Editor
**URL:** `/dashboard/blog/new` or `/dashboard/blog/[id]/edit`

**Features:**
- **Title input** (text field)
- **Slug input** (auto-generated from title, editable)
  - Example: Title "Cómo Cuidar Tu Piel" → Slug "como-cuidar-tu-piel"
- **Rich text editor** (WYSIWYG)
  - Bold, italic, underline
  - Headings (H2, H3)
  - Bullet/numbered lists
  - Links
  - Images (inline)
  - Code blocks (optional)
- **Thumbnail upload** (featured image)
- **Excerpt field** (150-200 chars summary)
- **SEO Section:**
  - Meta description (160 chars)
  - Keywords (optional)
- **Status toggle** (Draft / Published)
- **Actions:**
  - Save as Draft
  - Publish
  - Preview (opens in new tab)
  - Cancel

**Visual:**
```
┌────────────────────────────────────────────────────┐
│  New Article                                       │
│  ─────────────────────────────────────────────────│
│                                                    │
│  Title:                                            │
│  [_________________________________]               │
│                                                    │
│  Slug: doctores/maria-lopez/blog/                  │
│  [_________________________________]               │
│                                                    │
│  Thumbnail:                                        │
│  [Upload Image] or drag & drop                     │
│                                                    │
│  Content:                                          │
│  ┌──────────────────────────────────────────────┐ │
│  │ [B] [I] [U] [H2] [H3] [•] [1.] [🔗] [📷]    │ │
│  │                                              │ │
│  │ Write your article here...                  │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  Excerpt:                                          │
│  [_________________________________] 0/200         │
│                                                    │
│  SEO ▼                                             │
│    Meta Description:                               │
│    [_________________________________] 0/160       │
│                                                    │
│  Status: ⚪ Draft  ⚪ Published                    │
│                                                    │
│  [Save Draft]  [Publish]  [Preview]  [Cancel]     │
└────────────────────────────────────────────────────┘
```

### 3. API Endpoints (apps/api)

#### Public Endpoints (No Auth Required)
```typescript
// List all published articles for a doctor
GET /api/doctors/:slug/articles
Response: {
  success: true,
  data: [
    {
      id: "clx123",
      slug: "como-cuidar-tu-piel",
      title: "Cómo Cuidar Tu Piel en Verano",
      excerpt: "Consejos para...",
      thumbnail: "https://...",
      publishedAt: "2024-12-15T10:00:00Z",
      doctor: {
        doctorFullName: "Dra. María López",
        primarySpecialty: "Dermatología",
        heroImage: "https://..."
      }
    }
  ]
}

// Get single published article
GET /api/doctors/:slug/articles/:articleSlug
Response: {
  success: true,
  data: {
    id: "clx123",
    slug: "como-cuidar-tu-piel",
    title: "Cómo Cuidar Tu Piel en Verano",
    content: "<p>Full HTML content...</p>",
    thumbnail: "https://...",
    excerpt: "...",
    metaDescription: "...",
    publishedAt: "2024-12-15T10:00:00Z",
    doctor: { /* ... */ }
  }
}
```

#### Doctor-Only Endpoints (Requires Auth)
```typescript
// List doctor's own articles (published + drafts)
GET /api/articles
Headers: Authorization: Bearer <token>
Response: {
  success: true,
  data: [
    {
      id: "clx123",
      title: "...",
      status: "PUBLISHED",
      publishedAt: "...",
      /* ... */
    }
  ]
}

// Create new article
POST /api/articles
Headers: Authorization: Bearer <token>
Body: {
  title: "Cómo Cuidar Tu Piel",
  slug: "como-cuidar-tu-piel",
  content: "<p>...</p>",
  excerpt: "...",
  thumbnail: "https://...",
  metaDescription: "...",
  status: "DRAFT"
}
Response: {
  success: true,
  data: { /* created article */ }
}

// Update article
PUT /api/articles/:id
Headers: Authorization: Bearer <token>
Body: { /* updated fields */ }
Response: {
  success: true,
  data: { /* updated article */ }
}

// Delete article
DELETE /api/articles/:id
Headers: Authorization: Bearer <token>
Response: {
  success: true,
  message: "Article deleted successfully"
}

// Publish article (change status from DRAFT to PUBLISHED)
PUT /api/articles/:id/publish
Headers: Authorization: Bearer <token>
Response: {
  success: true,
  data: { /* article with status: PUBLISHED */ }
}
```

---

## Database Schema

### New Model: `Article`

```prisma
// packages/database/prisma/schema.prisma

model Article {
  id              String        @id @default(cuid())
  slug            String        @unique

  // Content
  title           String
  excerpt         String        @db.VarChar(200)  // Short summary
  content         String        @db.Text          // Full article (HTML)
  thumbnail       String?                         // Featured image URL

  // Author (Doctor)
  doctorId        String
  doctor          Doctor        @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  // Publishing
  status          ArticleStatus @default(DRAFT)
  publishedAt     DateTime?     // Null if draft

  // SEO
  metaDescription String?       @db.VarChar(160)
  keywords        String[]      // Array of keywords

  // Analytics (Future)
  views           Int           @default(0)

  // Timestamps
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Indexes for performance
  @@index([doctorId, status])
  @@index([slug])
  @@index([publishedAt])
  @@map("articles")
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
}
```

### Update Existing `Doctor` Model

```prisma
model Doctor {
  // ... existing fields ...

  // NEW: Relation to articles
  articles        Article[]

  // ... rest of existing relations ...
}
```

### Migration Command

```bash
# After updating schema
pnpm db:migrate

# When prompted for migration name:
"add_article_model_for_blog_feature"
```

---

## Fixed Sidebar Strategy

### Problem
Currently, the sidebar only appears on the main profile page. We need it to appear on:
- Main profile page ✅ (already works)
- Blog listing page ❌ (new)
- Individual article pages ❌ (new)

### Solution: Shared Layout Component

**File:** `apps/public/src/app/doctores/[slug]/layout.tsx`

```tsx
import { getDoctorBySlug } from '@/lib/data';
import { notFound } from 'next/navigation';

export default async function DoctorLayout({
  children,
  params
}: {
  children: React.ReactNode,
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content area - renders different pages */}
        <main className="lg:w-2/3">
          {children}
          {/*
            This renders:
            - Profile page (page.tsx)
            - Blog listing (blog/page.tsx)
            - Article page (blog/[articleSlug]/page.tsx)
          */}
        </main>

        {/* Fixed sidebar - ALWAYS visible on desktop */}
        <aside className="lg:w-1/3 lg:sticky lg:top-20 lg:h-fit">
          {/* Booking widget (dynamically imported) */}
          <DynamicBookingWidget doctorSlug={doctor.slug} />

          {/* Contact card */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h3 className="font-bold mb-4">Contacto</h3>
            <p>{doctor.clinicPhone}</p>
            <p>{doctor.clinicWhatsapp}</p>
            <p>{doctor.clinicAddress}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
```

### File Structure After Implementation

```
apps/public/src/app/doctores/[slug]/
├── layout.tsx                    ← Shared layout with sidebar
├── page.tsx                      ← Main profile page
└── blog/
    ├── page.tsx                  ← Blog listing
    └── [articleSlug]/
        └── page.tsx              ← Individual article
```

**Result:**
- ✅ Sidebar appears on all pages under `/doctores/[slug]/*`
- ✅ No code duplication
- ✅ Consistent UX across profile and blog
- ✅ Sidebar stays fixed when scrolling (desktop)

---

## SEO Optimization Strategy

### 1. Blog Listing Page SEO

**File:** `apps/public/src/app/doctores/[slug]/blog/page.tsx`

```typescript
import { Metadata } from 'next';
import { getDoctorBySlug } from '@/lib/data';

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    return { title: 'Blog Not Found' };
  }

  const title = `Blog de ${doctor.doctorFullName} | Artículos de ${doctor.primarySpecialty}`;
  const description = `Lee los últimos artículos y consejos de salud de ${doctor.doctorFullName}, ${doctor.primarySpecialty} en ${doctor.city}. Información médica confiable y actualizada.`;
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/doctores/${slug}/blog`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [
        {
          url: doctor.heroImage,
          alt: doctor.doctorFullName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [doctor.heroImage],
    },
    alternates: {
      canonical: url,
    },
  };
}
```

**Schema.org Structured Data:**

```typescript
// Generate Blog schema
export function generateBlogSchema(doctor: DoctorProfile, articles: Article[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'url': `${process.env.NEXT_PUBLIC_BASE_URL}/doctores/${doctor.slug}/blog`,
    'name': `Blog de ${doctor.doctorFullName}`,
    'description': `Artículos de salud por ${doctor.doctorFullName}`,
    'author': {
      '@type': 'Physician',
      'name': doctor.doctorFullName,
      'medicalSpecialty': doctor.primarySpecialty,
      'image': doctor.heroImage,
    },
    'blogPost': articles.map(article => ({
      '@type': 'BlogPosting',
      'headline': article.title,
      'url': `${process.env.NEXT_PUBLIC_BASE_URL}/doctores/${doctor.slug}/blog/${article.slug}`,
      'datePublished': article.publishedAt,
      'image': article.thumbnail,
      'author': {
        '@type': 'Physician',
        'name': doctor.doctorFullName,
      },
    })),
  };
}
```

### 2. Individual Article SEO

**File:** `apps/public/src/app/doctores/[slug]/blog/[articleSlug]/page.tsx`

```typescript
export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; articleSlug: string }>
}): Promise<Metadata> {
  const { slug, articleSlug } = await params;
  const article = await getArticle(slug, articleSlug);
  const doctor = await getDoctorBySlug(slug);

  if (!article || !doctor) {
    return { title: 'Article Not Found' };
  }

  const title = `${article.title} | ${doctor.doctorFullName}`;
  const description = article.metaDescription || article.excerpt;
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/doctores/${slug}/blog/${articleSlug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: article.publishedAt?.toISOString(),
      authors: [doctor.doctorFullName],
      images: [
        {
          url: article.thumbnail || doctor.heroImage,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [article.thumbnail || doctor.heroImage],
    },
    alternates: {
      canonical: url,
    },
  };
}
```

**Schema.org BlogPosting:**

```typescript
export function generateBlogPostingSchema(
  doctor: DoctorProfile,
  article: Article
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': article.title,
    'description': article.excerpt,
    'image': article.thumbnail,
    'datePublished': article.publishedAt?.toISOString(),
    'dateModified': article.updatedAt.toISOString(),
    'author': {
      '@type': 'Physician',
      'name': doctor.doctorFullName,
      'medicalSpecialty': doctor.primarySpecialty,
      'url': `${process.env.NEXT_PUBLIC_BASE_URL}/doctores/${doctor.slug}`,
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Your Healthcare Platform',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://yoursite.com/logo.png',
      },
    },
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `${process.env.NEXT_PUBLIC_BASE_URL}/doctores/${doctor.slug}/blog/${article.slug}`,
    },
    'articleBody': article.content.replace(/<[^>]*>/g, ''), // Strip HTML
    'keywords': article.keywords?.join(', '),
  };
}
```

### 3. Sitemap Integration

**File:** `apps/public/src/app/sitemap.ts`

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // Get all doctors
  const doctors = await getAllDoctors();

  // Get all published articles
  const articles = await getAllPublishedArticles();

  // Doctor profile pages
  const doctorPages = doctors.map((doctor) => ({
    url: `${baseUrl}/doctores/${doctor.slug}`,
    lastModified: doctor.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Doctor blog listing pages
  const blogPages = doctors.map((doctor) => ({
    url: `${baseUrl}/doctores/${doctor.slug}/blog`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Individual article pages
  const articlePages = articles.map((article) => ({
    url: `${baseUrl}/doctores/${article.doctor.slug}/blog/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/doctores`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
  ];

  return [...staticPages, ...doctorPages, ...blogPages, ...articlePages];
}
```

### 4. SEO Best Practices Checklist

- ✅ Server-side rendering (SSR/SSG) for all blog pages
- ✅ Unique H1 per article (article title)
- ✅ Semantic HTML structure (H2, H3 hierarchy in content)
- ✅ Image optimization (Next.js Image component)
- ✅ Internal linking:
  - Profile → Blog listing
  - Blog listing → Articles
  - Articles → Profile
  - Articles → Related articles (future)
- ✅ Canonical URLs (self-referencing)
- ✅ XML sitemap inclusion (profile + blog + articles)
- ✅ Open Graph tags for social sharing
- ✅ Twitter Card tags
- ✅ Schema.org structured data (Blog + BlogPosting)
- ✅ Alt text for all images
- ✅ Meta descriptions (unique per article)

---

## User Flows

### Flow 1: Doctor Writes and Publishes Article

```
1. Doctor logs in to dashboard
   URL: /dashboard

2. Clicks "My Blog" in navigation
   URL: /dashboard/blog

3. Sees list of existing articles (if any)
   Table showing: Title | Status | Date | Actions

4. Clicks "New Article" button
   URL: /dashboard/blog/new

5. Fills out article form:
   - Title: "Cómo Cuidar Tu Piel en Verano"
   - Slug: Auto-generated "como-cuidar-tu-piel-en-verano"
   - Uploads thumbnail image
   - Writes content in rich text editor:
     * Adds headings (H2, H3)
     * Formats text (bold, italic)
     * Inserts images
     * Adds links
   - Writes excerpt (150-200 chars)
   - Adds meta description for SEO
   - Optionally adds keywords

6. Clicks "Save as Draft" (to save progress)
   OR
   Clicks "Publish" (to make it live)

7. If published:
   - Article status changes to PUBLISHED
   - publishedAt timestamp set
   - Redirect to article preview in public site

8. Doctor sees success message:
   "Article published successfully! View it at: /doctores/maria-lopez/blog/como-cuidar-tu-piel-en-verano"

9. Article now appears in:
   - Blog listing page
   - Doctor's article list in dashboard
   - Sitemap (for Google)
```

### Flow 2: Patient Discovers and Reads Article

```
1. Patient lands on doctor's profile via Google search
   URL: /doctores/maria-lopez

2. Patient sees blog section or navigation tab
   Options:
   - Tab: "Perfil | Blog"
   - Sidebar link: "Ver Blog del Doctor"
   - Hero section link: "Lee mis artículos"

3. Patient clicks → Goes to blog listing
   URL: /doctores/maria-lopez/blog

4. Sees grid of articles with thumbnails:
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ [Image]  │  │ [Image]  │  │ [Image]  │
   │ Title 1  │  │ Title 2  │  │ Title 3  │
   │ Excerpt  │  │ Excerpt  │  │ Excerpt  │
   │ 15 Dec   │  │ 10 Dec   │  │ 5 Dec    │
   └──────────┘  └──────────┘  └──────────┘

5. Patient clicks on article card
   URL: /doctores/maria-lopez/blog/como-cuidar-tu-piel-en-verano

6. Reads full article:
   - Sees doctor's info (author)
   - Reads content (with images, formatting)
   - Sees sidebar with booking widget

7. Patient is impressed and wants to book:
   - Sees booking widget in sidebar (same as profile)
   - Clicks "Agendar Cita"
   - Books appointment

8. Or patient navigates:
   - Clicks "← Blog" to return to listing
   - Clicks "← Perfil" to return to profile
   - Scrolls to related articles (future feature)
```

### Flow 3: Doctor Edits Published Article

```
1. Doctor goes to dashboard blog section
   URL: /dashboard/blog

2. Sees list of articles including published ones

3. Clicks "Edit" on published article

4. Editor opens with existing content pre-filled

5. Doctor makes changes:
   - Updates title (slug remains same for SEO)
   - Edits content
   - Replaces thumbnail
   - Updates meta description

6. Clicks "Publish" (saves changes)

7. Article updates immediately on public site
   - updatedAt timestamp changes
   - Content refreshes via ISR (Incremental Static Regeneration)

8. Success message: "Article updated successfully!"
```

---

## Implementation Phases

### Phase 1: Database & API (2-3 hours)

**Goal:** Create data layer for articles

**Tasks:**
1. ✅ Add `Article` model to Prisma schema
   - Fields: title, slug, content, excerpt, thumbnail, status, etc.
   - Relation to Doctor model
2. ✅ Run database migration
   ```bash
   pnpm db:migrate
   ```
3. ✅ Create API endpoints in `apps/api`:
   - `GET /api/doctors/:slug/articles` (public)
   - `GET /api/doctors/:slug/articles/:articleSlug` (public)
   - `GET /api/articles` (doctor only)
   - `POST /api/articles` (doctor only)
   - `PUT /api/articles/:id` (doctor only)
   - `DELETE /api/articles/:id` (doctor only)
4. ✅ Add authentication protection:
   - Doctors can only CRUD their own articles
   - Public endpoints return only PUBLISHED articles
5. ✅ Test API endpoints with Postman/curl

**Files to create:**
- `packages/database/prisma/schema.prisma` (modify)
- `apps/api/src/app/api/articles/route.ts`
- `apps/api/src/app/api/articles/[id]/route.ts`
- `apps/api/src/app/api/doctors/[slug]/articles/route.ts`
- `apps/api/src/app/api/doctors/[slug]/articles/[articleSlug]/route.ts`

**Deliverable:** Working API that can CRUD articles

---

### Phase 2: Doctor Dashboard (4-5 hours)

**Goal:** Allow doctors to write and manage articles

**Tasks:**
1. ✅ Create blog management page
   - File: `apps/doctor/src/app/dashboard/blog/page.tsx`
   - Shows table of articles (published + drafts)
   - "New Article" button
   - Edit/Delete actions

2. ✅ Create article editor page
   - File: `apps/doctor/src/app/dashboard/blog/new/page.tsx`
   - Title input
   - Slug input (auto-generated from title)
   - Rich text editor integration:
     - **Option A: Tiptap** (Recommended - React-friendly)
     - **Option B: TinyMCE** (Full-featured)
     - **Option C: Quill** (Lightweight)
   - Thumbnail upload (UploadThing)
   - Excerpt field
   - Meta description field
   - Keywords field (optional)
   - Status toggle (Draft/Published)

3. ✅ Create article edit page
   - File: `apps/doctor/src/app/dashboard/blog/[id]/edit/page.tsx`
   - Pre-populate form with existing article data
   - Same form as new article
   - "Update" instead of "Create" button

4. ✅ Implement slug auto-generation
   ```typescript
   function generateSlug(title: string): string {
     return title
       .toLowerCase()
       .normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '') // Remove accents
       .replace(/[^a-z0-9\s-]/g, '')     // Remove special chars
       .replace(/\s+/g, '-')             // Spaces to hyphens
       .replace(/-+/g, '-')              // Multiple hyphens to single
       .trim();
   }

   // Example:
   // "¿Cómo Cuidar Tu Piel?" → "como-cuidar-tu-piel"
   ```

5. ✅ Add navigation link in doctor dashboard
   - Update sidebar/header to include "My Blog" link

**Files to create:**
- `apps/doctor/src/app/dashboard/blog/page.tsx`
- `apps/doctor/src/app/dashboard/blog/new/page.tsx`
- `apps/doctor/src/app/dashboard/blog/[id]/edit/page.tsx`
- `apps/doctor/src/components/blog/ArticleEditor.tsx`
- `apps/doctor/src/components/blog/RichTextEditor.tsx`
- `apps/doctor/src/lib/slug-generator.ts`

**Dependencies to install:**
```bash
cd apps/doctor
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image
# OR
pnpm add @tinymce/tinymce-react
```

**Deliverable:** Doctors can create, edit, and delete articles

---

### Phase 3: Public Blog Pages (3-4 hours)

**Goal:** Display articles on public site

**Tasks:**
1. ✅ Create blog listing page
   - File: `apps/public/src/app/doctores/[slug]/blog/page.tsx`
   - Fetch published articles for this doctor
   - Display as grid/list of cards
   - Each card: thumbnail, title, excerpt, date
   - Link to individual articles
   - Pagination (if > 10 articles)

2. ✅ Create individual article page
   - File: `apps/public/src/app/doctores/[slug]/blog/[articleSlug]/page.tsx`
   - Fetch article by slug
   - Display full content (rich HTML)
   - Show author info (doctor)
   - Navigation (back to blog, back to profile)
   - Previous/Next article links

3. ✅ Update shared layout
   - File: `apps/public/src/app/doctores/[slug]/layout.tsx`
   - Ensure sidebar appears on all pages (profile + blog)

4. ✅ Add navigation between profile and blog
   - Option A: Tab navigation in header
   - Option B: Link in sidebar
   - Option C: Both

5. ✅ Create article card component
   - File: `apps/public/src/components/blog/ArticleCard.tsx`
   - Reusable component for article preview
   - Thumbnail, title, excerpt, date

6. ✅ Create article content component
   - File: `apps/public/src/components/blog/ArticleContent.tsx`
   - Renders rich HTML safely
   - Styles headings, images, lists, etc.

**Files to create:**
- `apps/public/src/app/doctores/[slug]/blog/page.tsx`
- `apps/public/src/app/doctores/[slug]/blog/[articleSlug]/page.tsx`
- `apps/public/src/components/blog/ArticleCard.tsx`
- `apps/public/src/components/blog/ArticleContent.tsx`
- `apps/public/src/components/blog/BlogNavigation.tsx`
- `apps/public/src/lib/articles.ts` (data fetching)

**Deliverable:** Patients can view blog listing and read articles

---

### Phase 4: SEO & Polish (2-3 hours)

**Goal:** Optimize for search engines and user experience

**Tasks:**
1. ✅ Add metadata generation
   - Blog listing metadata (title, description, OG tags)
   - Article metadata (unique per article, OG tags, Twitter cards)

2. ✅ Implement schema.org structured data
   - Blog schema for listing page
   - BlogPosting schema for article pages
   - Inject JSON-LD in page layout

3. ✅ Update sitemap
   - Include blog listing URLs
   - Include all published article URLs
   - Set proper priorities (profile > blog > articles)

4. ✅ Add internal links
   - Profile → Blog (navigation tab or sidebar)
   - Blog → Profile (breadcrumb or header)
   - Articles → Blog listing (back button)
   - Articles → Profile (breadcrumb)
   - Footer/header links across site

5. ✅ Implement social sharing
   - Share buttons (Twitter, Facebook, LinkedIn, WhatsApp)
   - Copy link button
   - Pre-filled share text with article title

6. ✅ Add reading time estimate
   ```typescript
   function calculateReadingTime(content: string): number {
     const wordsPerMinute = 200;
     const textContent = content.replace(/<[^>]*>/g, ''); // Strip HTML
     const wordCount = textContent.split(/\s+/).length;
     return Math.ceil(wordCount / wordsPerMinute);
   }
   ```

7. ✅ Polish UI/UX
   - Consistent spacing and typography
   - Responsive design (mobile, tablet, desktop)
   - Loading states
   - Error states (article not found)
   - Accessibility (keyboard navigation, ARIA labels)

**Files to create/modify:**
- `apps/public/src/lib/structured-data-blog.ts`
- `apps/public/src/app/sitemap.ts` (modify)
- `apps/public/src/components/blog/ShareButtons.tsx`
- `apps/public/src/lib/reading-time.ts`

**Deliverable:** SEO-optimized, polished blog feature

---

### Total Estimated Time: 11-15 hours

**Breakdown:**
- Phase 1 (Database & API): 2-3 hours
- Phase 2 (Doctor Dashboard): 4-5 hours
- Phase 3 (Public Pages): 3-4 hours
- Phase 4 (SEO & Polish): 2-3 hours

---

## Design Decisions to Confirm

Before implementation, please confirm the following:

### 1. Rich Text Editor Features
Which features should the editor have?

**Basic (Recommended for MVP):**
- ✅ Bold, italic, underline
- ✅ Headings (H2, H3)
- ✅ Bullet lists, numbered lists
- ✅ Links
- ✅ Images (inline)

**Advanced (Optional):**
- ⚪ Code blocks
- ⚪ Tables
- ⚪ Video embeds (YouTube, Vimeo)
- ⚪ Blockquotes
- ⚪ Horizontal rules

**Your choice:** ___________________

### 2. Article Permissions
What can doctors do with published articles?

**Options:**
- **A:** Doctors can delete published articles anytime
- **B:** Doctors cannot delete published articles (must contact admin)
- **C:** Doctors can unpublish articles (change status to DRAFT)

**Your choice:** ___________________

### 3. Approval Workflow
Should there be an approval process before publishing?

**Options:**
- **A:** Direct publishing (doctors publish immediately)
- **B:** Admin approval required (doctors submit for review)
- **C:** Hybrid (trusted doctors can publish, new doctors need approval)

**Your choice:** ___________________

### 4. Blog Listing Display
How should articles be displayed on the listing page?

**Options:**
- **A:** All articles on one page (if < 20 total)
- **B:** Paginated (10 articles per page)
- **C:** Infinite scroll (load more on scroll)

**Your choice:** ___________________

**Sort order:**
- **A:** Newest first (publishedAt DESC)
- **B:** Featured/pinned articles first, then newest
- **C:** Most viewed first (requires view tracking)

**Your choice:** ___________________

### 5. Navigation Style
How should users navigate between profile and blog?

**Options:**
- **A:** Tab navigation in header ("Perfil" | "Blog")
- **B:** Link in sidebar ("📝 Ver Blog del Doctor")
- **C:** Both tabs and sidebar link
- **D:** Prominent section on profile page with latest articles

**Your choice:** ___________________

### 6. Article Slug Handling
What if a doctor changes the article title after publishing?

**Options:**
- **A:** Slug never changes (prevents broken links)
- **B:** Slug updates automatically + create 301 redirect from old slug
- **C:** Show warning, let doctor decide

**Your choice:** ___________________

### 7. SEO Sitemap Priority
Should articles be included in the main sitemap?

**Options:**
- **A:** Yes, all published articles (may create large sitemap)
- **B:** Yes, but limit to most recent 50 articles per doctor
- **C:** Separate sitemap for blog (`/blog-sitemap.xml`)

**Your choice:** ___________________

### 8. Social Sharing Features
Which social sharing options?

**Options:**
- **A:** Twitter, Facebook, LinkedIn, WhatsApp
- **B:** Twitter, Facebook, WhatsApp only
- **C:** Just a "Copy Link" button
- **D:** None (save for later)

**Your choice:** ___________________

### 9. Analytics Tracking
Should we track article views?

**Options:**
- **A:** Yes, track views in database (increment on page load)
- **B:** Yes, but use Google Analytics only (no database)
- **C:** No, save for later

**Your choice:** ___________________

### 10. Image Storage
Where should article images (thumbnails, inline) be stored?

**Options:**
- **A:** UploadThing (already used for doctor profiles)
- **B:** Cloudinary (better image optimization)
- **C:** Railway/Vercel blob storage
- **D:** Direct base64 in content (not recommended)

**Your choice:** ___________________

---

## Technical Requirements

### Dependencies to Install

```bash
# Doctor app (article editor)
cd apps/doctor
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link

# Or if using TinyMCE:
pnpm add @tinymce/tinymce-react

# Public app (syntax highlighting, if needed)
cd apps/public
pnpm add react-syntax-highlighter @types/react-syntax-highlighter

# API (HTML sanitization)
cd apps/api
pnpm add dompurify isomorphic-dompurify
```

### Environment Variables

No new environment variables needed (uses existing UploadThing config).

### Performance Considerations

1. **Image optimization:**
   - Use Next.js Image component for thumbnails
   - Lazy load images in article content
   - Serve WebP format when possible

2. **Content rendering:**
   - Server-side render article HTML (not client-side)
   - Use ISR with 60-second revalidation
   - Cache article list responses

3. **Database queries:**
   - Index on `doctorId + status` (for listing queries)
   - Index on `slug` (for individual article lookups)
   - Index on `publishedAt` (for sorting)

4. **Rich text editor:**
   - Dynamically import (don't include in initial bundle)
   - Use code splitting for large editors

---

## Files to Create/Modify

### New Files (19 files)

**Database:**
- ✅ `packages/database/prisma/migrations/XXXXXX_add_article_model/migration.sql`

**API (4 files):**
- ✅ `apps/api/src/app/api/articles/route.ts`
- ✅ `apps/api/src/app/api/articles/[id]/route.ts`
- ✅ `apps/api/src/app/api/doctors/[slug]/articles/route.ts`
- ✅ `apps/api/src/app/api/doctors/[slug]/articles/[articleSlug]/route.ts`

**Doctor Dashboard (5 files):**
- ✅ `apps/doctor/src/app/dashboard/blog/page.tsx`
- ✅ `apps/doctor/src/app/dashboard/blog/new/page.tsx`
- ✅ `apps/doctor/src/app/dashboard/blog/[id]/edit/page.tsx`
- ✅ `apps/doctor/src/components/blog/ArticleEditor.tsx`
- ✅ `apps/doctor/src/components/blog/RichTextEditor.tsx`

**Public Site (9 files):**
- ✅ `apps/public/src/app/doctores/[slug]/blog/page.tsx`
- ✅ `apps/public/src/app/doctores/[slug]/blog/[articleSlug]/page.tsx`
- ✅ `apps/public/src/components/blog/ArticleCard.tsx`
- ✅ `apps/public/src/components/blog/ArticleContent.tsx`
- ✅ `apps/public/src/components/blog/BlogNavigation.tsx`
- ✅ `apps/public/src/components/blog/ShareButtons.tsx`
- ✅ `apps/public/src/lib/articles.ts`
- ✅ `apps/public/src/lib/structured-data-blog.ts`
- ✅ `apps/public/src/lib/reading-time.ts`

### Modified Files (5 files)

**Database:**
- ✅ `packages/database/prisma/schema.prisma` (add Article model)

**Public Site:**
- ✅ `apps/public/src/app/doctores/[slug]/layout.tsx` (ensure sidebar on all pages)
- ✅ `apps/public/src/app/sitemap.ts` (include blog URLs)

**Doctor Dashboard:**
- ✅ `apps/doctor/src/components/Navbar.tsx` (add "My Blog" link)
- ✅ `apps/doctor/src/app/dashboard/page.tsx` (add blog stats widget)

---

## Success Criteria

### Must Have (MVP)
- ✅ Doctors can create, edit, delete articles
- ✅ Articles have DRAFT and PUBLISHED status
- ✅ Rich text editor with basic formatting
- ✅ Thumbnail image upload
- ✅ Public blog listing page shows all published articles
- ✅ Individual article pages are accessible via URL
- ✅ Fixed sidebar visible on all doctor pages
- ✅ SEO metadata (title, description, OG tags)
- ✅ Schema.org structured data (BlogPosting)
- ✅ Articles included in sitemap
- ✅ Mobile responsive

### Nice to Have (Future)
- ⚪ View count tracking
- ⚪ Related articles suggestions
- ⚪ Article categories/tags
- ⚪ Full-text search across articles
- ⚪ Comments section
- ⚪ Social share count
- ⚪ Email newsletter (notify patients of new articles)
- ⚪ Admin can feature articles on homepage
- ⚪ Multi-language support

---

## Risk Assessment

### Low Risk
- ✅ Database migration (well-defined schema)
- ✅ API endpoints (standard CRUD)
- ✅ Public pages (simple SSR)

### Medium Risk
- ⚠️ Rich text editor integration (may have quirks)
- ⚠️ Image upload in editor (inline images can be tricky)
- ⚠️ HTML sanitization (prevent XSS attacks)

### Mitigation Strategies
1. **Rich text editor:** Start with Tiptap (well-documented, React-friendly)
2. **Image upload:** Use existing UploadThing integration
3. **HTML sanitization:** Use `dompurify` library on API before saving
4. **Testing:** Test with various HTML inputs (lists, images, links)

---

## Next Steps

1. **Review this specification document**
   - Confirm all requirements are captured
   - Answer design decision questions above

2. **Prioritize phases**
   - Do we implement all 4 phases or start with MVP (Phases 1-3)?

3. **Choose rich text editor**
   - Tiptap (recommended) or TinyMCE?

4. **Confirm navigation style**
   - Tabs, sidebar link, or both?

5. **Start implementation**
   - Begin with Phase 1 (Database & API)

---

## Related Documentation

- **PROJECT_ARCHITECTURE.md** - Monorepo structure
- **SEO_GUIDE.md** - Content SEO best practices
- **SEO_GUIDE2.md** - 9-stage crawl-index-rank pipeline
- **PHASE_0_SEO_IMPLEMENTATION.md** - Sitemap and robots.txt setup
- **DOCTOR_EDIT_FEATURE_IMPLEMENTATION.md** - Similar feature pattern

---

**Document Status:** 📋 Planning Phase
**Ready for Implementation:** ⏳ Pending design confirmations
**Last Updated:** December 28, 2024

---

## Questions?

Before starting implementation, please provide answers to the 10 design decision questions above. This will ensure we build exactly what you need without rework.

Once confirmed, we can proceed with **Phase 1: Database & API** (estimated 2-3 hours).
