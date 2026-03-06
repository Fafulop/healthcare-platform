"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ArrowLeft, Save, Loader2, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { VoiceRecordingModal } from "@/components/voice-assistant/VoiceRecordingModal";
import { VoiceChatSidebar } from "@/components/voice-assistant/chat/VoiceChatSidebar";
import { LedgerChatPanel } from "@/components/practice/LedgerChatPanel";
import { useNewLedgerEntry } from "../_components/useNewLedgerEntry";

export default function NewFlujoDeDineroPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/login"); },
  });

  const {
    doctorId,
    formData,
    submitting,
    error,
    loadingAreas,
    filteredAreas,
    availableSubareas,
    voiceModalOpen, setVoiceModalOpen,
    voiceSidebarOpen, setVoiceSidebarOpen,
    sidebarInitialData, clearSidebarInitialData,
    chatPanelOpen, setChatPanelOpen,
    accumulatedEntries,
    handleChange,
    handleSubmit,
    handleChatEntryUpdates,
    handleChatBatchCreate,
    handleVoiceModalComplete,
    handleVoiceConfirm,
  } = useNewLedgerEntry();

  if (status === "loading" || loadingAreas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="inline-block h-10 w-10 animate-spin text-blue-600" />
          <p className="mt-3 text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-3 sm:mb-6">
        <Link
          href="/dashboard/practice/flujo-de-dinero"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Flujo de Dinero
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nuevo Movimiento</h1>
            <p className="text-gray-600 mt-0.5 text-sm sm:text-base">Registra un nuevo ingreso o egreso</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChatPanelOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Chat IA
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-3 sm:mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Entry Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Movimiento *
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
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
                <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${formData.entryType === 'ingreso' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`font-medium text-sm sm:text-base ${formData.entryType === 'ingreso' ? 'text-blue-900' : 'text-gray-600'}`}>
                  Ingreso
                </span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
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
                <TrendingDown className={`w-4 h-4 sm:w-5 sm:h-5 ${formData.entryType === 'egreso' ? 'text-red-600' : 'text-gray-400'}`} />
                <span className={`font-medium text-sm sm:text-base ${formData.entryType === 'egreso' ? 'text-red-900' : 'text-gray-600'}`}>
                  Egreso
                </span>
              </label>
            </div>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Monto (MXN) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
                  $
                </span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fecha *
              </label>
              <input
                type="date"
                name="transactionDate"
                value={formData.transactionDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
              />
            </div>
          </div>

          {/* Concept */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Concepto
            </label>
            <textarea
              name="concept"
              value={formData.concept}
              onChange={handleChange}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Descripción del movimiento (opcional)..."
            />
            <p className="text-xs text-gray-400 mt-0.5">
              {formData.concept.length}/500
            </p>
          </div>

          {/* Area and Subarea */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Área
              </label>
              <select
                name="area"
                value={formData.area}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Subárea
              </label>
              <select
                name="subarea"
                value={formData.subarea}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cuenta Bancaria
              </label>
              <input
                type="text"
                name="bankAccount"
                value={formData.bankAccount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Ej: BBVA Empresarial"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Forma de Pago *
              </label>
              <select
                name="formaDePago"
                value={formData.formaDePago}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado de Pago *
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
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
                <span className={`font-medium text-sm ${formData.paymentOption === 'paid' ? 'text-blue-900' : 'text-gray-600'}`}>
                  {formData.entryType === 'ingreso' ? 'Cobrado' : 'Pagado'}
                </span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
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
                <span className={`font-medium text-sm ${formData.paymentOption === 'pending' ? 'text-orange-900' : 'text-gray-600'}`}>
                  {formData.entryType === 'ingreso' ? 'Por Cobrar' : 'Por Pagar'}
                </span>
              </label>
            </div>
          </div>

          {/* Bank Movement ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ID de Movimiento Bancario
            </label>
            <input
              type="text"
              name="bankMovementId"
              value={formData.bankMovementId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Ej: REF123456"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard/practice/flujo-de-dinero"
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-center text-sm"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar
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
      {doctorId && (
        <VoiceChatSidebar
          isOpen={voiceSidebarOpen}
          onClose={() => {
            setVoiceSidebarOpen(false);
            clearSidebarInitialData();
          }}
          sessionType="CREATE_LEDGER_ENTRY"
          patientId="ledger"
          doctorId={doctorId}
          onConfirm={handleVoiceConfirm}
          initialData={sidebarInitialData}
        />
      )}

      {/* Ledger Chat IA Panel */}
      {chatPanelOpen && (
        <LedgerChatPanel
          onClose={() => setChatPanelOpen(false)}
          accumulatedEntries={accumulatedEntries}
          onUpdateEntries={handleChatEntryUpdates}
          onCreateBatch={handleChatBatchCreate}
        />
      )}
    </div>
  );
}
