"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";

export function StatusRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
      <span className="text-sm text-gray-700">{label}</span>
      {enabled ? (
        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Activo
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-yellow-600 font-medium">
          <AlertCircle className="w-4 h-4" />
          Pendiente
        </span>
      )}
    </div>
  );
}
