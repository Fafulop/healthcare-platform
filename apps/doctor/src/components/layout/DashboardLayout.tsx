"use client";

import { useState } from "react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { doctorProfile } = useDoctorProfile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleMoreClick = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar doctorProfile={doctorProfile} />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav onMoreClick={handleMoreClick} isDrawerOpen={isDrawerOpen} />

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        doctorProfile={doctorProfile}
      />
    </div>
  );
}
