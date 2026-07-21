"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { useAgentActions } from "@/contexts/AgentContext";
import { AgendaAgentPanel } from "@/components/agent/AgendaAgentPanel";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileDrawer from "./MobileDrawer";
import PermissionGate from "./PermissionGate";
import { usePermissions } from "@/lib/permissions-client";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { doctorProfile } = useDoctorProfile();
  const { isOpen: agentOpen, open: openAgent } = useAgentActions();
  const { can } = usePermissions();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Members without the Asistente IA toggle get no panel at all (its API
  // route is blocked for them anyway — this hides the dead surface).
  const agentAllowed = can("asistente_ia");

  const handleMoreClick = () => {
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div
      className="flex h-screen bg-gray-50"
      style={{
        backgroundImage: "url('/medical-pattern.svg')",
        backgroundSize: "500px 500px",
      }}
    >
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar doctorProfile={doctorProfile} />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
        <PermissionGate>{children}</PermissionGate>
      </main>

      {/* Assistant copilot panel — SINGLE mount point (both route trees render
          this layout). Docked flex sibling on lg+ (main shrinks), fixed
          overlay/bottom-sheet below lg. State lives in AgentContext (root). */}
      {agentAllowed && <AgendaAgentPanel />}

      {/* Global open tab — right edge, above the floating-widgets toggle */}
      {agentAllowed && !agentOpen && (
        <button
          onClick={openAgent}
          className="fixed bottom-48 right-0 sm:bottom-40 z-[51]
            bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 border-r-0 rounded-l-lg shadow-md
            w-5 h-12 flex items-center justify-center text-white
            transition-colors"
          title="Abrir asistente"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      )}

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
