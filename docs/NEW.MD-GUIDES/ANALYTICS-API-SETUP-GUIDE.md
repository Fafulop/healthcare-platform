# Analytics API Setup Guide

Server-side analytics integration that queries Google Analytics 4 (GA4) and Google Search Console data via service account authentication, serving it to the admin and doctor dashboards.

## What We Built

### Architecture

```
Google Analytics 4  ──┐
                      ├──> Google APIs (googleapis) ──> apps/api ──> Admin/Doctor Dashboards
Search Console     ──┘         ▲
                               │
                    Service Account (JSON key, base64-encoded)
```

### Components

| File | Purpose |
|------|---------|
| `apps/api/src/lib/analytics/google-auth.ts` | Decodes the service account key and authenticates with Google APIs |
| `apps/api/src/lib/analytics/ga4-service.ts` | Queries GA4 for page views, sessions, events, traffic sources, doctor rankings |
| `apps/api/src/lib/analytics/search-console-service.ts` | Queries Search Console for search queries, CTR, positions, page performance |
| `apps/api/src/lib/analytics/cache.ts` | Caches API responses to avoid hitting rate limits |
| `apps/api/src/app/api/analytics/platform/route.ts` | API route: platform-wide analytics (admin dashboard) |
| `apps/api/src/app/api/analytics/doctor/[slug]/route.ts` | API route: per-doctor analytics |
| `apps/api/src/app/api/analytics/doctors-ranking/route.ts` | API route: doctor ranking by event count |
| `apps/admin/src/components/analytics/` | Admin dashboard analytics UI components |
| `apps/doctor/src/components/analytics/` | Doctor dashboard analytics UI components |

### What Data Is Available

**From GA4:**
- Page views, sessions, and unique users (daily breakdown)
- Traffic sources (Organic, Direct, Referral, Paid, Social, etc.)
- Custom events per doctor: `profile_view`, `contact_click`, `booking_complete`, `appointment_click`, `blog_view`, `map_click`
- Platform overview with period-over-period comparison (% change)
- Doctor ranking by any event metric

**From Search Console:**
- Top search queries driving traffic (clicks, impressions, CTR, average position)
- Page-level performance in Google Search
- Filterable by doctor slug

## Environment Variables

All three variables are required and live in `apps/api/.env`:

```env
GA4_PROPERTY_ID=524946974
GOOGLE_SERVICE_ACCOUNT_KEY=<base64-encoded-json-key>
SEARCH_CONSOLE_SITE_URL=sc-domain:tusalud.pro
```

### GA4_PROPERTY_ID

The numeric ID of your GA4 property. Used in every GA4 API call to specify which property to query.

**Where to find it:**
1. Go to https://analytics.google.com
2. Admin (gear icon) > Property Settings
3. The numeric ID at the top (e.g. `524946974`)

### GOOGLE_SERVICE_ACCOUNT_KEY

A base64-encoded JSON key from a Google Cloud service account. This is the authentication credential that allows the API server to query GA4 and Search Console without user interaction.

**How it was created:**
1. Google Cloud Console > project `perfiles-doctores`
2. IAM & Admin > Service Accounts > created `analytics-reader`
3. Keys tab > Add Key > Create New Key > JSON (downloads `.json` file)
4. Base64 encoded: `cat key.json | base64 -w 0`

**Service account email:** `analytics-reader@perfiles-doctores.iam.gserviceaccount.com`

### SEARCH_CONSOLE_SITE_URL

The Search Console property identifier. Can be either:
- Domain property: `sc-domain:tusalud.pro`
- URL prefix: `https://tusalud.pro/`

We use the domain property format.

## Google Cloud Setup

### Project: `perfiles-doctores`

### Enabled APIs
- **Google Analytics Data API** (`analyticsdata.googleapis.com`) — required for GA4 queries
- **Google Search Console API** (`searchconsole.googleapis.com`) — required for search data

### Service Account Permissions

| Service | Where to Grant | Role/Permission |
|---------|---------------|-----------------|
| GA4 | Analytics > Admin > Property Access Management | **Viewer** |
| Search Console | Search Console > Settings > Users and permissions | **Full** |

## How It Works

### Authentication Flow

1. On first API call, `google-auth.ts` reads `GOOGLE_SERVICE_ACCOUNT_KEY` from env
2. Decodes from base64 to JSON
3. Creates a `GoogleAuth` client with scopes for Analytics (readonly) and Search Console (readonly)
4. The auth client is cached in memory for subsequent requests

### API Routes

**GET `/api/analytics/platform?range=7d`**
Returns platform-wide overview: total users, sessions, page views, avg session duration (with % change vs previous period), daily breakdown, traffic sources.

**GET `/api/analytics/doctor/[slug]?range=28d`**
Returns per-doctor data: custom events (profile views, contact clicks, etc.), daily page views, search queries for that doctor's pages.

**GET `/api/analytics/doctors-ranking?range=28d&metric=profile_view&limit=20`**
Returns top doctors ranked by a specific event metric.

**Range options:** `7d`, `28d`, `90d`

### Caching

API responses are cached (see `cache.ts`) to prevent hitting Google API rate limits and to improve dashboard load times.

## Troubleshooting

### "GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set"
The env var is missing or the API server wasn't restarted after adding it.

### "403 Forbidden" from GA4
The service account email hasn't been added as a Viewer in GA4 Property Access Management.

### "403 Forbidden" from Search Console
The service account email hasn't been added as a user in Search Console Settings.

### "API not enabled" errors
Go to Google Cloud Console > APIs & Services > Enabled APIs and verify both APIs are enabled:
- `analyticsdata.googleapis.com`
- `searchconsole.googleapis.com`

### No data showing up
- GA4 data has a 24-48 hour delay for some reports
- Search Console data has a 2-3 day delay
- Verify the GA4 property ID matches the correct property
- Verify custom events (`profile_view`, etc.) are actually being fired from the frontend

## Rotating the Service Account Key

If the key is compromised:
1. Go to Google Cloud Console > IAM & Admin > Service Accounts
2. Click on `analytics-reader` > Keys tab
3. Delete the old key
4. Add Key > Create New Key > JSON
5. Base64 encode the new key and update `GOOGLE_SERVICE_ACCOUNT_KEY` in `apps/api/.env`
6. Restart the API server
