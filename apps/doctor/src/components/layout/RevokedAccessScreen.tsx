"use client";

import { signOut } from "next-auth/react";
import { ShieldOff } from "lucide-react";

/** Shown to a REVOKED member — never the doctor-onboarding flow
 * (00-REQUISITOS §2.2/§2.3: a removed member gets a distinct screen). */
export default function RevokedAccessScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-xl mb-4">
          <ShieldOff className="w-7 h-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Acceso revocado</h1>
        <p className="mt-2 text-sm text-gray-500">
          El dueño de este consultorio revocó tu acceso al portal. Si crees que es un error,
          contáctalo directamente.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-6 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
