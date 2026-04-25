"use client";

import ColorPaletteSelector from "./ColorPaletteSelector";
import { UploadButton } from "@/lib/uploadthing-components";

interface GeneralInfoSectionProps {
  formData: any;
  updateField: (field: string, value: any) => void;
}

export default function GeneralInfoSection({ formData, updateField }: GeneralInfoSectionProps) {
  return (
    <div className="space-y-6">
      {/* Identity fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
          <input
            type="text"
            value={formData.doctor_full_name}
            onChange={(e) => updateField("doctor_full_name", e.target.value)}
            placeholder="Dr. Nombre"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => updateField("last_name", e.target.value)}
            placeholder="Apellido"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => updateField("city", e.target.value)}
            placeholder="Guadalajara"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 mb-1">Slug (URL)</label>
          <p className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700 text-sm">
            /doctors/{formData.slug || "—"}
          </p>
        </div>
      </div>

      {/* Editable fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Especialidad Principal *
        </label>
        <input
          type="text"
          value={formData.primary_specialty}
          onChange={(e) => updateField("primary_specialty", e.target.value)}
          placeholder="Cardiologo"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Subspecialties */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Subespecialidades
        </label>
        <textarea
          value={(formData.subspecialties || []).join("\n")}
          onChange={(e) => updateField("subspecialties", e.target.value.split("\n").filter(Boolean))}
          placeholder={"Una subespecialidad por linea:\nCirugia de Cataratas\nGlaucoma\nRetina"}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
        />
        <p className="text-sm text-gray-500 mt-1">
          Aparecen como badges en tu perfil publico. {(formData.subspecialties || []).length} subespecialidades
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cedula Profesional
        </label>
        <input
          type="text"
          value={formData.cedula_profesional}
          onChange={(e) => updateField("cedula_profesional", e.target.value)}
          placeholder="1234567"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Biografia Completa
        </label>
        <textarea
          value={formData.long_bio}
          onChange={(e) => updateField("long_bio", e.target.value)}
          placeholder="Descripcion detallada de experiencia, educacion y especializacion..."
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Anos de Experiencia
        </label>
        <input
          type="number"
          value={formData.years_experience || ''}
          onChange={(e) => updateField("years_experience", parseInt(e.target.value) || 0)}
          min="0"
          max="60"
          placeholder="0"
          className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Hero Image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Foto de Perfil
        </label>
        {formData.hero_image && formData.hero_image !== "/images/doctors/sample/doctor-placeholder.svg" && (
          <div className="mb-3">
            <img
              src={formData.hero_image}
              alt="Foto actual"
              className="w-28 h-28 rounded-full object-cover border-2 border-gray-200"
            />
          </div>
        )}
        <UploadButton
          endpoint="doctorHeroImage"
          onClientUploadComplete={(res) => {
            const uploadedUrl = res[0]?.url;
            if (uploadedUrl) {
              updateField("hero_image", uploadedUrl);
            }
          }}
          onUploadError={(error: Error) => {
            alert(`Error al subir imagen: ${error.message}`);
          }}
        />
      </div>

      {/* Color Palette */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Paleta de Colores
        </label>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
          <ColorPaletteSelector
            currentPaletteId={formData.color_palette}
            onSelect={(paletteId) => updateField("color_palette", paletteId)}
            isModal={false}
          />
        </div>
      </div>
    </div>
  );
}
