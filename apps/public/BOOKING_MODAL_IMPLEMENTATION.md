# Booking Modal Implementation

## Overview

The booking modal allows patients to book appointments on mobile devices by clicking the "Agendar Cita" button. On desktop, the booking functionality is available in the fixed sidebar.

## Architecture

### Desktop (≥1024px)
- **Fixed Sidebar** with `DynamicBookingWidget` (sticky, right column)
- No modal needed

### Mobile (<1024px)
- **Sticky Bottom CTA** with "Agendar Cita" button
- **Modal** opens on button click containing `BookingWidget`

## SEO Considerations

✅ **The modal is SEO-safe** because:
1. It's **client-side only** (renders on user interaction)
2. BookingWidget is `ssr: false` (not server-rendered)
3. Per `SEO_GUIDE.md`: appointment widgets are explicitly "client_side_only"
4. No duplicate widgets (sidebar hidden on mobile via CSS)
5. Zero impact on crawlers or page ranking

## Implementation Method: Inline Styles

**Why inline styles instead of Tailwind classes?**

After extensive testing, Tailwind utility classes had rendering issues in the modal context (collapsed into a thin vertical line). Inline styles provide:
- ✅ Reliable cross-browser rendering
- ✅ No compilation/build issues
- ✅ Same performance as Tailwind
- ✅ **Zero SEO difference** (modal is client-side only)

This is documented as the official approach for client-side interactive overlays that don't affect SEO.

## Files

| File | Purpose |
|------|---------|
| `BookingModal.tsx` | Modal component with inline styles |
| `DoctorProfileClient.tsx` | Client wrapper managing modal state |
| `HeroSection.tsx` | Has onClick to open modal (desktop) |
| `StickyMobileCTA.tsx` | Has onClick to open modal (mobile) |
| `BookingWidget.tsx` | Shared booking widget (sidebar + modal) |

## Code Structure

```tsx
// DoctorProfileClient.tsx
export default function DoctorProfileClient({ doctor }) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const openBookingModal = () => setIsBookingModalOpen(true);
  const closeBookingModal = () => setIsBookingModalOpen(false);

  return (
    <>
      <main>
        <HeroSection onBookingClick={openBookingModal} />
        {/* ... other sections ... */}
        <StickyMobileCTA onBookingClick={openBookingModal} />
      </main>

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        doctorSlug={doctor.slug}
      />
    </>
  );
}
```

```tsx
// BookingModal.tsx
export default function BookingModal({ isOpen, onClose, doctorSlug }) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{ /* fixed fullscreen container */ }}>
      {/* Backdrop */}
      <div style={{ /* semi-transparent black */ }} onClick={onClose} />

      {/* Modal box */}
      <div style={{ /* centered white box */ }}>
        <button onClick={onClose}>✕</button>
        <div style={{ padding: '24px' }}>
          <BookingWidget doctorSlug={doctorSlug} isModal={true} />
        </div>
      </div>
    </div>
  );
}
```

## Features

- ✅ Centered modal on all screen sizes
- ✅ Dark backdrop (50% opacity black)
- ✅ Close button (X icon, top-right)
- ✅ Click outside to close
- ✅ Body scroll lock when open
- ✅ Responsive (448px max width)
- ✅ Accessible (proper z-index, click handlers)

## Future Improvements (Optional)

If Tailwind rendering issues are resolved in future versions:
- Consider migrating to Tailwind utility classes for consistency
- Current inline styles are perfectly acceptable and performant

## Testing

**Desktop:**
1. Click "Agendar Cita" in hero section
2. Modal should NOT appear (booking is in sidebar)

**Mobile:**
1. Click "Agendar Cita" in sticky bottom bar
2. Modal should appear centered
3. Full booking widget should be visible
4. Clicking backdrop or X button should close it

## Maintenance Notes

- **Do not duplicate BookingWidget** - it's shared between sidebar and modal
- **Do not server-render the modal** - it must remain client-side only
- **Inline styles are intentional** - not a bug or temporary fix
