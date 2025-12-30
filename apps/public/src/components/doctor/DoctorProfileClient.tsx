"use client";

import { useState } from "react";
import type { DoctorProfile } from "@/types/doctor";

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
import { DynamicAppointmentCalendar, DynamicMediaCarousel, DynamicBookingWidget } from "./DynamicSections";

interface DoctorProfileClientProps {
  doctor: DoctorProfile;
}

export default function DoctorProfileClient({ doctor }: DoctorProfileClientProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const openBookingModal = () => setIsBookingModalOpen(true);
  const closeBookingModal = () => setIsBookingModalOpen(false);

  return (
    <>
      <main className="min-h-screen pb-16 md:pb-0">
        {/* Two-Column Layout Container - Starts from top (Desktop) */}
        <div className="profile-layout-container">
          {/* LEFT COLUMN - Main Content (Optimized SEO + UX Order) */}
          <div className="profile-left-column">
            {/* 1. Hero - Identity + primary SEO anchor */}
            <HeroSection doctor={doctor} onBookingClick={openBookingModal} />

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

            {/* 5. Biography - E-E-A-T context & credentials */}
            <BiographySection
              id="biography"
              doctorLastName={doctor.last_name}
              shortBio={doctor.short_bio}
              longBio={doctor.long_bio}
              yearsExperience={doctor.years_experience}
            />

            {/* 6. Clinic Location - Local SEO signal */}
            <ClinicLocationSection id="location" clinicInfo={doctor.clinic_info} />

            {/* 7. Education - E-E-A-T proof */}
            <EducationSection id="education" educationItems={doctor.education_items} />

            {/* 8. Credentials - Visual proof of qualifications */}
            <CredentialsSection id="credentials" certificates={doctor.certificate_images} />

            {/* 9. Reviews - Patient testimonials & ratings (SEO + trust signal) */}
            <ReviewsSection
              id="reviews"
              reviews={doctor.reviews || []}
              reviewStats={doctor.reviewStats || { averageRating: 0, reviewCount: 0 }}
              doctorName={doctor.doctor_full_name}
            />

            {/* 10. FAQ - Rich snippets opportunity */}
            <FAQSection id="faq" faqs={doctor.faqs} />
          </div>

          {/* RIGHT COLUMN - Sticky Booking Sidebar (Desktop Only) */}
          <aside className="profile-right-column">
            <div className="flex flex-col h-screen">
              {/* Appointment Booking Widget - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <DynamicBookingWidget doctorSlug={doctor.slug} />
              </div>

              {/* Fixed Bottom Section - CTA Buttons & Contact */}
              <div className="flex-shrink-0 bg-white border-t border-gray-200">
                {/* CTA Buttons - Action buttons (Desktop Only) */}
                <SidebarCTA
                  onBookingClick={openBookingModal}
                  whatsappNumber={doctor.clinic_info.whatsapp}
                />

                {/* Contact Information - Quick access (Desktop Only) */}
                <SidebarContactInfo clinicInfo={doctor.clinic_info} />
              </div>
            </div>
          </aside>
        </div>

        {/* Sticky Mobile CTA - Bottom action bar (Mobile Only) */}
        <StickyMobileCTA onBookingClick={openBookingModal} />
      </main>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        doctorSlug={doctor.slug}
      />
    </>
  );
}
