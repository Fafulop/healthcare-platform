"use client";


import { useState, useEffect } from "react";
import { Loader2, Calendar, CheckCircle2, XCircle, RefreshCw, AlertTriangle, MessageCircle, ShieldOff } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { useDoctorProfile } from "@/contexts/DoctorProfileContext";
import { authFetch } from "@/lib/auth-fetch";
import GeneralInfoSection from "@/components/profile/GeneralInfoSection";
import ServicesSection from "@/components/profile/ServicesSection";
import ClinicSection from "@/components/profile/ClinicSection";
import EducationSection from "@/components/profile/EducationSection";
import MediaSection from "@/components/profile/MediaSection";
import FaqsSocialSection from "@/components/profile/FaqsSocialSection";
import ReviewsSection from "@/components/profile/ReviewsSection";
import PrescriptionTemplateSection from "@/components/profile/PrescriptionTemplateSection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

const TABS = [
  { id: "general", label: "Info General" },
  { id: "services", label: "Servicios" },
  { id: "clinic", label: "Clinica" },
  { id: "education", label: "Formacion" },
  { id: "media", label: "Multimedia" },
  { id: "faqs", label: "FAQs y Social" },
  { id: "reviews", label: "Opiniones" },
  { id: "integraciones", label: "Integraciones" },
  { id: "receta", label: "Receta PDF" },
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
    is_booking_active: boolean;
  }>,
  conditions: [] as string[],
  procedures: [] as string[],
  long_bio: "",
  years_experience: 0,
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
  clinic_locations: [] as Array<{
    id?: string;
    name: string;
    address: string;
    phone: string;
    whatsapp: string;
    hours: Record<string, string>;
    geoLat: number;
    geoLng: number;
    isDefault: boolean;
  }>,
  faqs: [] as Array<{ question: string; answer: string }>,
  carousel_items: [] as Array<{
    type: "image" | "video";
    src: string;
    alt: string;
    caption: string;
  }>,
  appointment_modes: ["in_person", "teleconsult"],
  next_available_date: new Date().toISOString().split("T")[0],
  social_links: {} as { linkedin?: string; twitter?: string; instagram?: string; facebook?: string; tiktok?: string },
  color_palette: "professional",
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

  // Google Calendar integration state
  const [calendarStatus, setCalendarStatus] = useState<{
    connected: boolean;
    hasTokens: boolean;
    calendarId: string | null;
    enabled: boolean;
    tokenExpiry: string | null;
    channelExpiry: string | null;
  } | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Telegram notification state
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [telegramInput, setTelegramInput] = useState("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [telegramLoaded, setTelegramLoaded] = useState(false);
  const [telegramNotifyBooking, setTelegramNotifyBooking] = useState(true);
  const [telegramNotifyForm, setTelegramNotifyForm] = useState(true);
  const [telegramNotifyReminderConfirmed, setTelegramNotifyReminderConfirmed] = useState(true);
  const [telegramNotifyReminderPending, setTelegramNotifyReminderPending] = useState(true);
  const [telegramReminderOffset, setTelegramReminderOffset] = useState(60);
  const [telegramNotifyTaskReminder, setTelegramNotifyTaskReminder] = useState(true);
  const [telegramTaskReminderOffset, setTelegramTaskReminderOffset] = useState(60);
  const [telegramToggleLoading, setTelegramToggleLoading] = useState<string | null>(null);

  // Active sessions state
  type SessionItem = { id: string; createdAt: string; expires: string; current: boolean };
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [killSessionsLoading, setKillSessionsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const slug = doctorProfile?.slug;

  // Fetch full profile data
  useEffect(() => {
    if (!slug) return;
    fetchProfile();
  }, [slug]);

  // Fetch Google Calendar status when Integraciones tab is opened
  useEffect(() => {
    if (activeTab === "integraciones" && slug && calendarStatus === null) {
      fetchCalendarStatus();
    }
  }, [activeTab, slug]);

  // Fetch Telegram status when Integraciones tab is opened
  useEffect(() => {
    if (activeTab === "integraciones" && slug && !telegramLoaded) {
      fetchTelegramStatus();
    }
  }, [activeTab, slug]);

  // Fetch active sessions when Integraciones tab is opened
  useEffect(() => {
    if (activeTab === "integraciones" && sessions.length === 0 && !sessionsLoading) {
      fetchSessions();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetch("/api/auth/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar sesiones");
      setSessions(data.data);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : "Error al cargar sesiones");
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleKillSessions = async () => {
    setKillSessionsLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/auth/kill-sessions`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al cerrar sesiones");
      }
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      setKillSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al revocar sesión");
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silently fail — session list will still show the item
    } finally {
      setRevokingId(null);
    }
  };

  const fetchCalendarStatus = async () => {
    if (!slug) return;
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/google-calendar/status`);
      const data = await res.json();
      setCalendarStatus(data);
    } catch {
      setCalendarStatus({ connected: false, hasTokens: false, calendarId: null, enabled: false, tokenExpiry: null, channelExpiry: null });
    }
  };

  const handleCalendarConnect = async () => {
    if (!slug) return;
    setCalendarLoading(true);
    setCalendarMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/google-calendar/connect`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al conectar");
      setCalendarMessage({
        type: "success",
        text: `Conectado. ${data.syncedSlots} citas y ${data.syncedTasks} pendientes sincronizados.`,
      });
      await fetchCalendarStatus();
    } catch (err) {
      setCalendarMessage({ type: "error", text: err instanceof Error ? err.message : "Error al conectar" });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleCalendarResync = async () => {
    if (!slug) return;
    setCalendarLoading(true);
    setCalendarMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/google-calendar/resync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al sincronizar");
      const parts: string[] = [];
      if (data.createdSlots > 0) parts.push(`${data.createdSlots} citas creadas`);
      if (data.updatedSlots > 0) parts.push(`${data.updatedSlots} citas actualizadas`);
      if (data.createdTasks > 0) parts.push(`${data.createdTasks} pendientes creados`);
      if (data.updatedTasks > 0) parts.push(`${data.updatedTasks} pendientes actualizados`);
      if (data.deletedOrphans > 0) parts.push(`${data.deletedOrphans} eventos obsoletos eliminados`);
      setCalendarMessage({
        type: "success",
        text: parts.length > 0 ? `Sincronizado: ${parts.join(", ")}.` : "Todo sincronizado, sin cambios.",
      });
    } catch (err) {
      setCalendarMessage({ type: "error", text: err instanceof Error ? err.message : "Error al sincronizar" });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleCalendarDisconnect = async () => {
    if (!slug) return;
    setCalendarLoading(true);
    setCalendarMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/google-calendar/disconnect`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al desconectar");
      setCalendarMessage({ type: "success", text: "Google Calendar desconectado." });
      await fetchCalendarStatus();
    } catch (err) {
      setCalendarMessage({ type: "error", text: err instanceof Error ? err.message : "Error al desconectar" });
    } finally {
      setCalendarLoading(false);
    }
  };

  const fetchTelegramStatus = async () => {
    if (!slug) return;
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/telegram`);
      const data = await res.json();
      setTelegramChatId(data.chatId ?? null);
      setTelegramInput(data.chatId ?? "");
      setTelegramNotifyBooking(data.notifyBooking ?? true);
      setTelegramNotifyForm(data.notifyForm ?? true);
      setTelegramNotifyReminderConfirmed(data.notifyReminderConfirmed ?? true);
      setTelegramNotifyReminderPending(data.notifyReminderPending ?? true);
      setTelegramReminderOffset(data.reminderOffsetMinutes ?? 60);
      setTelegramNotifyTaskReminder(data.notifyTaskReminder ?? true);
      setTelegramTaskReminderOffset(data.taskReminderOffsetMinutes ?? 60);
    } catch {
      setTelegramChatId(null);
    } finally {
      setTelegramLoaded(true);
    }
  };

  const handleTelegramToggle = async (
    field: "notifyBooking" | "notifyForm" | "notifyReminderConfirmed" | "notifyReminderPending" | "notifyTaskReminder",
    value: boolean
  ) => {
    if (!slug) return;
    setTelegramToggleLoading(field);
    // Optimistic update
    if (field === "notifyBooking") setTelegramNotifyBooking(value);
    else if (field === "notifyForm") setTelegramNotifyForm(value);
    else if (field === "notifyReminderConfirmed") setTelegramNotifyReminderConfirmed(value);
    else if (field === "notifyReminderPending") setTelegramNotifyReminderPending(value);
    else setTelegramNotifyTaskReminder(value);
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/telegram`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert on error
      if (field === "notifyBooking") setTelegramNotifyBooking(!value);
      else if (field === "notifyForm") setTelegramNotifyForm(!value);
      else if (field === "notifyReminderConfirmed") setTelegramNotifyReminderConfirmed(!value);
      else if (field === "notifyReminderPending") setTelegramNotifyReminderPending(!value);
      else setTelegramNotifyTaskReminder(!value);
    } finally {
      setTelegramToggleLoading(null);
    }
  };

  const handleTelegramReminderOffsetChange = async (minutes: number) => {
    if (!slug) return;
    setTelegramReminderOffset(minutes);
    try {
      await authFetch(`${API_URL}/api/doctors/${slug}/telegram`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderOffsetMinutes: minutes }),
      });
    } catch {
      // silent — offset will be re-fetched on next tab open
    }
  };

  const handleTelegramTaskReminderOffsetChange = async (minutes: number) => {
    if (!slug) return;
    setTelegramTaskReminderOffset(minutes);
    try {
      await authFetch(`${API_URL}/api/doctors/${slug}/telegram`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskReminderOffsetMinutes: minutes }),
      });
    } catch {
      // silent — offset will be re-fetched on next tab open
    }
  };

  const handleTelegramSave = async () => {
    if (!slug || !telegramInput.trim()) return;
    setTelegramLoading(true);
    setTelegramMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/telegram`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: telegramInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setTelegramChatId(data.chatId);
      setTelegramMessage({ type: "success", text: "Chat ID guardado. Recibirás notificaciones en Telegram." });
    } catch (err) {
      setTelegramMessage({ type: "error", text: err instanceof Error ? err.message : "Error al guardar" });
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTelegramRemove = async () => {
    if (!slug) return;
    setTelegramLoading(true);
    setTelegramMessage(null);
    try {
      const res = await authFetch(`${API_URL}/api/doctors/${slug}/telegram`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al desconectar");
      setTelegramChatId(null);
      setTelegramInput("");
      setTelegramNotifyBooking(true);
      setTelegramNotifyForm(true);
      setTelegramNotifyReminderConfirmed(true);
      setTelegramNotifyReminderPending(true);
      setTelegramReminderOffset(60);
      setTelegramNotifyTaskReminder(true);
      setTelegramTaskReminderOffset(60);
      setTelegramMessage({ type: "success", text: "Telegram desconectado." });
    } catch (err) {
      setTelegramMessage({ type: "error", text: err instanceof Error ? err.message : "Error al desconectar" });
    } finally {
      setTelegramLoading(false);
    }
  };

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
          is_booking_active: s.isBookingActive ?? true,
        })),
        conditions: d.conditions || [],
        procedures: d.procedures || [],
        long_bio: d.longBio || "",
        years_experience: d.yearsExperience ?? 0,
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
        clinic_locations: (d.clinicLocations && d.clinicLocations.length > 0)
          ? d.clinicLocations.map((loc: any) => ({
              id: loc.id,
              name: loc.name || "Consultorio Principal",
              address: loc.address || "",
              phone: loc.phone || "",
              whatsapp: loc.whatsapp || "",
              hours: loc.hours || {},
              geoLat: loc.geoLat || 0,
              geoLng: loc.geoLng || 0,
              isDefault: loc.isDefault ?? true,
            }))
          : [{
              name: "Consultorio Principal",
              address: d.clinicAddress || "",
              phone: d.clinicPhone || "",
              whatsapp: d.clinicWhatsapp || "",
              hours: d.clinicHours || {},
              geoLat: d.clinicGeoLat || 0,
              geoLng: d.clinicGeoLng || 0,
              isDefault: true,
            }],
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
          instagram: d.socialInstagram || "",
          facebook: d.socialFacebook || "",
          tiktok: d.socialTiktok || "",
        },
        color_palette: d.colorPalette || "professional",
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
        {activeTab === "receta" && <PrescriptionTemplateSection />}
        {activeTab === "integraciones" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Integraciones</h2>
              <p className="text-sm text-gray-500 mt-1">Conecta servicios externos para sincronizar tu agenda.</p>
            </div>

            {/* Google Calendar card */}
            <div className="border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Google Calendar</p>
                  <p className="text-xs text-gray-500">Sincroniza citas y pendientes en un calendario dedicado "tusalud.pro"</p>
                </div>
                {calendarStatus?.connected && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                  </span>
                )}
                {calendarStatus && !calendarStatus.connected && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                    <XCircle className="w-3.5 h-3.5" /> Desconectado
                  </span>
                )}
              </div>

              {calendarMessage && (
                <div className={`text-xs rounded-lg px-3 py-2 ${calendarMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {calendarMessage.text}
                </div>
              )}

              {calendarStatus === null ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando estado...
                </div>
              ) : !calendarStatus.hasTokens ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Para conectar Google Calendar necesitas volver a iniciar sesión con Google. Esto actualizará los permisos de tu cuenta.</span>
                  </div>
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/dashboard/mi-perfil" })}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Re-autenticar con Google
                  </button>
                </div>
              ) : calendarStatus.connected ? (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Calendario: <span className="font-mono text-gray-700">tusalud.pro</span></p>
                    {calendarStatus.channelExpiry && (() => {
                      const expiry = new Date(calendarStatus.channelExpiry);
                      const expiringSoon = expiry < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                      return (
                        <p>
                          Webhook válido hasta:{' '}
                          <span className={expiringSoon ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                            {expiry.toLocaleDateString("es-MX")}
                            {expiringSoon && ' ⚠️'}
                          </span>
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCalendarResync}
                      disabled={calendarLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${calendarLoading ? "animate-spin" : ""}`} />
                      Sincronizar ahora
                    </button>
                    <button
                      onClick={handleCalendarDisconnect}
                      disabled={calendarLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Desconectar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleCalendarConnect}
                  disabled={calendarLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {calendarLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                  Conectar Google Calendar
                </button>
              )}
            </div>

            {/* Sessions card */}
            <div className="border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <ShieldOff className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Sesiones activas</p>
                  <p className="text-xs text-gray-500">Administra los dispositivos donde tienes sesión abierta.</p>
                </div>
              </div>

              {sessionsLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando sesiones...
                </div>
              )}

              {sessionsError && (
                <div className="text-xs rounded-lg px-3 py-2 bg-red-50 text-red-700 border border-red-200">
                  {sessionsError}
                </div>
              )}

              {!sessionsLoading && !sessionsError && sessions.length === 0 && (
                <p className="text-xs text-gray-500">No hay sesiones activas.</p>
              )}

              {!sessionsLoading && !sessionsError && sessions.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                      <div className="text-xs text-gray-600">
                        <p className="font-medium text-gray-800">Sesión activa</p>
                        <p className="text-gray-500">
                          Iniciado: {new Date(s.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}
                          {new Date(s.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {s.current ? (
                        <span className="flex-shrink-0 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
                          Este dispositivo
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revokingId === s.id}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {revokingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Revocar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleKillSessions}
                  disabled={killSessionsLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {killSessionsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                  Cerrar todas
                </button>
              </div>
            </div>

            {/* Telegram card */}
            <div className="border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#229ED9] flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Telegram</p>
                  <p className="text-xs text-gray-500">Recibe una notificación en Telegram cuando un paciente agenda una cita</p>
                </div>
                {telegramChatId && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                  </span>
                )}
              </div>

              {telegramMessage && (
                <div className={`text-xs rounded-lg px-3 py-2 ${telegramMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {telegramMessage.text}
                </div>
              )}

              {!telegramLoaded ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando estado...
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-1">
                    <p className="font-medium text-gray-700">Cómo obtener tu Chat ID:</p>
                    <p>1. Abre Telegram y busca el bot <span className="font-mono text-gray-900">@Tusalud_citas_bot</span></p>
                    <p>2. Presiona <span className="font-medium">Start</span> — el bot te responderá con tu Chat ID</p>
                    <p>3. Copia el número y pégalo aquí</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={telegramInput}
                      onChange={(e) => setTelegramInput(e.target.value)}
                      placeholder="Ej: 123456789"
                      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      onClick={handleTelegramSave}
                      disabled={telegramLoading || !telegramInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#229ED9] text-white rounded-lg text-sm font-medium hover:bg-[#1a8cbf] disabled:opacity-50 transition-colors"
                    >
                      {telegramLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Guardar
                    </button>
                    {telegramChatId && (
                      <button
                        onClick={handleTelegramRemove}
                        disabled={telegramLoading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {telegramChatId && (
                    <div className="border-t border-gray-100 pt-3 space-y-4">
                      {/* Instant notifications */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Notificaciones instantáneas</p>
                        {[
                          { field: "notifyBooking" as const, label: "Nueva cita pendiente", description: "Cuando un paciente agenda desde el portal público" },
                          { field: "notifyForm" as const, label: "Formulario pre-consulta", description: "Cuando un paciente envía su formulario" },
                        ].map(({ field, label, description }) => {
                          const enabled = field === "notifyBooking" ? telegramNotifyBooking : telegramNotifyForm;
                          const loading = telegramToggleLoading === field;
                          return (
                            <div key={field} className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium text-gray-800">{label}</p>
                                <p className="text-xs text-gray-500">{description}</p>
                              </div>
                              <button
                                onClick={() => handleTelegramToggle(field, !enabled)}
                                disabled={!!telegramToggleLoading}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${enabled ? "bg-[#229ED9]" : "bg-gray-200"}`}
                                role="switch"
                                aria-checked={enabled}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${enabled ? "translate-x-4" : "translate-x-0"}`}>
                                  {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400 mt-0.5 ml-0.5" />}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Task reminder notifications */}
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <p className="text-xs font-medium text-gray-700">Recordatorios de tareas</p>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-500">Enviar recordatorio</p>
                          <select
                            value={telegramTaskReminderOffset}
                            onChange={(e) => handleTelegramTaskReminderOffsetChange(Number(e.target.value))}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value={15}>15 min antes</option>
                            <option value={30}>30 min antes</option>
                            <option value={60}>1 hora antes</option>
                            <option value={120}>2 horas antes</option>
                            <option value={240}>4 horas antes</option>
                            <option value={1440}>1 día antes</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-gray-800">Recordatorio de tareas pendientes</p>
                            <p className="text-xs text-gray-500">Tareas sin hora usan las 07:00 como referencia</p>
                          </div>
                          <button
                            onClick={() => handleTelegramToggle("notifyTaskReminder", !telegramNotifyTaskReminder)}
                            disabled={!!telegramToggleLoading}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${telegramNotifyTaskReminder ? "bg-[#229ED9]" : "bg-gray-200"}`}
                            role="switch"
                            aria-checked={telegramNotifyTaskReminder}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${telegramNotifyTaskReminder ? "translate-x-4" : "translate-x-0"}`}>
                              {telegramToggleLoading === "notifyTaskReminder" && <Loader2 className="w-3 h-3 animate-spin text-gray-400 mt-0.5 ml-0.5" />}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Appointment reminder notifications */}
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <p className="text-xs font-medium text-gray-700">Recordatorios de cita</p>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-gray-500">Enviar recordatorio</p>
                          <select
                            value={telegramReminderOffset}
                            onChange={(e) => handleTelegramReminderOffsetChange(Number(e.target.value))}
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value={15}>15 min antes</option>
                            <option value={30}>30 min antes</option>
                            <option value={60}>1 hora antes</option>
                            <option value={120}>2 horas antes</option>
                            <option value={240}>4 horas antes</option>
                            <option value={1440}>1 día antes</option>
                          </select>
                        </div>
                        {[
                          { field: "notifyReminderConfirmed" as const, label: "Citas confirmadas (Agendadas)", description: "Recordatorio para citas ya confirmadas" },
                          { field: "notifyReminderPending" as const, label: "Citas pendientes", description: "Recordatorio para citas aún sin confirmar" },
                        ].map(({ field, label, description }) => {
                          const enabled = field === "notifyReminderConfirmed" ? telegramNotifyReminderConfirmed : telegramNotifyReminderPending;
                          const loading = telegramToggleLoading === field;
                          return (
                            <div key={field} className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-medium text-gray-800">{label}</p>
                                <p className="text-xs text-gray-500">{description}</p>
                              </div>
                              <button
                                onClick={() => handleTelegramToggle(field, !enabled)}
                                disabled={!!telegramToggleLoading}
                                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${enabled ? "bg-[#229ED9]" : "bg-gray-200"}`}
                                role="switch"
                                aria-checked={enabled}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${enabled ? "translate-x-4" : "translate-x-0"}`}>
                                  {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400 mt-0.5 ml-0.5" />}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save Bar - hidden on Integraciones and Receta PDF tabs (they have their own save) */}
      <div className={`fixed bottom-16 lg:bottom-0 left-0 right-0 lg:sticky bg-white border-t border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-3 z-40 ${(activeTab === "integraciones" || activeTab === "receta") ? "hidden" : ""}`}>
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
