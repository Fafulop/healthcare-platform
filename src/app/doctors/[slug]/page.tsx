// Doctor Profile Page - Main page with all sections
import { notFound } from 'next/navigation';
import { getDoctorBySlug, getAllDoctorSlugs } from '@/lib/data';

// Import server-rendered components
import HeroSection from '@/components/doctor/HeroSection';
import ServicesSection from '@/components/doctor/ServicesSection';
import ConditionsSection from '@/components/doctor/ConditionsSection';
import BiographySection from '@/components/doctor/BiographySection';
import EducationSection from '@/components/doctor/EducationSection';
import CredentialsSection from '@/components/doctor/CredentialsSection';
import ClinicLocationSection from '@/components/doctor/ClinicLocationSection';
import FAQSection from '@/components/doctor/FAQSection';
import QuickNav from '@/components/doctor/QuickNav';
import StickyMobileCTA from '@/components/doctor/StickyMobileCTA';

// Import client-side components via wrapper
import { DynamicAppointmentCalendar, DynamicMediaCarousel } from '@/components/doctor/DynamicSections';

interface DoctorProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function DoctorProfilePage({ params }: DoctorProfilePageProps) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    notFound();
  }

  return (
    <main className="min-h-screen pb-16 md:pb-0">
      {/* Two-Column Layout Container - Starts from top (Desktop) */}
      <div className="profile-layout-container">
        {/* LEFT COLUMN - Main Content (SEO Priority Order) */}
        <div className="profile-left-column">
          {/* 1. Hero - Identity + primary SEO anchor */}
          <HeroSection doctor={doctor} />

          {/* Quick Navigation - Jump to sections */}
          <QuickNav />

          {/* 2. Services - Primary conversion & keyword section */}
          <ServicesSection id="services" services={doctor.services_list} />

          {/* 3. Carousel - Trust-building media (client-side, lazy-loaded) */}
          <DynamicMediaCarousel id="gallery" items={doctor.carousel_items} />

          {/* 4. Conditions Treated - High-value SEO keywords */}
          <ConditionsSection
            id="conditions"
            conditions={doctor.conditions}
            procedures={doctor.procedures}
          />

          {/* 5. Biography - E-E-A-T context */}
          <BiographySection
            id="biography"
            doctorLastName={doctor.last_name}
            shortBio={doctor.short_bio}
            longBio={doctor.long_bio}
            yearsExperience={doctor.years_experience}
          />

          {/* 6. Education - E-E-A-T proof */}
          <EducationSection id="education" educationItems={doctor.education_items} />

          {/* 7. Credentials - Visual proof of qualifications */}
          <CredentialsSection id="credentials" certificates={doctor.certificate_images} />

          {/* 8. Clinic Location - Local SEO signal */}
          <ClinicLocationSection id="location" clinicInfo={doctor.clinic_info} />

          {/* 9. FAQ - Rich snippets opportunity */}
          <FAQSection id="faq" faqs={doctor.faqs} />
        </div>

        {/* RIGHT COLUMN - Sticky Booking Sidebar (Desktop Only) */}
        <aside className="profile-right-column">
          {/* 4. Appointment Calendar - Conversion element (client-side) */}
          <DynamicAppointmentCalendar
            nextAvailableDate={doctor.next_available_date}
            modes={doctor.appointment_modes}
          />
        </aside>
      </div>

      {/* Sticky Mobile CTA - Bottom action bar (Mobile Only) */}
      <StickyMobileCTA />
    </main>
  );
}

// Generate static params for all doctor slugs
export async function generateStaticParams() {
  const slugs = await getAllDoctorSlugs();

  return slugs.map((slug) => ({
    slug,
  }));
}

// Enable static generation with revalidation
export const revalidate = 3600; // Revalidate every hour
