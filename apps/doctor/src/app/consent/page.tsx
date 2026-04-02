"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";

export default function ConsentPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    if (!accepted) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/consent", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Error al guardar el consentimiento");
      }

      // DB is now source of truth — trigger a session refresh so session()
      // re-reads privacyConsentAt from the User row.
      await update({});

      router.replace("/dashboard");
    } catch (err) {
      setError("Ocurrió un error. Por favor intenta de nuevo.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-xl mb-4">
            <Shield className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Aviso de Privacidad
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Por favor lee y acepta nuestras condiciones para continuar
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6 sm:p-8 space-y-5">
          {/* Privacy notice summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              <strong>tusalud.pro</strong> trata tus datos personales de acuerdo con la{" "}
              <strong>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP 2025)</strong>.
            </p>
            <p>
              Como médico en la plataforma, recopilamos y tratamos:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Nombre, especialidad, foto y datos de perfil profesional</li>
              <li>Correo y cuenta de Google (autenticación)</li>
              <li>Expedientes clínicos de tus pacientes (datos sensibles de salud)</li>
              <li>Datos de práctica: ventas, compras, cotizaciones y flujo de caja</li>
              <li>Token de Google Calendar (si habilitas la integración)</li>
            </ul>
            <p>
              Estos datos se utilizan para operar la plataforma, gestionar citas, expedientes clínicos y tu presencia profesional en línea.
              No vendemos tus datos a terceros.
            </p>
            <p>
              Puedes ejercer tus derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) escribiendo a{" "}
              <a href="mailto:privacidad@tusalud.pro" className="text-blue-600 underline">
                privacidad@tusalud.pro
              </a>.
            </p>
          </div>

          {/* Full policy link */}
          <p className="text-xs text-gray-500 text-center">
            Consulta el{" "}
            <a
              href={`${process.env.NEXT_PUBLIC_PUBLIC_APP_URL || 'https://tusalud.pro'}/privacidad`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              Aviso de Privacidad completo
            </a>{" "}
            para más detalles.
          </p>

          {/* Consent checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700 leading-snug">
              He leído y acepto el Aviso de Privacidad de tusalud.pro, y consiento el tratamiento de mis datos personales
              y los de mis pacientes conforme a lo descrito, incluyendo datos personales sensibles de salud. *
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Accept button */}
          <button
            onClick={handleAccept}
            disabled={!accepted || submitting}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
          >
            {submitting ? "Guardando..." : "Aceptar y continuar al dashboard"}
          </button>

          {/* Sign out link */}
          <p className="text-center text-xs text-gray-400">
            ¿No eres tú?{" "}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-blue-600 underline hover:text-blue-800"
            >
              Cerrar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
