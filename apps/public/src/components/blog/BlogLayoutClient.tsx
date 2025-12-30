"use client";

import { useState } from "react";
import SidebarContactInfo from "@/components/doctor/SidebarContactInfo";
import SidebarCTA from "@/components/doctor/SidebarCTA";
import BookingModal from "@/components/doctor/BookingModal";

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
      <main className="min-h-screen pb-16 md:pb-0 bg-gradient-to-b from-[#FFF5C2] to-[#D0E7E9]">
        <div className="profile-layout-container">
          {/* LEFT COLUMN - Content from children */}
          <div className="profile-left-column">
            {children}
          </div>

          {/* RIGHT COLUMN - Sticky Sidebar (Desktop Only) */}
          <aside className="profile-right-column">
            <div className="flex flex-col justify-end h-screen bg-white">
              {/* CTA Button & Contact - Fixed at bottom */}
              <div className="flex-shrink-0 border-t border-gray-200">
                {/* CTA Button - Opens booking modal */}
                <SidebarCTA onBookingClick={openBookingModal} />

                {/* Contact Information */}
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
