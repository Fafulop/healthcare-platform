"use client";

import { useState, useEffect } from "react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { authFetch } from "@/lib/auth-fetch";
import GeneralInfoSection from "@/components/profile/GeneralInfoSection";
import ServicesSection from "@/components/profile/ServicesSection";
import ClinicSection from "@/components/profile/ClinicSection";
import EducationSection from "@/components/profile/EducationSection";
import MediaSection from "@/components/profile/MediaSection";
import FaqsSocialSection from "@/components/profile/FaqsSocialSection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

const TABS = [
  { id: "general", label: "Info General" },
  { id: "services", label: "Servicios" },
  { id: "clinic", label: "Clinica" },
  { id: "education", label: "Formacion" },
  { id: "media", label: "Multimedia" },
  { id: "faqs", label: "FAQs y Social" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DEFAULT_FORM_DATA = {
  doctor_full_name: "",
  last_name: "",
  slug: "",
  primary_specialty: "",
  subspecialties: [] as string[],
  cedula_profesional: "",
  hero_image: "/images/doctors/sample/doctor-placeholder.svg",
  location_summary: "",
  city: "",
  services_list: [] as Array<{
    service_name: string;
    short_description: string;
    duration_minutes: number;
    price: number;
  }>,
  conditions: [] as string[],
  procedures: [] as string[],
  short_bio: "",
  long_bio: "",
  years_experience: 1,
  education_items: [] as Array<{
    institution: string;
    program: string;
    year: string;
    notes: string;
  }>,
  certificate_images: [] as Array<{
    src: string;
    alt: string;
    issued_by: string;
    year: string;
  }>,
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
  faqs: [] as Array<{ question: string; answer: string }>,
  carousel_items: [] as Array<{
    type: "image" | "video";
    src: string;
    alt: string;
    caption: string;
  }>,
  appointment_modes: ["in_person", "teleconsult"],
  next_available_date: new Date().toISOString().split("T")[0],
  social_links: {} as { linkedin?: string; twitter?: string },
  color_palette: "warm",
};

export default function MiPerfilPage() {
  const { doctorProfile, refetch } = useDoctorProfile();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const slug = doctorProfile?.slug;

  // Fetch full profile data
  useEffect(() => {
    if (!slug) return;
    fetchProfile();
  }, [slug]);

  const fetchProfile = async () => {
    if (!slug) return;
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await authFetch(`${API_URL}/api/doctors/${slug}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al cargar perfil");
      }

      const d = result.data;

      setFormData({
        doctor_full_name: d.doctorFullName || "",
        last_name: d.lastName || "",
        slug: d.slug || "",
        primary_specialty: d.primarySpecialty || "",
        subspecialties: d.subspecialties || [],
        cedula_profesional: d.cedulaProfesional || "",
        hero_image: d.heroImage || "/images/doctors/sample/doctor-placeholder.svg",
        location_summary: d.locationSummary || "",
        city: d.city || "",
        services_list: (d.services || []).map((s: any) => ({
          service_name: s.serviceName,
          short_description: s.shortDescription,
          duration_minutes: s.durationMinutes,
          price: s.price,
        })),
        conditions: d.conditions || [],
        procedures: d.procedures || [],
        short_bio: d.shortBio || "",
        long_bio: d.longBio || "",
        years_experience: d.yearsExperience || 1,
        education_items: (d.educationItems || []).map((e: any) => ({
          institution: e.institution,
          program: e.program,
          year: e.year,
          notes: e.notes || "",
        })),
        certificate_images: (d.certificates || []).map((c: any) => ({
          src: c.src,
          alt: c.alt,
          issued_by: c.issuedBy,
          year: c.year,
        })),
        clinic_info: {
          address: d.clinicAddress || "",
          phone: d.clinicPhone || "",
          whatsapp: d.clinicWhatsapp || "",
          hours: d.clinicHours || DEFAULT_FORM_DATA.clinic_info.hours,
          geo: {
            lat: d.clinicGeoLat || 0,
            lng: d.clinicGeoLng || 0,
          },
        },
        faqs: (d.faqs || []).map((f: any) => ({
          question: f.question,
          answer: f.answer,
        })),
        carousel_items: (d.carouselItems || []).map((item: any) => ({
          type: item.type,
          src: item.src,
          alt: item.alt,
          caption: item.caption || "",
        })),
        appointment_modes: d.appointmentModes || ["in_person", "teleconsult"],
        next_available_date: d.nextAvailableDate
          ? new Date(d.nextAvailableDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        social_links: {
          linkedin: d.socialLinkedin || "",
          twitter: d.socialTwitter || "",
        },
        color_palette: d.colorPalette || "warm",
      });
    } catch (error) {
      console.error("Error loading profile:", error);
      setLoadError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!slug) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await authFetch(`${API_URL}/api/doctors/${slug}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Error al guardar");
      }

      setSaveMessage({ type: "success", text: "Perfil actualizado correctamente." });
      await refetch();

      // Clear success message after 4 seconds
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Loading / error states
  if (!doctorProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-gray-500 text-sm">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-gray-500 text-sm">Cargando datos del perfil...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error al cargar</h2>
          <p className="text-red-700 text-sm mb-4">{loadError}</p>
          <button
            onClick={fetchProfile}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Editar Mi Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">
          Los cambios se aplicaran en tu perfil publico al guardar.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {activeTab === "general" && (
          <GeneralInfoSection formData={formData} updateField={updateField} />
        )}
        {activeTab === "services" && (
          <ServicesSection formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "clinic" && (
          <ClinicSection formData={formData} updateField={updateField} setFormData={setFormData} />
        )}
        {activeTab === "education" && (
          <EducationSection formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "media" && (
          <MediaSection formData={formData} setFormData={setFormData} />
        )}
        {activeTab === "faqs" && (
          <FaqsSocialSection formData={formData} updateField={updateField} setFormData={setFormData} />
        )}
      </div>

      {/* Save Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 px-4 flex items-center justify-between gap-4">
        {saveMessage && (
          <p
            className={`text-sm font-medium ${
              saveMessage.type === "success" ? "text-green-700" : "text-red-700"
            }`}
          >
            {saveMessage.text}
          </p>
        )}
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
}
