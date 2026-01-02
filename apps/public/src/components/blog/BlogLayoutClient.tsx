"use client";

import { useState } from "react";
import { DynamicBookingWidget } from "@/components/doctor/DynamicSections";
import SidebarContactInfo from "@/components/doctor/SidebarContactInfo";
import SidebarCTA from "@/components/doctor/SidebarCTA";
import BookingModal from "@/components/doctor/BookingModal";
import BlobDecoration from "@/components/ui/BlobDecoration";

interface BlogLayoutClientProps {
  doctorSlug: string;
  clinicInfo: {
    address: string;
    phone: string;
    whatsapp?: string;
    hours?: any;
    geo: {
      lat: number;
      lng: number;
    };
  };
  children: React.ReactNode;
}

export default function BlogLayoutClient({ doctorSlug, clinicInfo, children }: BlogLayoutClientProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const openBookingModal = () => setIsBookingModalOpen(true);
  const closeBookingModal = () => setIsBookingModalOpen(false);

  return (
    <>
      <main className="relative min-h-screen pb-16 md:pb-0 bg-[var(--color-bg-yellow-light)] overflow-hidden">
        {/* Visible organic blobs */}
        <BlobDecoration variant="blob3" color="gradient-purple" position="top-right" size="xl" opacity={33} blur={false} />
        <BlobDecoration variant="blob1" color="gradient-blue" position="bottom-left" size="xl" opacity={36} blur={false} />
        <BlobDecoration variant="blob2" color="accent" position="bottom-right" size="lg" opacity={25} blur={false} className="hidden md:block" />

        <div className="relative profile-layout-container">
          {/* LEFT COLUMN - Content from children */}
          <div className="profile-left-column">
            {children}
          </div>

          {/* RIGHT COLUMN - Sticky Booking Sidebar (Desktop Only) */}
          <aside className="profile-right-column">
            <div className="flex flex-col h-screen bg-white">
              {/* Appointment Booking Widget - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <DynamicBookingWidget doctorSlug={doctorSlug} onDayClick={openBookingModal} />
              </div>

              {/* Fixed Bottom Section - CTA Buttons & Contact */}
              <div className="flex-shrink-0 bg-white border-t border-gray-200">
                {/* CTA Buttons - Action buttons (Desktop Only) */}
                <SidebarCTA
                  onBookingClick={openBookingModal}
                  whatsappNumber={clinicInfo.whatsapp}
                />

                {/* Contact Information - Quick access (Desktop Only) */}
                <SidebarContactInfo clinicInfo={clinicInfo} />
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={closeBookingModal}
        doctorSlug={doctorSlug}
      />
    </>
  );
}
