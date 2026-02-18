"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { DoctorProfileProvider } from "@/contexts/DoctorProfileContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatWidget } from "@/components/llm-assistant/ChatWidget";
import { DayDetailsWidget } from "@/components/day-details/DayDetailsWidget";
import { VoiceAssistantHubWidget } from "@/components/voice-hub/VoiceAssistantHubWidget";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data: session, update } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const hasRefreshed = useRef(false);

  // If the user logged in before being linked to a doctor profile, the session
  // cookie will have doctorId: null. Auto-refresh once to pick up the link.
  useEffect(() => {
    if (status === "authenticated" && !session?.user?.doctorId && !hasRefreshed.current) {
      hasRefreshed.current = true;
      update();
    }
  }, [status, session?.user?.doctorId, update]);

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

  return (
    <DoctorProfileProvider>
      <DashboardLayout>{children}</DashboardLayout>
      <VoiceAssistantHubWidget />
      <DayDetailsWidget />
      <ChatWidget />
    </DoctorProfileProvider>
  );
}
