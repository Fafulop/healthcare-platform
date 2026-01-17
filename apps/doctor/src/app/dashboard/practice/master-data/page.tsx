"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, Loader2, Database, ChevronDown, ChevronRight, ArrowLeft, DollarSign } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface AttributeValue {
  id: number;
  value: string;
  description: string | null;
  cost: string | null;
  unit: string | null;
  order: number;
  isActive: boolean;
}

interface Attribute {
  id: number;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
  values: AttributeValue[];
}

export default function MasterDataPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAttributes, setExpandedAttributes] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null);
  const [editingValue, setEditingValue] = useState<{ attribute: Attribute; value: AttributeValue } | null>(null);
  const [selectedAttributeForValue, setSelectedAttributeForValue] = useState<Attribute | null>(null);

  // Form states
  const [attributeName, setAttributeName] = useState("");
  const [attributeDescription, setAttributeDescription] = useState("");
  const [valueName, setValueName] = useState("");
  const [valueDescription, setValueDescription] = useState("");
  const [valueCost, setValueCost] = useState("");
  const [valueUnit, setValueUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
    fetchAttributes();
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

  const fetchAttributes = async () => {
    if (!session?.user?.email) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/product-attributes`);

      if (!response.ok) throw new Error('Failed to fetch attributes');

      const result = await response.json();
      setAttributes(result.data || []);
    } catch (err: any) {
      console.error('Error fetching attributes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttribute = (id: number) => {
    const newExpanded = new Set(expandedAttributes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAttributes(newExpanded);
  };

  const openAttributeModal = (attribute?: Attribute) => {
    setEditingAttribute(attribute || null);
    setAttributeName(attribute?.name || "");
    setAttributeDescription(attribute?.description || "");
    setShowAttributeModal(true);
    setError(null);
  };

  const openValueModal = (attribute: Attribute, value?: AttributeValue) => {
    setSelectedAttributeForValue(attribute);
    setEditingValue(value ? { attribute, value } : null);
    setValueName(value?.value || "");
    setValueDescription(value?.description || "");
    setValueCost(value?.cost || "");
    setValueUnit(value?.unit || "");
    setShowValueModal(true);
    setError(null);
  };

  const closeModals = () => {
    setShowAttributeModal(false);
    setShowValueModal(false);
    setEditingAttribute(null);
    setEditingValue(null);
    setSelectedAttributeForValue(null);
    setAttributeName("");
    setAttributeDescription("");
    setValueName("");
    setValueDescription("");
    setValueCost("");
    setValueUnit("");
    setError(null);
  };

  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    setSubmitting(true);
    setError(null);

    try {
      const url = editingAttribute
        ? `${API_URL}/api/practice-management/product-attributes/${editingAttribute.id}`
        : `${API_URL}/api/practice-management/product-attributes`;

      const response = await authFetch(url, {
        method: editingAttribute ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: attributeName,
          description: attributeDescription || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save attribute');
      }

      await fetchAttributes();
      closeModals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email || !selectedAttributeForValue) return;

    setSubmitting(true);
    setError(null);

    try {
      const url = editingValue
        ? `${API_URL}/api/practice-management/product-attributes/${selectedAttributeForValue.id}/values/${editingValue.value.id}`
        : `${API_URL}/api/practice-management/product-attributes/${selectedAttributeForValue.id}/values`;

      const response = await authFetch(url, {
        method: editingValue ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: valueName,
          description: valueDescription || null,
          cost: valueCost || null,
          unit: valueUnit || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save value');
      }

      await fetchAttributes();
      setExpandedAttributes(new Set([...expandedAttributes, selectedAttributeForValue.id]));
      closeModals();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAttribute = async (attribute: Attribute) => {
    if (!session?.user?.email) return;
    if (!confirm(`¿Eliminar "${attribute.name}"? Esto eliminará todos sus valores.`)) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/product-attributes/${attribute.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar atributo');
      await fetchAttributes();
    } catch (err) {
      console.error('Error deleting attribute:', err);
      alert('Error al eliminar atributo');
    }
  };

  const handleDeleteValue = async (attribute: Attribute, value: AttributeValue) => {
    if (!session?.user?.email) return;
    if (!confirm(`¿Eliminar "${value.value}"?`)) return;

    try {
      const response = await authFetch(
        `${API_URL}/api/practice-management/product-attributes/${attribute.id}/values/${value.id}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) throw new Error('Error al eliminar valor');
      await fetchAttributes();
    } catch (err) {
      console.error('Error deleting value:', err);
      alert('Error al eliminar valor');
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Panel
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="w-8 h-8 text-blue-600" />
                Datos Maestros
              </h1>
              <p className="text-gray-600 mt-2">
                Administra componentes y materiales reutilizables para tus productos
              </p>
            </div>
            <button
              onClick={() => openAttributeModal()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nueva Categoría
            </button>
          </div>
        </div>

        {/* Attributes List */}
        <div className="bg-white rounded-lg shadow p-6">
          {attributes.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Aún no hay categorías</p>
              <p className="text-gray-400 text-sm mt-2">
                Crea categorías como "Materias Primas", "Embalaje", etc.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attributes.map((attribute) => (
                <div key={attribute.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Attribute Header */}
                  <div className="bg-blue-50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleAttribute(attribute.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        {expandedAttributes.has(attribute.id) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{attribute.name}</h3>
                        {attribute.description && (
                          <p className="text-sm text-gray-600 mt-1">{attribute.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {attribute.values.length} item{attribute.values.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openValueModal(attribute)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Agregar elemento"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openAttributeModal(attribute)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Editar categoría"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAttribute(attribute)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Values */}
                  {expandedAttributes.has(attribute.id) && attribute.values.length > 0 && (
                    <div className="bg-white p-4 pl-12 space-y-2">
                      {attribute.values.map((value) => (
                        <div
                          key={value.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{value.value}</p>
                            {value.description && (
                              <p className="text-sm text-gray-600 mt-1">{value.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              {value.cost && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  ${value.cost}
                                </span>
                              )}
                              {value.unit && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  por {value.unit}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openValueModal(attribute, value)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                              title="Editar elemento"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteValue(attribute, value)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Eliminar elemento"
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

        {/* Attribute Modal */}
        {showAttributeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingAttribute ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
              </div>
              <form onSubmit={handleSaveAttribute} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre de Categoría *
                  </label>
                  <input
                    type="text"
                    value={attributeName}
                    onChange={(e) => setAttributeName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ej., Materias Primas, Embalaje"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={attributeDescription}
                    onChange={(e) => setAttributeDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Describe esta categoría..."
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    disabled={submitting}
                  >
                    {submitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Value Modal */}
        {showValueModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingValue ? 'Editar Elemento' : 'Nuevo Elemento'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Categoría: {selectedAttributeForValue?.name}
                </p>
              </div>
              <form onSubmit={handleSaveValue} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del Elemento *
                  </label>
                  <input
                    type="text"
                    value={valueName}
                    onChange={(e) => setValueName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ej., Harina (50kg), Caja Pequeña"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción (opcional)
                  </label>
                  <input
                    type="text"
                    value={valueDescription}
                    onChange={(e) => setValueDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Detalles adicionales..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Costo por Unidad
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={valueCost}
                      onChange={(e) => setValueCost(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="500.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unidad
                    </label>
                    <input
                      type="text"
                      value={valueUnit}
                      onChange={(e) => setValueUnit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="kg, pzs, litro"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
