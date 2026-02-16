"use client";

import { useState, useEffect } from "react";
import type { DoctorProfile } from "@/types/doctor";
import { trackProfileView } from "@/lib/analytics";

// Import server-rendered components
import HeroSection from "./HeroSection";
import ServicesSection from "./ServicesSection";
import ConditionsSection from "./ConditionsSection";
import BiographySection from "./BiographySection";
import EducationSection from "./EducationSection";
import CredentialsSection from "./CredentialsSection";
import ClinicLocationSection from "./ClinicLocationSection";
import ReviewsSection from "./ReviewsSection";
import FAQSection from "./FAQSection";
import QuickNav from "./QuickNav";
import StickyMobileCTA from "./StickyMobileCTA";
import SidebarContactInfo from "./SidebarContactInfo";
import SidebarCTA from "./SidebarCTA";
import BookingModal from "./BookingModal";

// Import client-side components via wrapper
import { DynamicMediaCarousel, DynamicBookingWidget } from "./DynamicSections";

interface DoctorProfileClientProps {
  doctor: DoctorProfile;
}

export default function DoctorProfileClient({ doctor }: DoctorProfileClientProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Track profile view on mount + configure per-doctor Google Ads
  useEffect(() => {
    trackProfileView(doctor.slug, doctor.doctor_full_name, doctor.primary_specialty || '');

    // Configure per-doctor Google Ads account if available
    if (doctor.google_ads_id && typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', doctor.google_ads_id);
    }
  }, [doctor.slug, doctor.doctor_full_name, doctor.primary_specialty, doctor.google_ads_id]);

  const openBookingModal = (dateStr?: string) => {
    if (dateStr) {
      setSelectedDate(dateStr);
    }
    setIsBookingModalOpen(true);
  };

  const closeBookingModal = () => {
    setIsBookingModalOpen(false);
    setSelectedDate(null); // Reset selected date when modal closes
  };

  return (
    <>
      <main className="min-h-screen pb-16 md:pb-0">
        {/* Two-Column Layout Container - Starts from top (Desktop) */}
        <div className="profile-layout-container">
          {/* LEFT COLUMN - Main Content (Optimized SEO + UX Order) */}
          <div className="profile-left-column">
            {/* 1. Hero - Identity + primary SEO anchor */}
            <HeroSection doctor={doctor} onBookingClick={openBookingModal} googleAdsId={doctor.google_ads_id} />

            {/* Quick Navigation - Jump to sections */}
            <QuickNav />

            {/* 2. Video Carousel - Doctor intro videos (engagement + trust) */}
            <DynamicMediaCarousel id="gallery" items={doctor.carousel_items} />

            {/* 3. Services - Primary conversion & keyword section */}
            <ServicesSection id="services" services={doctor.services_list} />

            {/* 4. Conditions Treated - High-value SEO keywords */}
            <ConditionsSection
              id="conditions"
              conditions={doctor.conditions}
              procedures={doctor.procedures}
            />

            {/* 5. Reviews - Patient testimonials & ratings (SEO + trust signal) */}
            <ReviewsSection
              id="reviews"
              reviews={doctor.reviews || []}
              reviewStats={doctor.reviewStats || { averageRating: 0, reviewCount: 0 }}
              doctorName={doctor.doctor_full_name}
            />

            {/* 6. Biography - E-E-A-T context & credentials */}
            <BiographySection
              id="biography"
              doctorLastName={doctor.last_name}
              shortBio={doctor.short_bio}
              longBio={doctor.long_bio}
              yearsExperience={doctor.years_experience}
            />

            {/* 7. Clinic Location - Local SEO signal */}
            <ClinicLocationSection id="location" doctorSlug={doctor.slug} clinicInfo={doctor.clinic_info} />

            {/* 8. Education - E-E-A-T proof */}
            <EducationSection id="education" educationItems={doctor.education_items} />

            {/* 9. Credentials - Visual proof of qualifications */}
            <CredentialsSection id="credentials" certificates={doctor.certificate_images} />

            {/* 10. FAQ - Rich snippets opportunity */}
            <FAQSection id="faq" faqs={doctor.faqs} />
          </div>

          {/* RIGHT COLUMN - Sticky Booking Sidebar (Desktop Only) */}
          <aside className="profile-right-column">
            <div className="flex flex-col h-screen">
              {/* Appointment Booking Widget - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <DynamicBookingWidget doctorSlug={doctor.slug} onDayClick={openBookingModal} googleAdsId={doctor.google_ads_id} />
              </div>

              {/* Fixed Bottom Section - CTA Buttons & Contact */}
              <div className="flex-shrink-0 bg-white border-t border-gray-200">
                {/* CTA Buttons - Action buttons (Desktop Only) */}
                <SidebarCTA
                  doctorSlug={doctor.slug}
                  onBookingClick={openBookingModal}
                  whatsappNumber={doctor.clinic_info.whatsapp}
                  googleAdsId={doctor.google_ads_id}
                />

                {/* Contact Information - Quick access (Desktop Only) */}
                <SidebarContactInfo doctorSlug={doctor.slug} clinicInfo={doctor.clinic_info} />
              </div>
            </div>
          </aside>
        </div>

        {/* Sticky Mobile CTA - Bottom action bar (Mobile Only) */}
        <StickyMobileCTA
          doctorSlug={doctor.slug}
          whatsappNumber={doctor.clinic_info.whatsapp}
          onBookingClick={openBookingModal}
          googleAdsId={doctor.google_ads_id}
        />
      </main>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        doctorSlug={doctor.slug}
        initialDate={selectedDate}
        googleAdsId={doctor.google_ads_id}
      />
    </>
  );
}
