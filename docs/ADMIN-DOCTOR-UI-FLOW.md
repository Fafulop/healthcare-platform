# Important: Doctor App Requires Profile Linking

The doctor app requires the link to a doctor profile to be fully functional. Without it, the doctor can log in but can't do anything meaningful because every data query depends on `doctorId`:

- **Appointments** → `WHERE doctorId = ...`
- **Medical Records** → `WHERE doctor_id = ...`
- **Products/Sales/Purchases** → `WHERE doctor_id = ...`
- **Dashboard** → needs the doctor profile to show summary, public profile link, etc.

No `doctorId` = no data returned = empty/broken experience.

### Full chain to enable a doctor:

1. **Admin creates doctor profile** → public profile goes live
2. **Doctor signs in with Google** → user account created, but no access to data
3. **Admin links user to profile** → doctor app becomes fully functional

All three steps are required for the doctor app to work as intended.

---

# 🏥 Complete Healthcare Platform Architecture

## The 4 Applications & Database

---

## Journey 1: Patient Finding & Booking a Doctor

### 1. PATIENT (No login needed)
- Visits → `http://localhost:3000` (Public App)

### 2. Browse Doctors
- Goes to → `/doctores`
- Sees list of all doctors
- Public App calls → `GET http://localhost:3003/api/doctors`
- API queries → PostgreSQL (`public.doctors` table)
- Returns → List of doctor profiles

### 3. View Doctor Profile
- Clicks on → "Dra. María López"
- Goes to → `/doctores/maria-lopez`
- Public App calls → `GET http://localhost:3003/api/doctors/maria-lopez`
- API returns → Complete doctor profile with:
  - Bio, specialty, experience
  - Services (prices, durations)
  - Reviews & ratings
  - Education & certificates
  - Clinic location & hours
  - Available appointment slots

### 4. Book Appointment
- Clicks → "Agendar Cita" (Book Appointment)
- Opens → Booking calendar widget
- Selects date → Public App calls → `GET /api/doctors/maria-lopez/availability?month=2026-01`
- Selects time slot → "10:00 AM - $40"
- Fills form → Name, email, phone, WhatsApp, notes
- Submits → `POST http://localhost:3003/api/appointments/bookings`
- API creates → Booking record in database
- Patient receives → Confirmation code

### 5. Leave Review (Later)
- Receives email with → Review link + token
- Clicks → `http://localhost:3000/review/abc123token`
- Rates doctor → 5 stars + written review
- Submits → `POST http://localhost:3003/api/reviews`
- Review saved → Shows on doctor profile (after approval)

---

## Journey 2: Admin Creating & Managing Doctors

### 1. ADMIN (You)
- Visits → `http://localhost:3002` (Admin App)
- Clicks → "Sign in with Google"
- Google OAuth → `lopez.fafutis@gmail.com`
- Redirected to → `/dashboard`

### 2. Create New Doctor Profile
- Clicks → "Doctors" → "New Doctor"
- Goes to → `/doctors/new` (10-step wizard)

**Step 1: Basic Info**
- Name: "Dr. Carlos Gómez"
- Specialty: "Cardiólogo"
- Slug: auto-generated → "carlos-gomez"
- Location: "Guadalajara, Jalisco"

**Step 2: Services**
- Adds → "Consulta General - $50 - 30 min"
- Adds → "Ecocardiograma - $120 - 60 min"

**Step 3-9:** Conditions, Bio, Education, Certificates, Clinic, FAQs, Media

**Step 10: Review & Submit**
- Clicks → "Crear Doctor"
- Admin App calls → `GET /api/auth/get-token` (gets JWT)
- Admin App calls → `POST http://localhost:3003/api/doctors`
  - Headers: `Authorization: Bearer eyJhbGc...`
  - Body: `{ all doctor data }`
- API validates → JWT token (admin role required)
- API creates → Doctor record + all nested data
- Returns → `{ success: true, data: { slug: "carlos-gomez" } }`

### 3. Link User to Doctor Profile
- Clicks "Vincular" next to `carlos.gomez@example.com`
- Selects → "Dr. Carlos Gómez - Cardiólogo"
- Admin App calls → `PATCH http://localhost:3003/api/users/{userId}`
  - Body: `{ doctorId: "cmk1abc..." }`
- API updates → `users.doctor_id = "cmk1abc..."`
- Done! Carlos can now log into doctor portal

---

## Journey 3: Doctor Managing Their Profile & Patients

### 1. DOCTOR (Dr. Carlos)
- Visits → `http://localhost:3001` (Doctor App)
- Clicks → "Iniciar sesión con Google"
- Google OAuth → `carlos.gomez@example.com`
- NextAuth callback → `POST http://localhost:3003/api/auth/user`
  - Body: `{ email, name, image }`
- API checks → users table for `carlos.gomez@example.com`
- API returns → `{ role: "DOCTOR", doctorId: "cmk1abc..." }`
- Session created → User logged in as DOCTOR
- Redirected to → `/dashboard`

### 2. View Dashboard
- Doctor App displays:
  - Doctor profile summary
  - Link to public profile
  - Upcoming appointments
  - Recent activity

### 3. Manage Appointments
- Clicks → "Appointments"
- Doctor App calls → `GET http://localhost:3003/api/appointments?doctorId=cmk1abc...`
- Sees → List of patient bookings
- Can → Confirm, cancel, reschedule

### 4. Manage Medical Records (EMR)
- Clicks → "Medical Records"
- Doctor App calls → `GET /api/medical-records/patients` (doctor app's local API)
- Uses → `requireDoctorAuth()` middleware
- Middleware checks → Session role = DOCTOR or ADMIN
- Queries → `medical_records.patients WHERE doctor_id = "cmk1abc..."`
- Shows → Patient list (scoped to this doctor only)
- Can → Create encounters, prescriptions, notes

### 5. Manage Practice (Products, Sales, Purchases)
- Clicks → "Practice" → "Products"
- Doctor App calls → `GET http://localhost:3003/api/practice-management/products`
- API uses → `getAuthenticatedDoctor()` helper
- Queries → `practice_management.products WHERE doctor_id = "cmk1abc..."`
- Shows → Inventory, pricing

**Sales:**
- Clicks → "Ventas" (Sales)
- API queries → `practice_management.sales WHERE doctor_id = "cmk1abc..."`
- Can → Create invoices, track revenue

### 6. Use LLM Assistant
- Clicks → Blue chat bubble (bottom right)
- Types → "How do I create a new patient record?"
- Doctor App calls → `POST /api/llm-assistant/chat`
  - Body: `{ query, conversationId }`
- LLM Assistant:
  - Detects module → "medical-records"
  - Searches vector DB → Railway pgvector
  - Retrieves → Relevant documentation chunks
  - Calls → OpenAI GPT-4o-mini
  - Returns → Answer in Spanish with sources
- Shows → Response with links to docs

---

## Data Flow: How Everything Connects

### Creating a Doctor Profile (Full Flow)

```
ADMIN APP (Port 3002)
    │
    ├─ User fills 10-step wizard
    ├─ Uploads hero image → UploadThing CDN → Returns URL
    ├─ Uploads certificates → UploadThing CDN → Returns URLs
    ├─ Uploads clinic photos → UploadThing CDN → Returns URLs
    │
    └─ Submits form data
        │
        ▼
    authFetch() function
        │
        ├─ Calls → GET /api/auth/get-token
        │   └─ Returns → Signed JWT token (valid 1 hour)
        │
        └─ Calls → POST http://localhost:3003/api/doctors
            Headers: Authorization: Bearer {JWT}
            Body: { doctor_full_name, services_list, ... }
            │
            ▼
API SERVICE (Port 3003)
    │
    ├─ Receives request
    ├─ Extracts JWT from Authorization header
    ├─ Validates JWT → jwt.verify(token, NEXTAUTH_SECRET)
    ├─ Checks role → Must be ADMIN
    │
    ├─ Receives doctor data
    ├─ Transforms fields → snake_case to camelCase
    │
    └─ Creates database transaction
        │
        ▼
PostgreSQL Database
    │
    ├─ INSERT INTO public.doctors (...)
    ├─ INSERT INTO public.services (5 services)
    ├─ INSERT INTO public.education (3 education items)
    ├─ INSERT INTO public.certificates (4 certificates)
    ├─ INSERT INTO public.carousel_items (6 media items)
    ├─ INSERT INTO public.faqs (7 FAQs)
    │
    └─ Returns → Doctor record with ID
        │
        ▼
API SERVICE
    │
    └─ Returns JSON → { success: true, data: { id, slug, ... } }
        │
        ▼
ADMIN APP
    │
    ├─ Shows alert → "Doctor created successfully!"
    ├─ Opens new tab → http://localhost:3000/doctores/{slug}
    └─ Redirects → /dashboard
```

### Patient Viewing Doctor Profile (Full Flow)

```
PATIENT (Browser)
    │
    └─ Visits → http://localhost:3000/doctores/maria-lopez
        │
        ▼
PUBLIC APP (Port 3000)
    │
    ├─ Next.js Server-Side Rendering
    ├─ Calls → getDoctorBySlug("maria-lopez")
    │   └─ fetch("http://localhost:3003/api/doctors/maria-lopez")
    │       Options: { next: { revalidate: 60 } }
    │
    │       ▼
    │   API SERVICE (Port 3003)
    │       │
    │       ├─ Receives → GET /api/doctors/maria-lopez
    │       ├─ No auth required (public endpoint)
    │       │
    │       └─ Queries database
    │           │
    │           ▼
    │   PostgreSQL
    │       │
    │       ├─ SELECT * FROM public.doctors WHERE slug = 'maria-lopez'
    │       ├─ SELECT * FROM public.services WHERE doctor_id = ...
    │       ├─ SELECT * FROM public.education WHERE doctor_id = ...
    │       ├─ SELECT * FROM public.certificates WHERE doctor_id = ...
    │       ├─ SELECT * FROM public.carousel_items WHERE doctor_id = ...
    │       ├─ SELECT * FROM public.faqs WHERE doctor_id = ...
    │       ├─ SELECT * FROM public.reviews WHERE doctor_id = ... AND approved = true
    │       │
    │       └─ Returns → Complete doctor profile with all nested data
    │           │
    │           ▼
    │   API SERVICE
    │       │
    │       └─ Returns JSON → { success: true, data: { doctor + relations } }
    │           │
    │           ▼
    │   PUBLIC APP
    │       │
    │       ├─ Transforms data → To DoctorProfile type
    │       ├─ Generates SEO metadata → Title, description, OpenGraph
    │       ├─ Generates structured data → JSON-LD for Google
    │       │
    │       └─ Renders HTML
    │           ├─ <HeroSection> with photo, name, ratings
    │           ├─ <ServicesSection> with price list
    │           └─ <ReviewsSection>
```

---

## Database Schema

### Schema: `public` (Main app data)

| Table | Description |
|-------|-------------|
| `users` | User accounts (ADMIN/DOCTOR) |
| `doctors` | Doctor profiles |
| `services` | Medical services offered |
| `education` | Educational background |
| `certificates` | Certifications & credentials |
| `carousel_items` | Profile media (images/videos) |
| `faqs` | Frequently asked questions |
| `articles` | Blog posts |
| `appointment_slots` | Available time slots |
| `bookings` | Patient appointments |
| `reviews` | Patient reviews |

### Schema: `practice_management` (Business management)

| Table | Description |
|-------|-------------|
| `areas` | Business areas |
| `clients` | Client database |
| `suppliers` | Supplier database (proveedores) |
| `products` | Inventory products |
| `ledger_entries` | Flujo de dinero (cash flow) |
| `quotations` | Cotizaciones (quotes) |
| `sales` | Ventas (sales records) |
| `purchases` | Compras (purchases) |

### Schema: `medical_records` (EMR system)

| Table | Description |
|-------|-------------|
| `patients` | Patient database |
| `clinical_encounters` | Doctor visits |
| `prescriptions` | Medications prescribed |
| `patient_media` | Patient files/images |
| `patient_audit_logs` | Access audit trail |

### Schema: `llm_assistant` (AI assistant data)

| Table | Description |
|-------|-------------|
| `llm_docs_chunks` | Vector embeddings (1536-dim) |
| `llm_module_summaries` | Module descriptions |
| `llm_query_cache` | Response cache (SHA-256) |
| `llm_conversation_memory` | Chat history |
| `llm_docs_version` | Sync version tracking |
| `llm_docs_file_hash` | Incremental sync hashes |

---

## Authentication Flow

- If email matches `ADMIN_EMAILS` env → Create with role=ADMIN
- If not → Create with role=DOCTOR
- Returns → `{ id, email, role, doctorId }`
- Session created with role & doctorId

**Middleware checks role on every request:**
- Admin App → Allows only ADMIN
- Doctor App → Allows ADMIN or DOCTOR
- Wrong role → Redirects to sign out

---

## How to Create a Complete Public Portal

### Step 1: Admin Creates Doctor Profile

1. Log into admin → `http://localhost:3002`
2. Navigate to → Doctors → New Doctor
3. Fill 10-step wizard:
   - Basic Info (name, specialty, slug)
   - Services (consultations, treatments)
   - Conditions & Procedures treated
   - Biography
   - Education & Credentials
   - Certificates (upload images)
   - Clinic Information (address, hours, map)
   - FAQs
   - Media Gallery (clinic photos, videos)
   - Review & Submit
4. Click "Crear Doctor"
5. New doctor profile created in database
6. Automatic redirect to public profile

### Step 2: Create User Account for Doctor

1. Doctor visits → `http://localhost:3001`
2. Clicks "Sign in with Google"
3. Uses their work email (e.g., `doctor@clinic.com`)
4. System auto-creates user with role=DOCTOR
5. User created but NOT linked to profile yet

### Step 3: Link User to Doctor Profile

1. Admin goes to → `http://localhost:3002/users`
2. Finds doctor's email in user list
3. Clicks "Vincular" button
4. Selects doctor profile from dropdown
5. Clicks "Vincular"
6. User now linked to profile
7. Doctor can now manage their own data

### Step 4: Public Profile is Live

Public can now visit: `http://localhost:3000/doctores/{slug}`

They see:
- Doctor photo & bio
- Services & pricing
- Reviews & ratings
- Credentials & education
- Clinic location & hours
- Appointment booking calendar
- FAQ section
- Media gallery

### Step 5: SEO & Discoverability

The public app automatically:
- Generates sitemap → `/sitemap.xml`
- Creates structured data (JSON-LD)
- Sets meta tags for social sharing
- Optimizes images for performance
- Enables ISR (revalidates every 60s)

---

## Key Concepts

### 1. Data Scoping

Each doctor only sees their own data:

```typescript
// In API endpoints
const { doctor } = await getAuthenticatedDoctor(request);

// Queries are scoped by doctorId
await prisma.patient.findMany({
  where: { doctorId: doctor.id }  // ← Only this doctor's patients
});
```

### 2. Role-Based Access

| App | Access |
|-----|--------|
| Public App | No auth required |
| Admin App | ADMIN role only |
| Doctor App | DOCTOR or ADMIN role |
| API Endpoints | JWT token required (role checked per endpoint) |

### 3. Data Separation

**Public Data (`public` schema)**
- Doctors, services, reviews
- Visible to everyone

**Private Data (`medical_records`, `practice_management` schemas)**
- Patient records, sales, inventory
- Scoped to individual doctors
