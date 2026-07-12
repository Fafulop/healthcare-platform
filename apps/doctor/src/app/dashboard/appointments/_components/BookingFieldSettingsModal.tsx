"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Globe, CalendarCheck, Clock } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";

interface FieldSettings {
  emailRequired: boolean;
  phoneRequired: boolean;
  whatsappRequired: boolean;
}

interface Settings {
  public: FieldSettings;
  horarios: FieldSettings;
  instant: FieldSettings;
}

const DEFAULT_SETTINGS: Settings = {
  public:   { emailRequired: true, phoneRequired: true, whatsappRequired: true },
  horarios: { emailRequired: true, phoneRequired: true, whatsappRequired: true },
  instant:  { emailRequired: true, phoneRequired: true, whatsappRequired: true },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function FieldRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500">{checked ? "Requerido" : "Opcional"}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function FlowSection({
  icon,
  title,
  subtitle,
  settings,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  settings: FieldSettings;
  onChange: (updated: FieldSettings) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center shadow-sm text-blue-600">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        <FieldRow
          label="Correo electrónico"
          checked={settings.emailRequired}
          onChange={(v) => onChange({ ...settings, emailRequired: v })}
        />
        <FieldRow
          label="Teléfono"
          checked={settings.phoneRequired}
          onChange={(v) => onChange({ ...settings, phoneRequired: v })}
        />
        <FieldRow
          label="WhatsApp"
          checked={settings.whatsappRequired}
          onChange={(v) => onChange({ ...settings, whatsappRequired: v })}
        />
      </div>
    </div>
  );
}

export function BookingFieldSettingsModal({ isOpen, onClose }: Props) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    authFetch("/api/doctor/booking-field-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const raw = d.data;
          setSettings({
            public: {
              emailRequired:    raw.bookingPublicEmailRequired,
              phoneRequired:    raw.bookingPublicPhoneRequired,
              whatsappRequired: raw.bookingPublicWhatsappRequired,
            },
            horarios: {
              emailRequired:    raw.bookingHorariosEmailRequired,
              phoneRequired:    raw.bookingHorariosPhoneRequired,
              whatsappRequired: raw.bookingHorariosWhatsappRequired,
            },
            instant: {
              emailRequired:    raw.bookingInstantEmailRequired,
              phoneRequired:    raw.bookingInstantPhoneRequired,
              whatsappRequired: raw.bookingInstantWhatsappRequired,
            },
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch("/api/doctor/booking-field-settings", {
        method: "PATCH",
        body: JSON.stringify({
          bookingPublicEmailRequired:      settings.public.emailRequired,
          bookingPublicPhoneRequired:      settings.public.phoneRequired,
          bookingPublicWhatsappRequired:   settings.public.whatsappRequired,
          bookingHorariosEmailRequired:    settings.horarios.emailRequired,
          bookingHorariosPhoneRequired:    settings.horarios.phoneRequired,
          bookingHorariosWhatsappRequired: settings.horarios.whatsappRequired,
          bookingInstantEmailRequired:     settings.instant.emailRequired,
          bookingInstantPhoneRequired:     settings.instant.phoneRequired,
          bookingInstantWhatsappRequired:  settings.instant.whatsappRequired,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Configuración guardada");
        onClose();
      } else {
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Campos de Cita</h2>
            <p className="text-sm text-gray-500">Define qué datos del paciente son requeridos</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <FlowSection
                icon={<Globe className="w-4 h-4" />}
                title="Reserva pública"
                subtitle="Cuando el paciente agenda desde tu perfil"
                settings={settings.public}
                onChange={(updated) => setSettings((s) => ({ ...s, public: updated }))}
              />
              <FlowSection
                icon={<CalendarCheck className="w-4 h-4" />}
                title="Horarios disponibles"
                subtitle="Cuando agendas desde un horario existente"
                settings={settings.horarios}
                onChange={(updated) => setSettings((s) => ({ ...s, horarios: updated }))}
              />
              <FlowSection
                icon={<Clock className="w-4 h-4" />}
                title="Nuevo horario"
                subtitle="Cuando creas un horario nuevo para el paciente"
                settings={settings.instant}
                onChange={(updated) => setSettings((s) => ({ ...s, instant: updated }))}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
