"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { DoctorProfileProvider } from "@/contexts/DoctorProfileContext";
import { useAgentActions } from "@/contexts/AgentContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RevokedAccessScreen from "@/components/layout/RevokedAccessScreen";
import { GoogleCalendarBanner } from "@/components/GoogleCalendarBanner";
import { ChatWidget } from "@/components/llm-assistant/ChatWidget";
import { DayDetailsWidget } from "@/components/day-details/DayDetailsWidget";
import { VoiceAssistantHubWidget } from "@/components/voice-hub/VoiceAssistantHubWidget";
import { PracticeUIProvider } from "@/components/ui/PracticeUIProvider";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [widgetsCollapsed, setWidgetsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("widgetsCollapsed") === "true";
    }
    return false;
  });

  const toggleWidgets = () => {
    setWidgetsCollapsed((c) => {
      const next = !c;
      localStorage.setItem("widgetsCollapsed", String(next));
      return next;
    });
  };

  const { status, data: session, update } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const { isOpen: agentOpen } = useAgentActions();

  const hasRefreshed = useRef(false);

  // If the user logged in before being linked to a doctor profile, the session
  // cookie will have doctorId: null. Auto-refresh once to pick up the link.
  useEffect(() => {
    if (status === "authenticated" && !session?.user?.doctorId && !hasRefreshed.current) {
      hasRefreshed.current = true;
      update();
    }
  }, [status, session?.user?.doctorId, update]);

  // Role check — only DOCTOR and ADMIN can access the doctor portal
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      const allowedRoles = ["DOCTOR", "ADMIN"];
      if (!allowedRoles.includes(session.user.role)) {
        redirect("/login");
      }
    }
  }, [status, session?.user?.role]);

  // Consent check — redirect to /consent if doctor hasn't accepted privacy policy
  useEffect(() => {
    if (status === "authenticated" && session?.user?.privacyConsentAt == null) {
      redirect("/consent");
    }
  }, [status, session?.user?.privacyConsentAt]);

  // NUEVOS USUARIOS PR D (01-DISENO §5.2 routing order): a session with no
  // effective doctorId might have a pending team invite — route there BEFORE
  // falling through to the existing doctor-onboarding flow. Skipped for
  // owners/members (always a non-null doctorId). Deliberately NOT skipped for
  // revoked members: re-inviting a removed member to another portal (or the
  // same one) is an explicit supported flow (00-REQUISITOS §2.3) — without
  // this check a re-invited user would be stuck on the revoked screen forever
  // (a real bug caught during PR D review, angle 9).
  const [pendingInviteChecked, setPendingInviteChecked] = useState(false);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (session?.user?.doctorId) return;
    if (pendingInviteChecked) return;
    setPendingInviteChecked(true);
    fetch("/api/team/my-invites")
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json?.data) && json.data.length > 0) setHasPendingInvite(true);
      })
      .catch(() => {});
  }, [status, session?.user?.doctorId, pendingInviteChecked]);

  useEffect(() => {
    if (hasPendingInvite) redirect("/invitacion");
  }, [hasPendingInvite]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (status === "authenticated" && session?.user?.membershipRevoked) {
    // Ultra review finding: rendering RevokedAccessScreen immediately (before
    // the pending-invite fetch above resolves) let a re-invited revoked user
    // see "Cerrar sesión" — its only control — and sign themselves out of the
    // very session needed to accept the re-invite. Show the same loader while
    // the check is in flight; only commit to the dead-end screen once we know
    // there's no pending invite waiting (the redirect effect handles the
    // has-invite case).
    if (!pendingInviteChecked || hasPendingInvite) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
        </div>
      );
    }
    return <RevokedAccessScreen />;
  }

  return (
    <DoctorProfileProvider>
      <PracticeUIProvider>
        <GoogleCalendarBanner />
        <DashboardLayout>{children}</DashboardLayout>

        {/* --agent-dock shifts the fixed widget stack left of the docked
            assistant panel on lg+ (widgets consume it in their right-* calc). */}
        <div style={{ "--agent-dock": agentOpen ? "24rem" : "0px" } as React.CSSProperties}>
          {/* Collapse/expand tab — always visible on the right edge */}
          <button
            onClick={toggleWidgets}
            className="fixed bottom-32 right-0 sm:bottom-24 lg:right-[var(--agent-dock,0px)] z-[51]
              bg-blue-500 hover:bg-blue-600 border border-blue-500 border-r-0 rounded-l-lg shadow-md
              w-5 h-12 flex items-center justify-center text-white
              transition-colors"
            title={widgetsCollapsed ? "Mostrar herramientas" : "Ocultar herramientas"}
          >
            {widgetsCollapsed
              ? <ChevronLeft className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>

          {/* Widget buttons — hidden when collapsed (display:none cascades to fixed children) */}
          <div className={widgetsCollapsed ? "hidden" : ""}>
            <VoiceAssistantHubWidget />
            <DayDetailsWidget />
            <ChatWidget />
          </div>
        </div>
      </PracticeUIProvider>
    </DoctorProfileProvider>
  );
}
