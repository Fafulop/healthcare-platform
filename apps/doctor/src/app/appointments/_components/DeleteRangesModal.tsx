"use client";

import { useState } from "react";
import { X, Trash2, Loader2, Search, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/practice-toast";

interface ProtectedRange {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  activeBookings: Array<{ patientName: string; startTime: string; endTime: string }>;
}

interface PreviewResult {
  deleted: number;
  protected: number;
  protectedRanges: ProtectedRange[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bulkDeleteRanges: (startDate: string, endDate: string, dryRun: boolean) => Promise<any>;
  onSuccess: () => void;
}

export function DeleteRangesModal({ isOpen, onClose, bulkDeleteRanges, onSuccess }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClose = () => {
    setDateFrom("");
    setDateTo("");
    setPreview(null);
    onClose();
  };

  const canPreview = dateFrom && dateTo && dateFrom <= dateTo;

  const handlePreview = async () => {
    if (!canPreview) return;
    setIsLoading(true);
    setPreview(null);
    try {
      const data = await bulkDeleteRanges(dateFrom, dateTo, true);
      if (data.success) {
        setPreview(data);
      } else {
        toast.error(data.error || "Error al consultar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const data = await bulkDeleteRanges(dateFrom, dateTo, false);
      if (data.success) {
        toast.success(
          `${data.deleted} rango(s) eliminado(s)${data.protected > 0 ? `. ${data.protected} protegido(s).` : ""}`
        );
        onSuccess();
        handleClose();
      } else {
        toast.error(data.error || "Error al ejecutar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full my-4 sm:my-8">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            Eliminar Rangos
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Safety notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-amber-700">
              Los rangos con <strong>citas activas</strong> (pendientes o confirmadas) no se eliminan. Se muestran como protegidos.
            </p>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Rango de fechas a eliminar *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPreview(null); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPreview(null); }}
                  min={dateFrom || undefined}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview result */}
          {preview && (
            <div className="space-y-2">
              <div className={`rounded-lg p-3 border text-sm ${
                preview.deleted === 0
                  ? "bg-gray-50 border-gray-200 text-gray-600"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {preview.deleted === 0
                  ? "No hay rangos que eliminar en este período."
                  : <>Se eliminarán <strong>{preview.deleted} rango(s)</strong>. Esta acción es irreversible.</>
                }
              </div>

              {preview.protected > 0 && (
                <div className="rounded-lg p-3 border border-blue-200 bg-blue-50 text-sm">
                  <p className="font-medium text-blue-800 flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {preview.protected} rango(s) protegido(s) por citas activas:
                  </p>
                  <ul className="space-y-1.5">
                    {preview.protectedRanges.map((pr, i) => (
                      <li key={i} className="text-xs text-blue-700">
                        <span className="font-medium">{pr.date}</span> {pr.startTime}–{pr.endTime}
                        <span className="text-blue-500">
                          {" "}— {pr.activeBookings.map((b) => `${b.patientName} (${b.startTime}–${b.endTime})`).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-3 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={isExecuting}
              className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
            {!preview || preview.deleted === 0 ? (
              <button
                type="button"
                onClick={handlePreview}
                disabled={isLoading || !canPreview}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white font-medium rounded-lg transition-colors text-sm flex items-center gap-1.5"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Vista previa
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExecute}
                disabled={isExecuting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center gap-1.5"
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar {preview.deleted}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
