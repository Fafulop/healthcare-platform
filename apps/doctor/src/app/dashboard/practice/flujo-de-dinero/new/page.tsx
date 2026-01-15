"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Area {
  id: number;
  name: string;
  type: 'INGRESO' | 'EGRESO';
  subareas: Subarea[];
}

interface Subarea {
  id: number;
  name: string;
}

interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
}

interface Supplier {
  id: number;
  businessName: string;
  contactName: string | null;
}

export default function NewFlujoDeDineroPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

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
    porRealizar: false,
    transactionType: "N/A" as "N/A" | "COMPRA" | "VENTA",
    clientId: "",
    supplierId: "",
    paymentStatus: "PENDING" as "PENDING" | "PARTIAL" | "PAID",
    amountPaid: "0"
  });

  useEffect(() => {
    if (session?.user?.email) {
      if (session?.user?.doctorId) {
        fetchDoctorProfile(session.user.doctorId);
      }
      fetchAreas();
      fetchClients();
      fetchSuppliers();
    }
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

      if (!response.ok) throw new Error('Error al cargar áreas');
      const result = await response.json();
      setAreas(result.data || []);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    } finally {
      setLoadingAreas(false);
    }
  };

  const fetchClients = async () => {
    if (!session?.user?.email) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/clients`);

      if (!response.ok) throw new Error('Error al cargar clientes');
      const result = await response.json();
      setClients(result.data || []);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchSuppliers = async () => {
    if (!session?.user?.email) return;

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/proveedores`);

      if (!response.ok) throw new Error('Error al cargar proveedores');
      const result = await response.json();
      setSuppliers(result.data || []);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setLoadingSuppliers(false);
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

    // Reset transactionType when entryType changes to prevent invalid combinations
    if (name === 'entryType') {
      setFormData(prev => ({
        ...prev,
        area: '',
        subarea: '',
        transactionType: 'N/A',
        clientId: '',
        supplierId: '',
        paymentStatus: 'PENDING',
        amountPaid: '0'
      }));
    }

    // Reset client/supplier when transactionType changes
    if (name === 'transactionType') {
      setFormData(prev => ({
        ...prev,
        clientId: '',
        supplierId: '',
        paymentStatus: 'PENDING',
        amountPaid: '0'
      }));
    }

    // Auto-set amountPaid based on paymentStatus
    if (name === 'paymentStatus') {
      setFormData(prev => {
        const newData = { ...prev, paymentStatus: value as 'PENDING' | 'PARTIAL' | 'PAID' };

        if (value === 'PENDING') {
          newData.amountPaid = '0';
        } else if (value === 'PAID') {
          newData.amountPaid = prev.amount || '0';
        }
        // For PARTIAL, keep the current amountPaid value

        return newData;
      });
    }

    // When amount changes and status is PAID, update amountPaid to match
    if (name === 'amount') {
      setFormData(prev => {
        const newData = { ...prev, amount: value };
        if (prev.paymentStatus === 'PAID') {
          newData.amountPaid = value || '0';
        }
        return newData;
      });
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

    if (!formData.area || !formData.subarea) {
      setError('Seleccione un área y subárea');
      return;
    }

    // Validate transaction type fields
    if (formData.transactionType === 'VENTA') {
      if (!formData.clientId) {
        setError('Debe seleccionar un cliente para ventas');
        return;
      }
      if (!formData.paymentStatus) {
        setError('Debe seleccionar un estado de pago para ventas');
        return;
      }
    }

    if (formData.transactionType === 'COMPRA') {
      if (!formData.supplierId) {
        setError('Debe seleccionar un proveedor para compras');
        return;
      }
      if (!formData.paymentStatus) {
        setError('Debe seleccionar un estado de pago para compras');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          amountPaid: formData.amountPaid ? parseFloat(formData.amountPaid) : 0
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

  // Filter areas based on entry type
  const filteredAreas = areas.filter(a =>
    formData.entryType === 'ingreso' ? a.type === 'INGRESO' : a.type === 'EGRESO'
  );

  const selectedArea = filteredAreas.find(a => a.name === formData.area);
  const availableSubareas = selectedArea?.subareas || [];

  if (status === "loading" || loadingAreas) {
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
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Entry Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Movimiento *
              </label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.entryType === 'ingreso'
                    ? 'border-blue-500 bg-blue-50'
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
                  <TrendingUp className={`w-5 h-5 ${formData.entryType === 'ingreso' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${formData.entryType === 'ingreso' ? 'text-blue-900' : 'text-gray-600'}`}>
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
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Concept */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Concepto
              </label>
              <textarea
                name="concept"
                value={formData.concept}
                onChange={handleChange}
                rows={3}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descripción del movimiento (opcional)..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.concept.length}/500 caracteres
              </p>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Transacción *
              </label>
              <select
                name="transactionType"
                value={formData.transactionType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="N/A">N/A (No aplica)</option>
                {formData.entryType === 'egreso' && (
                  <option value="COMPRA">Compra</option>
                )}
                {formData.entryType === 'ingreso' && (
                  <option value="VENTA">Venta</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.entryType === 'ingreso'
                  ? 'Para ingresos: seleccione N/A o Venta'
                  : 'Para egresos: seleccione N/A o Compra'
                }
              </p>
            </div>

            {/* Conditional Cliente field - shows only when VENTA */}
            {formData.transactionType === 'VENTA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <select
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={loadingClients}
                >
                  <option value="">Seleccione un cliente</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.businessName}
                      {client.contactName ? ` - ${client.contactName}` : ''}
                    </option>
                  ))}
                </select>
                {loadingClients && (
                  <p className="text-xs text-gray-500 mt-1">Cargando clientes...</p>
                )}
              </div>
            )}

            {/* Conditional Proveedor field - shows only when COMPRA */}
            {formData.transactionType === 'COMPRA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor *
                </label>
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={loadingSuppliers}
                >
                  <option value="">Seleccione un proveedor</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.businessName}
                      {supplier.contactName ? ` - ${supplier.contactName}` : ''}
                    </option>
                  ))}
                </select>
                {loadingSuppliers && (
                  <p className="text-xs text-gray-500 mt-1">Cargando proveedores...</p>
                )}
              </div>
            )}

            {/* Conditional Estado de Pago field - shows when COMPRA or VENTA */}
            {(formData.transactionType === 'COMPRA' || formData.transactionType === 'VENTA') && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado de Pago *
                    </label>
                    <select
                      name="paymentStatus"
                      value={formData.paymentStatus}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="PENDING">Pendiente</option>
                      <option value="PARTIAL">Pago Parcial</option>
                      <option value="PAID">Pagado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto Pagado {formData.paymentStatus === 'PAID' && '(Auto)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        $
                      </span>
                      <input
                        type="number"
                        name="amountPaid"
                        value={formData.amountPaid}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        max={formData.amount ? parseFloat(formData.amount) : undefined}
                        disabled={formData.paymentStatus === 'PENDING' || formData.paymentStatus === 'PAID'}
                        className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formData.paymentStatus === 'PENDING' || formData.paymentStatus === 'PAID'
                            ? 'bg-gray-100 cursor-not-allowed text-gray-500'
                            : ''
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.paymentStatus === 'PENDING' && '⚠️ Pendiente: Monto pagado es $0'}
                      {formData.paymentStatus === 'PAID' && formData.amount && `✓ Pagado: Igualado al total ($${parseFloat(formData.amount).toFixed(2)})`}
                      {formData.paymentStatus === 'PARTIAL' && formData.amount && `Ingrese el monto pagado (Total: $${parseFloat(formData.amount).toFixed(2)})`}
                      {!formData.amount && 'Ingrese el monto total primero'}
                    </p>
                  </div>
                </div>
              </>
            )}

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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccione un área</option>
                  {filteredAreas.map(area => (
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: REF123456"
              />
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
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </main>
    </div>
  );
}
