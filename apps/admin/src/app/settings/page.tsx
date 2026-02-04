"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { authFetch } from "@/lib/auth-fetch";
import Navbar from "@/components/Navbar";
import { MessageSquare, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

export default function SettingsPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        const json = await res.json();
        if (json.success) {
          setSmsEnabled(json.data.sms_enabled === "true");
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  async function handleToggleSMS() {
    setToggling(true);
    try {
      const newValue = !smsEnabled;
      const res = await authFetch(`${API_URL}/api/settings`, {
        method: "PATCH",
        body: JSON.stringify({ key: "sms_enabled", value: String(newValue) }),
      });
      const json = await res.json();
      if (json.success) {
        setSmsEnabled(newValue);
      } else {
        console.error("Failed to update setting:", json.error);
      }
    } catch (error) {
      console.error("Error toggling SMS:", error);
    } finally {
      setToggling(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Configuracion del Sistema
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Controla las funcionalidades globales de la plataforma.
          </p>

          {/* SMS Toggle Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`p-2.5 rounded-lg ${
                    smsEnabled
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Notificaciones SMS (Twilio)
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Envio de SMS al paciente y doctor cuando se crea o confirma
                    una cita. Cada mensaje tiene un costo por Twilio.
                  </p>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                        smsEnabled
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          smsEnabled ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      {smsEnabled ? "Activo" : "Desactivado"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={handleToggleSMS}
                disabled={toggling}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  smsEnabled ? "bg-green-500" : "bg-gray-300"
                } ${toggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    smsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Info box */}
            <div className="mt-5 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Cuando esta activo</strong>, se envian 3 SMS por cita: 1
                al paciente al agendar, 1 al doctor como alerta, y 1 al paciente
                cuando el doctor confirma. Desactivar no afecta el flujo de
                citas, solo detiene los SMS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
