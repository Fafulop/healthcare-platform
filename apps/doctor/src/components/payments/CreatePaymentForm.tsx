"use client";

import { useState } from "react";
import { Loader2, Link as LinkIcon } from "lucide-react";

interface CreatePaymentFormProps {
  onSubmit: (amount: number, description: string, patientEmail?: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel?: string;
  hint?: string;
  showEmailField?: boolean;
}

export function CreatePaymentForm({
  onSubmit,
  onCancel,
  loading,
  submitLabel = "Crear link de pago",
  hint = "Cada link solo puede usarse una vez.",
  showEmailField = false,
}: CreatePaymentFormProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [patientEmail, setPatientEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed < 10) return;
    await onSubmit(parsed, description, patientEmail || undefined);
    setAmount("");
    setDescription("");
    setPatientEmail("");
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Monto (MXN) *
        </label>
        <input
          type="number"
          step="0.01"
          min="10"
          max="100000"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="500.00"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripcion (opcional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Consulta general"
          maxLength={200}
        />
      </div>
      {showEmailField && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email del paciente (opcional)
          </label>
          <input
            type="email"
            value={patientEmail}
            onChange={(e) => setPatientEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="paciente@email.com"
          />
          <p className="text-xs text-gray-400 mt-1">Mejora la tasa de aprobacion del pago</p>
        </div>
      )}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
          {loading ? "Creando..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
