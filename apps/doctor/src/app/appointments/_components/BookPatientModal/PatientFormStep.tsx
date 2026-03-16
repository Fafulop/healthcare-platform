"use client";

import { User, Mail, Phone, MessageSquare, Stethoscope } from "lucide-react";

interface DoctorService {
  id: string;
  serviceName: string;
  durationMinutes: number;
  price: number | null;
}

export interface PatientFormData {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientWhatsapp: string;
  notes: string;
}

interface Props {
  services: DoctorService[];
  selectedServiceId: string | null;
  onSelectService: (id: string) => void;
  isFirstTime: boolean | null;
  setIsFirstTime: (v: boolean | null) => void;
  appointmentMode: "PRESENCIAL" | "TELEMEDICINA" | null;
  setAppointmentMode: (v: "PRESENCIAL" | "TELEMEDICINA" | null) => void;
  formData: PatientFormData;
  setFormData: (f: PatientFormData) => void;
  error: string;
}

export function PatientFormStep({
  services,
  selectedServiceId,
  onSelectService,
  isFirstTime,
  setIsFirstTime,
  appointmentMode,
  setAppointmentMode,
  formData,
  setFormData,
  error,
}: Props) {
  return (
    <div className="space-y-4">
      {services.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Servicio *</label>
          <div className="grid grid-cols-1 gap-2">
            {services.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => onSelectService(svc.id)}
                className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                  selectedServiceId === svc.id
                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Stethoscope
                    className={`w-4 h-4 shrink-0 ${
                      selectedServiceId === svc.id ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      selectedServiceId === svc.id ? "text-blue-900" : "text-gray-800"
                    }`}
                  >
                    {svc.serviceName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {svc.durationMinutes && (
                    <span className="text-xs text-gray-400">{svc.durationMinutes} min</span>
                  )}
                  {svc.price != null && (
                    <span className="text-xs font-semibold text-gray-700">${svc.price}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tipo de visita */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de visita *</label>
        <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
          {([{ val: true, label: "Primera vez" }, { val: false, label: "Recurrente" }] as const).map(
            ({ val, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setIsFirstTime(val)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isFirstTime === val
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Modalidad */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Modalidad *</label>
        <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
          {(
            [
              { val: "PRESENCIAL", label: "Presencial" },
              { val: "TELEMEDICINA", label: "Telemedicina" },
            ] as const
          ).map(({ val, label }) => (
            <button
              key={val}
              type="button"
              onClick={() => setAppointmentMode(val)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                appointmentMode === val
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            required
            autoFocus
            value={formData.patientName}
            onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Juan García"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            required
            value={formData.patientEmail}
            onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="juan@email.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            required
            value={formData.patientPhone}
            onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="5512345678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            value={formData.patientWhatsapp}
            onChange={(e) => setFormData({ ...formData, patientWhatsapp: e.target.value })}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="5512345678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Motivo de consulta, observaciones..."
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
