"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Stethoscope, AlertCircle } from "lucide-react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-xl mb-4">
            <Stethoscope className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Portal Médico
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Plataforma de Salud
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow p-6 sm:p-8 space-y-5 border border-gray-200">
          {/* Welcome Message */}
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Bienvenido
            </h2>
            <p className="text-sm text-gray-500">
              Inicia sesión para gestionar tu perfil y citas
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">
                    {error === "AccessDenied"
                      ? "Acceso Denegado"
                      : "Autenticación Fallida"}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {error === "AccessDenied"
                      ? "No tienes acceso de médico. Por favor contacta a soporte para verificar tu cuenta."
                      : "La autenticación falló. Por favor intenta de nuevo o contacta a soporte si el problema persiste."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Iniciar sesión con Google
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-400 text-xs">
                Autenticación segura
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600 text-center">
              <span className="font-medium text-gray-700">Portal Protegido</span> — Inicia sesión con el correo asociado a tu perfil de médico verificado
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            ¿Necesitas ayuda? Contacta a{" "}
            <a href="mailto:support@healthcare.com" className="text-blue-600 hover:text-blue-700 font-medium">
              support@healthcare.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DoctorLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Stethoscope className="w-10 h-10 text-blue-600 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
