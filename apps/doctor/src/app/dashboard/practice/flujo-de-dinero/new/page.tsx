"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, TrendingUp, TrendingDown, Mic } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { VoiceRecordingModal } from "@/components/voice-assistant/VoiceRecordingModal";
import { VoiceChatSidebar } from "@/components/voice-assistant/chat/VoiceChatSidebar";
import type { InitialChatData } from "@/hooks/useChatSession";
import type { VoiceStructuredData, VoiceLedgerEntryData, VoiceLedgerEntryBatch } from "@/types/voice-assistant";

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

export default function NewFlujoDeDineroPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

  const [formData, setFormData] = useState({
    entryType: "ingreso" as "ingreso" | "egreso",
    amount: "",
    concept: "",
    // Use local date (not UTC) to avoid timezone issues
    transactionDate: (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    area: "",
    subarea: "",
    bankAccount: "",
    formaDePago: "efectivo",
    bankMovementId: "",
    porRealizar: false,
    paymentOption: "paid" as "paid" | "pending", // New: default to paid
  });

  // Voice Assistant state
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);
  const [voiceFormData, setVoiceFormData] = useState<Partial<typeof formData> | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      if (session?.user?.doctorId) {
        fetchDoctorProfile(session.user.doctorId);
      }
      fetchAreas();
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

  // Voice Assistant: Convert voice data to form format
  const mapVoiceToFormData = (voiceData: VoiceLedgerEntryData): Partial<typeof formData> => {
    return {
      entryType: voiceData.entryType || undefined,
      amount: voiceData.amount !== null && voiceData.amount !== undefined ? String(voiceData.amount) : undefined,
      concept: voiceData.concept || undefined,
      transactionDate: voiceData.transactionDate || undefined,
      area: voiceData.area || undefined,
      subarea: voiceData.subarea || undefined,
      bankAccount: voiceData.bankAccount || undefined,
      formaDePago: voiceData.formaDePago || undefined,
      bankMovementId: voiceData.bankMovementId || undefined
    };
  };

  // Voice Assistant: Handle recording modal completion
  const handleVoiceModalComplete = (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const ledgerData = data as VoiceLedgerEntryData;

    // Calculate extracted fields
    const allFields = Object.keys(ledgerData);
    const extracted = allFields.filter(k => {
      const val = ledgerData[k as keyof VoiceLedgerEntryData];
      return val != null && val !== '' && !(Array.isArray(val) && val.length === 0);
    });

    // Prepare initial data for sidebar
    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      sessionId,
      transcriptId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    setSidebarInitialData(initialData);
    setVoiceModalOpen(false);
    setVoiceSidebarOpen(true);
  };

  // Voice Assistant: Handle confirmation from chat sidebar
  const handleVoiceConfirm = async (data: VoiceStructuredData) => {
    // Check if this is a batch of entries
    const batchData = data as VoiceLedgerEntryBatch;
    if (batchData.isBatch && batchData.entries) {
      // Handle batch creation - create all entries sequentially
      await handleBatchEntryCreation(batchData.entries);
      return;
    }

    // Single entry - populate form as usual
    const ledgerData = data as VoiceLedgerEntryData;
    const mappedData = mapVoiceToFormData(ledgerData);
    setVoiceFormData(mappedData);
    setVoiceSidebarOpen(false);
    setSidebarInitialData(undefined); // Clear after confirmation
  };

  // Load voice data from sessionStorage (hub widget flow)
  // Handles both single entries (pre-fill form) and batch (direct API creation)
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceLedgerData');
      if (stored) {
        try {
          const { data } = JSON.parse(stored);
          sessionStorage.removeItem('voiceLedgerData');
          handleVoiceConfirm(data);
        } catch (e) {
          console.error('Error parsing voice ledger data:', e);
        }
      }
    }
  }, [searchParams]);

  // Voice Assistant: Handle batch entry creation
  const handleBatchEntryCreation = async (entries: VoiceLedgerEntryData[]) => {
    if (!session?.user?.email) return;

    setSubmitting(true);
    setError(null);

    try {
      let successCount = 0;
      const errors: string[] = [];

      // Create each entry sequentially
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        try {
          const response = await authFetch(`${API_URL}/api/practice-management/ledger`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...entry,
              amount: entry.amount || 0,
              amountPaid: entry.amountPaid || 0,
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            errors.push(`Movimiento ${i + 1}: ${errorData.error || 'Error'}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          errors.push(`Movimiento ${i + 1}: ${err.message}`);
        }
      }

      // Close sidebar
      setVoiceSidebarOpen(false);
      setSidebarInitialData(undefined);

      // Show results and redirect
      if (successCount === entries.length) {
        // All successful - redirect to list
        router.push('/dashboard/practice/flujo-de-dinero?success=batch&count=' + successCount);
      } else if (successCount > 0) {
        // Partial success
        setError(`Se crearon ${successCount} de ${entries.length} movimientos. Errores: ${errors.join(', ')}`);
      } else {
        // All failed
        setError(`No se pudo crear ningún movimiento: ${errors.join(', ')}`);
      }
    } catch (err: any) {
      setError('Error al crear movimientos: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Voice Assistant: Apply voice data to form when confirmed
  useEffect(() => {
    if (voiceFormData) {
      setFormData((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(voiceFormData).filter(([_, v]) => v !== undefined)
        ),
      }));
      setVoiceFormData(null); // Clear after applying
    }
  }, [voiceFormData]);

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

    // Reset area/subarea when entryType changes
    if (name === 'entryType') {
      setFormData(prev => ({
        ...prev,
        area: '',
        subarea: ''
      }));
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

    // Area and subarea are now optional - no validation needed

    setSubmitting(true);
    setError(null);

    try {
      const amount = parseFloat(formData.amount);
      const amountPaid = formData.paymentOption === 'paid' ? amount : 0;
      const paymentStatus = formData.paymentOption === 'paid' ? 'PAID' : 'PENDING';

      const response = await authFetch(`${API_URL}/api/practice-management/ledger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          amount: amount,
          amountPaid: amountPaid,
          paymentStatus: paymentStatus
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
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
          <Link
            href="/dashboard/practice/flujo-de-dinero"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Flujo de Dinero
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nuevo Movimiento</h1>
              <p className="text-gray-600 mt-1">Registra un nuevo ingreso o egreso</p>
            </div>
            <button
              type="button"
              onClick={() => setVoiceModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Asistente de Voz
            </button>
          </div>
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

            {/* Area and Subarea */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Área
                </label>
                <select
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  Subárea
                </label>
                <select
                  name="subarea"
                  value={formData.subarea}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!formData.area}
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

            {/* Payment Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Estado de Pago *
              </label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.paymentOption === 'paid'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentOption"
                    value="paid"
                    checked={formData.paymentOption === 'paid'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className={`font-medium ${formData.paymentOption === 'paid' ? 'text-blue-900' : 'text-gray-600'}`}>
                    {formData.entryType === 'ingreso' ? 'Cobrado' : 'Pagado'}
                  </span>
                </label>
                <label className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.paymentOption === 'pending'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="paymentOption"
                    value="pending"
                    checked={formData.paymentOption === 'pending'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className={`font-medium ${formData.paymentOption === 'pending' ? 'text-orange-900' : 'text-gray-600'}`}>
                    {formData.entryType === 'ingreso' ? 'Por Cobrar' : 'Por Pagar'}
                  </span>
                </label>
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

      {/* Voice Recording Modal */}
      <VoiceRecordingModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        sessionType="CREATE_LEDGER_ENTRY"
        onComplete={handleVoiceModalComplete}
      />

      {/* Voice Chat Sidebar */}
      {session?.user?.doctorId && (
        <VoiceChatSidebar
          isOpen={voiceSidebarOpen}
          onClose={() => {
            setVoiceSidebarOpen(false);
            setSidebarInitialData(undefined);
          }}
          sessionType="CREATE_LEDGER_ENTRY"
          patientId="ledger" // Use a special ID for ledger entry context
          doctorId={session.user.doctorId}
          onConfirm={handleVoiceConfirm}
          initialData={sidebarInitialData}
        />
      )}
    </div>
  );
}
