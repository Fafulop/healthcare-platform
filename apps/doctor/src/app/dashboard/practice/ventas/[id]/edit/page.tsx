"use client";

import { useSession } from "next-auth/react";
import { redirect, useParams } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function EditSalePage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const params = useParams();
  const saleId = params.id as string;

  useEffect(() => {
    // Redirect to view page for now - full edit functionality coming soon
    if (saleId) {
      redirect(`/dashboard/practice/ventas/${saleId}`);
    }
  }, [saleId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirigiendo...</p>
      </div>
    </div>
  );
}
