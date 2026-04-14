"use client";

const DEFAULT_HOURS: Record<string, string> = {
  monday: "9:00 AM - 6:00 PM",
  tuesday: "9:00 AM - 6:00 PM",
  wednesday: "9:00 AM - 6:00 PM",
  thursday: "9:00 AM - 6:00 PM",
  friday: "9:00 AM - 5:00 PM",
  saturday: "Cerrado",
  sunday: "Cerrado",
};

const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miercoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
];

interface ClinicLocation {
  id?: string;
  name: string;
  address: string;
  phone: string;
  whatsapp: string;
  hours: Record<string, string>;
  geoLat: number;
  geoLng: number;
  isDefault: boolean;
}

interface ClinicSectionProps {
  formData: any;
  updateField: (field: string, value: any) => void;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

function LocationCard({
  index,
  loc,
  onUpdate,
  onUpdateHour,
  onRemove,
}: {
  index: number;
  loc: ClinicLocation;
  onUpdate: (field: string, value: any) => void;
  onUpdateHour: (day: string, value: string) => void;
  onRemove?: () => void;
}) {
  const title = index === 0 ? "Consultorio Principal" : "Consultorio 2";

  return (
    <div className="border border-gray-200 rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Eliminar segundo consultorio
          </button>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del consultorio</label>
        <input
          type="text"
          value={loc.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder={title}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Direccion *</label>
        <input
          type="text"
          value={loc.address}
          onChange={(e) => onUpdate("address", e.target.value)}
          placeholder="Av. Principal 123, Col. Centro"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Phone & WhatsApp */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
          <input
            type="tel"
            value={loc.phone}
            onChange={(e) => onUpdate("phone", e.target.value)}
            placeholder="+52 33 1234 5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
          <input
            type="tel"
            value={loc.whatsapp}
            onChange={(e) => onUpdate("whatsapp", e.target.value)}
            placeholder="+52 33 1234 5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Office Hours */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Horario de Atencion</h4>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <label className="text-sm font-medium text-gray-600 sm:w-24 flex-shrink-0">{label}</label>
              <input
                type="text"
                value={(loc.hours as Record<string, string>)[key] || ""}
                onChange={(e) => onUpdateHour(key, e.target.value)}
                placeholder="9:00 AM - 6:00 PM"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Usa &quot;Cerrado&quot; para dias sin atencion.</p>
      </div>

      {/* Geo Coordinates */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Coordenadas de Google Maps</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitud</label>
            <input
              type="number"
              step="any"
              value={loc.geoLat}
              onChange={(e) => onUpdate("geoLat", parseFloat(e.target.value) || 0)}
              placeholder="20.6737777"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
            <input
              type="number"
              step="any"
              value={loc.geoLng}
              onChange={(e) => onUpdate("geoLng", parseFloat(e.target.value) || 0)}
              placeholder="-103.3723871"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const q = encodeURIComponent(loc.address || "Mexico");
            window.open(`https://www.google.com/maps/search/${q}`, "_blank");
          }}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          Buscar Direccion en Google Maps
        </button>
      </div>
    </div>
  );
}

export default function ClinicSection({ formData, updateField, setFormData }: ClinicSectionProps) {
  const locations: ClinicLocation[] = formData.clinic_locations || [];

  const updateLocation = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const locs = [...prev.clinic_locations];
      locs[index] = { ...locs[index], [field]: value };
      return { ...prev, clinic_locations: locs };
    });
  };

  const updateLocationHour = (index: number, day: string, value: string) => {
    setFormData((prev: any) => {
      const locs = [...prev.clinic_locations];
      locs[index] = { ...locs[index], hours: { ...locs[index].hours, [day]: value } };
      return { ...prev, clinic_locations: locs };
    });
  };

  const addSecondLocation = () => {
    setFormData((prev: any) => ({
      ...prev,
      clinic_locations: [
        ...prev.clinic_locations,
        {
          name: "Consultorio 2",
          address: "",
          phone: "",
          whatsapp: "",
          hours: { ...DEFAULT_HOURS },
          geoLat: 0,
          geoLng: 0,
          isDefault: false,
        },
      ],
    }));
  };

  const removeSecondLocation = () => {
    if (!window.confirm('¿Eliminar el segundo consultorio?\n\nSi tiene horarios asignados en la sección de Citas, el sistema no permitirá guardar. Primero deberás eliminar esos horarios.')) return;
    setFormData((prev: any) => ({
      ...prev,
      clinic_locations: prev.clinic_locations.slice(0, 1),
    }));
  };

  return (
    <div className="space-y-6">
      {locations.map((loc, index) => (
        <LocationCard
          key={loc.id ?? index}
          index={index}
          loc={loc}
          onUpdate={(field, value) => updateLocation(index, field, value)}
          onUpdateHour={(day, value) => updateLocationHour(index, day, value)}
          onRemove={index === 1 ? removeSecondLocation : undefined}
        />
      ))}

      {locations.length < 2 && (
        <button
          type="button"
          onClick={addSecondLocation}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Agregar segundo consultorio
        </button>
      )}

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
