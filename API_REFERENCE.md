# API Reference Documentation

**API App**: `apps/api` (Port 3003)
**Framework**: Next.js 16.0.10 App Router
**Validation**: Zod 4.2.0 (currently disabled)
**Authentication**: Custom JWT token-based auth

## Overview

The centralized API app provides RESTful endpoints for all frontend applications. It handles:
- Doctor profile CRUD operations
- Blog/article management
- User management (staff only)
- Appointment scheduling
- Patient bookings

**Base URL**:
- Development: `http://localhost:3003`
- Production: Set via `NEXT_PUBLIC_API_URL` env variable

---

## Authentication

### Authentication Methods

**1. Public Endpoints**: No auth required
- `GET /api/doctors`
- `GET /api/doctors/[slug]`
- `GET /api/doctors/[slug]/articles`
- `GET /api/doctors/[slug]/articles/[articleSlug]`

**2. Authenticated Endpoints**: Require JWT token

#### Token Format

```http
Authorization: Bearer <base64_encoded_token>
```

Token payload (before base64 encoding):
```json
{
  "email": "user@example.com",
  "role": "ADMIN" | "DOCTOR",
  "timestamp": 1234567890
}
```

#### Token Validation

- Tokens expire after **5 minutes**
- Verified against database user records
- Role must match user's actual role

#### Authentication Helpers

Located in `apps/api/src/lib/auth.ts`:

```typescript
// Validate any auth token
validateAuthToken(request)
  → { email, role, userId }

// Require ADMIN role
requireAdminAuth(request)
  → { email, role, userId } or throws

// Require DOCTOR role
requireDoctorAuth(request)
  → { email, role, userId } or throws

// Require ADMIN or DOCTOR
requireStaffAuth(request)
  → { email, role, userId } or throws

// Get authenticated doctor's profile
getAuthenticatedDoctor(request)
  → { user, doctor } or throws
```

---

## Endpoints

### Doctor Endpoints

#### `GET /api/doctors`

List all doctors with their related data.

**Authentication**: None (public)

**Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "clx1234567890",
      "slug": "dr-maria-lopez",
      "doctorFullName": "María Elena",
      "lastName": "López Martínez",
      "primarySpecialty": "Cardiología",
      "subspecialties": ["Ecocardiografía"],
      "heroImage": "https://...",
      "shortBio": "...",
      "services": [...],
      "educationItems": [...],
      "certificates": [...],
      "carouselItems": [...],
      "faqs": [...]
    }
  ]
}
```

**Includes**:
- services
- educationItems
- certificates
- carouselItems
- faqs

---

#### `POST /api/doctors`

Create a new doctor profile.

**Authentication**: Admin only

**Request Body**:
```json
{
  "slug": "dr-maria-lopez",
  "doctor_full_name": "María Elena",
  "last_name": "López Martínez",
  "primary_specialty": "Cardiología",
  "subspecialties": ["Ecocardiografía"],
  "cedula_profesional": "1234567",
  "hero_image": "https://...",
  "location_summary": "Guadalajara, Jalisco",
  "city": "Guadalajara",
  "short_bio": "Cardióloga con 15 años de experiencia...",
  "long_bio": "...",
  "years_experience": 15,
  "conditions": ["Hipertensión", "Arritmias"],
  "procedures": ["Ecocardiograma", "Holter"],
  "next_available_date": "2025-01-15T00:00:00.000Z",
  "appointment_modes": ["in_person", "teleconsult"],
  "clinic_info": {
    "address": "Av. Revolución 123, Col. Centro",
    "phone": "+52 33 1234 5678",
    "whatsapp": "+52 33 1234 5678",
    "hours": {
      "monday": "9:00 AM - 5:00 PM",
      "tuesday": "9:00 AM - 5:00 PM"
    },
    "geo": {
      "lat": 20.6597,
      "lng": -103.3496
    }
  },
  "social_links": {
    "linkedin": "https://linkedin.com/in/...",
    "twitter": "https://twitter.com/..."
  },
  "services_list": [
    {
      "service_name": "Consulta General",
      "short_description": "...",
      "duration_minutes": 30,
      "price": 800
    }
  ],
  "education_items": [
    {
      "institution": "UNAM",
      "program": "Medicina General",
      "year": "2005-2011",
      "notes": ""
    }
  ],
  "certificate_images": [
    {
      "src": "https://...",
      "alt": "Cédula Profesional",
      "issued_by": "SEP",
      "year": "2011"
    }
  ],
  "carousel_items": [
    {
      "type": "image",
      "src": "https://...",
      "alt": "Consultorio",
      "caption": "Vista del consultorio"
    }
  ],
  "faqs": [
    {
      "question": "¿Aceptan seguro?",
      "answer": "Sí, aceptamos todos los seguros principales."
    }
  ]
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": { /* created doctor object */ }
}
```

**Validation**: Currently disabled (TODO: Re-enable Zod validation)

**Errors**:
- `401 Unauthorized` - Missing/invalid auth token or not admin
- `500 Internal Server Error` - Database error

---

#### `GET /api/doctors/[slug]`

Get single doctor by slug.

**Authentication**: None (public)

**URL Parameters**:
- `slug` (string) - Doctor's URL slug

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "...",
    "slug": "dr-maria-lopez",
    // ... full doctor profile with all relations
  }
}
```

**Errors**:
- `404 Not Found` - Doctor with slug doesn't exist

---

#### `PUT /api/doctors/[slug]`

Update existing doctor profile.

**Authentication**: Admin only

**URL Parameters**:
- `slug` (string) - Doctor's URL slug

**Request Body**: Same as POST (all fields optional except slug must match)

**SEO Protection**:
- Slug **cannot be changed** (returns 400 error)
- Error message: "El slug no se puede modificar por razones de SEO"

**Update Strategy**: Delete-and-recreate
- Deletes all related records (services, education, etc.)
- Recreates with new data
- Uses Prisma transaction for atomicity

**Response**: `200 OK`
```json
{
  "success": true,
  "data": { /* updated doctor */ },
  "message": "Doctor profile updated successfully"
}
```

**Errors**:
- `400 Bad Request` - Attempted slug change
- `401 Unauthorized` - Not admin
- `404 Not Found` - Doctor doesn't exist

---

#### `DELETE /api/doctors/[slug]`

**Status**: Not Implemented (501)

Future implementation recommended: Soft delete

---

### Article Endpoints (Blog)

#### `GET /api/doctors/[slug]/articles`

Get all published articles for a doctor (public endpoint).

**Authentication**: None (public)

**URL Parameters**:
- `slug` (string) - Doctor's slug

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "slug": "benefits-of-cardio",
      "title": "Beneficios del Ejercicio Cardiovascular",
      "excerpt": "Descubre cómo el ejercicio mejora tu salud...",
      "thumbnail": "https://...",
      "publishedAt": "2025-12-20T10:00:00.000Z",
      "views": 150,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "doctor": {
    "slug": "dr-maria-lopez",
    "doctorFullName": "María Elena",
    "primarySpecialty": "Cardiología",
    "heroImage": "https://...",
    "city": "Guadalajara"
  }
}
```

**Notes**:
- Only returns `PUBLISHED` articles
- Ordered by `publishedAt` DESC (newest first)
- Does NOT include full content (only excerpt)

---

#### `GET /api/doctors/[slug]/articles/[articleSlug]`

Get single published article with full content.

**Authentication**: None (public)

**URL Parameters**:
- `slug` (string) - Doctor's slug
- `articleSlug` (string) - Article's slug

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "...",
    "slug": "benefits-of-cardio",
    "title": "Beneficios del Ejercicio Cardiovascular",
    "excerpt": "...",
    "content": "<p>Full HTML content here...</p>",
    "thumbnail": "https://...",
    "doctorId": "...",
    "status": "PUBLISHED",
    "publishedAt": "2025-12-20T10:00:00.000Z",
    "metaDescription": "SEO meta description",
    "keywords": ["salud", "ejercicio"],
    "views": 151,
    "createdAt": "...",
    "updatedAt": "...",
    "doctor": {
      "id": "...",
      "slug": "dr-maria-lopez",
      "doctorFullName": "María Elena",
      "primarySpecialty": "Cardiología",
      "heroImage": "https://...",
      "city": "Guadalajara"
    }
  }
}
```

**Side Effects**:
- Increments view count asynchronously (doesn't block response)

**Errors**:
- `404 Not Found` - Doctor doesn't exist, article doesn't exist, article not published, or article doesn't belong to doctor

---

#### `GET /api/articles`

Get all articles for authenticated doctor (including drafts).

**Authentication**: Doctor only

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "slug": "my-draft",
      "title": "Draft Article",
      "excerpt": "...",
      "thumbnail": null,
      "status": "DRAFT",
      "publishedAt": null,
      "views": 0,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Notes**:
- Ordered by `updatedAt` DESC
- Includes both DRAFT and PUBLISHED articles
- Only returns articles owned by authenticated doctor

---

#### `POST /api/articles`

Create new article.

**Authentication**: Doctor only

**Request Body**:
```json
{
  "slug": "my-article-slug",
  "title": "Article Title",
  "excerpt": "Short summary (max 200 chars)",
  "content": "<p>Full HTML content</p>",
  "thumbnail": "https://...",  // optional
  "status": "DRAFT",  // or "PUBLISHED"
  "metaDescription": "SEO description (max 160 chars)",  // optional
  "keywords": ["keyword1", "keyword2"]  // optional
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": { /* created article */ },
  "message": "Article created successfully"
}
```

**Automatic Fields**:
- `doctorId` - Set from authenticated doctor
- `publishedAt` - Auto-set if status is PUBLISHED
- `views` - Defaults to 0

**Errors**:
- `400 Bad Request` - Missing required fields or slug already exists
- `401 Unauthorized` - Not authenticated or not a doctor

---

#### `GET /api/articles/[id]`

Get single article with full details (own articles only).

**Authentication**: Doctor only

**URL Parameters**:
- `id` (string) - Article ID

**Response**: `200 OK`
```json
{
  "success": true,
  "data": { /* full article with all fields */ }
}
```

**Errors**:
- `403 Forbidden` - Article belongs to different doctor
- `404 Not Found` - Article doesn't exist

---

#### `PUT /api/articles/[id]`

Update existing article.

**Authentication**: Doctor only

**URL Parameters**:
- `id` (string) - Article ID

**Request Body**: Same as POST (all fields optional)

**SEO Protection**:
- Cannot change slug of PUBLISHED articles (returns 400)

**Publishing Logic**:
- When status changes from DRAFT → PUBLISHED: sets `publishedAt` to now
- When status changes from PUBLISHED → DRAFT: clears `publishedAt`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": { /* updated article */ },
  "message": "Article updated successfully"
}
```

**Errors**:
- `400 Bad Request` - Attempted slug change on published article
- `403 Forbidden` - Not the article owner
- `404 Not Found` - Article doesn't exist

---

#### `DELETE /api/articles/[id]`

Delete article (hard delete).

**Authentication**: Doctor only

**URL Parameters**:
- `id` (string) - Article ID

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Article deleted successfully"
}
```

**Errors**:
- `403 Forbidden` - Not the article owner
- `404 Not Found` - Article doesn't exist

---

### User Management Endpoints

#### `GET /api/users`

List all staff users.

**Authentication**: Admin only

**Response**: `200 OK`
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": "...",
      "email": "admin@example.com",
      "name": "Admin User",
      "image": "https://...",
      "role": "ADMIN",
      "doctorId": null,
      "doctor": null,
      "createdAt": "...",
      "updatedAt": "..."
    },
    {
      "id": "...",
      "email": "doctor@example.com",
      "name": "Dr. Example",
      "image": "https://...",
      "role": "DOCTOR",
      "doctorId": "clx...",
      "doctor": {
        "id": "clx...",
        "slug": "dr-example",
        "doctorFullName": "Dr. Example",
        "primarySpecialty": "Cardiología",
        "heroImage": "https://..."
      },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Notes**:
- Includes linked doctor profile if user is a doctor
- Ordered by `createdAt` DESC

---

#### `POST /api/users`

**Status**: Not documented (implementation needed)

Create new staff user.

---

#### `PUT /api/users/[id]`

**Status**: Not documented (implementation needed)

Update existing user.

---

#### `DELETE /api/users/[id]`

**Status**: Not documented (implementation needed)

Delete user.

---

### Appointment Endpoints

#### `GET /api/appointments/slots`

Get appointment slots for a doctor.

**Authentication**: None (public)

**Query Parameters**:
- `doctorId` (required) - Doctor ID
- `startDate` (optional) - Start date filter (ISO)
- `endDate` (optional) - End date filter (ISO)
- `status` (optional) - AVAILABLE, BOOKED, or BLOCKED

**Example**:
```
GET /api/appointments/slots?doctorId=clx123&startDate=2025-01-01&status=AVAILABLE
```

**Response**: `200 OK`
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "id": "...",
      "doctorId": "clx123",
      "date": "2025-01-15T00:00:00.000Z",
      "startTime": "09:00",
      "endTime": "09:30",
      "duration": 30,
      "basePrice": "800.00",
      "discount": null,
      "discountType": null,
      "finalPrice": "800.00",
      "status": "AVAILABLE",
      "maxBookings": 1,
      "currentBookings": 0,
      "bookings": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

#### `POST /api/appointments/slots`

Create appointment slots (single or recurring).

**Authentication**: TODO (currently allows creation in development)

**Mode 1: Single Day**

```json
{
  "mode": "single",
  "doctorId": "clx123",
  "date": "2025-01-15",
  "startTime": "09:00",
  "endTime": "17:00",
  "duration": 30,
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "basePrice": 800,
  "discount": 10,
  "discountType": "PERCENTAGE"
}
```

**Mode 2: Recurring (Multiple Days)**

```json
{
  "mode": "recurring",
  "doctorId": "clx123",
  "startDate": "2025-01-15",
  "endDate": "2025-01-31",
  "daysOfWeek": [0, 1, 2, 3, 4],  // Mon-Fri (0=Mon, 6=Sun)
  "startTime": "09:00",
  "endTime": "17:00",
  "duration": 60,
  "breakStart": "13:00",
  "breakEnd": "14:00",
  "basePrice": 1000,
  "discount": null,
  "discountType": null
}
```

**Parameters**:
- `mode` - "single" or "recurring"
- `duration` - 30 or 60 minutes only
- `breakStart`, `breakEnd` - Optional lunch break
- `discountType` - "PERCENTAGE" or "FIXED"

**Time Slot Generation**:
- Automatically splits time range into slots
- Skips break period
- Prevents duplicate slots (unique constraint)

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Created 32 slots",
  "count": 32
}
```

For recurring mode:
```json
{
  "success": true,
  "message": "Created 150 recurring slots",
  "count": 150,
  "totalPossible": 160  // Some may have been duplicates
}
```

---

#### `POST /api/appointments/bookings`

**Status**: Not documented (implementation needed)

Create patient booking.

---

### Authentication Endpoint

#### `POST /api/auth/user`

Get or create user from OAuth data (used by NextAuth callback).

**Authentication**: None (internal use)

**Request Body**:
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "image": "https://..."
}
```

**Response**: `200 OK`
```json
{
  "id": "...",
  "email": "user@example.com",
  "name": "User Name",
  "image": "https://...",
  "role": "DOCTOR",
  "doctorId": "clx..."
}
```

---

## Error Handling

### Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed explanation (optional)",
  "details": { /* additional context (optional) */ }
}
```

### Common HTTP Status Codes

- `200 OK` - Successful GET/PUT/DELETE
- `201 Created` - Successful POST
- `400 Bad Request` - Validation error, missing fields
- `401 Unauthorized` - Missing/invalid auth token
- `403 Forbidden` - Valid auth but insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Database or server error
- `501 Not Implemented` - Endpoint not yet implemented

---

## CORS Configuration

The API app should be configured with CORS to allow requests from:
- Public app (port 3000)
- Doctor app (port 3001)
- Admin app (port 3002)

**Note**: CORS configuration not visible in provided code, likely in Next.js config.

---

## Development Notes

### Disabled Features

**Zod Validation** (Line 72-90 in `apps/api/src/app/api/doctors/route.ts`):
```typescript
// Temporarily disabled due to monorepo module resolution issues
// TODO: Re-enable validation once Zod is properly configured
```

**Reason**: Module resolution issues in monorepo setup

**Impact**: No request body validation currently

**Recommendation**: Re-enable after fixing Zod imports

---

### Future Enhancements

- [ ] Re-enable Zod validation
- [ ] Implement soft deletes for doctors
- [ ] Add pagination for list endpoints
- [ ] Implement user CRUD endpoints
- [ ] Add booking creation endpoint
- [ ] Add rate limiting
- [ ] Add request logging middleware
- [ ] Add API versioning (v1, v2, etc.)

---

## Testing

### Manual Testing with curl

**Get all doctors**:
```bash
curl http://localhost:3003/api/doctors
```

**Create doctor (admin)**:
```bash
TOKEN=$(echo -n '{"email":"admin@example.com","role":"ADMIN","timestamp":'$(date +%s)'000}' | base64)

curl -X POST http://localhost:3003/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @doctor-data.json
```

**Get doctor articles (public)**:
```bash
curl http://localhost:3003/api/doctors/dr-maria-lopez/articles
```

---

## Environment Variables

```env
# Database connection
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3003"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# API URL for cross-app communication
NEXT_PUBLIC_API_URL="http://localhost:3003"
```

---

**End of API Reference Documentation**
