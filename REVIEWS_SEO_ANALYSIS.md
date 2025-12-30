# Reviews SEO Analysis & Implementation Plan

**Date:** December 29, 2025
**Context:** Adding review system to doctor profiles with SEO optimization
**Priority:** HIGH - Reviews are critical for SEO and local search ranking

---

## Current SEO Architecture

### Server-Side Rendering (SSR) with ISR
- **Pattern:** Incremental Static Regeneration (ISR)
- **Revalidation:** Every 1 hour (`revalidate = 3600`)
- **Data Source:** API endpoint fetches complete doctor profile
- **Schema Injection:** Layout.tsx injects structured data in `<head>`

### Existing Structured Data
1. **Physician Schema** - Doctor's professional info
2. **MedicalBusiness Schema** - Clinic location, hours, geo coordinates
3. **FAQPage Schema** - Doctor's FAQs
4. **VideoObject Schema** - Video carousel items

### Current Content Flow
```
Server → getDoctorBySlug() → Doctor Data → SSR → HTML with Schema → Google
```

---

## Why Reviews Are Critical for SEO

### 1. Local Search Ranking Factors
- **Google My Business equivalent:** Reviews signal trust and quality
- **Star ratings:** Appear in search results (rich snippets)
- **Review count:** More reviews = higher local ranking
- **Recency:** Recent reviews boost freshness signals

### 2. Rich Snippets in Search Results
- **AggregateRating:** Shows star rating (⭐4.8/5) in search results
- **Review snippets:** Individual reviews can appear in search
- **Higher CTR:** Rich snippets increase click-through rate by 20-30%

### 3. Content Quality Signals
- **User-generated content:** Fresh, unique content that Google loves
- **Keyword diversity:** Patients use natural language in reviews
- **Long-tail keywords:** Reviews contain specific symptoms, conditions
- **Social proof:** Reduces bounce rate, increases engagement

### 4. YMYL (Your Money, Your Life) Trust
- Healthcare is YMYL category - requires high trust signals
- Reviews provide third-party validation
- Patient testimonials boost E-E-A-T (Experience, Expertise, Authoritativeness, Trust)

---

## Required Schema.org Markup

### 1. AggregateRating Schema
**Add to Physician schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "Physician",
  "name": "Dr. María López",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "bestRating": "5",
    "worstRating": "1",
    "ratingCount": "127"
  }
}
```

**SEO Impact:**
- ⭐ Star rating appears in Google search results
- 📈 Higher click-through rate (CTR)
- 🏆 Competitive advantage in search listings

### 2. Review Schema (Individual Reviews)
**Add separate schema for each review:**
```json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "author": {
    "@type": "Person",
    "name": "Juan Pérez"
  },
  "datePublished": "2025-12-29",
  "reviewBody": "Excelente atención, muy profesional...",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "5",
    "bestRating": "5",
    "worstRating": "1"
  },
  "itemReviewed": {
    "@type": "Physician",
    "name": "Dr. María López"
  }
}
```

**SEO Impact:**
- 📝 Individual reviews can appear in search snippets
- 🔍 Review content gets indexed and searchable
- 💬 Increases page word count and keyword diversity

---

## Implementation Requirements for SEO

### ❌ WRONG: Client-Side Fetch (Current review form page)
```tsx
// apps/public/src/app/review/[token]/page.tsx
'use client';  // ❌ Client-side only

const [data, setData] = useState(null);

useEffect(() => {
  fetch('/api/reviews').then(...)  // ❌ Not in HTML for Google
}, []);
```

**Why it's bad for SEO:**
- ❌ Google doesn't execute `useEffect`
- ❌ Reviews not in initial HTML response
- ❌ No schema.org markup in server response
- ❌ Slower indexing (Google must render JavaScript)
- ❌ No rich snippets in search results

### ✅ CORRECT: Server-Side Fetch + SSR
```tsx
// apps/public/src/app/doctores/[slug]/page.tsx
export default async function DoctorProfilePage({ params }) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);
  const reviews = await getReviewsByDoctorId(doctor.id);  // ✅ Server-side

  return <DoctorProfileClient doctor={doctor} reviews={reviews} />;
}

export const revalidate = 3600;  // ✅ ISR with 1-hour revalidation
```

**Why it's good for SEO:**
- ✅ Reviews in HTML from server
- ✅ Google indexes immediately (no JS execution needed)
- ✅ Schema.org markup in `<head>`
- ✅ Fast LCP (Largest Contentful Paint)
- ✅ Rich snippets eligible

---

## Recommended Architecture

### Option A: Add reviews to existing API endpoint (RECOMMENDED)
**Modify:** `apps/api/src/app/api/doctors/[slug]/route.ts`

```typescript
// GET /api/doctors/[slug] - Already fetches doctor data
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const doctor = await prisma.doctor.findUnique({
    where: { slug: params.slug },
    include: {
      services: true,
      educationItems: true,
      certificates: true,
      carouselItems: true,
      faqs: true,
      reviews: {                              // ✅ ADD THIS
        where: { approved: true },
        select: {
          id: true,
          patientName: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,  // Limit to most recent 50 reviews
      },
    },
  });

  // Calculate aggregate rating
  const reviewCount = doctor.reviews.length;
  const avgRating = reviewCount > 0
    ? doctor.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
    : 0;

  return NextResponse.json({
    ...doctor,
    reviewStats: {
      averageRating: avgRating,
      reviewCount: reviewCount,
    },
  });
}
```

**Advantages:**
- ✅ Single API call for all doctor data
- ✅ Reviews cached with ISR (1 hour)
- ✅ Minimal changes to existing code
- ✅ Reviews available in initial server render

**Disadvantage:**
- ⚠️ New reviews take up to 1 hour to appear (ISR revalidation)
- 🔧 Can be solved with on-demand revalidation

### Option B: Separate reviews API endpoint
**Create:** `apps/api/src/app/api/doctors/[slug]/reviews/route.ts`

**Advantages:**
- ✅ Can revalidate reviews independently
- ✅ Lighter payload if doctor data doesn't change

**Disadvantages:**
- ❌ Two API calls during server render
- ❌ More complex caching strategy
- ❌ Not recommended for SEO (slower initial load)

---

## Schema.org Implementation Plan

### Step 1: Update structured-data.ts
**File:** `apps/public/src/lib/structured-data.ts`

**Add:**
```typescript
/**
 * Generate AggregateRating schema for doctor reviews
 */
export function generateAggregateRatingSchema(
  reviewStats: { averageRating: number; reviewCount: number }
) {
  if (reviewStats.reviewCount === 0) return null;

  return {
    '@type': 'AggregateRating',
    ratingValue: reviewStats.averageRating.toFixed(1),
    bestRating: '5',
    worstRating: '1',
    ratingCount: reviewStats.reviewCount.toString(),
  };
}

/**
 * Generate individual Review schemas
 */
export function generateReviewSchemas(
  reviews: Array<{
    patientName: string | null;
    rating: number;
    comment: string;
    createdAt: Date;
  }>,
  doctorName: string
) {
  return reviews.map((review) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: review.patientName || 'Paciente Anónimo',
    },
    datePublished: review.createdAt.toISOString().split('T')[0],
    reviewBody: review.comment,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating.toString(),
      bestRating: '5',
      worstRating: '1',
    },
    itemReviewed: {
      '@type': 'Physician',
      name: doctorName,
    },
  }));
}
```

**Modify `generatePhysicianSchema`:**
```typescript
export function generatePhysicianSchema(
  doctor: DoctorProfile,
  baseUrl: string,
  reviewStats?: { averageRating: number; reviewCount: number }  // ✅ ADD THIS
) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: doctor.doctor_full_name,
    // ... existing fields ...
  };

  // ✅ ADD AGGREGATE RATING IF REVIEWS EXIST
  if (reviewStats && reviewStats.reviewCount > 0) {
    schema.aggregateRating = generateAggregateRatingSchema(reviewStats);
  }

  return schema;
}
```

### Step 2: Update layout.tsx
**File:** `apps/public/src/app/doctores/[slug]/layout.tsx`

**Modify to include reviews in schema:**
```typescript
export default async function DoctorLayout({ children, params }: DoctorLayoutProps) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);  // Now includes reviews

  if (!doctor) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';

  // ✅ Generate schemas with review data
  const schemas = generateAllSchemas(doctor, baseUrl);
  const reviewSchemas = generateReviewSchemas(
    doctor.reviews || [],
    doctor.doctor_full_name
  );

  const allSchemas = [...schemas, ...reviewSchemas];

  return (
    <>
      {allSchemas.map((schema, index) => (
        <Script
          key={index}
          id={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          strategy="beforeInteractive"
        />
      ))}
      {/* ... rest */}
    </>
  );
}
```

### Step 3: Server-render reviews in page component
**File:** `apps/public/src/app/doctores/[slug]/page.tsx`

**Pass reviews to client component:**
```typescript
export default async function DoctorProfilePage({ params }: DoctorProfilePageProps) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);  // Now includes reviews

  if (!doctor) notFound();

  return (
    <DoctorProfileClient
      doctor={doctor}
      reviews={doctor.reviews || []}  // ✅ Pass reviews
      reviewStats={doctor.reviewStats}  // ✅ Pass stats
    />
  );
}
```

---

## On-Demand Revalidation (Optional - For Immediate Review Display)

### Problem:
- ISR revalidation is every 1 hour
- New reviews won't appear for up to 1 hour

### Solution: Trigger revalidation after review submission
**File:** `apps/api/src/app/api/reviews/route.ts`

**Add after review creation:**
```typescript
export async function POST(request: Request) {
  // ... create review logic ...

  // ✅ Trigger revalidation of doctor profile page
  const publicAppUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const doctorSlug = booking.doctor.slug;

  try {
    await fetch(
      `${publicAppUrl}/api/revalidate?path=/doctores/${doctorSlug}`,
      { method: 'POST' }
    );
  } catch (error) {
    console.warn('Failed to revalidate page:', error);
    // Don't fail the review submission if revalidation fails
  }

  return NextResponse.json({ success: true, data: review });
}
```

**Create revalidation API route:**
**File:** `apps/public/src/app/api/revalidate/route.ts`
```typescript
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { error: 'path is required' },
      { status: 400 }
    );
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to revalidate' },
      { status: 500 }
    );
  }
}
```

---

## Testing Checklist

### SEO Testing
- [ ] View page source → Reviews visible in HTML (not loaded via JS)
- [ ] Check `<script type="application/ld+json">` → AggregateRating present
- [ ] Check `<script type="application/ld+json">` → Individual Review schemas present
- [ ] Google Rich Results Test: https://search.google.com/test/rich-results
- [ ] Verify star rating appears in test results

### Functional Testing
- [ ] Create new booking → Submit review → Verify review appears (wait 1 hour OR test on-demand revalidation)
- [ ] Test with 0 reviews → No schema errors
- [ ] Test with 1 review → AggregateRating shows correctly
- [ ] Test with multiple reviews → Average rating calculates correctly
- [ ] Test anonymous review → Shows "Paciente Anónimo"

---

## Expected SEO Impact

### Immediate (Week 1-2)
- ✅ Rich snippets eligible in Google Search Console
- ✅ Schema validation passes (no errors)
- ✅ Reviews indexed in Google search

### Short-term (Month 1-2)
- ⭐ Star ratings appear in search results
- 📈 10-15% increase in CTR from rich snippets
- 🔍 Reviews show in "Reviews from the web" section

### Long-term (Month 3-6)
- 🏆 Higher local search ranking (top 3 for "doctor + specialty + city")
- 📊 More long-tail keyword rankings (from review content)
- 💬 Increased patient trust signals → Lower bounce rate

---

## Comparison: Client-Side vs Server-Side

| Aspect | Client-Side (❌ Wrong) | Server-Side (✅ Correct) |
|--------|----------------------|------------------------|
| **SEO** | Google doesn't see reviews | Google indexes immediately |
| **Rich Snippets** | Not eligible | ⭐ Star ratings in search |
| **LCP** | Slower (fetch after load) | Faster (in initial HTML) |
| **Schema.org** | Not in server response | Injected in `<head>` |
| **Caching** | No CDN caching | ISR cached at edge |
| **Performance** | Extra client request | Single server request |

---

## Recommended Implementation Order

1. ✅ **Add reviews to doctor API endpoint** (Option A)
   - Modify `apps/api/src/app/api/doctors/[slug]/route.ts`
   - Include reviews and stats in response

2. ✅ **Update structured data schemas**
   - Add `generateAggregateRatingSchema()`
   - Add `generateReviewSchemas()`
   - Modify `generatePhysicianSchema()` to accept review stats

3. ✅ **Update doctor data type**
   - Add reviews array to `DoctorProfile` type
   - Add `reviewStats` to type

4. ✅ **Inject review schemas in layout**
   - Modify `apps/public/src/app/doctores/[slug]/layout.tsx`

5. ✅ **Create review display component**
   - Server-side rendered review section
   - Star rating display
   - Individual review cards

6. ⚠️ **Optional: On-demand revalidation**
   - Create revalidation API route
   - Trigger from review submission

7. ✅ **Test with Google Rich Results Tool**
   - Verify schemas valid
   - Confirm star ratings eligible

---

## Priority: HIGH

**Rationale:**
- Reviews are **primary SEO signal** for local healthcare
- Rich snippets can **increase CTR by 20-30%**
- Proper implementation = competitive advantage in search
- Wrong implementation (client-side) = **zero SEO benefit**

---

## Next Steps

**Decision Required:**
1. Approve server-side rendering approach (recommended)
2. Decide on revalidation strategy:
   - Option A: 1-hour delay (simpler, good enough for MVP)
   - Option B: On-demand revalidation (instant, more complex)

**Implementation Time:**
- Option A: ~2-3 hours
- Option B: ~4-5 hours (includes on-demand revalidation)

---

**Document Status:** ✅ READY FOR REVIEW
**Author:** SEO Implementation Team
**Date:** December 29, 2025
