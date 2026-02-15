"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { authFetch } from "@/lib/auth-fetch";
import GeneralInfoSection from "@/components/profile/GeneralInfoSection";
import ServicesSection from "@/components/profile/ServicesSection";
import ClinicSection from "@/components/profile/ClinicSection";
import EducationSection from "@/components/profile/EducationSection";
import MediaSection from "@/components/profile/MediaSection";
import FaqsSocialSection from "@/components/profile/FaqsSocialSection";
import ReviewsSection from "@/components/profile/ReviewsSection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

const TABS = [
  { id: "general", label: "Info General" },
  { id: "services", label: "Servicios" },
  { id: "clinic", label: "Clinica" },
  { id: "education", label: "Formacion" },
  { id: "media", label: "Multimedia" },
  { id: "faqs", label: "FAQs y Social" },
  { id: "reviews", label: "Opiniones" },
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
  const [reviews, setReviews] = useState<Array<{ id: string; patientName: string | null; rating: number; comment: string; createdAt: string }>>([]);
  const [reviewStats, setReviewStats] = useState({ averageRating: 0, reviewCount: 0 });

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

      // Load reviews data
      setReviews(d.reviews || []);
      setReviewStats(d.reviewStats || { averageRating: 0, reviewCount: 0 });
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

  const handleDeleteReview = async (reviewId: string) => {
    try {
      const response = await authFetch(`${API_URL}/api/reviews/${reviewId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al eliminar");
      }

      // Remove from local state
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setReviewStats((prev) => {
        const newCount = prev.reviewCount - 1;
        const deletedReview = reviews.find((r) => r.id === reviewId);
        const newAvg = newCount > 0 && deletedReview
          ? (prev.averageRating * prev.reviewCount - deletedReview.rating) / newCount
          : 0;
        return { averageRating: Number(newAvg.toFixed(1)), reviewCount: newCount };
      });

      setSaveMessage({ type: "success", text: "Opinion eliminada correctamente." });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (error) {
      console.error("Error deleting review:", error);
      setSaveMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Error al eliminar opinion",
      });
    }
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
  if (!doctorProfile || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando perfil...</p>
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Editar Mi Perfil</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Los cambios se aplicaran en tu perfil publico al guardar.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4 sm:mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
        <nav className="flex gap-0 sm:gap-1 overflow-x-auto -mb-px scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
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
      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
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
        {activeTab === "reviews" && (
          <ReviewsSection reviews={reviews} reviewStats={reviewStats} onDelete={handleDeleteReview} />
        )}
      </div>

      {/* Save Bar - fixed on mobile above bottom nav, sticky on desktop */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:sticky bg-white border-t border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-3 z-40">
        {saveMessage && (
          <p
            className={`text-xs sm:text-sm font-medium truncate ${
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
          className="px-5 sm:px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex-shrink-0"
        >
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
}
