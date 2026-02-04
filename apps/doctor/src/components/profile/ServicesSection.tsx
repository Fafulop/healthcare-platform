"use client";

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
        { service_name: "", short_description: "", duration_minutes: 30, price: 50 },
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
                  className="text-red-600 hover:text-red-700 text-sm"
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
                    Precio (USD)
                  </label>
                  <input
                    type="number"
                    value={service.price}
                    onChange={(e) => updateService(index, "price", parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
