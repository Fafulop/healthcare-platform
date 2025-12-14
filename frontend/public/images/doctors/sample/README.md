# Sample Doctor Images

This directory should contain the following placeholder images for the sample doctor profile:

## Required Images:

### Hero Image
- **hero.jpg** (180x180px or larger, square)
  - Professional headshot of the doctor
  - Should be preloaded for LCP optimization
  - Alt text: "Dr. María López Hernández - Dermatologist"

### Clinic Photos (for carousel)
- **clinic-1.jpg** - Reception area
- **clinic-2.jpg** - Treatment room
- **clinic-3.jpg** - Waiting area
- **clinic-4.jpg** - Consultation room

### Certificates/Diplomas
- **certificate-1.jpg** - Medical degree
- **certificate-2.jpg** - Dermatology certification
- **certificate-3.jpg** - Fellowship certificate
- **certificate-4.jpg** - Laser treatment certification

## Image Specifications:

- **Format**: JPG or WebP (Next.js will automatically optimize)
- **Hero image**: Minimum 180x180px, preferably 400x400px
- **Clinic photos**: Recommended 800x600px (4:3 aspect ratio)
- **Certificates**: Recommended 800x1000px (portrait orientation)
- **File size**: Keep under 500KB each (Next.js will optimize further)

## Temporary Solution:

For development/testing, you can use placeholder images from services like:
- https://placeholder.com/
- https://via.placeholder.com/
- https://placehold.co/

Example URLs:
- Hero: https://placehold.co/400x400/1D5B63/FFFFFF?text=Dr.+Lopez
- Clinic: https://placehold.co/800x600/F7F7F7/333333?text=Clinic+Photo
- Certificate: https://placehold.co/800x1000/FFFFFF/333333?text=Certificate

## SEO Considerations:

- All images must have descriptive alt text
- Hero image should be preloaded in the page layout
- Other images should use lazy loading
- Compress images before uploading (TinyPNG, ImageOptim, etc.)
