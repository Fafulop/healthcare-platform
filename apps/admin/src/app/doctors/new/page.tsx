"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Simplified 3-step wizard for MVP
export default function NewDoctorWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    doctor_full_name: "",
    last_name: "",
    slug: "",
    primary_specialty: "",
    subspecialties: [] as string[],
    cedula_profesional: "",
    hero_image: "/images/doctors/sample/doctor-placeholder.svg",
    location_summary: "",
    city: "",

    // Services (simplified - just one for MVP)
    services_list: [
      {
        service_name: "Consulta General",
        short_description: "Evaluación médica completa",
        duration_minutes: 30,
        price: 50,
      },
    ],

    // Step 2: Biography
    short_bio: "",
    long_bio: "",
    years_experience: 1,

    // Clinic Info
    clinic_info: {
      address: "",
      phone: "",
      whatsapp: "",
      hours: {
        monday: "9:00 AM - 6:00 PM",
        tuesday: "9:00 AM - 6:00 PM",
        wednesday: "9:00 AM - 6:00 PM",
        thursday: "9:00 AM - 6:00 PM",
        friday: "9:00 AM - 5:00 PM",
        saturday: "Closed",
        sunday: "Closed",
      },
      geo: { lat: 0, lng: 0 },
    },

    // Auto-filled defaults
    conditions: ["Condiciones generales"],
    procedures: ["Procedimientos generales"],
    appointment_modes: ["in_person", "teleconsult"],
    next_available_date: new Date().toISOString().split("T")[0],
    education_items: [],
    certificate_images: [],
    carousel_items: [],
    faqs: [],
    social_links: {},
  });

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-generate slug when name changes
    if (field === "doctor_full_name" && value) {
      const slug = generateSlug(value);
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const updateClinicField = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      clinic_info: { ...prev.clinic_info, [field]: value },
    }));
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch("http://localhost:3003/api/doctors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create doctor");
      }

      const result = await response.json();

      alert(`¡Doctor creado exitosamente! Slug: ${result.data.slug}`);
      router.push(`http://localhost:3000/doctors/${result.data.slug}`);
    } catch (error) {
      console.error("Error creating doctor:", error);
      alert("Error al crear el doctor. Ver consola para detalles.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Crear Nuevo Doctor
          </h1>
          <p className="text-gray-600">
            Paso {currentStep} de 3
          </p>

          {/* Progress Bar */}
          <div className="mt-4 flex gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex-1 h-2 rounded ${
                  step <= currentStep ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Información Básica
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={formData.doctor_full_name}
                  onChange={(e) => updateField("doctor_full_name", e.target.value)}
                  placeholder="Dr. Juan Pérez García"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  placeholder="Pérez"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug (URL) *
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  placeholder="juan-perez"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Se genera automáticamente del nombre. URL: /doctors/{formData.slug || "slug"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Especialidad Principal *
                </label>
                <input
                  type="text"
                  value={formData.primary_specialty}
                  onChange={(e) => updateField("primary_specialty", e.target.value)}
                  placeholder="Cardiólogo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cédula Profesional
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
                  Ciudad *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => {
                    updateField("city", e.target.value);
                    updateField("location_summary", `${e.target.value}, México`);
                  }}
                  placeholder="Guadalajara"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Biography & Clinic */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Biografía e Información de Clínica
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biografía Corta *
                </label>
                <textarea
                  value={formData.short_bio}
                  onChange={(e) => updateField("short_bio", e.target.value)}
                  placeholder="Especialista en cardiología con 10 años de experiencia..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.short_bio.length}/300 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biografía Completa *
                </label>
                <textarea
                  value={formData.long_bio}
                  onChange={(e) => updateField("long_bio", e.target.value)}
                  placeholder="Descripción detallada de experiencia, educación y especialización..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Años de Experiencia *
                </label>
                <input
                  type="number"
                  value={formData.years_experience}
                  onChange={(e) => updateField("years_experience", parseInt(e.target.value))}
                  min="1"
                  max="60"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Información de Clínica
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      value={formData.clinic_info.address}
                      onChange={(e) => updateClinicField("address", e.target.value)}
                      placeholder="Av. Principal 123, Col. Centro"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={formData.clinic_info.phone}
                      onChange={(e) => updateClinicField("phone", e.target.value)}
                      placeholder="+52 33 1234 5678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formData.clinic_info.whatsapp}
                      onChange={(e) => updateClinicField("whatsapp", e.target.value)}
                      placeholder="+52 33 1234 5678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Revisar y Publicar
              </h2>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700">Nombre:</h3>
                  <p className="text-gray-900">{formData.doctor_full_name}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Especialidad:</h3>
                  <p className="text-gray-900">{formData.primary_specialty}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">URL:</h3>
                  <p className="text-blue-600">/doctors/{formData.slug}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Ciudad:</h3>
                  <p className="text-gray-900">{formData.city}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Experiencia:</h3>
                  <p className="text-gray-900">{formData.years_experience} años</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Dirección:</h3>
                  <p className="text-gray-900">{formData.clinic_info.address}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Teléfono:</h3>
                  <p className="text-gray-900">{formData.clinic_info.phone}</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Al hacer clic en "Publicar", el perfil del doctor estará visible en el sitio público inmediatamente.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>

            {currentStep < 3 ? (
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Publicando..." : "Publicar Doctor"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
