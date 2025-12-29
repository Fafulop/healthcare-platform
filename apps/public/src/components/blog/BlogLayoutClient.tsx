"use client";

import { useState } from "react";
import { DynamicBookingWidget } from "@/components/doctor/DynamicSections";
import SidebarContactInfo from "@/components/doctor/SidebarContactInfo";
import SidebarCTA from "@/components/doctor/SidebarCTA";
import BookingModal from "@/components/doctor/BookingModal";

interface BlogLayoutClientProps {
  doctorSlug: string;
  clinicInfo: {
    address: string;
    phone: string;
    whatsapp?: string;
    hours: any;
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
      <main className="min-h-screen pb-16 md:pb-0">
        <div className="profile-layout-container">
          {/* LEFT COLUMN - Content from children */}
          <div className="profile-left-column">
            {children}
          </div>

          {/* RIGHT COLUMN - Sticky Sidebar (Desktop Only) */}
          <aside className="profile-right-column">
            <div className="flex flex-col h-screen">
              {/* Booking Widget */}
              <div className="flex-1 overflow-y-auto">
                <DynamicBookingWidget doctorSlug={doctorSlug} />
              </div>

              {/* Fixed Bottom Section */}
              <div className="flex-shrink-0 bg-white border-t border-gray-200">
                <SidebarCTA
                  onBookingClick={openBookingModal}
                  whatsappNumber={clinicInfo.whatsapp}
                />
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
