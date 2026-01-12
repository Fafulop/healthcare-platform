"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Loader2, FolderTree, ChevronDown, ChevronRight, ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";

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
  }, [session]);

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
      // Generate auth token
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/areas`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

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
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const url = editingArea
        ? `${API_URL}/api/practice-management/areas/${editingArea.id}`
        : `${API_URL}/api/practice-management/areas`;

      const payload = {
        name: areaName,
        description: areaDescription || null,
        type: areaType
      };

      console.log('Saving area with payload:', payload);

      const response = await fetch(url, {
        method: editingArea ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const url = editingSubarea
        ? `${API_URL}/api/practice-management/areas/${selectedAreaForSubarea.id}/subareas/${editingSubarea.subarea.id}`
        : `${API_URL}/api/practice-management/areas/${selectedAreaForSubarea.id}/subareas`;

      const response = await fetch(url, {
        method: editingSubarea ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
    if (!confirm(`Are you sure you want to delete "${area.name}"? This will also delete all subareas.`)) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/areas/${area.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete area');
      }

      await fetchAreas();
    } catch (err) {
      console.error('Error deleting area:', err);
      alert('Failed to delete area');
    }
  };

  const handleDeleteSubarea = async (area: Area, subarea: Subarea) => {
    if (!session?.user?.email) return;
    if (!confirm(`Are you sure you want to delete "${subarea.name}"?`)) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(
        `${API_URL}/api/practice-management/areas/${area.id}/subareas/${subarea.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete subarea');
      }

      await fetchAreas();
    } catch (err) {
      console.error('Error deleting subarea:', err);
      alert('Failed to delete subarea');
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar doctorProfile={doctorProfile} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <FolderTree className="w-8 h-8 text-blue-600" />
                Areas & Subareas
              </h1>
              <p className="text-gray-600 mt-2">
                Organize your practice management with hierarchical categories
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/practice/flujo-de-dinero"
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <DollarSign className="w-5 h-5" />
                Flujo de Dinero
              </Link>
              <button
                onClick={() => openAreaModal('INGRESO')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nueva Área Ingresos
              </button>
              <button
                onClick={() => openAreaModal('EGRESO')}
                className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nueva Área Egresos
              </button>
            </div>
          </div>
        </div>

        {/* Areas List */}
        <div className="space-y-6">
          {/* INGRESOS Section */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                ÁREAS DE INGRESOS
              </h2>
            </div>
            <div className="p-6">
              {areas.filter(a => a.type === 'INGRESO').length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay áreas de ingresos</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Crea tu primera área de ingresos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {areas.filter(a => a.type === 'INGRESO').map((area) => (
                <div key={area.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Area Header */}
                  <div className="bg-blue-50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleArea(area.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {expandedAreas.has(area.id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{area.name}</h3>
                        {area.description && (
                          <p className="text-sm text-gray-600 mt-1">{area.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {area.subareas.length} subarea{area.subareas.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openSubareaModal(area)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Add subarea"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openAreaModal(area.type, area)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit area"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArea(area)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete area"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subareas */}
                  {expandedAreas.has(area.id) && area.subareas.length > 0 && (
                    <div className="bg-white p-4 pl-12 space-y-2">
                      {area.subareas.map((subarea) => (
                        <div
                          key={subarea.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{subarea.name}</p>
                            {subarea.description && (
                              <p className="text-sm text-gray-600 mt-1">{subarea.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openSubareaModal(area, subarea)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Edit subarea"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubarea(area, subarea)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete subarea"
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingDown className="w-6 h-6" />
                ÁREAS DE EGRESOS
              </h2>
            </div>
            <div className="p-6">
              {areas.filter(a => a.type === 'EGRESO').length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No hay áreas de egresos</p>
                  <p className="text-gray-400 text-sm mt-2">
                    Crea tu primera área de egresos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {areas.filter(a => a.type === 'EGRESO').map((area) => (
                <div key={area.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Area Header */}
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleArea(area.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {expandedAreas.has(area.id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{area.name}</h3>
                        {area.description && (
                          <p className="text-sm text-gray-600 mt-1">{area.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {area.subareas.length} subarea{area.subareas.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openSubareaModal(area)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Add subarea"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openAreaModal(area.type, area)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit area"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteArea(area)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete area"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subareas */}
                  {expandedAreas.has(area.id) && area.subareas.length > 0 && (
                    <div className="bg-white p-4 pl-12 space-y-2">
                      {area.subareas.map((subarea) => (
                        <div
                          key={subarea.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{subarea.name}</p>
                            {subarea.description && (
                              <p className="text-sm text-gray-600 mt-1">{subarea.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openSubareaModal(area, subarea)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Edit subarea"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubarea(area, subarea)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete subarea"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className={`p-6 border-b border-gray-200 ${areaType === 'INGRESO' ? 'bg-blue-50' : 'bg-red-50'}`}>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingArea ? 'Editar Área' : `Nueva Área ${areaType === 'INGRESO' ? 'Ingresos' : 'Egresos'}`}
                </h2>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    areaType === 'INGRESO'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {areaType === 'INGRESO' ? '💰 INGRESO' : '💸 EGRESO'}
                  </span>
                </div>
              </div>
              <form onSubmit={handleSaveArea} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}
                {/* Hidden field to preserve type */}
                <input type="hidden" value={areaType} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Area Name *
                  </label>
                  <input
                    type="text"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Ventas, Gastos, Proyectos"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={areaDescription}
                    onChange={(e) => setAreaDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe this area..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Subarea Modal */}
        {showSubareaModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingSubarea ? 'Edit Subarea' : 'New Subarea'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Under: {selectedAreaForSubarea?.name}
                </p>
              </div>
              <form onSubmit={handleSaveSubarea} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subarea Name *
                  </label>
                  <input
                    type="text"
                    value={subareaName}
                    onChange={(e) => setSubareaName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Online, Tienda Física"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={subareaDescription}
                    onChange={(e) => setSubareaDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe this subarea..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
