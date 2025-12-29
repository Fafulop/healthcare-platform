# Database Schema Documentation

**Generated from**: `packages/database/prisma/schema.prisma`
**Database**: PostgreSQL
**ORM**: Prisma 6.2.1
**Last Updated**: 2025-12-28

## Overview

This healthcare platform uses PostgreSQL with Prisma ORM. The schema supports:
- Multi-tenant doctor profiles
- Staff authentication (Admin + Doctor roles)
- Blog/article management
- Appointment scheduling
- Patient bookings (no patient accounts)

## Data Models

### Core Entity Relationship

```
User (Staff Auth) ──1:1─> Doctor (Profile)
                            ├──1:N─> Service
                            ├──1:N─> Education
                            ├──1:N─> Certificate
                            ├──1:N─> CarouselItem
                            ├──1:N─> FAQ
                            ├──1:N─> Article (Blog)
                            ├──1:N─> AppointmentSlot
                            └──1:N─> Booking
                                       │
AppointmentSlot ──1:N─> Booking       │
                                       └── (linked)
```

---

## Model Definitions

### User (Staff Authentication)

**Table**: `users`
**Purpose**: Staff authentication (doctors and admins only, no patient accounts)

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `email` | String | Unique, Required | Google OAuth email |
| `name` | String? | Optional | Display name from Google |
| `image` | String? | Optional | Google profile picture URL |
| `role` | Role | Default: DOCTOR | ADMIN or DOCTOR |
| `doctorId` | String? | FK, Unique | Link to doctor profile (optional) |
| `createdAt` | DateTime | Auto | Account creation timestamp |
| `updatedAt` | DateTime | Auto | Last update timestamp |

**Relationships**:
- `doctor` → Doctor (1:1, optional)

**Indexes**:
- Unique: `email`
- Unique: `doctorId`

**Notes**:
- Not all users have doctor profiles (admins don't)
- Google OAuth only (no password auth)

---

### Role (Enum)

```prisma
enum Role {
  ADMIN   // Full access to all features
  DOCTOR  // Access to own profile + blog
}
```

---

### Doctor (Main Profile Entity)

**Table**: `doctors`
**Purpose**: Complete doctor profile with all related data

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `slug` | String | Unique, Required | URL-safe identifier (SEO, immutable) |
| `doctorFullName` | String | Required | First and middle names |
| `lastName` | String | Required | Last name |
| `primarySpecialty` | String | Required | Main medical specialty |
| `subspecialties` | String[] | Array | Additional specialties |
| `cedulaProfesional` | String? | Optional | Professional license number |
| `heroImage` | String | Required | Main profile image URL |
| `locationSummary` | String | Required | e.g., "Guadalajara, Jalisco" |
| `city` | String | Required | City name |
| `shortBio` | Text | Required | Brief bio (200-300 chars) |
| `longBio` | Text | Required | Full biography |
| `yearsExperience` | Int | Required | Years practicing medicine |
| `conditions` | String[] | Array | Medical conditions treated |
| `procedures` | String[] | Array | Procedures performed |
| `nextAvailableDate` | DateTime? | Optional | Next appointment availability |
| `appointmentModes` | String[] | Array | in_person, teleconsult |
| `clinicAddress` | String | Required | Full clinic address |
| `clinicPhone` | String | Required | Clinic phone number |
| `clinicWhatsapp` | String? | Optional | WhatsApp number |
| `clinicHours` | Json | Required | Office hours object |
| `clinicGeoLat` | Float? | Optional | Latitude for map |
| `clinicGeoLng` | Float? | Optional | Longitude for map |
| `socialLinkedin` | String? | Optional | LinkedIn profile URL |
| `socialTwitter` | String? | Optional | Twitter/X profile URL |
| `createdAt` | DateTime | Auto | Profile creation |
| `updatedAt` | DateTime | Auto | Last update |

**Relationships**:
- `user` → User (1:1, optional, inverse)
- `services` → Service[] (1:N, cascade delete)
- `educationItems` → Education[] (1:N, cascade delete)
- `certificates` → Certificate[] (1:N, cascade delete)
- `carouselItems` → CarouselItem[] (1:N, cascade delete)
- `faqs` → FAQ[] (1:N, cascade delete)
- `articles` → Article[] (1:N, cascade delete)
- `appointmentSlots` → AppointmentSlot[] (1:N, cascade delete)
- `bookings` → Booking[] (1:N, cascade delete)

**Indexes**:
- Unique: `slug`

**Important Notes**:
- **Slug is immutable** after creation (SEO protection)
- All related records use cascade delete
- `clinicHours` is JSON: `{"monday": "9:00 AM - 5:00 PM", ...}`

---

### Article (Blog System)

**Table**: `articles`
**Purpose**: Doctor blog posts and articles

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `slug` | String | Unique, Required | URL slug |
| `title` | String | Required | Article title |
| `excerpt` | String | VarChar(200) | Short summary |
| `content` | Text | Required | Full HTML content |
| `thumbnail` | String? | Optional | Featured image URL |
| `doctorId` | String | FK, Required | Author (doctor) |
| `status` | ArticleStatus | Default: DRAFT | DRAFT or PUBLISHED |
| `publishedAt` | DateTime? | Optional | Publish timestamp (null if draft) |
| `metaDescription` | String? | VarChar(160) | SEO meta description |
| `keywords` | String[] | Array | SEO keywords |
| `views` | Int | Default: 0 | View count |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Unique: `slug`
- Composite: `(doctorId, status)` - for listing
- Single: `publishedAt` - for sorting
- Single: `slug` - for lookup

**Notes**:
- Slug immutable after publishing (SEO protection)
- `publishedAt` auto-set when status → PUBLISHED
- HTML content stored in `content` field

---

### ArticleStatus (Enum)

```prisma
enum ArticleStatus {
  DRAFT      // Not visible to public
  PUBLISHED  // Live on website
}
```

---

### Service

**Table**: `services`
**Purpose**: Medical services offered by doctor

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `doctorId` | String | FK, Required | Parent doctor |
| `serviceName` | String | Required | Service name |
| `shortDescription` | String | Required | Brief description |
| `durationMinutes` | Int | Required | Typical duration |
| `price` | Float? | Optional | Price (if disclosed) |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Single: `doctorId`

---

### Education

**Table**: `education`
**Purpose**: Doctor's educational background

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `doctorId` | String | FK, Required | Parent doctor |
| `institution` | String | Required | University/institution name |
| `program` | String | Required | Degree/program name |
| `year` | String | Required | Graduation year or range |
| `notes` | String? | Optional | Additional notes |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Single: `doctorId`

---

### Certificate

**Table**: `certificates`
**Purpose**: Certifications and credentials

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `doctorId` | String | FK, Required | Parent doctor |
| `src` | String | Required | Image URL (UploadThing) |
| `alt` | String | Required | Alt text for accessibility |
| `issuedBy` | String | Required | Issuing organization |
| `year` | String | Required | Year issued |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Single: `doctorId`

---

### CarouselItem

**Table**: `carousel_items`
**Purpose**: Clinic photos and videos for media carousel

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `doctorId` | String | FK, Required | Parent doctor |
| `type` | String | Required | "image" or "video_thumbnail" |
| `src` | String | Required | Image/video URL |
| `thumbnail` | String? | Optional | Video thumbnail URL |
| `alt` | String | Required | Alt text |
| `caption` | String? | Optional | Media caption |
| `name` | String? | Optional | Video name (for schema.org) |
| `description` | Text? | Optional | Video description |
| `uploadDate` | String? | Optional | Video upload date (ISO) |
| `duration` | String? | Optional | Video duration (ISO 8601) |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Single: `doctorId`

**Notes**:
- Video fields (`name`, `description`, `uploadDate`, `duration`) used for SEO structured data

---

### FAQ

**Table**: `faqs`
**Purpose**: Frequently asked questions

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `doctorId` | String | FK, Required | Parent doctor |
| `question` | String | Required | Question text |
| `answer` | Text | Required | Answer text |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Single: `doctorId`

---

### AppointmentSlot

**Table**: `appointment_slots`
**Purpose**: Doctor's availability slots for booking

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `doctorId` | String | FK, Required | Parent doctor |
| `date` | DateTime | Required | Date (normalized to midnight UTC) |
| `startTime` | String | Required | Start time (e.g., "09:00") |
| `endTime` | String | Required | End time (e.g., "10:00") |
| `duration` | Int | Required | Duration in minutes (30 or 60) |
| `basePrice` | Decimal | Required | Base price (10,2 precision) |
| `discount` | Decimal? | Optional | Discount amount (10,2 precision) |
| `discountType` | String? | Optional | "PERCENTAGE" or "FIXED" |
| `finalPrice` | Decimal | Required | Final price after discount |
| `status` | SlotStatus | Default: AVAILABLE | Availability status |
| `maxBookings` | Int | Default: 1 | Max concurrent bookings |
| `currentBookings` | Int | Default: 0 | Current booking count |
| `createdAt` | DateTime | Auto | Creation timestamp |
| `updatedAt` | DateTime | Auto | Last update |

**Relationships**:
- `doctor` → Doctor (N:1, cascade delete)
- `bookings` → Booking[] (1:N, cascade delete)

**Indexes**:
- Composite: `(doctorId, date, status)` - for filtering
- Single: `date` - for date range queries
- Unique: `(doctorId, date, startTime)` - prevent duplicates

---

### SlotStatus (Enum)

```prisma
enum SlotStatus {
  AVAILABLE  // Open for booking
  BOOKED     // Fully booked
  BLOCKED    // Unavailable (doctor blocked)
}
```

---

### Booking

**Table**: `bookings`
**Purpose**: Patient appointment bookings

| Field | Type | Attributes | Description |
|-------|------|------------|-------------|
| `id` | String | PK, CUID | Unique identifier |
| `slotId` | String | FK, Required | Appointment slot |
| `doctorId` | String | FK, Required | Doctor (denormalized) |
| `patientName` | String | Required | Patient full name |
| `patientEmail` | String | Required | Patient email |
| `patientPhone` | String | Required | Patient phone |
| `patientWhatsapp` | String? | Optional | WhatsApp number |
| `status` | BookingStatus | Default: PENDING | Booking status |
| `finalPrice` | Decimal | Required | Price paid (10,2 precision) |
| `notes` | Text? | Optional | Patient notes |
| `confirmationCode` | String? | Unique, Optional | Confirmation code |
| `confirmedAt` | DateTime? | Optional | Confirmation timestamp |
| `cancelledAt` | DateTime? | Optional | Cancellation timestamp |
| `createdAt` | DateTime | Auto | Booking timestamp |
| `updatedAt` | DateTime | Auto | Last update |

**Relationships**:
- `slot` → AppointmentSlot (N:1, cascade delete)
- `doctor` → Doctor (N:1, cascade delete)

**Indexes**:
- Composite: `(doctorId, status)` - for filtering
- Single: `slotId`
- Single: `patientEmail` - for lookup
- Unique: `confirmationCode`

**Notes**:
- No patient accounts - bookings are anonymous
- `confirmationCode` used for future WhatsApp integration

---

### BookingStatus (Enum)

```prisma
enum BookingStatus {
  PENDING     // Just created, awaiting confirmation
  CONFIRMED   // Confirmed (via WhatsApp in future)
  CANCELLED   // Cancelled by patient or doctor
  COMPLETED   // Appointment happened
  NO_SHOW     // Patient didn't show up
}
```

---

## Migration History

### Recent Migrations

**2025-12-29 00:24:58** - `add_article_model_for_blog`
- Added `Article` model
- Added `ArticleStatus` enum
- Created indexes for article queries
- Purpose: Enable blog feature for doctors

---

## Common Query Patterns

### Get Doctor with All Related Data

```prisma
prisma.doctor.findUnique({
  where: { slug: "dr-maria-lopez" },
  include: {
    services: true,
    educationItems: true,
    certificates: true,
    carouselItems: true,
    faqs: true,
    articles: {
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' }
    }
  }
})
```

### Get Available Appointment Slots

```prisma
prisma.appointmentSlot.findMany({
  where: {
    doctorId: doctorId,
    date: { gte: new Date() },
    status: 'AVAILABLE'
  },
  orderBy: [
    { date: 'asc' },
    { startTime: 'asc' }
  ]
})
```

### Get Doctor's Articles (Dashboard)

```prisma
prisma.article.findMany({
  where: { doctorId: doctorId },
  orderBy: { updatedAt: 'desc' }
})
```

---

## Database Conventions

1. **Naming**:
   - Database columns use `snake_case` (mapped via `@map`)
   - Prisma models use `camelCase`
   - Enums use `SCREAMING_SNAKE_CASE` values

2. **IDs**: All primary keys are CUIDs (Collision-resistant Unique IDs)

3. **Timestamps**: `createdAt` and `updatedAt` on all main entities

4. **Soft Deletes**: Not implemented (using hard cascade deletes)

5. **Cascade Deletes**: All related records deleted when parent is deleted

---

## Performance Considerations

1. **Indexes**:
   - All foreign keys are indexed
   - Slug fields are unique indexes
   - Composite indexes for common query patterns
   - Date fields indexed for range queries

2. **Text Fields**:
   - Use `@db.Text` for long content (bio, article content)
   - Use `@db.VarChar` with limits for SEO fields

3. **Decimal Precision**:
   - Prices use `Decimal(10,2)` for financial accuracy

4. **JSON Fields**:
   - `clinicHours` stored as JSON for flexibility
   - Consider extracting if complex queries needed

---

## Future Enhancements (Not Yet Implemented)

- Review/rating system for doctors
- Multi-language support (i18n)
- Analytics tracking tables
- Notification queue table
- File metadata table (for UploadThing integration)
- Soft delete flags

---

## Environment Variables

Required for database connection:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
```

---

## Development Commands

```bash
# Generate Prisma Client
pnpm db:generate

# Push schema changes (dev)
pnpm db:push

# Create migration
pnpm db:migrate

# Deploy migrations (production)
pnpm db:migrate:deploy

# Open Prisma Studio
pnpm db:studio

# Run seed script
pnpm db:seed
```

---

**End of Database Schema Documentation**
