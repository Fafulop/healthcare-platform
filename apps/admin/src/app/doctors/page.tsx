"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import ColorPaletteSelector from "@/components/ColorPaletteSelector";

// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
const PUBLIC_URL = process.env.NEXT_PUBLIC_PUBLIC_URL || 'http://localhost:3000';

interface Doctor {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
  city: string;
  heroImage: string;
  colorPalette: string;
  createdAt: string;
}

export default function DoctorsListPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paletteModalOpen, setPaletteModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [updatingPalette, setUpdatingPalette] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        setDoctors(result.data);
      } else {
        setError("Error al cargar los doctores");
      }
    } catch (err) {
      console.error("Error fetching doctors:", err);
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaletteModal = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setPaletteModalOpen(true);
  };

  const handleClosePaletteModal = () => {
    setPaletteModalOpen(false);
    setSelectedDoctor(null);
  };

  const handleUpdatePalette = async (paletteId: string) => {
    if (!selectedDoctor) return;

    setUpdatingPalette(true);
    try {
      // First, fetch the full doctor data
      const fetchResponse = await authFetch(`${API_URL}/api/doctors/${selectedDoctor.slug}`);
      const fetchResult = await fetchResponse.json();

      if (!fetchResult.success) {
        throw new Error("Failed to fetch doctor data");
      }

      const doctor = fetchResult.data;

      // Transform and update with new palette
      const updateData = {
        doctor_full_name: doctor.doctorFullName,
        last_name: doctor.lastName,
        slug: doctor.slug,
        primary_specialty: doctor.primarySpecialty,
        subspecialties: doctor.subspecialties || [],
        cedula_profesional: doctor.cedulaProfesional || "",
        hero_image: doctor.heroImage,
        location_summary: doctor.locationSummary,
        city: doctor.city,
        services_list: (doctor.services || []).map((s: any) => ({
          service_name: s.serviceName,
          short_description: s.shortDescription,
          duration_minutes: s.durationMinutes,
          price: s.price,
        })),
        conditions: doctor.conditions || [],
        procedures: doctor.procedures || [],
        short_bio: doctor.shortBio,
        long_bio: doctor.longBio || "",
        years_experience: doctor.yearsExperience,
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
          address: doctor.clinicAddress,
          phone: doctor.clinicPhone,
          whatsapp: doctor.clinicWhatsapp || "",
          hours: doctor.clinicHours || {},
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
        appointment_modes: doctor.appointmentModes || [],
        next_available_date: doctor.nextAvailableDate
          ? new Date(doctor.nextAvailableDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        social_links: {
          linkedin: doctor.socialLinkedin,
          twitter: doctor.socialTwitter,
        },
        color_palette: paletteId, // NEW PALETTE
      };

      const response = await authFetch(`${API_URL}/api/doctors/${selectedDoctor.slug}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update the local state
        setDoctors((prev) =>
          prev.map((d) =>
            d.slug === selectedDoctor.slug ? { ...d, colorPalette: paletteId } : d
          )
        );
        alert(`✅ Paleta actualizada a "${paletteId}" exitosamente!`);
        handleClosePaletteModal();
      } else {
        throw new Error(result.error || "Failed to update palette");
      }
    } catch (err) {
      console.error("Error updating palette:", err);
      alert(`❌ Error al actualizar la paleta: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdatingPalette(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Doctores Registrados
              </h1>
              <p className="text-gray-600">
                {loading ? "Cargando..." : `${doctors.length} doctores encontrados`}
              </p>
            </div>
            <Link
              href="/doctors/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              + Crear Nuevo
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Cargando doctores...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800">{error}</p>
              <button
                onClick={fetchDoctors}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && doctors.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">No hay doctores</h3>
              <p className="mt-1 text-gray-500">Comienza creando tu primer doctor.</p>
              <Link
                href="/doctors/new"
                className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                Crear Primer Doctor
              </Link>
            </div>
          )}

          {!loading && !error && doctors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Doctor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Especialidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ciudad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paleta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Creación
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {doctors.map((doctor) => (
                    <tr key={doctor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={doctor.heroImage}
                            alt={doctor.doctorFullName}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {doctor.doctorFullName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {doctor.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{doctor.primarySpecialty}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{doctor.city}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenPaletteModal(doctor)}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition"
                        >
                          <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: '#F59E0B' }} />
                          {doctor.colorPalette || 'warm'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(doctor.createdAt).toLocaleDateString('es-MX')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a
                          href={`${PUBLIC_URL}/doctors/${doctor.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          Ver Perfil
                        </a>
                        <button
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => router.push(`/doctors/${doctor.slug}/edit`)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Palette Modal */}
        {paletteModalOpen && selectedDoctor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Cambiar Paleta de Colores
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedDoctor.doctorFullName} - {selectedDoctor.primarySpecialty}
                    </p>
                  </div>
                  <button
                    onClick={handleClosePaletteModal}
                    disabled={updatingPalette}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {updatingPalette ? (
                  <div className="py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Actualizando paleta...</p>
                  </div>
                ) : (
                  <ColorPaletteSelector
                    currentPaletteId={selectedDoctor.colorPalette || 'warm'}
                    onSelect={handleUpdatePalette}
                    isModal={true}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
