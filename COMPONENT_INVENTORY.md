# Component Inventory

**Generated**: 2025-12-28
**Framework**: React 19.2.1 with Next.js 16 App Router
**Styling**: Tailwind CSS 4

## Overview

This document catalogs all React components across the healthcare platform monorepo. Components are organized by application and category.

---

## Public App Components (`apps/public/src/components/`)

### UI Components (`components/ui/`)

Generic, reusable UI components.

#### `Button.tsx`

**Purpose**: Generic button component
**Type**: Client or Server component
**Props**: Standard button props

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  // ... standard button props
}
```

**Usage**:
```tsx
<Button variant="primary" size="md">
  Click Me
</Button>
```

---

#### `Badge.tsx`

**Purpose**: Badge/tag component for labels
**Type**: Server component
**Props**: Text and color variant

```typescript
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}
```

**Usage**:
```tsx
<Badge variant="success">Disponible</Badge>
```

---

#### `Card.tsx`

**Purpose**: Card container component
**Type**: Server component
**Props**: Standard div props with styling

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
}
```

**Usage**:
```tsx
<Card>
  <h2>Title</h2>
  <p>Content</p>
</Card>
```

---

### Doctor Profile Components (`components/doctor/`)

Components for rendering doctor profile sections. All consume doctor data passed from parent.

#### `HeroSection.tsx`

**Purpose**: Top hero section with doctor photo and CTA
**Type**: Server Component
**Location**: Top of profile page

**Props**:
```typescript
interface HeroSectionProps {
  doctorFullName: string;
  lastName: string;
  primarySpecialty: string;
  heroImage: string;
  locationSummary: string;
  yearsExperience: number;
  slug: string; // for CTA links
}
```

**Features**:
- Hero image with gradient overlay
- Doctor name and specialty
- Location and experience
- Primary CTA button (appointment booking)

**Rendering**:
- Full-width background image
- Responsive layout
- Structured data for SEO (Physician schema)

---

#### `ServicesSection.tsx`

**Purpose**: Display medical services offered
**Type**: Server Component

**Props**:
```typescript
interface ServicesSectionProps {
  services: Array<{
    serviceName: string;
    shortDescription: string;
    durationMinutes: number;
    price?: number;
  }>;
}
```

**Features**:
- Grid layout (responsive)
- Service cards with name, description, duration
- Optional price display
- Icons from lucide-react

---

#### `ConditionsSection.tsx`

**Purpose**: List medical conditions and procedures
**Type**: Server Component

**Props**:
```typescript
interface ConditionsSectionProps {
  conditions: string[];
  procedures: string[];
}
```

**Features**:
- Two-column layout
- Badge/pill style for each item
- Grouped by category

---

#### `MediaCarousel.tsx`

**Purpose**: Clinic photos and videos carousel
**Type**: **Client Component** (uses useState)
**Dynamic Import**: Yes (loaded on-demand)

**Props**:
```typescript
interface MediaCarouselProps {
  items: Array<{
    type: 'image' | 'video_thumbnail';
    src: string;
    thumbnail?: string;
    alt: string;
    caption?: string;
    // Video metadata
    name?: string;
    description?: string;
    uploadDate?: string;
    duration?: string;
  }>;
}
```

**Features**:
- Image/video slideshow
- Navigation arrows
- Thumbnail grid
- Video play button overlay
- Lightbox effect
- Video structured data for SEO

**State**:
```typescript
const [currentIndex, setCurrentIndex] = useState(0);
```

---

#### `BiographySection.tsx`

**Purpose**: Doctor's biography
**Type**: Server Component

**Props**:
```typescript
interface BiographySectionProps {
  longBio: string;
  shortBio: string;
  yearsExperience: number;
}
```

**Features**:
- Rich text rendering
- Read more/less toggle (if needed)
- Years of experience badge

---

#### `EducationSection.tsx`

**Purpose**: Educational background
**Type**: Server Component

**Props**:
```typescript
interface EducationSectionProps {
  educationItems: Array<{
    institution: string;
    program: string;
    year: string;
    notes?: string;
  }>;
}
```

**Features**:
- Timeline or list layout
- Institution logos (optional)
- Chronological order

---

#### `CredentialsSection.tsx`

**Purpose**: Certifications and credentials
**Type**: Server Component

**Props**:
```typescript
interface CredentialsSectionProps {
  certificates: Array<{
    src: string;
    alt: string;
    issuedBy: string;
    year: string;
  }>;
}
```

**Features**:
- Image grid of certificates
- Lightbox/modal on click
- Issuer and year display

---

#### `ClinicLocationSection.tsx`

**Purpose**: Clinic address, hours, and map
**Type**: Server Component (map may be client component)

**Props**:
```typescript
interface ClinicLocationSectionProps {
  clinicAddress: string;
  clinicPhone: string;
  clinicWhatsapp?: string;
  clinicHours: {
    [day: string]: string; // e.g., "monday": "9:00 AM - 5:00 PM"
  };
  clinicGeoLat?: number;
  clinicGeoLng?: number;
}
```

**Features**:
- Address display
- Phone/WhatsApp links
- Office hours table
- Embedded map (Google Maps or similar)
- MedicalBusiness structured data

---

#### `FAQSection.tsx`

**Purpose**: Frequently asked questions
**Type**: Server Component (accordion likely client component)

**Props**:
```typescript
interface FAQSectionProps {
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}
```

**Features**:
- Accordion/collapsible Q&A
- FAQPage structured data for rich snippets
- Smooth expand/collapse animation

---

#### `AppointmentCalendar.tsx`

**Purpose**: Appointment booking widget
**Type**: **Client Component** (interactive calendar)
**Dynamic Import**: Yes (lazy loaded)

**Props**:
```typescript
interface AppointmentCalendarProps {
  doctorId: string;
  doctorSlug: string;
}
```

**Features**:
- Calendar UI for date selection
- Available time slots
- Booking form
- Integration with appointment API
- WhatsApp redirect for booking confirmation

**State**:
```typescript
const [selectedDate, setSelectedDate] = useState<Date | null>(null);
const [availableSlots, setAvailableSlots] = useState([]);
const [selectedSlot, setSelectedSlot] = useState(null);
```

**API Calls**:
```typescript
// Fetch available slots
GET /api/appointments/slots?doctorId={id}&date={date}

// Create booking
POST /api/appointments/bookings
```

---

#### `QuickNav.tsx`

**Purpose**: Quick navigation anchors
**Type**: Client Component (scroll behavior)

**Props**:
```typescript
interface QuickNavProps {
  sections: Array<{
    id: string;
    label: string;
  }>;
}
```

**Features**:
- Sticky navigation bar
- Smooth scroll to sections
- Active section highlight

---

#### `DoctorProfileClient.tsx`

**Purpose**: Client-side wrapper for profile page
**Type**: Client Component
**Usage**: Wraps sections that need client interactivity

**Props**:
```typescript
interface DoctorProfileClientProps {
  doctor: DoctorProfile;
}
```

**Purpose**:
- Manages client-side state
- Coordinates between sections
- Handles scroll effects

---

### Blog Components (`components/blog/`)

#### `BlogLayoutClient.tsx`

**Purpose**: Shared layout for blog pages with sidebar
**Type**: Client Component
**Location**: Used in blog listing and article pages

**Props**:
```typescript
interface BlogLayoutClientProps {
  children: React.ReactNode;
  doctorSlug: string;
  doctorName: string;
  doctorImage: string;
  currentPage?: 'list' | 'article';
}
```

**Features**:
- Fixed sidebar with doctor info
- Back button to profile
- Navigation to article list
- Responsive layout

**Layout**:
```
┌─────────────┬─────────────────────┐
│  Sidebar    │  Main Content       │
│  (Doctor)   │  (Articles/Article) │
│             │                     │
│  Fixed      │  Scrollable         │
└─────────────┴─────────────────────┘
```

---

#### `ArticleCard.tsx`

**Status**: **Not Yet Implemented**

**Planned Purpose**: Article preview card
**Type**: Server Component

**Props**:
```typescript
interface ArticleCardProps {
  slug: string;
  title: string;
  excerpt: string;
  thumbnail?: string;
  publishedAt: string;
  views: number;
}
```

**Planned Features**:
- Thumbnail image
- Title and excerpt
- Publish date
- View count
- Link to full article

---

#### `ArticleContent.tsx`

**Status**: **Not Yet Implemented**

**Planned Purpose**: Render HTML article content safely
**Type**: Server Component

**Props**:
```typescript
interface ArticleContentProps {
  content: string; // HTML string
}
```

**Planned Features**:
- Safe HTML rendering (dangerouslySetInnerHTML or library)
- Styled typography
- Code syntax highlighting (if needed)
- Responsive images

---

## Doctor App Components (`apps/doctor/src/components/`)

### Blog Management (`components/blog/`)

#### `RichTextEditor.tsx`

**Purpose**: WYSIWYG HTML editor for blog posts
**Type**: **Client Component** (Tiptap uses DOM)

**Props**:
```typescript
interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}
```

**Features**:
- Tiptap-based rich text editor
- Toolbar with formatting buttons:
  - Bold, Italic
  - Headings (H2, H3)
  - Bullet list, Ordered list
  - Link insertion
  - Image upload
  - Undo/Redo
- Real-time HTML output
- Character counter
- Placeholder text

**Extensions Used**:
```typescript
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
```

**State Management**:
```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Image,
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: 'Escribe tu artículo aquí...' })
  ],
  content: content,
  onUpdate: ({ editor }) => {
    onChange(editor.getHTML());
  }
});
```

**Recent Bug Fix**:
- Fixed infinite reload when editing articles
- Solution: Only update editor when `content` prop changes on initial load, not on every keystroke

**File Location**: `apps/doctor/src/components/blog/RichTextEditor.tsx`

---

#### `CreateSlotsModal.tsx`

**Purpose**: Modal for creating appointment slots
**Type**: Client Component
**Location**: `apps/doctor/src/app/appointments/CreateSlotsModal.tsx`

**Props**:
```typescript
interface CreateSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onSuccess: () => void;
}
```

**Features**:
- Single or recurring slot creation
- Date picker
- Time range selection
- Break time configuration
- Pricing and discount settings
- Form validation

**Form State**:
```typescript
const [mode, setMode] = useState<'single' | 'recurring'>('single');
const [date, setDate] = useState<Date | null>(null);
const [startTime, setStartTime] = useState('09:00');
const [endTime, setEndTime] = useState('17:00');
const [duration, setDuration] = useState<30 | 60>(30);
const [basePrice, setBasePrice] = useState(800);
// ... more fields
```

**API Call**:
```typescript
POST /api/appointments/slots
```

---

## Admin App Components (`apps/admin/src/components/`)

### Status

The admin app components are primarily **inline** within page files rather than extracted into separate component files. The main UI is the 10-step wizard located in:

- `apps/admin/src/app/doctors/new/page.tsx` (Create)
- `apps/admin/src/app/doctors/[slug]/edit/page.tsx` (Edit)

### Wizard Steps (Inline Components)

The doctor creation/editing wizard has 10 steps, each rendered as a section within the page component:

1. **Basic Information**
   - Form fields: name, slug, specialty, hero image
   - UploadThing file upload

2. **Services**
   - Dynamic array of service forms
   - Add/remove service entries

3. **Conditions & Procedures**
   - Tag input for conditions
   - Tag input for procedures

4. **Biography**
   - Short bio textarea
   - Long bio textarea
   - Years of experience input

5. **Education**
   - Dynamic array of education forms
   - Institution, program, year

6. **Credentials**
   - Certificate image upload
   - Issued by, year metadata

7. **Clinic Information**
   - Address, phone, hours
   - Map coordinates (optional)

8. **FAQs**
   - Dynamic array of Q&A pairs

9. **Multimedia**
   - Clinic photos upload
   - Video thumbnails

10. **Review & Publish**
    - Summary of all data
    - Submit button

**State Management**:
```typescript
const [currentStep, setCurrentStep] = useState(1);
const [formData, setFormData] = useState({
  // All form fields
});
```

---

## Component Patterns & Conventions

### Server vs Client Components

**Server Components** (default in Next.js App Router):
- All doctor profile display components
- Layout components
- Static UI elements

**Client Components** (`'use client'` directive):
- Interactive forms
- Rich text editors
- Calendars and date pickers
- Modals
- Components using useState, useEffect, event handlers

### Component File Organization

```
src/components/
├── ui/              # Generic, reusable UI components
├── doctor/          # Domain-specific (doctor profiles)
└── blog/            # Feature-specific (blog)
```

### Props Pattern

Most components follow this pattern:
1. Interface definition for props
2. Destructure props in function signature
3. Render with Tailwind classes

```typescript
interface MyComponentProps {
  title: string;
  items: Array<{ id: string; name: string }>;
}

export function MyComponent({ title, items }: MyComponentProps) {
  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

### Dynamic Imports

Heavy client components are lazy-loaded:

```typescript
// apps/public/src/app/doctores/[slug]/page.tsx
const AppointmentCalendar = dynamic(
  () => import('@/components/doctor/AppointmentCalendar'),
  { ssr: false, loading: () => <p>Cargando calendario...</p> }
);

const MediaCarousel = dynamic(
  () => import('@/components/doctor/MediaCarousel'),
  { ssr: false }
);
```

**Purpose**: Reduce initial page load size

---

## Styling

### Tailwind CSS

All components use Tailwind CSS v4 for styling:

```tsx
<div className="container mx-auto px-4 py-8">
  <h1 className="text-3xl font-bold text-gray-900">
    Title
  </h1>
  <p className="mt-4 text-gray-600">
    Content
  </p>
</div>
```

### Common Tailwind Patterns

- **Container**: `container mx-auto px-4`
- **Grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- **Card**: `bg-white rounded-lg shadow-md p-6`
- **Button**: `bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700`

---

## Icons

All apps use **Lucide React** for icons:

```tsx
import { Calendar, MapPin, Phone, Mail } from 'lucide-react';

<Calendar className="w-5 h-5" />
<MapPin className="w-4 h-4 text-gray-500" />
```

**Common Icons**:
- `Calendar` - Appointments
- `MapPin` - Location
- `Phone` - Contact
- `Mail` - Email
- `Clock` - Time/duration
- `Star` - Ratings
- `User` - Profile
- `Edit` - Edit actions
- `Trash` - Delete actions

---

## Form Components

### UploadThing Components (Admin App)

```tsx
import { UploadButton, UploadDropzone } from '@uploadthing/react';

<UploadButton
  endpoint="imageUploader"
  onClientUploadComplete={(res) => {
    setImageUrl(res[0].url);
  }}
  onUploadError={(error) => {
    alert(`ERROR! ${error.message}`);
  }}
/>
```

**Endpoints**:
- `imageUploader` - Doctor hero images
- `certificateUploader` - Certificate images
- `carouselUploader` - Clinic photos

**Configuration**: `apps/admin/src/app/api/uploadthing/core.ts`

---

## Data Fetching Patterns

### Server Components (Public App)

```tsx
// apps/public/src/app/doctores/[slug]/page.tsx
async function getDoctor(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/doctors/${slug}`,
    { next: { revalidate: 60 } } // ISR: 60 seconds
  );

  if (!res.ok) notFound();

  const { data } = await res.json();
  return data;
}

export default async function DoctorPage({ params }) {
  const { slug } = await params;
  const doctor = await getDoctor(slug);

  return <DoctorProfileClient doctor={doctor} />;
}
```

### Client Components (Doctor/Admin Apps)

```tsx
// apps/doctor/src/app/dashboard/blog/page.tsx
'use client';

export default function BlogPage() {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    async function fetchArticles() {
      const token = generateToken(session.user);
      const res = await fetch(`${API_URL}/api/articles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const { data } = await res.json();
      setArticles(data);
    }

    fetchArticles();
  }, []);

  return <ArticleList articles={articles} />;
}
```

---

## Future Component Needs

Based on the codebase analysis, these components should be created:

1. **ArticleCard** (`apps/public/src/components/blog/ArticleCard.tsx`)
   - Article preview for listing page
   - Currently listed but not implemented

2. **ArticleContent** (`apps/public/src/components/blog/ArticleContent.tsx`)
   - Safe HTML renderer for article content
   - Should handle HTML sanitization

3. **DoctorList** (`apps/public/src/components/doctor/DoctorList.tsx`)
   - Grid of doctor cards for `/doctores` page
   - Filter/search functionality

4. **BookingConfirmation** (`apps/public/src/components/appointments/BookingConfirmation.tsx`)
   - Confirmation modal after booking
   - WhatsApp redirect

5. **UserForm** (`apps/admin/src/components/users/UserForm.tsx`)
   - Create/edit user form
   - Role selection, doctor linking

---

## Testing Recommendations

### Component Testing

Consider adding tests for:

1. **RichTextEditor**
   - Test HTML output
   - Test toolbar buttons
   - Test image upload

2. **AppointmentCalendar**
   - Test date selection
   - Test slot availability
   - Test booking flow

3. **MediaCarousel**
   - Test navigation
   - Test image/video switching

### Testing Libraries

Recommended:
- **Vitest** or **Jest** - Unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

---

**End of Component Inventory**
