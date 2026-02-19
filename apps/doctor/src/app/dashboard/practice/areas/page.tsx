"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Loader2, FolderTree, ChevronDown, ChevronRight, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Subarea {
  id: number;
  name: string;
  description: string | null;
}

interface Area {
  id: number;
  name: string;
  description: string | null;
  type: 'INGRESO' | 'EGRESO';
  subareas: Subarea[];
}

export default function AreasPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAreas, setExpandedAreas] = useState<Set<number>>(new Set());

  // Modal states
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showSubareaModal, setShowSubareaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingSubarea, setEditingSubarea] = useState<{ area: Area; subarea: Subarea } | null>(null);
  const [selectedAreaForSubarea, setSelectedAreaForSubarea] = useState<Area | null>(null);

  // Form states
  const [areaName, setAreaName] = useState("");
  const [areaDescription, setAreaDescription] = useState("");
  const [areaType, setAreaType] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [subareaName, setSubareaName] = useState("");
  const [subareaDescription, setSubareaDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
    fetchAreas();
  }, []);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const fetchAreas = async () => {
    if (!session?.user?.email) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/areas`);

      if (!response.ok) {
        throw new Error('Failed to fetch areas');
      }

      const result = await response.json();
      setAreas(result.data || []);
    } catch (err) {
      console.error('Error fetching areas:', err);
      setError('Failed to load areas');
    } finally {
      setLoading(false);
    }
  };

  const toggleArea = (areaId: number) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId);
    } else {
      newExpanded.add(areaId);
    }
    setExpandedAreas(newExpanded);
  };

  const openAreaModal = (type: 'INGRESO' | 'EGRESO', area?: Area) => {
    setEditingArea(area || null);
    setAreaName(area?.name || "");
    setAreaDescription(area?.description || "");
    setAreaType(area?.type || type);
    setShowAreaModal(true);
    setError(null);
  };

  const openSubareaModal = (area: Area, subarea?: Subarea) => {
    setSelectedAreaForSubarea(area);
    setEditingSubarea(subarea ? { area, subarea } : null);
    setSubareaName(subarea?.name || "");
    setSubareaDescription(subarea?.description || "");
    setShowSubareaModal(true);
    setError(null);
  };

  const closeModals = () => {
    setShowAreaModal(false);
    setShowSubareaModal(false);
    setEditingArea(null);
    setEditingSubarea(null);
    setSelectedAreaForSubarea(null);
    setAreaName("");
    setAreaDescription("");
    setAreaType('INGRESO');
    setSubareaName("");
    setSubareaDescription("");
    setError(null);
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setSubmitting(true);
    setError(null);

    try {
      const url = editingArea
        ? `${API_URL}/api/practice-management/areas/${editingArea.id}`
        : `${API_URL}/api/practice-management/areas`;

      const payload = {
        name: areaName,
        description: areaDescription || null,
        type: areaType
      };

      console.log('Saving area with payload:', payload);

      const response = await authFetch(url, {
        method: editingArea ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save area');
      }

      const result = await response.json();
      console.log('Area saved successfully:', result);

      await fetchAreas();
      closeModals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSubarea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email || !selectedAreaForSubarea) return;

    setSubmitting(true);
    setError(null);

    try {
      const url = editingSubarea
        ? `${API_URL}/api/practice-management/areas/${selectedAreaForSubarea.id}/subareas/${editingSubarea.subarea.id}`
        : `${API_URL}/api/practice-management/areas/${selectedAreaForSubarea.id}/subareas`;

      const response = await authFetch(url, {
        method: editingSubarea ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: subareaName,
          description: subareaDescription || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save subarea');
      }

      await fetchAreas();
      // Auto-expand the area after adding subarea
      setExpandedAreas(new Set([...expandedAreas, selectedAreaForSubarea.id]));
      closeModals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteArea = async (area: Area) => {
    if (!session?.user?.email) return;
    if (!confirm(`¿Estás seguro de eliminar "${area.name}"? Esto también eliminará todas las subáreas.`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/areas/${area.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Error al eliminar área');
      }

      await fetchAreas();
    } catch (err) {
      console.error('Error deleting area:', err);
      alert('Error al eliminar área');
    }
  };

  const handleDeleteSubarea = async (area: Area, subarea: Subarea) => {
    if (!session?.user?.email) return;
    if (!confirm(`¿Estás seguro de eliminar "${subarea.name}"?`)) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/practice-management/areas/${area.id}/subareas/${subarea.id}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Error al eliminar subárea');
      }

      await fetchAreas();
    } catch (err) {
      console.error('Error deleting subarea:', err);
      alert('Error al eliminar subárea');
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-slate-400" />
          <p className="mt-4 text-gray-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6">
          <Link
            href="/dashboard/practice/flujo-de-dinero"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-3 sm:mb-4 transition-colors text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Flujo de Dinero</span>
            <span className="sm:hidden">Volver</span>
          </Link>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                <FolderTree className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                Áreas y Subáreas
              </h1>
              <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
                Organiza la gestión de tu consultorio
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={() => openAreaModal('INGRESO')}
                className="flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-medium py-2 sm:py-2.5 px-4 sm:px-5 rounded-lg transition-colors text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Nueva Área de Ingresos</span>
                <span className="sm:hidden">+ Ingreso</span>
              </button>
              <button
                onClick={() => openAreaModal('EGRESO')}
                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium py-2 sm:py-2.5 px-4 sm:px-5 rounded-lg transition-colors text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Nueva Área de Egresos</span>
                <span className="sm:hidden">+ Egreso</span>
              </button>
            </div>
          </div>
        </div>

        {/* Areas List */}
        <div className="space-y-4 sm:space-y-6">
          {/* INGRESOS Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-teal-50 border-b border-teal-100 px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-base sm:text-lg font-semibold text-teal-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                <span className="hidden sm:inline">Áreas de Ingresos</span>
                <span className="sm:hidden">Ingresos</span>
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {areas.filter(a => a.type === 'INGRESO').length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-gray-400 text-sm sm:text-base">No hay áreas de ingresos</p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-2">
                    Crea tu primera área de ingresos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {areas.filter(a => a.type === 'INGRESO').map((area) => (
                <div key={area.id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* Area Header */}
                  <div className="bg-slate-50 p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleArea(area.id)}
                        className="text-teal-600 hover:text-teal-700 flex-shrink-0"
                      >
                        {expandedAreas.has(area.id) ? (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-800 text-sm sm:text-base truncate">{area.name}</h3>
                        {area.description && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">{area.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5 sm:mt-1">
                          {area.subareas.length} subarea{area.subareas.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => openSubareaModal(area)}
                        className="p-1.5 sm:p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Agregar subárea"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openAreaModal(area.type, area)}
                        className="p-1.5 sm:p-2 text-slate-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar área"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArea(area)}
                        className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar área"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subareas */}
                  {expandedAreas.has(area.id) && area.subareas.length > 0 && (
                    <div className="bg-white p-3 sm:p-4 pl-8 sm:pl-12 space-y-2">
                      {area.subareas.map((subarea) => (
                        <div
                          key={subarea.id}
                          className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-700 text-sm sm:text-base truncate">{subarea.name}</p>
                            {subarea.description && (
                              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">{subarea.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <button
                              onClick={() => openSubareaModal(area, subarea)}
                              className="p-1.5 sm:p-2 text-slate-500 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Editar subárea"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubarea(area, subarea)}
                              className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Eliminar subárea"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
            </div>
          </div>

          {/* EGRESOS Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-rose-50 border-b border-rose-100 px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-base sm:text-lg font-semibold text-rose-700 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
                <span className="hidden sm:inline">Áreas de Egresos</span>
                <span className="sm:hidden">Egresos</span>
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              {areas.filter(a => a.type === 'EGRESO').length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-gray-400 text-sm sm:text-base">No hay áreas de egresos</p>
                  <p className="text-gray-400 text-xs sm:text-sm mt-2">
                    Crea tu primera área de egresos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {areas.filter(a => a.type === 'EGRESO').map((area) => (
                <div key={area.id} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* Area Header */}
                  <div className="bg-rose-50/60 p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleArea(area.id)}
                        className="text-rose-500 hover:text-rose-600 flex-shrink-0"
                      >
                        {expandedAreas.has(area.id) ? (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-800 text-sm sm:text-base truncate">{area.name}</h3>
                        {area.description && (
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">{area.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5 sm:mt-1">
                          {area.subareas.length} subarea{area.subareas.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <button
                        onClick={() => openSubareaModal(area)}
                        className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Agregar subárea"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openAreaModal(area.type, area)}
                        className="p-1.5 sm:p-2 text-slate-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar área"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArea(area)}
                        className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar área"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subareas */}
                  {expandedAreas.has(area.id) && area.subareas.length > 0 && (
                    <div className="bg-white p-3 sm:p-4 pl-8 sm:pl-12 space-y-2">
                      {area.subareas.map((subarea) => (
                        <div
                          key={subarea.id}
                          className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-700 text-sm sm:text-base truncate">{subarea.name}</p>
                            {subarea.description && (
                              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 truncate">{subarea.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <button
                              onClick={() => openSubareaModal(area, subarea)}
                              className="p-1.5 sm:p-2 text-slate-500 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Editar subárea"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubarea(area, subarea)}
                              className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Eliminar subárea"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
            </div>
          </div>
        </div>

        {/* Area Modal */}
        {showAreaModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className={`p-4 sm:p-6 border-b border-gray-100 ${areaType === 'INGRESO' ? 'bg-teal-50' : 'bg-rose-50'}`}>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                  {editingArea ? 'Editar Área' : `Nueva Área de ${areaType === 'INGRESO' ? 'Ingresos' : 'Egresos'}`}
                </h2>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                    areaType === 'INGRESO'
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {areaType === 'INGRESO' ? 'Ingreso' : 'Egreso'}
                  </span>
                </div>
              </div>
              <form onSubmit={handleSaveArea} className="p-4 sm:p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <input type="hidden" value={areaType} />

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">
                    Nombre del Área *
                  </label>
                  <input
                    type="text"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 sm:px-4 py-2 focus:ring-2 focus:ring-slate-300 focus:border-transparent text-sm sm:text-base"
                    placeholder="ej., Ventas, Gastos, Proyectos"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={areaDescription}
                    onChange={(e) => setAreaDescription(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 sm:px-4 py-2 focus:ring-2 focus:ring-slate-300 focus:border-transparent text-sm sm:text-base"
                    rows={3}
                    placeholder="Describe esta área..."
                  />
                </div>
                <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-3 sm:px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm sm:text-base"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
                    disabled={submitting}
                  >
                    {submitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Subarea Modal */}
        {showSubareaModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6 border-b border-gray-100">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                  {editingSubarea ? 'Editar Subárea' : 'Nueva Subárea'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Bajo: {selectedAreaForSubarea?.name}
                </p>
              </div>
              <form onSubmit={handleSaveSubarea} className="p-4 sm:p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">
                    Nombre de Subárea *
                  </label>
                  <input
                    type="text"
                    value={subareaName}
                    onChange={(e) => setSubareaName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 sm:px-4 py-2 focus:ring-2 focus:ring-slate-300 focus:border-transparent text-sm sm:text-base"
                    placeholder="ej., Online, Tienda Física"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-600 mb-1.5 sm:mb-2">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={subareaDescription}
                    onChange={(e) => setSubareaDescription(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 sm:px-4 py-2 focus:ring-2 focus:ring-slate-300 focus:border-transparent text-sm sm:text-base"
                    rows={3}
                    placeholder="Describe esta subárea..."
                  />
                </div>
                <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-3 sm:px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm sm:text-base"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors disabled:opacity-50 text-sm sm:text-base"
                    disabled={submitting}
                  >
                    {submitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
