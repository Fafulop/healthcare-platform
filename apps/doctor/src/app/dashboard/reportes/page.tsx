"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

export default function ReportesPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  if (status === "loading") {
    return null;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-600 mt-1">Reportes y estadísticas</p>
      </div>

      <div className="bg-white rounded-lg shadow p-12 text-center">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500 text-lg font-medium">Próximamente</p>
        <p className="text-gray-400 text-sm mt-1">Los reportes estarán disponibles aquí</p>
      </div>
    </div>
  );
}
