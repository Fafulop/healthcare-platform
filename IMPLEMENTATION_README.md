# Doctor Profile Platform - Implementation Guide

## Overview

This is a complete implementation of a doctor profile page following SEO best practices and modern design principles. The project is built with Next.js 13+ (App Router), TypeScript, and TailwindCSS v4.

## Project Structure

```
docs-front/
├── src/
│   ├── app/
│   │   ├── doctors/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx          # Dynamic doctor profile page
│   │   │       ├── layout.tsx         # Metadata & structured data
│   │   │       └── not-found.tsx      # 404 page
│   │   ├── layout.tsx                 # Root layout with Inter font
│   │   ├── page.tsx                   # Homepage
│   │   └── globals.css                # Tailwind config & design tokens
│   ├── components/
│   │   ├── ui/                        # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Badge.tsx
│   │   └── doctor/                    # Doctor profile sections
│   │       ├── HeroSection.tsx
│   │       ├── ServicesSection.tsx
│   │       ├── ConditionsSection.tsx
│   │       ├── AppointmentCalendar.tsx
│   │       ├── MediaCarousel.tsx
│   │       ├── BiographySection.tsx
│   │       ├── EducationSection.tsx
│   │       ├── CredentialsSection.tsx
│   │       ├── ClinicLocationSection.tsx
│   │       └── FAQSection.tsx
│   ├── lib/
│   │   ├── seo.ts                     # SEO metadata utilities
│   │   ├── structured-data.ts         # JSON-LD generators
│   │   └── data.ts                    # Data loading utilities
│   ├── types/
│   │   └── doctor.ts                  # TypeScript interfaces
│   └── data/
│       └── doctors/
│           └── maria-lopez.json       # Sample doctor data
├── public/
│   └── images/
│       └── doctors/
│           └── sample/                # Placeholder images needed
├── DESIGN_GUIDE.md                    # Design system documentation
├── SEO_GUIDE.md                       # SEO blueprint
└── package.json
```

## Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. View the Sample Doctor Profile

Navigate to: [http://localhost:3000/doctors/maria-lopez](http://localhost:3000/doctors/maria-lopez)

### 3. Add Placeholder Images

Before running, you'll need to add placeholder images to `public/images/doctors/sample/`:

Required files:
- `hero.jpg` (180x180px+)
- `clinic-1.jpg` through `clinic-4.jpg`
- `certificate-1.jpg` through `certificate-4.jpg`

For quick testing, you can use placeholder URLs in the JSON file:
```json
"hero_image": "https://placehold.co/400x400/1D5B63/FFFFFF?text=Dr.+Lopez"
```

See `public/images/doctors/sample/README.md` for detailed specifications.

## Key Features Implemented

### ✅ SEO Optimization
- Server-side rendering for all textual content
- Dynamic metadata generation (title, description, OpenGraph)
- JSON-LD structured data (Physician, MedicalBusiness, FAQPage)
- Only one H1 per page (doctor name)
- Proper heading hierarchy (H1 → H2 → H3)
- Hero image preloading for LCP optimization
- Alt text for all images
- Canonical URLs

### ✅ Design System
- TailwindCSS v4 with custom design tokens
- Color palette: Warm Yellow (#FFEC1A) + Deep Green (#1D5B63)
- Inter font family
- Consistent spacing (8px base unit)
- Border radius system (small, medium, large, pill)
- Box shadows (light, medium)
- Responsive breakpoints (sm, md, lg, xl)

### ✅ Performance
- Dynamic imports for Calendar and Carousel (client-side only)
- Lazy loading for all images except hero
- Next.js Image component with automatic optimization
- Static generation with revalidation
- Code splitting (automatic with App Router)

### ✅ Accessibility
- Keyboard navigation support
- ARIA labels for icon buttons
- Focus indicators with proper contrast
- Semantic HTML structure
- Alt text for all images
- Click-to-call phone links

### ✅ Components (10 Sections)
1. **Hero** - Doctor identity, photo, CTAs
2. **Services** - Service cards with pricing
3. **Conditions** - Bulleted lists of conditions/procedures
4. **Appointment Calendar** - Booking widget (client-side)
5. **Media Carousel** - Clinic photos & videos
6. **Biography** - Experience narrative with "Read More"
7. **Education** - Academic credentials
8. **Credentials** - Diploma gallery with lightbox
9. **Clinic Location** - Address, hours, Google Maps link
10. **FAQ** - Accordion-style Q&A

## Testing & Validation

### SEO Validation Checklist

Run these checks after starting the dev server:

#### ✅ Metadata Check
1. Visit `/doctors/maria-lopez`
2. View page source (Right-click → View Page Source)
3. Verify:
   - `<title>` matches template: "Dr. María López Hernández | Dermatologist | Guadalajara"
   - `<meta name="description">` is present and descriptive
   - OpenGraph tags (`og:title`, `og:description`, `og:image`) are present
   - Canonical URL is set

#### ✅ Structured Data Check
1. View page source
2. Search for `<script type="application/ld+json">`
3. Verify 3 JSON-LD schemas are present:
   - Physician schema
   - MedicalBusiness schema
   - FAQPage schema
4. Optional: Use [Google's Rich Results Test](https://search.google.com/test/rich-results)

#### ✅ Heading Structure Check
1. Inspect page with browser DevTools
2. Verify:
   - Only ONE `<h1>` (doctor full name)
   - `<h2>` tags for major sections (Services, Biography, etc.)
   - `<h3>` tags for subsections (individual services, FAQs)

#### ✅ Content Check
- Minimum 300 words of unique content across bio + services + conditions
- All images have descriptive alt text
- Hero image has `priority` prop

### Performance Testing

#### Lighthouse Audit
1. Open DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Performance", "Accessibility", "Best Practices", "SEO"
4. Run audit
5. Target scores: **90+ on all metrics**

#### Key Metrics to Check
- **LCP (Largest Contentful Paint)**: < 2.5s (hero image should be preloaded)
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1
- **Image optimization**: All images use Next.js Image component
- **Lazy loading**: Calendar and Carousel load client-side only

### Accessibility Testing

#### Automated Testing
1. Install axe DevTools extension
2. Run accessibility scan
3. Fix any issues reported

#### Manual Testing
- **Keyboard navigation**: Tab through all interactive elements
- **Focus indicators**: Visible focus rings on buttons/links
- **Screen reader**: Test with NVDA (Windows) or VoiceOver (Mac)
- **Color contrast**: All text meets WCAG AA standards

### Responsive Design Testing

Test at these breakpoints:
- **Mobile**: 375px, 480px
- **Tablet**: 768px
- **Desktop**: 1024px, 1280px, 1440px

Verify:
- Single column layout on mobile
- Grid layouts adjust properly
- Touch-friendly button sizes (min 44px)
- No horizontal scrolling

## Building for Production

### 1. Build the Project

```bash
npm run build
```

This will:
- Generate static pages for all doctor profiles
- Optimize images
- Bundle and minify JavaScript/CSS
- Create production-ready build in `.next/`

### 2. Start Production Server

```bash
npm start
```

### 3. Deploy

Deploy to Vercel (recommended) or any hosting that supports Next.js:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Adding More Doctors

### 1. Create New JSON File

Create `src/data/doctors/[doctor-slug].json` with the same structure as `maria-lopez.json`.

### 2. Add Images

Add corresponding images to `public/images/doctors/[doctor-slug]/`.

### 3. Build

Run `npm run build` to regenerate static pages.

The new doctor will be available at `/doctors/[doctor-slug]`.

## Environment Variables

Create `.env.local` for environment-specific config:

```env
# Base URL for metadata and structured data
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## Customization

### Update Design Tokens

Edit `src/app/globals.css` to modify:
- Colors
- Spacing
- Border radius
- Typography scale
- Box shadows

### Modify Section Order

Edit `src/app/doctors/[slug]/page.tsx` to rearrange sections. Current order follows SEO_GUIDE.md recommendations.

### Add New Sections

1. Create component in `src/components/doctor/`
2. Add to doctor profile page
3. Update TypeScript interfaces if needed

## Troubleshooting

### Images Not Loading
- Check file paths in JSON match actual file locations
- Ensure images are in `public/` directory
- Verify image URLs in browser DevTools Network tab

### TypeScript Errors
```bash
npm run type-check
```

### Build Errors
- Clear `.next/` directory: `rm -rf .next` (or `rmdir /s .next` on Windows)
- Clear node_modules: `rm -rf node_modules && npm install`

### Tailwind Styles Not Applying
- Restart dev server
- Check that CSS variables are defined in `globals.css`
- Verify class names use `var(--color-name)` syntax

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TailwindCSS v4 Documentation](https://tailwindcss.com/docs)
- [Schema.org Documentation](https://schema.org/)
- [Google Search Central](https://developers.google.com/search)
- [Lucide Icons](https://lucide.dev/)

## License

This implementation is based on the SEO_GUIDE.md and DESIGN_GUIDE.md specifications.
