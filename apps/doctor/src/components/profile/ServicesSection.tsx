"use client";

import { useState } from "react";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

interface ServicesSectionProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ServicesSection({ formData, setFormData }: ServicesSectionProps) {
  const addService = () => {
    setFormData((prev: any) => ({
      ...prev,
      services_list: [
        ...prev.services_list,
        { service_name: "", short_description: "", duration_minutes: 30, price: 50, is_booking_active: true },
      ],
    }));
  };

  const removeService = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      services_list: prev.services_list.filter((_: any, i: number) => i !== index),
    }));
  };

  const updateService = (index: number, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      services_list: prev.services_list.map((s: any, i: number) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  const activeCount = formData.services_list.filter((s: any) => s.is_booking_active).length;

  const PriceInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState("");

    return (
      <input
        type="text"
        inputMode="decimal"
        value={editing ? raw : formatMoney(value)}
        onFocus={() => { setEditing(true); setRaw(value ? String(value) : ""); }}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => { setEditing(false); onChange(parseMoney(raw)); }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {formData.services_list.length} servicio(s) registrado(s)
        </p>
        <button
          onClick={addService}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Agregar Servicio
        </button>
      </div>

      {formData.services_list.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          No hay servicios agregados. Haz clic en &quot;Agregar Servicio&quot; para comenzar.
        </div>
      ) : (
        <div className="space-y-4">
          {formData.services_list.map((service: any, index: number) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-700 text-sm">Servicio {index + 1}</h3>
                <button
                  onClick={() => removeService(index)}
                  disabled={service.is_booking_active && activeCount === 1}
                  title={service.is_booking_active && activeCount === 1 ? "Debe haber al menos 1 servicio activo para reservas" : undefined}
                  className="text-red-600 hover:text-red-700 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Eliminar
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={service.service_name}
                  onChange={(e) => updateService(index, "service_name", e.target.value)}
                  placeholder="Consulta General"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripcion Corta *
                </label>
                <textarea
                  value={service.short_description}
                  onChange={(e) => updateService(index, "short_description", e.target.value)}
                  placeholder="Evaluacion medica completa"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duracion (min) *
                  </label>
                  <input
                    type="number"
                    value={service.duration_minutes}
                    onChange={(e) => updateService(index, "duration_minutes", parseInt(e.target.value) || 0)}
                    min="1"
                    max="480"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio (MXN)
                  </label>
                  <PriceInput
                    value={service.price}
                    onChange={(v) => updateService(index, "price", v)}
                  />
                </div>
              </div>

              {/* Booking active toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Activo para reservas de pacientes</p>
                  <p className="text-xs text-gray-400">Si está desactivado, este servicio no aparece cuando un paciente agenda una cita</p>
                  {service.is_booking_active && activeCount === 1 && (
                    <p className="text-xs text-amber-600 mt-0.5">Debe haber al menos 1 servicio activo</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => updateService(index, "is_booking_active", !service.is_booking_active)}
                  disabled={service.is_booking_active && activeCount === 1}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${
                    service.is_booking_active ? "bg-blue-600" : "bg-gray-200 cursor-pointer"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      service.is_booking_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
