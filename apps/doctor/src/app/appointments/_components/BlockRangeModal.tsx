"use client";

import { useState } from "react";
import { X, Lock, Unlock, AlertTriangle, CheckCircle, Info, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Preview {
  toChange: number;
  alreadyInState: number;
  skipped: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onSuccess: () => void;
}

export function BlockRangeModal({ isOpen, onClose, doctorId, onSuccess }: Props) {
  const [action, setAction] = useState<"block" | "unblock">("block");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPreview(null);
    setError("");
  };

  const handleClose = () => {
    reset();
    setAction("block");
    setStartDate("");
    setEndDate("");
    setUseTimeRange(false);
    setStartTime("09:00");
    setEndTime("18:00");
    onClose();
  };

  const buildPayload = (dryRun: boolean) => ({
    doctorId,
    startDate,
    endDate,
    startTime: useTimeRange ? startTime : undefined,
    endTime: useTimeRange ? endTime : undefined,
    action,
    dryRun,
  });

  const handlePreview = async () => {
    if (!startDate || !endDate) {
      setError("Selecciona fecha de inicio y fin.");
      return;
    }
    if (startDate > endDate) {
      setError("La fecha de inicio debe ser anterior a la fecha de fin.");
      return;
    }
    if (useTimeRange && startTime >= endTime) {
      setError("La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }
    setError("");
    setLoadingPreview(true);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/slots/block-range`, {
        method: "POST",
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview);
      } else {
        setError(data.error || "Error al calcular vista previa.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/api/appointments/slots/block-range`, {
        method: "POST",
        body: JSON.stringify(buildPayload(false)),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
        handleClose();
      } else {
        setError(data.error || "Error al aplicar los cambios.");
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  const previewReady = preview !== null;
  const canApply = previewReady && preview.toChange > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Bloquear / Desbloquear periodo</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Action toggle */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Acción</p>
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => { setAction("block"); reset(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                  action === "block"
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Lock className="w-4 h-4" />
                Bloquear
              </button>
              <button
                onClick={() => { setAction("unblock"); reset(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                  action === "unblock"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Unlock className="w-4 h-4" />
                Desbloquear
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); reset(); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); reset(); }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Optional time range */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useTimeRange}
                onChange={(e) => { setUseTimeRange(e.target.checked); reset(); }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-600">Filtrar por horario (opcional)</span>
            </label>

            {useTimeRange && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => { setStartTime(e.target.value); reset(); }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => { setEndTime(e.target.value); reset(); }}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Preview button */}
          {!previewReady && (
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loadingPreview ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Calculando...</>
              ) : (
                "Ver vista previa"
              )}
            </button>
          )}

          {/* Preview results */}
          {previewReady && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Vista previa
              </p>

              {preview.toChange > 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{preview.toChange}</strong>{" "}
                    {action === "block" ? "slot(s) serán bloqueados" : "slot(s) serán desbloqueados"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>No hay slots que {action === "block" ? "bloquear" : "desbloquear"} en este rango.</span>
                </div>
              )}

              {preview.alreadyInState > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{preview.alreadyInState}</strong>{" "}
                    ya {action === "block" ? "bloqueados" : "disponibles"} (sin cambio)
                  </span>
                </div>
              )}

              {preview.skipped > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{preview.skipped}</strong> omitido(s) — tienen reserva activa
                  </span>
                </div>
              )}

              <button
                onClick={reset}
                className="text-xs text-blue-600 hover:text-blue-800 mt-1"
              >
                Recalcular
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t">
          <button
            onClick={handleClose}
            className="flex-1 py-2 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={!canApply || applying}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              action === "block"
                ? "bg-gray-700 hover:bg-gray-800"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {applying ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando...</>
            ) : (
              action === "block" ? "Bloquear" : "Desbloquear"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
