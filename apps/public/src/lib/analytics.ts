// Google Analytics 4 + Google Ads tracking utilities
// GA4 Measurement ID and Google Ads ID are loaded from environment variables

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

// Type-safe gtag command
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

// Helper to check if gtag is available
function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

// ─── Page View ───────────────────────────────────────────────
export function trackPageView(url: string) {
  gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
}

// ─── Custom Events ───────────────────────────────────────────

// Doctor profile was viewed
export function trackProfileView(doctorSlug: string, doctorName: string, specialty: string) {
  gtag('event', 'profile_view', {
    doctor_slug: doctorSlug,
    doctor_name: doctorName,
    specialty,
  });
}

// Contact button clicked (WhatsApp, phone, email)
export function trackContactClick(
  doctorSlug: string,
  contactMethod: 'whatsapp' | 'phone' | 'email',
  location: 'hero' | 'sidebar' | 'mobile_cta' | 'blog_sidebar',
  googleAdsId?: string
) {
  gtag('event', 'contact_click', {
    doctor_slug: doctorSlug,
    contact_method: contactMethod,
    click_location: location,
  });

  // Fire as Google Ads conversion (per-doctor ID with global fallback)
  const adsId = googleAdsId || GOOGLE_ADS_ID;
  if (adsId) {
    gtag('event', 'conversion', {
      send_to: `${adsId}/contact_click`,
      doctor_slug: doctorSlug,
      contact_method: contactMethod,
    });
  }
}

// Blog article was viewed
export function trackBlogView(doctorSlug: string, articleSlug: string, articleTitle: string) {
  gtag('event', 'blog_view', {
    doctor_slug: doctorSlug,
    article_slug: articleSlug,
    article_title: articleTitle,
  });
}

// Appointment booking button clicked (opens modal/calendar)
export function trackAppointmentClick(doctorSlug: string, location: 'hero' | 'sidebar' | 'mobile_cta' | 'blog_sidebar') {
  gtag('event', 'appointment_click', {
    doctor_slug: doctorSlug,
    click_location: location,
  });
}

// Appointment time slot selected
export function trackSlotSelected(doctorSlug: string, slotDate: string, slotTime: string, price: number) {
  gtag('event', 'slot_selected', {
    doctor_slug: doctorSlug,
    slot_date: slotDate,
    slot_time: slotTime,
    price,
  });
}

// Appointment booking completed successfully
export function trackBookingComplete(doctorSlug: string, slotDate: string, price: number, googleAdsId?: string) {
  gtag('event', 'booking_complete', {
    doctor_slug: doctorSlug,
    slot_date: slotDate,
    value: price,
    currency: 'MXN',
  });

  // Fire as Google Ads conversion (per-doctor ID with global fallback)
  const adsId = googleAdsId || GOOGLE_ADS_ID;
  if (adsId) {
    gtag('event', 'conversion', {
      send_to: `${adsId}/booking_complete`,
      doctor_slug: doctorSlug,
      value: price,
      currency: 'MXN',
    });
  }
}

// Map/directions link clicked
export function trackMapClick(doctorSlug: string, location: 'sidebar' | 'clinic_section') {
  gtag('event', 'map_click', {
    doctor_slug: doctorSlug,
    click_location: location,
  });
}

// Doctor listing card clicked
export function trackDoctorCardClick(doctorSlug: string, doctorName: string, position: number) {
  gtag('event', 'doctor_card_click', {
    doctor_slug: doctorSlug,
    doctor_name: doctorName,
    list_position: position,
  });
}
