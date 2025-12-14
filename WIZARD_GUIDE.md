# Doctor Profile Creation Wizard - Implementation Guide

## Overview

This guide documents the 10-step wizard for creating doctor profiles in the admin panel. The wizard ensures that all doctor profiles maintain the same SEO optimization and structure as the public-facing website.

---

## Purpose

**Goal:** Enable admins to create complete, SEO-optimized doctor profiles through an intuitive step-by-step interface.

**Key Features:**
- ✅ 10-step guided form matching public frontend structure
- ✅ Real-time validation and preview
- ✅ Image/certificate upload with optimization
- ✅ Automatic slug generation from doctor name
- ✅ SEO-optimized output (JSON-LD, meta tags)
- ✅ Progress saving (draft mode)
- ✅ Final review before publishing

---

## Wizard Flow

```
Admin Dashboard
    │
    ├─→ [Create New Doctor Button]
    │
    ├─→ Wizard Step 1: Basic Info ───────────┐
    ├─→ Wizard Step 2: Services              │
    ├─→ Wizard Step 3: Conditions             │
    ├─→ Wizard Step 4: Biography              ├─ Form Data State
    ├─→ Wizard Step 5: Education              │  (Accumulated)
    ├─→ Wizard Step 6: Credentials            │
    ├─→ Wizard Step 7: Clinic Info            │
    ├─→ Wizard Step 8: FAQs                   │
    ├─→ Wizard Step 9: Media                  │
    ├─→ Wizard Step 10: Review & Publish ─────┘
            │
            ├─→ [Publish] → API POST /api/doctors → Database
            │                                           │
            └─→ [Save Draft] → API POST /api/doctors/drafts
                                                        │
                                                        ↓
                                            Public Website (SEO-optimized)
```

---

## Wizard Steps

### Step 1: Basic Info

**Fields:**
- **Full Name** (required) - Auto-generates slug
- **Last Name** (required)
- **Primary Specialty** (required, dropdown)
- **Subspecialties** (optional, multi-select)
- **Cédula Profesional** (optional, text)
- **Location Summary** (required, text) - e.g., "Guadalajara, Jalisco"
- **Hero Image** (required, upload) - Circular photo, min 400x400px

**Validation:**
- Name: Min 3 characters
- Hero image: JPG/PNG, max 5MB
- Slug: Auto-generated, editable, must be unique

**Output:**
```typescript
{
  doctor_full_name: "Dr. María López Hernández",
  slug: "maria-lopez", // Auto-generated
  primary_specialty: "Dermatologist",
  subspecialties: ["Cosmetic Dermatology"],
  cedula_profesional: "1234567",
  location_summary: "Guadalajara, Jalisco",
  hero_image: "/images/doctors/maria-lopez/hero.jpg"
}
```

---

### Step 2: Services

**Interface:**
- Dynamic list of services
- Each service has:
  - **Service Name** (required)
  - **Short Description** (required, max 200 chars)
  - **Duration** (required, number in minutes)
  - **Price** (optional, currency USD or MXN)

**Actions:**
- [+] Add Service
- [-] Remove Service
- ↑↓ Reorder Services

**Validation:**
- Min 1 service required
- Max 20 services allowed
- Service name: Min 3 characters
- Description: Max 200 characters
- Duration: 1-480 minutes

**Output:**
```typescript
services_list: [
  {
    service_name: "Acne Treatment Consultation",
    short_description: "Comprehensive evaluation and treatment plan for acne",
    duration_minutes: 60,
    price_usd: 120
  }
]
```

---

### Step 3: Conditions & Procedures

**Interface:**
- Two columns:
  - **Conditions Treated** (left)
  - **Procedures Offered** (right)

**Each List:**
- Dynamic textarea (comma-separated or line-separated)
- Real-time preview of bullet points

**Validation:**
- Min 3 items per list
- Max 50 items per list

**Output:**
```typescript
{
  conditions: [
    "Acne",
    "Eczema",
    "Psoriasis"
  ],
  procedures: [
    "Chemical Peels",
    "Botox Injections",
    "Laser Therapy"
  ]
}
```

---

### Step 4: Biography

**Fields:**
- **Short Bio** (required, max 300 chars) - For preview cards
- **Long Bio** (required, min 300 chars) - Full biography
- **Years of Experience** (required, number)

**Editor:**
- Rich text editor with basic formatting (bold, italic, lists)
- Character counter
- Preview panel

**Validation:**
- Short bio: 50-300 characters
- Long bio: 300-2000 characters
- Years experience: 1-60

**SEO Optimization:**
- Include E-E-A-T factors (Experience, Expertise, Authoritativeness, Trustworthiness)
- Natural keyword integration
- Readable, patient-friendly language

**Output:**
```typescript
{
  short_bio: "Board-certified dermatologist with 12+ years treating skin conditions.",
  long_bio: "Dr. María López Hernández is a board-certified dermatologist...",
  years_experience: 12
}
```

---

### Step 5: Education

**Interface:**
- Dynamic list of education entries
- Each entry:
  - **Institution** (required)
  - **Program/Degree** (required)
  - **Year** (required, year picker)
  - **Notes** (optional, e.g., "Cum Laude")

**Actions:**
- [+] Add Education
- [-] Remove Education
- ↑↓ Reorder (chronological)

**Validation:**
- Min 1 education entry
- Max 10 entries
- Year: 1950-current year

**Output:**
```typescript
education_items: [
  {
    institution: "University of Guadalajara",
    program: "Medical Degree (MD)",
    year: "2010",
    notes: "Graduated with Honors"
  }
]
```

---

### Step 6: Credentials

**Interface:**
- Image upload grid (certificates, diplomas)
- Each credential:
  - **Image** (required, upload)
  - **Alt Text** (required)
  - **Issued By** (required)
  - **Year** (required)

**Upload Specs:**
- Format: JPG/PNG/PDF
- Max size: 10MB per file
- Auto-resize and optimize
- Thumbnail generation

**Actions:**
- [+] Upload Credential
- [-] Remove Credential
- 👁️ Preview Full-size

**Validation:**
- Min 1 credential
- Max 20 credentials

**Output:**
```typescript
certificate_images: [
  {
    src: "/images/doctors/maria-lopez/cert-1.jpg",
    alt: "Board Certification in Dermatology",
    issued_by: "Mexican Board of Dermatology",
    year: "2011"
  }
]
```

---

### Step 7: Clinic Info

**Fields:**
- **Clinic Name** (required)
- **Street Address** (required)
- **City** (required)
- **State** (required)
- **ZIP Code** (required)
- **Country** (required, default: Mexico)
- **Phone** (required, format validation)
- **WhatsApp** (optional, format validation)
- **Email** (optional, email validation)
- **Geo Coordinates** (optional, lat/lng)

**Office Hours:**
- Day-by-day grid (Mon-Sun)
- Each day: Open/Closed toggle
- If open: Start Time, End Time

**Map Integration:**
- Google Maps autocomplete for address
- Drag marker for precise location
- Preview map in wizard

**Validation:**
- Phone: International format
- Email: Valid email format
- Coordinates: Valid lat/lng (-90 to 90, -180 to 180)

**Output:**
```typescript
clinic_info: {
  clinic_name: "Dermatología Especializada",
  street_address: "Av. Américas 1500",
  city: "Guadalajara",
  state: "Jalisco",
  zip: "44610",
  country: "Mexico",
  phone: "+52 33 1234 5678",
  whatsapp_number: "+52 33 1234 5678",
  email: "contacto@dermaespecializada.com",
  geo_coordinates: {
    lat: 20.6737,
    lng: -103.3579
  },
  office_hours: [
    { day: "Monday", hours: "9:00 AM - 6:00 PM" },
    { day: "Tuesday", hours: "9:00 AM - 6:00 PM" }
  ]
}
```

---

### Step 8: FAQs

**Interface:**
- Dynamic list of FAQ pairs
- Each FAQ:
  - **Question** (required, max 200 chars)
  - **Answer** (required, max 1000 chars)

**Actions:**
- [+] Add FAQ
- [-] Remove FAQ
- ↑↓ Reorder

**SEO Optimization:**
- Questions should match common patient searches
- Answers should be clear, concise, actionable
- Include keywords naturally

**Validation:**
- Min 3 FAQs
- Max 20 FAQs
- Question: 10-200 characters
- Answer: 50-1000 characters

**Output:**
```typescript
faqs: [
  {
    question: "What skin conditions do you treat?",
    answer: "I specialize in treating acne, eczema, psoriasis..."
  }
]
```

**JSON-LD Schema:**
- Automatically generates FAQPage structured data
- Enhances search result appearance

---

### Step 9: Media

**Interface:**
- Two sections:
  - **Clinic Photos** (image uploads)
  - **Introduction Videos** (URL inputs)

**Clinic Photos:**
- Upload multiple images
- Each image:
  - **Image** (required, upload)
  - **Caption** (optional)
  - **Alt Text** (required)

**Introduction Videos:**
- Add video URLs (YouTube, Vimeo)
- Auto-generate thumbnail
- Each video:
  - **URL** (required, validated)
  - **Title** (required)
  - **Thumbnail** (auto-generated or custom)

**Upload Specs:**
- Images: JPG/PNG, max 10MB
- Videos: External URLs only (no uploads)

**Validation:**
- Min 2 media items (photos or videos)
- Max 20 total items

**Output:**
```typescript
carousel_items: [
  {
    type: "image",
    src: "/images/doctors/maria-lopez/clinic-1.jpg",
    alt: "Modern reception area",
    caption: "Our welcoming reception"
  },
  {
    type: "video",
    src: "https://youtube.com/watch?v=xyz",
    thumbnail: "/images/doctors/maria-lopez/video-thumb.jpg",
    title: "Meet Dr. López"
  }
]
```

---

### Step 10: Review & Publish

**Interface:**
- **Left Panel:** Summary of all sections
  - Read-only view of all entered data
  - [Edit] buttons for each section (jump back to step)

- **Right Panel:** Live Preview
  - Full doctor profile page preview
  - Same styling as public website
  - SEO preview (title, description, OpenGraph)

**SEO Checklist:**
- ✅ Unique H1 (doctor name)
- ✅ Meta description (auto-generated from short bio)
- ✅ Alt text on all images
- ✅ Structured data (Physician, MedicalBusiness, FAQPage)
- ✅ Canonical URL
- ✅ OpenGraph tags

**Actions:**
- **[Save Draft]** - Save without publishing (admin-only view)
- **[Publish]** - Publish to public website (POST /api/doctors)
- **[← Back]** - Return to previous step

**Pre-Publish Validation:**
- All required fields filled
- Min requirements met (services, FAQs, etc.)
- Images uploaded successfully
- Slug is unique

**Success:**
- Show success message with:
  - Public URL: `https://yoursite.com/doctors/[slug]`
  - Admin edit URL: `https://admin.yoursite.com/doctors/[id]/edit`
  - [View Profile] button
  - [Create Another] button

---

## Technical Implementation

### Component Structure

```
apps/admin/src/components/wizard/
├── WizardLayout.tsx           # Main wizard container
├── WizardStepper.tsx          # Progress stepper UI
├── WizardNavigation.tsx       # Next/Back/Save buttons
├── steps/
│   ├── Step1_BasicInfo.tsx
│   ├── Step2_Services.tsx
│   ├── Step3_Conditions.tsx
│   ├── Step4_Biography.tsx
│   ├── Step5_Education.tsx
│   ├── Step6_Credentials.tsx
│   ├── Step7_ClinicInfo.tsx
│   ├── Step8_FAQs.tsx
│   ├── Step9_Media.tsx
│   └── Step10_Review.tsx
└── hooks/
    ├── useWizardState.ts      # Wizard form state management
    ├── useWizardValidation.ts # Validation logic
    └── useImageUpload.ts      # Image upload handler
```

### State Management

**Local State (React Hook):**
```typescript
interface WizardState {
  currentStep: number;
  formData: Partial<DoctorProfile>;
  errors: Record<string, string>;
  isDraft: boolean;
  isValid: boolean;
}

const useWizardState = () => {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    formData: {},
    errors: {},
    isDraft: false,
    isValid: false
  });

  const nextStep = () => { /* ... */ };
  const prevStep = () => { /* ... */ };
  const updateField = (field, value) => { /* ... */ };
  const saveDraft = () => { /* ... */ };
  const publish = () => { /* ... */ };

  return { state, nextStep, prevStep, updateField, saveDraft, publish };
};
```

### API Integration

**Create Doctor:**
```typescript
// POST /api/doctors
const response = await fetch('http://localhost:3003/api/doctors', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.accessToken}`
  },
  body: JSON.stringify(formData)
});

if (response.ok) {
  const doctor = await response.json();
  router.push(`/doctors/${doctor.id}`);
}
```

**Upload Image:**
```typescript
// POST /api/upload
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'hero_image');
formData.append('doctorSlug', 'maria-lopez');

const response = await fetch('http://localhost:3003/api/upload', {
  method: 'POST',
  body: formData
});

const { url } = await response.json();
// url: "/images/doctors/maria-lopez/hero.jpg"
```

---

## Validation Rules

### Global Rules
- All required fields must be filled
- No duplicate slugs allowed
- All images must upload successfully
- Form must pass all step validations

### Step-by-Step Validation

| Step | Field | Rule |
|------|-------|------|
| 1 | Full Name | 3-100 chars |
| 1 | Hero Image | JPG/PNG, 400x400px min, 5MB max |
| 1 | Slug | Lowercase, hyphens, unique |
| 2 | Services | 1-20 services |
| 2 | Service Name | 3-100 chars |
| 2 | Duration | 1-480 minutes |
| 3 | Conditions | 3-50 items |
| 3 | Procedures | 3-50 items |
| 4 | Short Bio | 50-300 chars |
| 4 | Long Bio | 300-2000 chars |
| 5 | Education | 1-10 entries |
| 6 | Credentials | 1-20 files, 10MB max each |
| 7 | Phone | Valid format |
| 7 | Email | Valid email |
| 8 | FAQs | 3-20 pairs |
| 8 | Question | 10-200 chars |
| 9 | Media | 2-20 items |

---

## SEO Optimization

### Auto-Generated SEO Elements

**Meta Title:**
```
{doctor_full_name} | {primary_specialty} | {location_summary}
Example: "Dr. María López Hernández | Dermatologist | Guadalajara"
```

**Meta Description:**
```
{short_bio} Specializing in {subspecialties}. {years_experience} years of experience. Book an appointment today.
Example: "Board-certified dermatologist with 12+ years treating skin conditions. Specializing in Cosmetic Dermatology. Book an appointment today."
```

**JSON-LD Schemas:**
1. **Physician Schema**
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Physician",
     "name": "Dr. María López Hernández",
     "medicalSpecialty": "Dermatologist",
     "address": { ... },
     "telephone": "+52 33 1234 5678"
   }
   ```

2. **MedicalBusiness Schema**
   ```json
   {
     "@context": "https://schema.org",
     "@type": "MedicalBusiness",
     "name": "Dermatología Especializada",
     "address": { ... },
     "openingHours": [ ... ]
   }
   ```

3. **FAQPage Schema**
   ```json
   {
     "@context": "https://schema.org",
     "@type": "FAQPage",
     "mainEntity": [ ... ]
   }
   ```

---

## User Experience

### Progress Saving
- Auto-save draft every 30 seconds
- Show "Last saved" timestamp
- Allow manual save with [Save Draft] button
- Resume from last saved step

### Validation Feedback
- Inline validation (real-time)
- Error messages below fields
- Prevent advancing to next step if current step invalid
- Summary of errors at top of step

### Navigation
- **Next Button:** Advances to next step (if valid)
- **Back Button:** Returns to previous step (no validation)
- **Save Draft:** Saves current progress (no publish)
- **Jump to Step:** Click stepper to jump (if step visited)

### Stepper UI
```
1. Basic Info  ✓
2. Services    ✓
3. Conditions  (current)
4. Biography
5. Education
6. Credentials
7. Clinic Info
8. FAQs
9. Media
10. Review
```

---

## Error Handling

### Upload Errors
- **File too large:** "Image exceeds 5MB limit"
- **Invalid format:** "Only JPG and PNG files allowed"
- **Upload failed:** "Upload failed. Please try again."

### API Errors
- **Duplicate slug:** "This URL is already taken. Try 'maria-lopez-guadalajara'"
- **Validation error:** Show field-specific errors
- **Network error:** "Connection lost. Your progress has been saved."

### Recovery
- All draft data saved to local storage
- Session timeout warning (30 min idle)
- Confirm navigation away if unsaved changes

---

## Testing Checklist

### Functional Tests
- [ ] All 10 steps render correctly
- [ ] Navigation (next/back) works
- [ ] Form data persists across steps
- [ ] Validation prevents invalid submissions
- [ ] Image upload works for all file types
- [ ] Draft saving works
- [ ] Final publish creates doctor in database
- [ ] Published doctor appears on public website
- [ ] SEO metadata generated correctly
- [ ] Structured data valid (Google Rich Results Test)

### Edge Cases
- [ ] Duplicate slug handling
- [ ] Very long text inputs (truncation)
- [ ] Empty optional fields
- [ ] Maximum items in lists (services, FAQs)
- [ ] Invalid image formats
- [ ] Network failure during upload
- [ ] Browser back button behavior
- [ ] Session timeout recovery

---

## Deployment Checklist

### Before Launch
- [ ] Set up image storage (S3 or local /public/images)
- [ ] Configure upload size limits
- [ ] Set up CDN for image delivery
- [ ] Test on all browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices
- [ ] Load test with 100+ doctors

### Environment Variables
```env
# Image Upload
UPLOAD_MAX_SIZE=10485760  # 10MB
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,application/pdf

# Storage
STORAGE_TYPE=local  # or s3
S3_BUCKET=doctor-images
S3_REGION=us-east-1

# API
NEXT_PUBLIC_API_URL=https://api.yoursite.com
```

---

## Future Enhancements

### Phase 2
- [ ] Doctor profile editing (reuse wizard)
- [ ] Bulk import from CSV
- [ ] Template presets (save common services/FAQs)
- [ ] AI-assisted bio writing
- [ ] Video upload (not just URLs)

### Phase 3
- [ ] Multi-language support (Spanish/English)
- [ ] Approval workflow (draft → pending → approved)
- [ ] Version history (track changes)
- [ ] Duplicate profile (clone existing)
- [ ] Advanced analytics (views, clicks per doctor)

---

## Support & Documentation

### For Admins
- Video tutorial: "How to create a doctor profile" (5 min)
- PDF guide: Step-by-step screenshots
- FAQ: Common questions

### For Developers
- API documentation: `/api/doctors` endpoints
- Component storybook: Wizard components
- Database schema: Doctor table structure

---

## Summary

The Doctor Profile Creation Wizard is the core feature of the admin panel MVP. It ensures:
- ✅ **Consistency:** All doctors follow same structure
- ✅ **SEO:** Automatic optimization without manual work
- ✅ **UX:** Intuitive step-by-step process
- ✅ **Validation:** Prevents incomplete or invalid profiles
- ✅ **Scalability:** Easy to add new doctors

**Estimated build time:** 16-20 hours for full implementation
**MVP version:** 8-10 hours (basic validation, no draft saving)
