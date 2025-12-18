# SEO Admin Flow V2 - Production-Ready Design

**Version:** 2.0 (Revised based on senior SEO engineer feedback)
**Status:** Production-ready, real-world Google behavior
**Purpose:** Admin-facing SEO monitoring system designed for actual Google constraints

---

## What Changed from V1

### Critical Corrections
1. ✅ **Indexing API is now optional** - Doctor profiles not officially supported, treated as best-effort
2. ✅ **State model is heuristic-based** - No deterministic transitions, derived from Google signals
3. ✅ **contentQualityScore not seoScore** - Clear it's not a ranking predictor
4. ✅ **Canonical validation added** - Prevents duplicate content issues
5. ✅ **Structured data validation** - Validates Physician, MedicalOrganization, FAQPage schemas
6. ✅ **YMYL trust signals** - License number, years experience, clinic verification
7. ✅ **noindex protection** - Low-quality profiles blocked from indexing
8. ✅ **Smart GSC check cadence** - Daily for new, weekly for stable (quota-aware)
9. ✅ **RANKING removed as state** - Now metrics only (clicks/impressions/position)
10. ✅ **Soft-launch state added** - Crawl warm-up before full exposure

---

## Table of Contents
1. [Status Lifecycle (Revised)](#status-lifecycle-revised)
2. [Database Schema](#database-schema)
3. [Content Quality Validator](#content-quality-validator)
4. [Publishing System](#publishing-system)
5. [Google Search Console Integration (Realistic)](#google-search-console-integration-realistic)
6. [Background Jobs (Quota-Aware)](#background-jobs-quota-aware)
7. [Admin UI Components](#admin-ui-components)
8. [Implementation Phases (Pragmatic)](#implementation-phases-pragmatic)

---

## Status Lifecycle (Revised)

### Simplified State Model

```
DRAFT
  ↓ (Admin saves, system validates)
  ↓
PENDING_VALIDATION
  ↓ (Quality score ≥ 70)
  ↓
READY_TO_PUBLISH
  ↓ (Admin clicks "Publish")
  ↓
PUBLISHED
  ↓ (In sitemap, accessible, may have noindex if quality < 85)
  ↓
SOFT_PUBLISHED (Optional - crawl warm-up)
  ↓ (In sitemap, accessible, not linked internally yet)
  ↓
FULLY_PUBLISHED
  ↓ (In sitemap, accessible, linked from /doctors listing)
  ↓
--- Google's side (we observe, not control) ---
  ↓
INDEXED (Derived from GSC signals)
  ↓
ERROR (GSC reported issues)
```

### State Definitions (Production-Ready)

| State | Icon | Description | What Admin Can Do | What System Does |
|-------|------|-------------|-------------------|------------------|
| **DRAFT** | 📝 | Profile incomplete or being edited | Edit, Delete | None |
| **PENDING_VALIDATION** | ⏳ | Saved, system calculating quality score | Edit, View Report | Run quality checks |
| **READY_TO_PUBLISH** | ✅ | Quality score ≥ 70, can go live | Publish, Edit | Waiting |
| **PUBLISHED** | 🌐 | Live on site, in sitemap | Unpublish, Edit, Request indexing | Serve content |
| **SOFT_PUBLISHED** | 🔄 | In sitemap but not linked (crawl warm-up) | Promote to full, Edit | Allow crawling |
| **FULLY_PUBLISHED** | 🌍 | In sitemap AND linked from /doctors | Demote to soft, Edit | Full exposure |
| **INDEXED** | ✅ | Google confirmed indexing (derived) | Monitor, Optimize | Track metrics |
| **ERROR** | ⚠️ | Google reported crawl/index errors | Fix & Republish | Alert admin |

### Important: INDEXED is Derived, Not Controlled

**We do NOT set INDEXED directly. It's derived from Google Search Console signals:**

```typescript
// Heuristic-based status derivation
function deriveIndexingStatus(gscData) {
  if (!gscData) return null; // No GSC data yet

  const { verdict, coverageState, indexingState } = gscData.indexStatusResult || {};

  // Google confirmed indexed
  if (verdict === 'PASS' && coverageState?.includes('indexed')) {
    return 'INDEXED';
  }

  // Google found errors
  if (verdict === 'FAIL' || indexingState === 'INDEXING_NOT_ALLOWED') {
    return 'ERROR';
  }

  // Default: Still waiting for Google
  return null; // Status remains PUBLISHED/FULLY_PUBLISHED
}
```

**No DISCOVERED or SUBMITTED states** - These are too fuzzy and unreliable.

---

## Database Schema

### Updated Doctor Model

```prisma
// packages/database/prisma/schema.prisma

model Doctor {
  // ... existing fields (id, slug, doctorFullName, etc.)

  // Publishing Status
  publishStatus      PublishStatus    @default(DRAFT)
  publishedAt        DateTime?
  softPublishedAt    DateTime?        // For soft-launch
  fullyPublishedAt   DateTime?        // For full exposure
  unpublishedAt      DateTime?

  // Content Quality (NOT ranking predictor)
  contentQualityScore Int             @default(0) // 0-100
  qualityIssues       Json?           // Array of validation issues
  lastQualityCheck    DateTime?

  // SEO Technical
  canonicalUrl        String?         // Self-referencing canonical
  isCanonicalValid    Boolean         @default(false)
  hasValidSchema      Boolean         @default(false) // Physician schema valid
  shouldIndex         Boolean         @default(true)  // Controls robots meta tag

  // YMYL Trust Signals (Critical for medical content)
  licenseNumber       String?         // Medical license
  licenseAuthority    String?         // Issuing authority
  licenseVerified     Boolean         @default(false)
  yearsExperience     Int?
  clinicVerified      Boolean         @default(false)

  // Google Search Console Data (Observed, not controlled)
  gscLastCheck        DateTime?       // When we last checked GSC
  gscNextCheck        DateTime?       // When to check next (smart cadence)
  gscLastCrawl        DateTime?       // When Google last crawled
  gscIndexedAt        DateTime?       // When Google confirmed indexing
  gscStatus           Json?           // Raw GSC inspection result
  gscErrors           Json?           // Errors/warnings from Google

  // Performance Metrics (Not a "state")
  impressions7d       Int             @default(0)
  clicks7d            Int             @default(0)
  avgPosition7d       Float?
  topQuery            String?         // Top search query
  lastMetricsUpdate   DateTime?

  // Audit Trail
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  createdBy           String?         // Admin user ID
  lastEditedBy        String?         // Admin user ID
}

enum PublishStatus {
  DRAFT                // Created but incomplete
  PENDING_VALIDATION   // Saved, quality check running
  READY_TO_PUBLISH     // Quality ≥ 70, can publish
  PUBLISHED            // Live, in sitemap (may have noindex if quality < 85)
  SOFT_PUBLISHED       // In sitemap, not linked yet (crawl warm-up)
  FULLY_PUBLISHED      // In sitemap AND linked from /doctors
  INDEXED              // Google confirmed (derived from GSC)
  ERROR                // GSC reported errors
}
```

### Key Design Decisions

**1. shouldIndex flag**
- If `contentQualityScore < 85` → `shouldIndex = false` → robots meta tag `noindex`
- Protects domain authority from thin content
- Admin can override manually

**2. Smart GSC check cadence**
- New profiles (<30 days): `gscNextCheck` = daily
- Stable profiles (30-90 days): `gscNextCheck` = weekly
- Old profiles (>90 days): `gscNextCheck` = monthly
- Saves quota, focuses on what matters

**3. Separate indexed tracking**
- `publishedAt` - When admin published
- `gscIndexedAt` - When Google confirmed indexing
- These are NOT the same event

---

## Content Quality Validator

### Updated Scoring System

**Important naming:** This is `contentQualityScore`, NOT `seoScore`.

**Admin UI copy:**
> "Content Completeness Score: 85/100
> This measures profile quality, not ranking potential.
> Higher scores improve indexing chances but don't guarantee rankings."

### Validation Rules (Production-Ready)

```typescript
// apps/api/src/lib/content-quality-validator.ts

interface QualityCheck {
  name: string;
  description: string;
  points: number;
  category: 'critical' | 'important' | 'recommended';
  validator: (doctor: Doctor) => boolean;
  recommendation: string;
}

const QUALITY_CHECKS: QualityCheck[] = [
  // === CRITICAL (10 points each) - Must have ===
  {
    name: 'hasName',
    description: 'Doctor full name',
    points: 10,
    category: 'critical',
    validator: (d) => !!d.doctorFullName && d.doctorFullName.length >= 5,
    recommendation: 'Add doctor\'s full name (minimum 5 characters)'
  },
  {
    name: 'hasSpecialty',
    description: 'Primary specialty defined',
    points: 10,
    category: 'critical',
    validator: (d) => !!d.primarySpecialty,
    recommendation: 'Select primary medical specialty'
  },
  {
    name: 'hasServices',
    description: 'At least 3 services listed',
    points: 10,
    category: 'critical',
    validator: (d) => d.services && d.services.length >= 3,
    recommendation: 'Add at least 3 medical services'
  },
  {
    name: 'hasHeroImage',
    description: 'Professional hero image',
    points: 10,
    category: 'critical',
    validator: (d) => !!d.heroImage && d.heroImage.length > 0,
    recommendation: 'Upload professional headshot'
  },
  {
    name: 'hasShortBio',
    description: 'Short biography (50+ chars)',
    points: 10,
    category: 'critical',
    validator: (d) => !!d.shortBio && d.shortBio.length >= 50,
    recommendation: 'Write concise bio (minimum 50 characters)'
  },

  // === YMYL TRUST SIGNALS (10 points each) - Critical for medical ===
  {
    name: 'hasLicenseNumber',
    description: 'Medical license number',
    points: 10,
    category: 'critical',
    validator: (d) => !!d.licenseNumber && d.licenseNumber.length >= 5,
    recommendation: 'Add medical license number (e.g., Cédula Profesional)'
  },
  {
    name: 'hasYearsExperience',
    description: 'Years of experience',
    points: 5,
    category: 'critical',
    validator: (d) => !!d.yearsExperience && d.yearsExperience >= 1,
    recommendation: 'Specify years of medical experience'
  },

  // === IMPORTANT (10 points each) ===
  {
    name: 'hasLongBio',
    description: 'Detailed biography (200+ chars)',
    points: 10,
    category: 'important',
    validator: (d) => !!d.longBio && d.longBio.length >= 200,
    recommendation: 'Add detailed biography (200+ characters) for E-E-A-T'
  },
  {
    name: 'hasClinicInfo',
    description: 'Complete clinic information',
    points: 10,
    category: 'important',
    validator: (d) => !!d.clinicAddress && !!d.clinicPhone && !!d.clinicGeoLat,
    recommendation: 'Add complete clinic address, phone, and coordinates'
  },
  {
    name: 'hasFAQs',
    description: '3+ FAQs for rich snippets',
    points: 10,
    category: 'important',
    validator: (d) => d.faqs && d.faqs.length >= 3,
    recommendation: 'Add at least 3 FAQs for rich snippet eligibility'
  },

  // === TECHNICAL SEO (5-10 points each) ===
  {
    name: 'hasValidCanonical',
    description: 'Canonical URL is valid',
    points: 5,
    category: 'important',
    validator: (d) => {
      const expectedCanonical = `${process.env.NEXT_PUBLIC_BASE_URL}/doctors/${d.slug}`;
      return d.canonicalUrl === expectedCanonical;
    },
    recommendation: 'Canonical URL should be self-referencing'
  },
  {
    name: 'hasValidSchema',
    description: 'Physician schema is valid',
    points: 10,
    category: 'important',
    validator: (d) => d.hasValidSchema === true,
    recommendation: 'Ensure Physician structured data validates'
  },

  // === RECOMMENDED (5 points each) ===
  {
    name: 'hasEducation',
    description: 'Education credentials',
    points: 5,
    category: 'recommended',
    validator: (d) => d.educationItems && d.educationItems.length >= 1,
    recommendation: 'Add education credentials for authority'
  },
  {
    name: 'hasCertificates',
    description: 'Certificates/diplomas',
    points: 5,
    category: 'recommended',
    validator: (d) => d.certificates && d.certificates.length >= 1,
    recommendation: 'Upload professional certificates'
  },
  {
    name: 'hasConditions',
    description: '5+ conditions treated',
    points: 5,
    category: 'recommended',
    validator: (d) => d.conditions && d.conditions.length >= 5,
    recommendation: 'List conditions treated (keyword coverage)'
  },
  {
    name: 'slugValid',
    description: 'SEO-friendly URL slug',
    points: 5,
    category: 'recommended',
    validator: (d) => {
      return !!d.slug
        && /^[a-z0-9-]+$/.test(d.slug)
        && d.slug.length >= 5
        && d.slug.length <= 60;
    },
    recommendation: 'Use lowercase letters, numbers, hyphens (5-60 chars)'
  }
];

// Total possible: 130 points
const MAX_SCORE = QUALITY_CHECKS.reduce((sum, c) => sum + c.points, 0);

export function validateContentQuality(doctor: Doctor) {
  let totalScore = 0;
  const issues: QualityIssue[] = [];
  const checks: Record<string, CheckResult> = {};

  for (const check of QUALITY_CHECKS) {
    const passed = check.validator(doctor);

    checks[check.name] = {
      passed,
      points: passed ? check.points : 0,
      max: check.points,
      category: check.category
    };

    if (passed) {
      totalScore += check.points;
    } else {
      issues.push({
        category: check.category,
        message: check.description + ' is missing',
        field: check.name,
        recommendation: check.recommendation
      });
    }
  }

  // Normalize to 0-100
  const score = Math.round((totalScore / MAX_SCORE) * 100);

  // Determine status
  let status: PublishStatus;
  if (score < 50) {
    status = 'DRAFT';
  } else if (score < 70) {
    status = 'PENDING_VALIDATION';
  } else {
    status = 'READY_TO_PUBLISH';
  }

  // Determine if should be indexed
  // Threshold: 85+ for indexing (prevents thin content)
  const shouldIndex = score >= 85;

  return {
    contentQualityScore: score,
    status,
    issues: issues.sort((a, b) => {
      const order = { critical: 0, important: 1, recommended: 2 };
      return order[a.category] - order[b.category];
    }),
    checks,
    canPublish: score >= 70,
    shouldIndex,
    nextSteps: generateNextSteps(issues)
  };
}

// Structured Data Validation
export async function validateStructuredData(doctor: Doctor): Promise<boolean> {
  const schemas = generateAllSchemas(doctor, process.env.NEXT_PUBLIC_BASE_URL);

  try {
    // Validate each schema against schema.org spec
    for (const schema of schemas) {
      // Check required fields for Physician
      if (schema['@type'] === 'Physician') {
        if (!schema.name || !schema.medicalSpecialty) {
          return false;
        }
      }

      // Check required fields for MedicalBusiness
      if (schema['@type'] === 'MedicalBusiness') {
        if (!schema.address || !schema.telephone) {
          return false;
        }
      }

      // Check FAQPage structure
      if (schema['@type'] === 'FAQPage') {
        if (!schema.mainEntity || schema.mainEntity.length === 0) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Schema validation error:', error);
    return false;
  }
}
```

### Publishing Requirements

**Minimum to publish (score ≥ 70):**
- ✅ All critical fields complete
- ✅ Medical license number
- ✅ Years of experience

**Recommended for indexing (score ≥ 85):**
- ✅ Long bio
- ✅ FAQs
- ✅ Valid schema
- ✅ Complete clinic info

**If score 70-84:**
- ✅ Can publish
- ⚠️ Will have `<meta name="robots" content="noindex">` until improved
- Admin sees warning: "Profile will be published but not indexed until quality improves to 85+"

---

## Publishing System

### Publishing Flow (Revised)

```typescript
// apps/api/src/app/api/doctors/[id]/publish/route.ts

export async function POST(request: Request, { params }) {
  const { id } = params;
  const body = await request.json();
  const { useSoftLaunch = false } = body;

  // 1. Validate quality score
  const doctor = await prisma.doctor.findUnique({ where: { id } });
  const validation = validateContentQuality(doctor);

  if (!validation.canPublish) {
    return NextResponse.json({
      success: false,
      error: 'Quality score too low',
      message: 'Minimum score of 70 required to publish',
      currentScore: validation.contentQualityScore,
      issues: validation.issues
    }, { status: 400 });
  }

  // 2. Validate structured data
  const hasValidSchema = await validateStructuredData(doctor);

  // 3. Generate canonical URL
  const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/doctors/${doctor.slug}`;

  // 4. Determine if should index
  const shouldIndex = validation.shouldIndex; // score ≥ 85

  // 5. Update doctor
  const updateData: any = {
    contentQualityScore: validation.contentQualityScore,
    qualityIssues: validation.issues,
    canonicalUrl,
    isCanonicalValid: true,
    hasValidSchema,
    shouldIndex,
    lastQualityCheck: new Date()
  };

  if (useSoftLaunch) {
    updateData.publishStatus = 'SOFT_PUBLISHED';
    updateData.softPublishedAt = new Date();
  } else {
    updateData.publishStatus = 'FULLY_PUBLISHED';
    updateData.fullyPublishedAt = new Date();
    updateData.publishedAt = updateData.publishedAt || new Date();
  }

  // Set next GSC check (daily for new profiles)
  updateData.gscNextCheck = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const updatedDoctor = await prisma.doctor.update({
    where: { id },
    data: updateData
  });

  // 6. Trigger revalidation
  await Promise.all([
    // Revalidate sitemap
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=/sitemap.xml`, {
      method: 'POST'
    }),
    // Revalidate doctor page
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=/doctors/${doctor.slug}`, {
      method: 'POST'
    }),
    // Revalidate doctors listing (if fully published)
    !useSoftLaunch && fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}&path=/doctors`, {
      method: 'POST'
    })
  ]);

  return NextResponse.json({
    success: true,
    data: {
      doctorId: updatedDoctor.id,
      slug: updatedDoctor.slug,
      status: updatedDoctor.publishStatus,
      publishedAt: updatedDoctor.publishedAt,
      liveUrl: canonicalUrl,
      shouldIndex,
      contentQualityScore: validation.contentQualityScore,
      warnings: shouldIndex ? [] : [
        'Profile published with noindex due to quality score < 85. Improve content to enable indexing.'
      ]
    }
  });
}
```

### Sitemap Generation (Respects noindex)

```typescript
// apps/public/src/app/sitemap.ts

import { MetadataRoute } from 'next'
import { getAllDoctors } from '@/lib/data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://healthcarepublic-production.up.railway.app'

  // Get all doctors
  const doctors = await getAllDoctors();

  // Filter: Only include doctors that should be indexed
  // (SOFT_PUBLISHED and FULLY_PUBLISHED with shouldIndex=true)
  const indexableDoctors = doctors.filter(d =>
    (d.publishStatus === 'SOFT_PUBLISHED' || d.publishStatus === 'FULLY_PUBLISHED')
    && d.shouldIndex === true
  );

  const doctorPages: MetadataRoute.Sitemap = indexableDoctors.map((doctor) => ({
    url: `${baseUrl}/doctors/${doctor.slug}`,
    lastModified: doctor.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/doctors`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    }
  ];

  return [...staticPages, ...doctorPages];
}
```

### Doctor Page Metadata (noindex control)

```typescript
// apps/public/src/app/doctors/[slug]/layout.tsx

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    return { title: 'Doctor Not Found' };
  }

  const baseMetadata = generateDoctorMetadata(doctor, process.env.NEXT_PUBLIC_BASE_URL);

  // Add noindex if quality score < 85
  if (!doctor.shouldIndex) {
    baseMetadata.robots = {
      index: false,
      follow: true,
      nocache: false
    };
  }

  return baseMetadata;
}
```

---

## Google Search Console Integration (Realistic)

### API Usage Policy (Honest)

**URL Inspection API:** ✅ Use this
- Purpose: Check indexing status
- Works reliably for all pages
- Quota: 2,000 requests/day (plenty for smart cadence)

**Indexing API:** ⚠️ Best-effort only
- Purpose: Request immediate indexing
- **Reality:** Only officially supports JobPosting, BroadcastEvent, LiveStream
- Doctor profiles are NOT officially supported
- May work, may be ignored, may waste quota
- **Decision:** Make it optional, set expectations low

### Implementation (Production-Ready)

```typescript
// apps/api/src/lib/google-search-console.ts

import { google } from 'googleapis';

const searchconsole = google.searchconsole('v1');

export async function inspectUrl(url: string) {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  const authClient = await auth.getClient();

  try {
    const response = await searchconsole.urlInspection.index.inspect({
      auth: authClient,
      requestBody: {
        inspectionUrl: url,
        siteUrl: process.env.SEARCH_CONSOLE_SITE_URL
      }
    });

    return {
      success: true,
      data: response.data.inspectionResult
    };
  } catch (error) {
    console.error('[GSC] URL Inspection failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// OPTIONAL: Request indexing (best-effort)
export async function requestIndexing(url: string) {
  // Admin UI should say:
  // "Request indexing (may be ignored by Google for doctor profiles)"

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/indexing']
  });

  const authClient = await auth.getClient();
  const accessToken = await authClient.getAccessToken();

  try {
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken.token}`
      },
      body: JSON.stringify({
        url: url,
        type: 'URL_UPDATED'
      })
    });

    const result = await response.json();

    // Log but don't guarantee success
    console.log('[GSC] Indexing request sent (best-effort):', result);

    return {
      success: response.ok,
      message: 'Request sent to Google. Doctor profiles may not be prioritized.',
      data: result
    };
  } catch (error) {
    console.error('[GSC] Indexing request failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getSearchAnalytics(url: string, days = 7) {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  const authClient = await auth.getClient();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  try {
    const response = await searchconsole.searchanalytics.query({
      auth: authClient,
      siteUrl: process.env.SEARCH_CONSOLE_SITE_URL,
      requestBody: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{
            dimension: 'page',
            expression: url
          }]
        }],
        rowLimit: 10
      }
    });

    const rows = response.data.rows || [];

    if (rows.length === 0) {
      return {
        success: true,
        data: {
          impressions: 0,
          clicks: 0,
          avgPosition: null,
          topQuery: null
        }
      };
    }

    const totals = rows.reduce((acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      positionSum: acc.positionSum + (row.position * row.impressions)
    }), { impressions: 0, clicks: 0, positionSum: 0 });

    return {
      success: true,
      data: {
        impressions: totals.impressions,
        clicks: totals.clicks,
        avgPosition: totals.impressions > 0 ? totals.positionSum / totals.impressions : null,
        topQuery: rows[0]?.keys[0] || null
      }
    };
  } catch (error) {
    console.error('[GSC] Search Analytics failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## Background Jobs (Quota-Aware)

### Smart Check Cadence

```typescript
// apps/api/src/lib/gsc-check-cadence.ts

export function calculateNextCheckTime(doctor: Doctor): Date {
  const now = new Date();
  const publishedDaysAgo = doctor.publishedAt
    ? Math.floor((now.getTime() - doctor.publishedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // New profiles (< 30 days): Check daily
  if (publishedDaysAgo < 30) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
  }

  // Maturing profiles (30-90 days): Check every 3 days
  if (publishedDaysAgo < 90) {
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
  }

  // Established profiles (> 90 days): Check weekly
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
}
```

### Daily Cron Job (Revised)

```typescript
// apps/api/src/jobs/check-seo-status.ts

import { PrismaClient } from '@healthcare/database';
import { inspectUrl, getSearchAnalytics } from '@/lib/google-search-console';
import { calculateNextCheckTime } from '@/lib/gsc-check-cadence';

const prisma = new PrismaClient();

export async function checkSeoStatusJob() {
  console.log('[SEO Job] Starting GSC status check...');

  // Get doctors that are due for checking
  const doctors = await prisma.doctor.findMany({
    where: {
      publishStatus: {
        in: ['PUBLISHED', 'SOFT_PUBLISHED', 'FULLY_PUBLISHED', 'INDEXED']
      },
      OR: [
        { gscNextCheck: null },
        { gscNextCheck: { lte: new Date() } }
      ]
    },
    orderBy: {
      publishedAt: 'desc' // Newest first
    }
  });

  console.log(`[SEO Job] Found ${doctors.length} doctors to check`);

  let checksPerformed = 0;
  const MAX_CHECKS_PER_RUN = 500; // Stay well under 2,000/day quota

  for (const doctor of doctors) {
    if (checksPerformed >= MAX_CHECKS_PER_RUN) {
      console.log(`[SEO Job] Reached daily limit (${MAX_CHECKS_PER_RUN}), stopping`);
      break;
    }

    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/doctors/${doctor.slug}`;

    try {
      // Check GSC status
      const inspection = await inspectUrl(url);
      checksPerformed++;

      if (inspection.success) {
        const updates: any = {
          gscLastCheck: new Date(),
          gscStatus: inspection.data,
          gscNextCheck: calculateNextCheckTime(doctor)
        };

        const indexStatus = inspection.data.indexStatusResult;

        if (indexStatus?.lastCrawlTime) {
          updates.gscLastCrawl = new Date(indexStatus.lastCrawlTime);
        }

        // Derive status from GSC signals (heuristic)
        const derivedStatus = deriveIndexingStatus(inspection.data);

        if (derivedStatus === 'INDEXED') {
          updates.publishStatus = 'INDEXED';
          updates.gscIndexedAt = updates.gscIndexedAt || new Date();

          // If indexed, fetch analytics
          const analytics = await getSearchAnalytics(url, 7);
          checksPerformed++; // Analytics counts toward quota too

          if (analytics.success) {
            updates.impressions7d = analytics.data.impressions;
            updates.clicks7d = analytics.data.clicks;
            updates.avgPosition7d = analytics.data.avgPosition;
            updates.topQuery = analytics.data.topQuery;
            updates.lastMetricsUpdate = new Date();
          }
        } else if (derivedStatus === 'ERROR') {
          updates.publishStatus = 'ERROR';
          updates.gscErrors = indexStatus.pageIndexingReport?.issues || [];
        }

        await prisma.doctor.update({
          where: { id: doctor.id },
          data: updates
        });

        console.log(`[SEO Job] ✅ ${doctor.doctorFullName}: ${updates.publishStatus || doctor.publishStatus}`);

      } else {
        console.error(`[SEO Job] ❌ ${doctor.doctorFullName}: GSC check failed`);

        // Schedule retry sooner
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            gscNextCheck: new Date(Date.now() + 6 * 60 * 60 * 1000) // Retry in 6 hours
          }
        });
      }

      // Rate limiting: 100ms between requests (max 600/min, well under quota)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`[SEO Job] Error checking ${doctor.slug}:`, error);
    }
  }

  console.log(`[SEO Job] Completed! Checked ${checksPerformed} doctors.`);
}

// Helper: Derive status from GSC data (heuristic-based)
function deriveIndexingStatus(gscData: any): 'INDEXED' | 'ERROR' | null {
  if (!gscData?.indexStatusResult) return null;

  const { verdict, coverageState, indexingState } = gscData.indexStatusResult;

  // Google confirmed indexed
  if (verdict === 'PASS' && coverageState?.toLowerCase().includes('indexed')) {
    return 'INDEXED';
  }

  // Google reported errors
  if (verdict === 'FAIL' || indexingState === 'INDEXING_NOT_ALLOWED') {
    return 'ERROR';
  }

  // Still waiting
  return null;
}

// Schedule with cron (runs daily at 2 AM)
export function scheduleSeoStatusJob() {
  const cron = require('node-cron');

  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    await checkSeoStatusJob();
  });

  console.log('[SEO Job] Scheduled to run daily at 2:00 AM');
}
```

---

## Admin UI Components

### 1. Doctor Listing Page - Realistic Status Badges

```tsx
// apps/admin/src/app/doctors/page.tsx

<table>
  <thead>
    <tr>
      <th>Doctor Name</th>
      <th>Specialty</th>
      <th>Quality Score</th>
      <th>Status</th>
      <th>Google Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {doctors.map(doctor => (
      <tr key={doctor.id}>
        <td>{doctor.doctorFullName}</td>
        <td>{doctor.primarySpecialty}</td>
        <td>
          <QualityScoreBadge score={doctor.contentQualityScore} />
          {/* Shows: 85/100 with color */}
          {!doctor.shouldIndex && (
            <Tooltip content="Quality too low for indexing">
              ⚠️
            </Tooltip>
          )}
        </td>
        <td>
          <PublishStatusBadge status={doctor.publishStatus} />
          {/*
            DRAFT: Gray
            READY_TO_PUBLISH: Green
            FULLY_PUBLISHED: Blue
            SOFT_PUBLISHED: Purple
          */}
        </td>
        <td>
          {doctor.publishStatus === 'INDEXED' ? (
            <IndexedBadge
              impressions={doctor.impressions7d}
              clicks={doctor.clicks7d}
            />
          ) : doctor.publishStatus === 'ERROR' ? (
            <ErrorBadge errors={doctor.gscErrors} />
          ) : (
            <span className="text-gray-500">Not indexed yet</span>
          )}
        </td>
        <td>
          <Link href={`/doctors/${doctor.id}/edit`}>Edit</Link>
          {doctor.publishStatus === 'READY_TO_PUBLISH' && (
            <button onClick={() => publishDoctor(doctor.id)}>
              Publish
            </button>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### 2. Doctor Edit Page - SEO Panel (Revised)

```tsx
// apps/admin/src/app/doctors/[id]/edit/SeoPanel.tsx

<div className="seo-panel">
  <h2>SEO Status</h2>

  {/* Content Quality Score (NOT ranking predictor) */}
  <div className="quality-card">
    <h3>Content Completeness Score</h3>
    <CircularProgress value={doctor.contentQualityScore} />
    <p className="score">{doctor.contentQualityScore}/100</p>

    <p className="disclaimer">
      This measures profile quality, not ranking potential.
      Higher scores improve indexing chances but don't guarantee rankings.
    </p>

    {doctor.contentQualityScore < 70 && (
      <Alert type="error">
        Minimum score of 70 required to publish
      </Alert>
    )}

    {doctor.contentQualityScore >= 70 && doctor.contentQualityScore < 85 && (
      <Alert type="warning">
        Profile can be published but will have "noindex" until score reaches 85.
        This protects domain authority from thin content.
      </Alert>
    )}
  </div>

  {/* Publishing Status */}
  <div className="status-card">
    <PublishStatusBadge status={doctor.publishStatus} size="large" />
    <p>{getStatusDescription(doctor.publishStatus)}</p>

    {doctor.publishedAt && (
      <p className="meta">
        Published: {formatDate(doctor.publishedAt)}
      </p>
    )}
  </div>

  {/* Checklist */}
  <div className="checklist">
    <h3>Content Quality Checklist</h3>

    <div className="category">
      <h4>Critical (Must Have)</h4>
      {getCriticalChecks(doctor.checks).map(check => (
        <ChecklistItem key={check.name} check={check} />
      ))}
    </div>

    <div className="category">
      <h4>Important (Recommended)</h4>
      {getImportantChecks(doctor.checks).map(check => (
        <ChecklistItem key={check.name} check={check} />
      ))}
    </div>

    <div className="category">
      <h4>Optional (Nice to Have)</h4>
      {getRecommendedChecks(doctor.checks).map(check => (
        <ChecklistItem key={check.name} check={check} />
      ))}
    </div>
  </div>

  {/* Actions */}
  <div className="actions">
    <button onClick={revalidateQuality}>
      Re-check Quality Score
    </button>

    {doctor.publishStatus === 'READY_TO_PUBLISH' && (
      <>
        <button onClick={() => publishDoctor(false)} className="primary">
          Publish to Web
        </button>
        <button onClick={() => publishDoctor(true)} className="secondary">
          Soft Launch (Crawl Warm-up)
        </button>
      </>
    )}

    {['PUBLISHED', 'SOFT_PUBLISHED', 'FULLY_PUBLISHED'].includes(doctor.publishStatus) && (
      <>
        <a href={doctor.canonicalUrl} target="_blank" className="button">
          View Live Profile
        </a>
        <button onClick={requestGoogleIndexing} className="secondary">
          Request Google Indexing (May Be Ignored)
        </button>
      </>
    )}

    {doctor.publishStatus === 'INDEXED' && (
      <button onClick={viewGscReport}>
        View Google Search Console Report
      </button>
    )}
  </div>

  {/* Google Search Console Data */}
  {doctor.publishStatus === 'INDEXED' && (
    <div className="gsc-metrics">
      <h3>Search Performance (Last 7 Days)</h3>
      <p className="note">
        These are observed metrics from Google, not controlled by us.
      </p>

      <div className="metrics-grid">
        <MetricCard
          label="Impressions"
          value={doctor.impressions7d}
          icon="👀"
          help="Times your profile appeared in search results"
        />
        <MetricCard
          label="Clicks"
          value={doctor.clicks7d}
          icon="🖱️"
          help="Times someone clicked your profile from search"
        />
        <MetricCard
          label="Avg. Position"
          value={doctor.avgPosition7d?.toFixed(1)}
          icon="📊"
          help="Average ranking position (lower is better)"
        />
        {doctor.topQuery && (
          <MetricCard
            label="Top Query"
            value={doctor.topQuery}
            icon="🔍"
            help="Most common search term"
          />
        )}
      </div>

      <p className="last-updated">
        Last updated: {formatDate(doctor.lastMetricsUpdate)}
        <br />
        Next check: {formatDate(doctor.gscNextCheck)}
      </p>
    </div>
  )}

  {/* Technical SEO Status */}
  <div className="technical-seo">
    <h3>Technical SEO</h3>
    <StatusItem
      label="Canonical URL"
      value={doctor.canonicalUrl}
      status={doctor.isCanonicalValid ? 'valid' : 'invalid'}
    />
    <StatusItem
      label="Structured Data"
      value="Physician, MedicalBusiness, FAQPage"
      status={doctor.hasValidSchema ? 'valid' : 'invalid'}
    />
    <StatusItem
      label="Indexing"
      value={doctor.shouldIndex ? 'Allowed' : 'Blocked (noindex)'}
      status={doctor.shouldIndex ? 'valid' : 'warning'}
      help={!doctor.shouldIndex ? 'Improve quality score to 85+ to enable indexing' : undefined}
    />
  </div>
</div>
```

### 3. "Request Indexing" Button (Honest UI)

```tsx
// apps/admin/src/components/RequestIndexingButton.tsx

function RequestIndexingButton({ doctorId, doctorSlug }) {
  const [requested, setRequested] = useState(false);

  const handleClick = async () => {
    const confirmed = confirm(
      'Request Google Indexing?\n\n' +
      '⚠️ Important: Google\'s Indexing API officially supports only ' +
      'JobPosting, BroadcastEvent, and LiveStream content types.\n\n' +
      'Doctor profiles may be ignored by this API.\n\n' +
      'We recommend waiting for natural crawling (1-7 days) instead.'
    );

    if (!confirmed) return;

    const response = await fetch(`/api/doctors/${doctorId}/request-indexing`, {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      alert(
        '✅ Indexing request sent to Google.\n\n' +
        'However, Google may ignore this request for doctor profiles.\n' +
        'Monitor status in the next 24-48 hours.'
      );
      setRequested(true);
    } else {
      alert('❌ Request failed: ' + result.error);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={requested}
      className="secondary"
    >
      {requested ? '✅ Requested' : 'Request Google Indexing (May Be Ignored)'}
    </button>
  );
}
```

---

## Implementation Phases (Pragmatic)

### Phase 0: Foundation (TODAY - 1 hour)
**Goal:** Make site crawlable and discoverable

**Tasks:**
1. ✅ Create `robots.ts` with proper allow rules
2. ✅ Create `sitemap.ts` (respects shouldIndex flag)
3. ✅ Create `/doctors` listing page (public)
4. ✅ Add canonical tags to all doctor pages
5. ✅ Deploy and verify

**Files to create:**
- `apps/public/src/app/robots.ts`
- `apps/public/src/app/sitemap.ts`
- `apps/public/src/app/doctors/page.tsx`

**Deliverable:** Site is crawlable, URLs discoverable via sitemap

---

### Phase 1: Content Quality System (THIS WEEK - 6 hours)
**Goal:** Prevent low-quality profiles from being published

**Tasks:**
1. ✅ Add database fields (contentQualityScore, shouldIndex, etc.)
2. ✅ Implement content quality validator
3. ✅ Add structured data validator
4. ✅ Create `/api/doctors/:id/validate-quality` endpoint
5. ✅ Add quality score display to admin UI
6. ✅ Implement publishing gate (score ≥ 70)
7. ✅ Add noindex control for score < 85

**Database migration:**
```prisma
// Add to Doctor model
contentQualityScore Int @default(0)
qualityIssues Json?
shouldIndex Boolean @default(true)
canonicalUrl String?
isCanonicalValid Boolean @default(false)
hasValidSchema Boolean @default(false)
licenseNumber String?
yearsExperience Int?
```

**Deliverable:** Admins see quality score, can only publish if ≥ 70

---

### Phase 2: Publishing System (WEEK 2 - 4 hours)
**Goal:** One-click publishing with automatic revalidation

**Tasks:**
1. ✅ Create `/api/doctors/:id/publish` endpoint
2. ✅ Implement sitemap/ISR revalidation triggers
3. ✅ Add "Publish" button in admin UI
4. ✅ Add soft-launch option
5. ✅ Implement unpublish functionality

**Deliverable:** Admin clicks "Publish" → Doctor goes live, sitemap updates

---

### Phase 3: Google Search Console Setup (WEEK 2 - 3 hours)
**Goal:** Enable GSC monitoring

**Tasks:**
1. ✅ Create Google Cloud Project
2. ✅ Enable Search Console API
3. ✅ Create service account
4. ✅ Verify domain in GSC
5. ✅ Grant service account access
6. ✅ Test URL Inspection API

**Environment variables:**
```bash
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/credentials.json
SEARCH_CONSOLE_SITE_URL=https://healthcarepublic-production.up.railway.app
```

**Deliverable:** Can query GSC API for indexing status

---

### Phase 4: Background Monitoring (WEEK 3 - 4 hours)
**Goal:** Automatic status tracking

**Tasks:**
1. ✅ Implement smart check cadence logic
2. ✅ Create daily cron job
3. ✅ Implement status derivation (heuristic-based)
4. ✅ Add analytics fetching
5. ✅ Display metrics in admin UI

**Deliverable:** System auto-checks GSC daily, updates doctor status

---

### Phase 5: Dashboard & Insights (WEEK 4 - 4 hours)
**Goal:** High-level SEO overview

**Tasks:**
1. ✅ Create SEO dashboard page
2. ✅ Add summary metrics (total published, indexed, etc.)
3. ✅ Show "needs attention" alerts
4. ✅ Add export functionality
5. ✅ Create email notifications

**Deliverable:** Admin sees SEO health at a glance

---

## Key Differences from V1

### What Changed (Production-Ready)

| Aspect | V1 (Idealistic) | V2 (Realistic) |
|--------|-----------------|----------------|
| **Indexing API** | Relied on it | Optional, best-effort only |
| **State transitions** | Deterministic (PUBLISHED → SUBMITTED → DISCOVERED → INDEXED) | Heuristic (PUBLISHED → maybe INDEXED, derived from signals) |
| **Score naming** | seoScore | contentQualityScore (not ranking predictor) |
| **RANKING state** | Formal state | Removed - just metrics now |
| **GSC checks** | Daily for all | Smart cadence (daily/weekly/monthly) |
| **Index control** | Assumed all published = indexed | noindex for quality < 85 |
| **Canonical** | Not mentioned | Required validation |
| **Schema validation** | Mentioned, not validated | Actual validation logic |
| **YMYL signals** | Not included | License, experience, verification |
| **A/B testing** | Phase 5 | Removed (low ROI) |

### What Stayed (Still Excellent)

- ✅ Admin workflow (create → validate → publish → monitor)
- ✅ Quality gating (can't publish if score < 70)
- ✅ SEO as lifecycle, not checkbox
- ✅ Sitemap auto-regeneration
- ✅ ISR revalidation
- ✅ Dashboard concept
- ✅ Metrics tracking (impressions, clicks, position)

---

## Summary: Realistic Admin Flow

```
Admin creates doctor profile
  ↓
System calculates contentQualityScore (0-100)
  ↓
Shows checklist of missing items
  ↓
Admin fixes issues until score ≥ 70
  ↓
Admin clicks "Publish to Web"
  ↓
System:
  - Updates status to PUBLISHED or FULLY_PUBLISHED
  - Sets shouldIndex = (score ≥ 85)
  - Adds <meta name="robots" content="noindex"> if score < 85
  - Regenerates sitemap (only includes shouldIndex=true)
  - Revalidates ISR cache
  ↓
Profile is live (but may have noindex)
  ↓
Admin optionally clicks "Request Indexing (May Be Ignored)"
  ↓
System sends best-effort request to Google Indexing API
  ↓
Background job (daily for new, weekly for stable):
  - Calls URL Inspection API
  - Derives status from GSC signals (heuristic)
  - Updates to INDEXED if Google confirms
  - Fetches analytics (impressions, clicks, position)
  ↓
Admin sees:
  - Quality score with honest messaging
  - Publish status (not Google-controlled)
  - Google status (observed, not controlled)
  - Metrics (when indexed)
  - Realistic expectations ("may be ignored")
```

---

## Next Steps

**Recommended sequence:**

1. **Review this V2 design** - Confirm approach matches your expectations
2. **Implement Phase 0** (1 hour) - robots.txt, sitemap, /doctors page, canonicals
3. **Deploy and verify** - Test in production on Railway
4. **Implement Phase 1** (6 hours) - Quality validation system
5. **Implement Phase 2** (4 hours) - Publishing system
6. **Phase 3-5** - GSC integration + monitoring (as needed)

**Total time estimate:**
- Phase 0: 1 hour (critical, do today)
- Phase 1-2: 10 hours (important, do this week)
- Phase 3-5: 11 hours (nice-to-have, do when ready)

---

**Document Version:** 2.0 (Production-Ready)
**Based on:** Senior SEO engineer feedback
**Date:** December 17, 2024
**Status:** Ready for implementation
