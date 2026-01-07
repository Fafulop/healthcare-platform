"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Area {
  id: number;
  name: string;
  subareas: Subarea[];
}

interface Subarea {
  id: number;
  name: string;
}

export default function NewFlujoDeDineroPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

  const [formData, setFormData] = useState({
    entryType: "ingreso" as "ingreso" | "egreso",
    amount: "",
    concept: "",
    transactionDate: new Date().toISOString().split('T')[0],
    area: "",
    subarea: "",
    bankAccount: "",
    formaDePago: "efectivo",
    bankMovementId: "",
    porRealizar: false
  });

  useEffect(() => {
    if (session?.user?.email) {
      fetchAreas();
    }
  }, [session]);

  const fetchAreas = async () => {
    if (!session?.user?.email) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/areas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar áreas');
      const result = await response.json();
      setAreas(result.data || []);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));

    // Reset subarea when area changes
    if (name === 'area') {
      setFormData(prev => ({ ...prev, subarea: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    // Validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    if (!formData.concept.trim()) {
      setError('El concepto es requerido');
      return;
    }

    if (!formData.area || !formData.subarea) {
      setError('Seleccione un área y subárea');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/ledger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear movimiento');
      }

      router.push('/dashboard/practice/flujo-de-dinero');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedArea = areas.find(a => a.name === formData.area);
  const availableSubareas = selectedArea?.subareas || [];

  if (status === "loading" || loadingAreas) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard/practice/flujo-de-dinero"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Flujo de Dinero
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Movimiento</h1>
          <p className="text-gray-600 mt-1">Registra un nuevo ingreso o egreso</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {/* Entry Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Movimiento *
              </label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.entryType === 'ingreso'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="entryType"
                    value="ingreso"
                    checked={formData.entryType === 'ingreso'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <TrendingUp className={`w-5 h-5 ${formData.entryType === 'ingreso' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${formData.entryType === 'ingreso' ? 'text-green-900' : 'text-gray-600'}`}>
                    Ingreso
                  </span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.entryType === 'egreso'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="entryType"
                    value="egreso"
                    checked={formData.entryType === 'egreso'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <TrendingDown className={`w-5 h-5 ${formData.entryType === 'egreso' ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${formData.entryType === 'egreso' ? 'text-red-900' : 'text-gray-600'}`}>
                    Egreso
                  </span>
                </label>
              </div>
            </div>

            {/* Amount and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto (MXN) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    $
                  </span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Transacción *
                </label>
                <input
                  type="date"
                  name="transactionDate"
                  value={formData.transactionDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Concept */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Concepto *
              </label>
              <textarea
                name="concept"
                value={formData.concept}
                onChange={handleChange}
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Descripción del movimiento..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.concept.length}/500 caracteres
              </p>
            </div>

            {/* Area and Subarea */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área *
                </label>
                <select
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccione un área</option>
                  {areas.map(area => (
                    <option key={area.id} value={area.name}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subárea *
                </label>
                <select
                  name="subarea"
                  value={formData.subarea}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={!formData.area}
                  required
                >
                  <option value="">Seleccione una subárea</option>
                  {availableSubareas.map(subarea => (
                    <option key={subarea.id} value={subarea.name}>
                      {subarea.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bank and Payment Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cuenta Bancaria
                </label>
                <input
                  type="text"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ej: BBVA Empresarial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pago *
                </label>
                <select
                  name="formaDePago"
                  value={formData.formaDePago}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="cheque">Cheque</option>
                  <option value="deposito">Depósito</option>
                </select>
              </div>
            </div>

            {/* Bank Movement ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID de Movimiento Bancario
              </label>
              <input
                type="text"
                name="bankMovementId"
                value={formData.bankMovementId}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ej: REF123456"
              />
            </div>

            {/* Por Realizar */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="porRealizar"
                name="porRealizar"
                checked={formData.porRealizar}
                onChange={handleChange}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="porRealizar" className="ml-2 block text-sm text-gray-700">
                Marcar como <strong>Por Realizar</strong> (transacción pendiente que no afecta el balance actual)
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Link
                href="/dashboard/practice/flujo-de-dinero"
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-center"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar Movimiento
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
