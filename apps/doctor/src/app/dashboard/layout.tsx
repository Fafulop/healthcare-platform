"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
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
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

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
