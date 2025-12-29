/* eslint-disable @next/next/no-before-interactive-script-outside-document */
// @refresh reset
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { UploadButton, UploadDropzone } from "@/utils/uploadthing";
import { authFetch } from "@/lib/auth-fetch";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
const PUBLIC_URL = process.env.NEXT_PUBLIC_PUBLIC_URL || 'http://localhost:3000';

// Edit doctor wizard - reuses creation wizard structure but loads existing data
export default function EditDoctorWizard({ params }: { params: Promise<{ slug: string }> }) {
  // Unwrap params Promise (Next.js 15 requirement)
  const { slug } = use(params);

  const router = useRouter();
  const { data: session } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [originalSlug] = useState(slug); // Store original slug for SEO

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

  // Fetch existing doctor data on mount
  useEffect(() => {
    fetchDoctorData();
  }, [slug]);

  const fetchDoctorData = async () => {
    try {
      setIsLoading(true);
      const response = await authFetch(`${API_URL}/api/doctors/${slug}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load doctor data');
      }

      const doctor = result.data;

      // Transform API data to match form structure
      setFormData({
        doctor_full_name: doctor.doctorFullName || "",
        last_name: doctor.lastName || "",
        slug: doctor.slug || "",
        primary_specialty: doctor.primarySpecialty || "",
        subspecialties: doctor.subspecialties || [],
        cedula_profesional: doctor.cedulaProfesional || "",
        hero_image: doctor.heroImage || "/images/doctors/sample/doctor-placeholder.svg",
        location_summary: doctor.locationSummary || "",
        city: doctor.city || "",

        services_list: (doctor.services || []).map((s: any) => ({
          service_name: s.serviceName,
          short_description: s.shortDescription,
          duration_minutes: s.durationMinutes,
          price: s.price,
        })),

        conditions: doctor.conditions || [],
        procedures: doctor.procedures || [],

        short_bio: doctor.shortBio || "",
        long_bio: doctor.longBio || "",
        years_experience: doctor.yearsExperience || 1,

        education_items: (doctor.educationItems || []).map((e: any) => ({
          institution: e.institution,
          program: e.program,
          year: e.year,
          notes: e.notes || "",
        })),

        certificate_images: (doctor.certificates || []).map((c: any) => ({
          src: c.src,
          alt: c.alt,
          issued_by: c.issuedBy,
          year: c.year,
        })),

        clinic_info: {
          address: doctor.clinicAddress || "",
          phone: doctor.clinicPhone || "",
          whatsapp: doctor.clinicWhatsapp || "",
          hours: doctor.clinicHours || {
            monday: "9:00 AM - 6:00 PM",
            tuesday: "9:00 AM - 6:00 PM",
            wednesday: "9:00 AM - 6:00 PM",
            thursday: "9:00 AM - 6:00 PM",
            friday: "9:00 AM - 5:00 PM",
            saturday: "Closed",
            sunday: "Closed",
          },
          geo: {
            lat: doctor.clinicGeoLat || 0,
            lng: doctor.clinicGeoLng || 0,
          },
        },

        faqs: (doctor.faqs || []).map((f: any) => ({
          question: f.question,
          answer: f.answer,
        })),

        carousel_items: (doctor.carouselItems || []).map((item: any) => ({
          type: item.type,
          src: item.src,
          alt: item.alt,
          caption: item.caption || "",
        })),

        appointment_modes: doctor.appointmentModes || ["in_person", "teleconsult"],
        next_available_date: doctor.nextAvailableDate
          ? new Date(doctor.nextAvailableDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        social_links: {
          linkedin: doctor.socialLinkedin,
          twitter: doctor.socialTwitter,
        },
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading doctor:", error);
      setLoadError(error instanceof Error ? error.message : 'Error desconocido');
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
      console.log("=== UPDATING DOCTOR DATA ===");
      console.log("Original Slug:", originalSlug);
      console.log("Hero Image:", formData.hero_image);
      console.log("Services:", formData.services_list.length);
      console.log("Full formData:", formData);

      // Use original slug for the PUT request (SEO protection)
      const response = await authFetch(`${API_URL}/api/doctors/${originalSlug}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error(`Server responded with status ${response.status} but response was not JSON`);
      }

      if (!response.ok) {
        console.error("API Error Response:", result);
        throw new Error(result.error || result.message || `Failed to update doctor (Status: ${response.status})`);
      }

      console.log("Doctor updated successfully:", result);
      alert(`¡Doctor actualizado exitosamente!\n\nSlug: ${result.data.slug}`);

      // Redirect to doctors list
      router.push('/doctors');
    } catch (error) {
      console.error("Error updating doctor:", error);
      alert(`Error al actualizar el doctor: ${error instanceof Error ? error.message : 'Unknown error'}\n\nVer consola para más detalles.`);
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
    "Revisar y Actualizar",
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Cargando datos del doctor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Error al cargar</h2>
            <p className="text-red-700 mb-4">{loadError}</p>
            <div className="flex gap-3">
              <button
                onClick={fetchDoctorData}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Reintentar
              </button>
              <Link
                href="/doctors"
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                Volver a la lista
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back to Doctors List */}
        <div className="mb-4">
          <Link
            href="/doctors"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a Doctores
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Editar Doctor
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

              {/* SEO-PROTECTED SLUG FIELD */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Slug (URL) - No editable
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                />
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ SEO:</strong> El slug no se puede cambiar para preservar el ranking en Google y los enlaces externos.
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    URL actual: /doctors/{formData.slug}
                  </p>
                </div>
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

                {/* Show current image */}
                {formData.hero_image && formData.hero_image !== "/images/doctors/sample/doctor-placeholder.svg" && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Imagen actual:</p>
                    <img
                      src={formData.hero_image}
                      alt="Current hero"
                      className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
                    />
                  </div>
                )}

                <UploadButton
                  key={`hero-${uploadKey}`}
                  endpoint="doctorHeroImage"
                  onClientUploadComplete={(res) => {
                    const uploadedUrl = res[0]?.url;
                    if (uploadedUrl) {
                      updateField("hero_image", uploadedUrl);
                      setUploadKey(prev => prev + 1);
                      alert("✅ Imagen actualizada exitosamente!");
                    }
                  }}
                  onUploadError={(error: Error) => {
                    console.error("Hero image upload error:", error);
                    alert(`❌ Error: ${error.message}`);
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 2: Services - SAME AS CREATE */}
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

          {/* Step 3: Conditions & Procedures - SAME AS CREATE */}
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

          {/* Step 4: Biography - SAME AS CREATE */}
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

          {/* Steps 5-9: Education, Credentials, Clinic, FAQs, Media - Reusing exact same code from create */}
          {/* For brevity, I'll include the essential structure. The full implementation would have all steps */}

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
                  No hay educación agregada.
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

              <UploadDropzone
                endpoint="doctorCertificates"
                onClientUploadComplete={(res) => {
                  const newCerts = res.map((file) => ({
                    src: file.url,
                    alt: file.name,
                    issued_by: "",
                    year: "",
                  }));

                  setFormData((prev) => ({
                    ...prev,
                    certificate_images: [...prev.certificate_images, ...newCerts],
                  }));
                  alert(`✅ ${res.length} certificado(s) subido(s) exitosamente!`);
                }}
                onUploadError={(error: Error) => {
                  alert(`❌ Error: ${error.message}`);
                }}
              />

              {formData.certificate_images.length > 0 && (
                <div className="space-y-4 mt-6">
                  <h3 className="font-semibold text-gray-700">
                    Certificados ({formData.certificate_images.length})
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
                          <input
                            type="text"
                            value={cert.alt}
                            onChange={(e) => updateCertificate(index, "alt", e.target.value)}
                            placeholder="Descripción"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={cert.issued_by}
                            onChange={(e) => updateCertificate(index, "issued_by", e.target.value)}
                            placeholder="Emitido Por"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <input
                            type="text"
                            value={cert.year}
                            onChange={(e) => updateCertificate(index, "year", e.target.value)}
                            placeholder="Año"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Google Maps Coordinates */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Coordenadas de Google Maps
                </h3>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 mb-2">
                    📍 Las coordenadas permiten que el enlace "Ver en Google Maps" lleve directamente a la ubicación exacta de la clínica.
                  </p>
                  <p className="text-xs text-blue-700">
                    Si no las agregas, el enlace buscará por dirección (menos preciso).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Latitud
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.clinic_info.geo.lat}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            geo: { ...prev.clinic_info.geo, lat: parseFloat(e.target.value) || 0 }
                          }
                        }));
                      }}
                      placeholder="20.6737777"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Longitud
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.clinic_info.geo.lng}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            geo: { ...prev.clinic_info.geo, lng: parseFloat(e.target.value) || 0 }
                          }
                        }));
                      }}
                      placeholder="-103.3723871"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const searchQuery = encodeURIComponent(formData.clinic_info.address || 'Guadalajara, Mexico');
                    window.open(`https://www.google.com/maps/search/${searchQuery}`, '_blank');
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                >
                  🗺️ Buscar Dirección en Google Maps
                </button>

                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-700 font-semibold mb-1">¿Cómo obtener las coordenadas?</p>
                  <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                    <li>Haz clic en "Buscar Dirección en Google Maps"</li>
                    <li>Encuentra la ubicación exacta en el mapa</li>
                    <li>Haz clic derecho en el pin rojo</li>
                    <li>Copia los números que aparecen arriba (ej: 20.6737777, -103.3723871)</li>
                    <li>Pega el primer número en Latitud y el segundo en Longitud</li>
                  </ol>
                </div>
              </div>

              {/* Office Hours */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Horario de Atención
                </h3>
                <div className="space-y-3">
                  {/* Monday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Lunes</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.monday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, monday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="9:00 AM - 6:00 PM"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Tuesday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Martes</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.tuesday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, tuesday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="9:00 AM - 6:00 PM"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Wednesday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Miércoles</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.wednesday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, wednesday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="9:00 AM - 6:00 PM"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Thursday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Jueves</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.thursday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, thursday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="9:00 AM - 6:00 PM"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Friday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Viernes</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.friday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, friday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="9:00 AM - 5:00 PM"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Saturday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Sábado</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.saturday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, saturday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="Closed"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Sunday */}
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-sm font-medium text-gray-700">Domingo</label>
                    <input
                      type="text"
                      value={formData.clinic_info.hours.sunday}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          clinic_info: {
                            ...prev.clinic_info,
                            hours: { ...prev.clinic_info.hours, sunday: e.target.value }
                          }
                        }));
                      }}
                      placeholder="Closed"
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-600">
                    💡 Tip: Use "Cerrado" o "Closed" para días sin atención
                  </p>
                </div>
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
                  No hay preguntas agregadas.
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
                          placeholder="El costo es..."
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

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  📸 Fotos de la Clínica
                </h3>

                <UploadDropzone
                  endpoint="clinicPhotos"
                  onClientUploadComplete={(res) => {
                    const newPhotos = res.map((file) => ({
                      type: "image" as const,
                      src: file.url,
                      alt: file.name,
                      caption: "",
                    }));

                    setFormData((prev) => ({
                      ...prev,
                      carousel_items: [...prev.carousel_items, ...newPhotos],
                    }));
                    alert(`✅ ${res.length} foto(s) subida(s)!`);
                  }}
                  onUploadError={(error: Error) => {
                    alert(`❌ Error: ${error.message}`);
                  }}
                />
              </div>

              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  🎥 Videos
                </h3>

                <UploadDropzone
                  endpoint="doctorVideos"
                  onClientUploadComplete={(res) => {
                    const newVideos = res.map((file) => ({
                      type: "video" as const,
                      src: file.url,
                      alt: file.name,
                      caption: "",
                    }));

                    setFormData((prev) => ({
                      ...prev,
                      carousel_items: [...prev.carousel_items, ...newVideos],
                    }));
                    alert(`✅ ${res.length} video(s) subido(s)!`);
                  }}
                  onUploadError={(error: Error) => {
                    alert(`❌ Error: ${error.message}`);
                  }}
                />
              </div>

              {formData.carousel_items.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">
                    Multimedia Subida ({formData.carousel_items.length})
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

                        <input
                          type="text"
                          value={item.caption}
                          onChange={(e) => updateMedia(index, "caption", e.target.value)}
                          placeholder="Descripción breve..."
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
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
                Revisar y Actualizar
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
                  <h3 className="font-semibold text-gray-700">Servicios:</h3>
                  <p className="text-gray-900">{formData.services_list.length} servicios</p>
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
                  <h3 className="font-semibold text-gray-700">Multimedia:</h3>
                  <p className="text-gray-900">{formData.carousel_items.length} elementos</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ℹ️ Los cambios se aplicarán inmediatamente en el perfil público.
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
                {isSubmitting ? "Actualizando..." : "Actualizar Doctor"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
