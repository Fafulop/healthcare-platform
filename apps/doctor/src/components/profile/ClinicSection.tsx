"use client";

interface ClinicSectionProps {
  formData: any;
  updateField: (field: string, value: any) => void;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ClinicSection({ formData, updateField, setFormData }: ClinicSectionProps) {
  const updateClinicField = (field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      clinic_info: { ...prev.clinic_info, [field]: value },
    }));
  };

  const updateHour = (day: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      clinic_info: {
        ...prev.clinic_info,
        hours: { ...prev.clinic_info.hours, [day]: value },
      },
    }));
  };

  const updateGeo = (field: "lat" | "lng", value: number) => {
    setFormData((prev: any) => ({
      ...prev,
      clinic_info: {
        ...prev.clinic_info,
        geo: { ...prev.clinic_info.geo, [field]: value },
      },
    }));
  };

  const days = [
    { key: "monday", label: "Lunes" },
    { key: "tuesday", label: "Martes" },
    { key: "wednesday", label: "Miercoles" },
    { key: "thursday", label: "Jueves" },
    { key: "friday", label: "Viernes" },
    { key: "saturday", label: "Sabado" },
    { key: "sunday", label: "Domingo" },
  ];

  return (
    <div className="space-y-6">
      {/* Contact */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Direccion *</label>
        <input
          type="text"
          value={formData.clinic_info.address}
          onChange={(e) => updateClinicField("address", e.target.value)}
          placeholder="Av. Principal 123, Col. Centro"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Telefono *</label>
          <input
            type="tel"
            value={formData.clinic_info.phone}
            onChange={(e) => updateClinicField("phone", e.target.value)}
            placeholder="+52 33 1234 5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp</label>
          <input
            type="tel"
            value={formData.clinic_info.whatsapp}
            onChange={(e) => updateClinicField("whatsapp", e.target.value)}
            placeholder="+52 33 1234 5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Office Hours */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Horario de Atencion</h3>
        <div className="space-y-3">
          {days.map(({ key, label }) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <label className="text-sm font-medium text-gray-700 sm:w-24 flex-shrink-0">{label}</label>
              <input
                type="text"
                value={(formData.clinic_info.hours as any)[key] || ""}
                onChange={(e) => updateHour(key, e.target.value)}
                placeholder="9:00 AM - 6:00 PM"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Usa &quot;Cerrado&quot; para dias sin atencion.
        </p>
      </div>

      {/* Geo Coordinates */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Coordenadas de Google Maps</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitud</label>
            <input
              type="number"
              step="any"
              value={formData.clinic_info.geo.lat}
              onChange={(e) => updateGeo("lat", parseFloat(e.target.value) || 0)}
              placeholder="20.6737777"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
            <input
              type="number"
              step="any"
              value={formData.clinic_info.geo.lng}
              onChange={(e) => updateGeo("lng", parseFloat(e.target.value) || 0)}
              placeholder="-103.3723871"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const q = encodeURIComponent(formData.clinic_info.address || "Mexico");
            window.open(`https://www.google.com/maps/search/${q}`, "_blank");
          }}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          Buscar Direccion en Google Maps
        </button>
      </div>

      {/* Conditions & Procedures */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Condiciones y Procedimientos</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Condiciones Tratadas</label>
          <textarea
            value={(formData.conditions || []).join("\n")}
            onChange={(e) => updateField("conditions", e.target.value.split("\n").filter(Boolean))}
            placeholder={"Hipertension\nDiabetes\nArritmias"}
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Una condicion por linea. Total: {(formData.conditions || []).length}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Procedimientos Realizados</label>
          <textarea
            value={(formData.procedures || []).join("\n")}
            onChange={(e) => updateField("procedures", e.target.value.split("\n").filter(Boolean))}
            placeholder={"Electrocardiograma\nEcocardiografia\nPrueba de esfuerzo"}
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Un procedimiento por linea. Total: {(formData.procedures || []).length}</p>
        </div>
      </div>
    </div>
  );
}
