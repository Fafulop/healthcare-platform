"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function EditQuotationPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  useEffect(() => {
    // Por ahora, redirigir a la vista de cotización
    // En una implementación completa, esta página tendría un formulario similar a /new
    // pero con los datos precargados de la cotización existente
    alert("La funcionalidad de edición estará disponible próximamente. Por favor, crea una nueva cotización.");
    redirect("/dashboard/practice/cotizaciones");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <Loader2 className="h-12 w-12 animate-spin text-green-600" />
    </div>
  );
}
