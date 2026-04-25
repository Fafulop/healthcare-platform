"use client";

import { useState } from "react";
import { X, Trash2, Ban, Loader2, AlertTriangle, Search, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/practice-toast";

const TIME_OPTIONS_15 = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

type Action = "delete" | "block";

interface ProtectedRange {
  date?: string;
  id?: string;
  startTime: string;
  endTime: string;
  activeBookings: Array<{ patientName: string; startTime: string; endTime: string }>;
}

interface PreviewResult {
  // Common
  protected: number;
  protectedRanges: ProtectedRange[];
  // Delete
  deleted?: number;
  // Block
  datesProcessed?: number;
  rangesAffected?: number;
  rangesDeleted?: number;
  rangesModified?: number;
  rangesCreated?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bulkDeleteRanges: (
    startDate: string,
    endDate: string,
    dryRun: boolean,
    startTime?: string,
    endTime?: string,
  ) => Promise<any>;
  blockTimeInRanges: (
    startDate: string,
    endDate: string,
    blockStartTime: string,
    blockEndTime: string,
    dryRun: boolean,
  ) => Promise<any>;
  onSuccess: () => void;
}

export function ManageRangesModal({
  isOpen,
  onClose,
  bulkDeleteRanges,
  blockTimeInRanges,
  onSuccess,
}: Props) {
  const [action, setAction] = useState<Action>("delete");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Delete-specific: optional time filter
  const [filterStartTime, setFilterStartTime] = useState("");
  const [filterEndTime, setFilterEndTime] = useState("");

  // Block-specific: required time window
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const resetForm = () => {
    setDateFrom("");
    setDateTo("");
    setFilterStartTime("");
    setFilterEndTime("");
    setBlockStartTime("");
    setBlockEndTime("");
    setPreview(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const clearPreview = () => setPreview(null);

  const canPreview =
    dateFrom &&
    dateTo &&
    dateFrom <= dateTo &&
    (action === "delete" || (blockStartTime && blockEndTime && blockStartTime < blockEndTime));

  const handlePreview = async () => {
    if (!canPreview) return;
    setIsLoading(true);
    setPreview(null);
    try {
      let data: any;
      if (action === "delete") {
        data = await bulkDeleteRanges(dateFrom, dateTo, true, filterStartTime || undefined, filterEndTime || undefined);
      } else {
        data = await blockTimeInRanges(dateFrom, dateTo, blockStartTime, blockEndTime, true);
      }
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
      let data: any;
      if (action === "delete") {
        data = await bulkDeleteRanges(dateFrom, dateTo, false, filterStartTime || undefined, filterEndTime || undefined);
      } else {
        data = await blockTimeInRanges(dateFrom, dateTo, blockStartTime, blockEndTime, false);
      }
      if (data.success) {
        const msg =
          action === "delete"
            ? `${data.deleted} rango(s) eliminado(s)${data.protected > 0 ? `. ${data.protected} protegido(s).` : ""}`
            : `${data.rangesAffected} rango(s) modificado(s)${data.protected > 0 ? `. ${data.protected} protegido(s).` : ""}`;
        toast.success(msg);
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

  const totalAffected =
    action === "delete"
      ? (preview?.deleted ?? 0)
      : (preview?.rangesAffected ?? 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full my-4 sm:my-8">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            {action === "delete" ? (
              <Trash2 className="w-4 h-4 text-red-500" />
            ) : (
              <Ban className="w-4 h-4 text-orange-500" />
            )}
            Gestionar Rangos
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Action selector */}
          <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
            <button
              type="button"
              onClick={() => { setAction("delete"); clearPreview(); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                action === "delete"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar rangos
            </button>
            <button
              type="button"
              onClick={() => { setAction("block"); clearPreview(); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                action === "block"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Bloquear horario
            </button>
          </div>

          {/* Safety notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-amber-700">
              {action === "delete"
                ? <>Los rangos con <strong>citas activas</strong> (pendientes o confirmadas) no se eliminan. Se muestran como protegidos.</>
                : <>Los rangos con <strong>citas activas</strong> en la zona de bloqueo no se modifican. Se muestran como protegidos.</>
              }
            </p>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Rango de fechas *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); clearPreview(); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); clearPreview(); }}
                  min={dateFrom || undefined}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Delete: optional time filter */}
          {action === "delete" && (
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Filtro de hora <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                  <select
                    value={filterStartTime}
                    onChange={(e) => { setFilterStartTime(e.target.value); clearPreview(); }}
                    className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                  >
                    <option value="">Cualquiera</option>
                    {TIME_OPTIONS_15.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                  <select
                    value={filterEndTime}
                    onChange={(e) => { setFilterEndTime(e.target.value); clearPreview(); }}
                    className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                  >
                    <option value="">Cualquiera</option>
                    {TIME_OPTIONS_15.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Block: required time window */}
          {action === "block" && (
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Horario a bloquear *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                  <select
                    value={blockStartTime}
                    onChange={(e) => { setBlockStartTime(e.target.value); clearPreview(); }}
                    className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                  >
                    <option value="">Seleccionar</option>
                    {TIME_OPTIONS_15.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                  <select
                    value={blockEndTime}
                    onChange={(e) => { setBlockEndTime(e.target.value); clearPreview(); }}
                    className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                  >
                    <option value="">Seleccionar</option>
                    {TIME_OPTIONS_15.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              {blockStartTime && blockEndTime && blockStartTime >= blockEndTime && (
                <p className="text-xs text-red-500 mt-1">La hora de inicio debe ser anterior a la hora de fin</p>
              )}
            </div>
          )}

          {/* Preview result */}
          {preview && (
            <div className="space-y-2">
              {/* Summary */}
              <div className={`rounded-lg p-3 border text-sm ${
                totalAffected === 0
                  ? "bg-gray-50 border-gray-200 text-gray-600"
                  : action === "delete"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-orange-50 border-orange-200 text-orange-700"
              }`}>
                {action === "delete" ? (
                  totalAffected === 0
                    ? "No hay rangos que coincidan con los filtros (sin citas activas)."
                    : <>Se eliminarán <strong>{preview.deleted} rango(s)</strong>. Esta acción es irreversible.</>
                ) : (
                  totalAffected === 0
                    ? "No hay rangos que coincidan con el bloqueo."
                    : <>
                        Se modificarán <strong>{preview.rangesAffected} rango(s)</strong> en {preview.datesProcessed} fecha(s).
                        {(preview.rangesDeleted ?? 0) > 0 && <> ({preview.rangesDeleted} eliminado(s))</>}
                        {(preview.rangesModified ?? 0) > 0 && <>, {preview.rangesModified} recortado(s)</>}
                        {(preview.rangesCreated ?? 0) > 0 && <>, {preview.rangesCreated} nuevo(s) creado(s) por división</>}
                      </>
                )}
              </div>

              {/* Protected ranges */}
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
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t">
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={handleClose}
                disabled={isExecuting}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
              {!preview || totalAffected === 0 ? (
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isLoading || !canPreview}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-60 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Vista previa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className={`flex-1 sm:flex-none px-4 py-2 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5 ${
                    action === "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-orange-600 hover:bg-orange-700"
                  }`}
                >
                  {isExecuting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : action === "delete" ? (
                    <Trash2 className="w-4 h-4" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  {action === "delete" ? `Eliminar ${totalAffected}` : `Bloquear ${totalAffected}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
