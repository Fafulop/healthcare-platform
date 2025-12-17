/* eslint-disable @next/next/no-before-interactive-script-outside-document */
// @refresh reset
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { UploadButton, UploadDropzone } from "@/utils/uploadthing";

// Full 10-step wizard for creating doctor profiles
export default function NewDoctorWizard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadKey, setUploadKey] = useState(0); // Key to reset upload components

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

    // Step 2: Services
    services_list: [] as Array<{
      service_name: string;
      short_description: string;
      duration_minutes: number;
      price: number;
    }>,

    // Step 3: Conditions & Procedures
    conditions: [] as string[],
    procedures: [] as string[],

    // Step 4: Biography
    short_bio: "",
    long_bio: "",
    years_experience: 1,

    // Step 5: Education
    education_items: [] as Array<{
      institution: string;
      program: string;
      year: string;
      notes: string;
    }>,

    // Step 6: Credentials
    certificate_images: [] as Array<{
      src: string;
      alt: string;
      issued_by: string;
      year: string;
    }>,

    // Step 7: Clinic Info
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

    // Step 8: FAQs
    faqs: [] as Array<{
      question: string;
      answer: string;
    }>,

    // Step 9: Media
    carousel_items: [] as Array<{
      type: "image" | "video";
      src: string;
      alt: string;
      caption: string;
    }>,

    // Other fields
    appointment_modes: ["in_person", "teleconsult"],
    next_available_date: new Date().toISOString().split("T")[0],
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
    if (currentStep < 10) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      console.log("=== SUBMITTING DOCTOR DATA ===");
      console.log("Hero Image:", formData.hero_image);
      console.log("Services:", formData.services_list.length);
      console.log("Certificates:", formData.certificate_images.length, formData.certificate_images);
      console.log("Carousel Items:", formData.carousel_items.length, formData.carousel_items);
      console.log("Full formData:", formData);

      const response = await fetch("http://localhost:3003/api/doctors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅ Include cookies for authentication
        body: JSON.stringify(formData),
      });

      // Try to parse JSON response
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error(`Server responded with status ${response.status} but response was not JSON`);
      }

      if (!response.ok) {
        console.error("API Error Response:", result);
        console.error("Response status:", response.status);
        console.error("Response statusText:", response.statusText);
        throw new Error(result.error || result.message || `Failed to create doctor (Status: ${response.status})`);
      }

      console.log("Doctor created successfully:", result);
      const doctorUrl = `http://localhost:3000/doctors/${result.data.slug}`;
      alert(`¡Doctor creado exitosamente!\n\nSlug: ${result.data.slug}\n\nVer perfil en:\n${doctorUrl}`);

      // Open profile in new tab
      window.open(doctorUrl, '_blank');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error("Error creating doctor:", error);
      alert(`Error al crear el doctor: ${error instanceof Error ? error.message : 'Unknown error'}\n\nVer consola para más detalles.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper functions for dynamic lists
  const addService = () => {
    setFormData((prev) => ({
      ...prev,
      services_list: [
        ...prev.services_list,
        {
          service_name: "",
          short_description: "",
          duration_minutes: 30,
          price: 50,
        },
      ],
    }));
  };

  const removeService = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      services_list: prev.services_list.filter((_, i) => i !== index),
    }));
  };

  const updateService = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      services_list: prev.services_list.map((service, i) =>
        i === index ? { ...service, [field]: value } : service
      ),
    }));
  };

  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education_items: [
        ...prev.education_items,
        { institution: "", program: "", year: "", notes: "" },
      ],
    }));
  };

  const removeEducation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      education_items: prev.education_items.filter((_, i) => i !== index),
    }));
  };

  const updateEducation = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      education_items: prev.education_items.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu
      ),
    }));
  };

  const addCertificate = () => {
    setFormData((prev) => ({
      ...prev,
      certificate_images: [
        ...prev.certificate_images,
        { src: "", alt: "", issued_by: "", year: "" },
      ],
    }));
  };

  const removeCertificate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      certificate_images: prev.certificate_images.filter((_, i) => i !== index),
    }));
  };

  const updateCertificate = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      certificate_images: prev.certificate_images.map((cert, i) =>
        i === index ? { ...cert, [field]: value } : cert
      ),
    }));
  };

  const addFAQ = () => {
    setFormData((prev) => ({
      ...prev,
      faqs: [...prev.faqs, { question: "", answer: "" }],
    }));
  };

  const removeFAQ = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index),
    }));
  };

  const updateFAQ = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      faqs: prev.faqs.map((faq, i) =>
        i === index ? { ...faq, [field]: value } : faq
      ),
    }));
  };

  const addMedia = () => {
    setFormData((prev) => ({
      ...prev,
      carousel_items: [
        ...prev.carousel_items,
        { type: "image", src: "", alt: "", caption: "" },
      ],
    }));
  };

  const removeMedia = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      carousel_items: prev.carousel_items.filter((_, i) => i !== index),
    }));
  };

  const updateMedia = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      carousel_items: prev.carousel_items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const stepTitles = [
    "Información Básica",
    "Servicios",
    "Condiciones y Procedimientos",
    "Biografía",
    "Educación",
    "Credenciales",
    "Información de Clínica",
    "Preguntas Frecuentes",
    "Multimedia",
    "Revisar y Publicar",
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back to Dashboard */}
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Crear Nuevo Doctor
          </h1>
          <p className="text-gray-600">
            Paso {currentStep} de 10: {stepTitles[currentStep - 1]}
          </p>

          {/* Progress Bar */}
          <div className="mt-4 flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((step) => (
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foto de Perfil *
                </label>

                <UploadButton
                  key={`hero-${uploadKey}`}
                  endpoint="doctorHeroImage"
                  onClientUploadComplete={(res) => {
                    console.log("✅ Hero image upload complete!");
                    console.log("Full response object:", res[0]);
                    console.log("Available properties:", Object.keys(res[0] || {}));

                    // UploadThing response has 'url' property
                    const uploadedUrl = res[0]?.url;
                    console.log("Extracted URL:", uploadedUrl);

                    if (uploadedUrl) {
                      updateField("hero_image", uploadedUrl);
                      console.log("✅ Updated hero_image field to:", uploadedUrl);
                      setUploadKey(prev => prev + 1); // Reset upload button
                      alert("✅ Imagen subida exitosamente!");
                    } else {
                      console.error("❌ No URL found in response!");
                      alert("⚠️ Imagen subida pero URL no capturada. Ver consola.");
                    }
                  }}
                  onUploadError={(error: Error) => {
                    console.error("Hero image upload error:", error);
                    alert(`❌ Error: ${error.message}`);
                  }}
                  onBeforeUploadBegin={(files) => {
                    console.log("Starting hero image upload...");
                    return files;
                  }}
                  onUploadProgress={(progress) => {
                    console.log(`Uploading hero image: ${progress}%`);
                  }}
                />

                {formData.hero_image && formData.hero_image !== "/images/doctors/sample/doctor-placeholder.svg" && (
                  <div className="mt-4">
                    <p className="text-sm text-green-600 mb-2">✅ Imagen subida exitosamente</p>
                    <img
                      src={formData.hero_image}
                      alt="Preview"
                      className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Services */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Servicios
                </h2>
                <button
                  onClick={addService}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Agregar Servicio
                </button>
              </div>

              {formData.services_list.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay servicios agregados. Haga clic en "Agregar Servicio" para comenzar.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.services_list.map((service, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-gray-700">Servicio {index + 1}</h3>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Descripción Corta *
                        </label>
                        <textarea
                          value={service.short_description}
                          onChange={(e) => updateService(index, "short_description", e.target.value)}
                          placeholder="Evaluación médica completa"
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duración (min) *
                          </label>
                          <input
                            type="number"
                            value={service.duration_minutes}
                            onChange={(e) => updateService(index, "duration_minutes", parseInt(e.target.value))}
                            min="1"
                            max="480"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Precio (USD)
                          </label>
                          <input
                            type="number"
                            value={service.price}
                            onChange={(e) => updateService(index, "price", parseFloat(e.target.value))}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Conditions & Procedures */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Condiciones y Procedimientos
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condiciones Tratadas *
                </label>
                <textarea
                  value={formData.conditions.join("\n")}
                  onChange={(e) => updateField("conditions", e.target.value.split("\n").filter(Boolean))}
                  placeholder="Ingrese una condición por línea:&#10;Hipertensión&#10;Diabetes&#10;Arritmias"
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Una condición por línea. Total: {formData.conditions.length} condiciones
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Procedimientos Realizados *
                </label>
                <textarea
                  value={formData.procedures.join("\n")}
                  onChange={(e) => updateField("procedures", e.target.value.split("\n").filter(Boolean))}
                  placeholder="Ingrese un procedimiento por línea:&#10;Electrocardiograma&#10;Ecocardiografía&#10;Prueba de esfuerzo"
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Un procedimiento por línea. Total: {formData.procedures.length} procedimientos
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Biography */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Biografía
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
                  maxLength={300}
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
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.long_bio.length} caracteres
                </p>
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
            </div>
          )}

          {/* Step 5: Education */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Educación
                </h2>
                <button
                  onClick={addEducation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Agregar Educación
                </button>
              </div>

              {formData.education_items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay educación agregada. Haga clic en "Agregar Educación" para comenzar.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.education_items.map((edu, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-gray-700">Educación {index + 1}</h3>
                        <button
                          onClick={() => removeEducation(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Eliminar
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Institución *
                        </label>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => updateEducation(index, "institution", e.target.value)}
                          placeholder="Universidad de Guadalajara"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Programa/Título *
                        </label>
                        <input
                          type="text"
                          value={edu.program}
                          onChange={(e) => updateEducation(index, "program", e.target.value)}
                          placeholder="Médico Cirujano"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Año *
                          </label>
                          <input
                            type="text"
                            value={edu.year}
                            onChange={(e) => updateEducation(index, "year", e.target.value)}
                            placeholder="2010"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notas
                          </label>
                          <input
                            type="text"
                            value={edu.notes}
                            onChange={(e) => updateEducation(index, "notes", e.target.value)}
                            placeholder="Con honores"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 6: Credentials */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Credenciales y Certificaciones
              </h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  📁 Suba imágenes de sus certificados, diplomas y licencias profesionales
                </p>
              </div>

              <UploadDropzone
                endpoint="doctorCertificates"
                onClientUploadComplete={(res) => {
                  console.log("✅ Certificates uploaded:", res.length, "files");
                  console.log("First file properties:", Object.keys(res[0] || {}));

                  const newCerts = res.map((file) => {
                    const fileUrl = file.url;
                    console.log("Certificate file URL:", fileUrl);
                    return {
                      src: fileUrl,
                      alt: file.name,
                      issued_by: "",
                      year: "",
                    };
                  });

                  console.log("New certificates with URLs:", newCerts);
                  setFormData((prev) => ({
                    ...prev,
                    certificate_images: [...prev.certificate_images, ...newCerts],
                  }));
                  alert(`✅ ${res.length} certificado(s) subido(s) exitosamente!`);
                }}
                onUploadError={(error: Error) => {
                  console.error("Certificate upload error:", error);
                  alert(`❌ Error: ${error.message}`);
                }}
                onUploadProgress={(progress) => {
                  console.log(`Uploading certificates: ${progress}%`);
                }}
                onBeforeUploadBegin={(files) => {
                  console.log(`Starting upload of ${files.length} certificate(s)...`);
                  return files;
                }}
              />

              {formData.certificate_images.length > 0 && (
                <div className="space-y-4 mt-6">
                  <h3 className="font-semibold text-gray-700">
                    Certificados Subidos ({formData.certificate_images.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.certificate_images.map((cert, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-gray-700">Certificado {index + 1}</h4>
                          <button
                            onClick={() => removeCertificate(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Eliminar
                          </button>
                        </div>

                        <img
                          src={cert.src}
                          alt={cert.alt}
                          className="w-full h-40 object-cover rounded border"
                        />

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descripción
                          </label>
                          <input
                            type="text"
                            value={cert.alt}
                            onChange={(e) => updateCertificate(index, "alt", e.target.value)}
                            placeholder="Certificación en Cardiología"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Emitido Por
                            </label>
                            <input
                              type="text"
                              value={cert.issued_by}
                              onChange={(e) => updateCertificate(index, "issued_by", e.target.value)}
                              placeholder="Consejo Médico"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Año
                            </label>
                            <input
                              type="text"
                              value={cert.year}
                              onChange={(e) => updateCertificate(index, "year", e.target.value)}
                              placeholder="2015"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 7: Clinic Info */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Información de Clínica
              </h2>

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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ℹ️ Horarios de atención: Los horarios predeterminados son Lun-Vie 9:00 AM - 6:00 PM. Esto se puede personalizar después.
                </p>
              </div>
            </div>
          )}

          {/* Step 8: FAQs */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Preguntas Frecuentes
                </h2>
                <button
                  onClick={addFAQ}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  + Agregar FAQ
                </button>
              </div>

              {formData.faqs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay preguntas agregadas. Haga clic en "Agregar FAQ" para comenzar.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.faqs.map((faq, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-gray-700">FAQ {index + 1}</h3>
                        <button
                          onClick={() => removeFAQ(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Eliminar
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pregunta *
                        </label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => updateFAQ(index, "question", e.target.value)}
                          placeholder="¿Cuál es el costo de la consulta?"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Respuesta *
                        </label>
                        <textarea
                          value={faq.answer}
                          onChange={(e) => updateFAQ(index, "answer", e.target.value)}
                          placeholder="El costo de la consulta general es de $50 USD..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 9: Media */}
          {currentStep === 9 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Multimedia (Fotos y Videos)
              </h2>

              {/* Clinic Photos Section */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  📸 Fotos de la Clínica
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Suba fotos de su clínica, sala de espera, consultorio, equipamiento, etc.
                  </p>
                </div>

                <UploadDropzone
                  endpoint="clinicPhotos"
                  onClientUploadComplete={(res) => {
                    console.log("✅ Clinic photos uploaded:", res.length, "files");
                    console.log("First photo properties:", Object.keys(res[0] || {}));

                    const newPhotos = res.map((file) => {
                      const fileUrl = file.url;
                      console.log("Photo URL:", fileUrl);
                      return {
                        type: "image" as const,
                        src: fileUrl,
                        alt: file.name,
                        caption: "",
                      };
                    });

                    console.log("New photos with URLs:", newPhotos);
                    setFormData((prev) => ({
                      ...prev,
                      carousel_items: [...prev.carousel_items, ...newPhotos],
                    }));
                    alert(`✅ ${res.length} foto(s) subida(s) exitosamente!`);
                  }}
                  onUploadError={(error: Error) => {
                    console.error("Clinic photos upload error:", error);
                    alert(`❌ Error: ${error.message}`);
                  }}
                  onUploadProgress={(progress) => {
                    console.log(`Uploading clinic photos: ${progress}%`);
                  }}
                  onBeforeUploadBegin={(files) => {
                    console.log(`Starting upload of ${files.length} clinic photo(s)...`);
                    return files;
                  }}
                />
              </div>

              {/* Videos Section */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  🎥 Videos
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Suba videos de presentación, recorrido por la clínica o mensaje para pacientes
                  </p>
                </div>

                <UploadDropzone
                  endpoint="doctorVideos"
                  onClientUploadComplete={(res) => {
                    console.log("✅ Videos uploaded:", res.length, "files");
                    console.log("First video properties:", Object.keys(res[0] || {}));

                    const newVideos = res.map((file) => {
                      const fileUrl = file.url;
                      console.log("Video URL:", fileUrl);
                      return {
                        type: "video" as const,
                        src: fileUrl,
                        alt: file.name,
                        caption: "",
                      };
                    });

                    console.log("New videos with URLs:", newVideos);
                    setFormData((prev) => ({
                      ...prev,
                      carousel_items: [...prev.carousel_items, ...newVideos],
                    }));
                    alert(`✅ ${res.length} video(s) subido(s) exitosamente!`);
                  }}
                  onUploadError={(error: Error) => {
                    console.error("Video upload error:", error);
                    alert(`❌ Error: ${error.message}`);
                  }}
                  onUploadProgress={(progress) => {
                    console.log(`Uploading videos: ${progress}%`);
                  }}
                  onBeforeUploadBegin={(files) => {
                    console.log(`Starting upload of ${files.length} video(s)...`);
                    return files;
                  }}
                />
              </div>

              {/* Uploaded Media Preview */}
              {formData.carousel_items.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">
                    Multimedia Subida ({formData.carousel_items.length} elementos)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {formData.carousel_items.map((item, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-medium text-gray-500">
                            {item.type === "image" ? "📸 Foto" : "🎥 Video"} #{index + 1}
                          </span>
                          <button
                            onClick={() => removeMedia(index)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            Eliminar
                          </button>
                        </div>

                        {item.type === "image" ? (
                          <img
                            src={item.src}
                            alt={item.alt}
                            className="w-full h-32 object-cover rounded"
                          />
                        ) : (
                          <video
                            src={item.src}
                            className="w-full h-32 object-cover rounded"
                            controls
                          />
                        )}

                        <div>
                          <input
                            type="text"
                            value={item.caption}
                            onChange={(e) => updateMedia(index, "caption", e.target.value)}
                            placeholder="Descripción breve..."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 10: Review */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Revisar y Publicar
              </h2>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-700">Nombre:</h3>
                  <p className="text-gray-900">{formData.doctor_full_name || "No especificado"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Especialidad:</h3>
                  <p className="text-gray-900">{formData.primary_specialty || "No especificado"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">URL:</h3>
                  <p className="text-blue-600">/doctors/{formData.slug || "slug"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Ciudad:</h3>
                  <p className="text-gray-900">{formData.city || "No especificado"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Servicios:</h3>
                  <p className="text-gray-900">{formData.services_list.length} servicios</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Condiciones:</h3>
                  <p className="text-gray-900">{formData.conditions.length} condiciones</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Procedimientos:</h3>
                  <p className="text-gray-900">{formData.procedures.length} procedimientos</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Experiencia:</h3>
                  <p className="text-gray-900">{formData.years_experience} años</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Educación:</h3>
                  <p className="text-gray-900">{formData.education_items.length} registros</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Certificados:</h3>
                  <p className="text-gray-900">{formData.certificate_images.length} certificados</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">FAQs:</h3>
                  <p className="text-gray-900">{formData.faqs.length} preguntas</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Multimedia:</h3>
                  <p className="text-gray-900">{formData.carousel_items.length} elementos</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Dirección:</h3>
                  <p className="text-gray-900">{formData.clinic_info.address || "No especificado"}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700">Teléfono:</h3>
                  <p className="text-gray-900">{formData.clinic_info.phone || "No especificado"}</p>
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

            {currentStep < 10 ? (
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
