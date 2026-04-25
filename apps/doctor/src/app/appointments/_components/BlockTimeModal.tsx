"use client";

import { useState } from "react";
import { X, Ban, Loader2, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";
import type { BlockedTime } from "../_hooks/useBlockedTimes";

const TIME_OPTIONS_30 = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = String((i % 2) * 30).padStart(2, "0");
  return `${h}:${m}`;
});

interface PreviewResult {
  datesToBlock: number;
  skippedDuplicates: number;
  conflicts: number;
  conflictDetails: Array<{
    date: string;
    activeBookings: Array<{ patientName: string; startTime: string; endTime: string }>;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  blockTime: (
    startDate: string,
    endDate: string,
    blockStartTime: string,
    blockEndTime: string,
    dryRun: boolean,
    reason?: string,
  ) => Promise<any>;
  unblockTimes: (ids: string[]) => Promise<any>;
  blockedTimes: BlockedTime[];
  onSuccess: () => void;
}

export function BlockTimeModal({ isOpen, onClose, blockTime, unblockTimes, blockedTimes, onSuccess }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [blockStartTime, setBlockStartTime] = useState("");
  const [blockEndTime, setBlockEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleClose = () => {
    setDateFrom("");
    setDateTo("");
    setBlockStartTime("");
    setBlockEndTime("");
    setReason("");
    setPreview(null);
    onClose();
  };

  const canPreview =
    dateFrom && dateTo && dateFrom <= dateTo &&
    blockStartTime && blockEndTime && blockStartTime < blockEndTime;

  const handlePreview = async () => {
    if (!canPreview) return;
    setIsLoading(true);
    setPreview(null);
    try {
      const data = await blockTime(dateFrom, dateTo, blockStartTime, blockEndTime, true, reason || undefined);
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
      const data = await blockTime(dateFrom, dateTo, blockStartTime, blockEndTime, false, reason || undefined);
      if (data.success) {
        const parts = [];
        if (data.datesBlocked > 0) parts.push(`${data.datesBlocked} día(s) bloqueado(s)`);
        if (data.skippedDuplicates > 0) parts.push(`${data.skippedDuplicates} ya existente(s)`);
        if (data.conflicts > 0) parts.push(`${data.conflicts} con conflictos`);
        toast.success(parts.join(". "));
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

  const handleUnblock = async (id: string) => {
    if (!await practiceConfirm("¿Desbloquear este horario?")) return;
    await unblockTimes([id]);
    onSuccess();
  };

  // Group blocked times by date for display
  const blockedByDate = new Map<string, BlockedTime[]>();
  for (const bt of blockedTimes) {
    const dateKey = bt.date.split("T")[0];
    if (!blockedByDate.has(dateKey)) blockedByDate.set(dateKey, []);
    blockedByDate.get(dateKey)!.push(bt);
  }
  const sortedDates = [...blockedByDate.keys()].sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full my-4 sm:my-8">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Ban className="w-4 h-4 text-orange-500" />
            Bloquear Horario
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
              Los bloqueos son <strong>reversibles</strong>. Los rangos de disponibilidad no se modifican.
              Las <strong>citas activas</strong> existentes no se afectan — solo se bloquean nuevas reservas.
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

          {/* Time window */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Horario a bloquear *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                <select
                  value={blockStartTime}
                  onChange={(e) => { setBlockStartTime(e.target.value); setPreview(null); }}
                  className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                >
                  <option value="">Seleccionar</option>
                  {TIME_OPTIONS_30.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                <select
                  value={blockEndTime}
                  onChange={(e) => { setBlockEndTime(e.target.value); setPreview(null); }}
                  className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                >
                  <option value="">Seleccionar</option>
                  {TIME_OPTIONS_30.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            {blockStartTime && blockEndTime && blockStartTime >= blockEndTime && (
              <p className="text-xs text-red-500 mt-1">La hora de inicio debe ser anterior a la hora de fin</p>
            )}
          </div>

          {/* Reason (optional) */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">
              Razón <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Comida, reunión, personal..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
            />
          </div>

          {/* Preview result */}
          {preview && (
            <div className="space-y-2">
              <div className={`rounded-lg p-3 border text-sm ${
                preview.datesToBlock === 0
                  ? "bg-gray-50 border-gray-200 text-gray-600"
                  : "bg-orange-50 border-orange-200 text-orange-700"
              }`}>
                {preview.datesToBlock === 0
                  ? "No hay días nuevos que bloquear."
                  : <>Se bloqueará <strong>{blockStartTime}–{blockEndTime}</strong> en <strong>{preview.datesToBlock} día(s)</strong>.</>
                }
                {preview.skippedDuplicates > 0 && (
                  <span className="text-gray-500"> ({preview.skippedDuplicates} ya bloqueado(s))</span>
                )}
              </div>

              {preview.conflicts > 0 && (
                <div className="rounded-lg p-3 border border-blue-200 bg-blue-50 text-sm">
                  <p className="font-medium text-blue-800 flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {preview.conflicts} día(s) con citas activas (se bloquearán, citas existentes no se afectan):
                  </p>
                  <ul className="space-y-1.5">
                    {preview.conflictDetails.map((c, i) => (
                      <li key={i} className="text-xs text-blue-700">
                        <span className="font-medium">{c.date}</span>
                        <span className="text-blue-500">
                          {" "}— {c.activeBookings.map((b) => `${b.patientName} (${b.startTime}–${b.endTime})`).join(", ")}
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
            {!preview || preview.datesToBlock === 0 ? (
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
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center gap-1.5"
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                Bloquear {preview.datesToBlock}
              </button>
            )}
          </div>

          {/* Existing blocked times */}
          {sortedDates.length > 0 && (
            <div className="pt-3 border-t">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-orange-500" />
                Bloqueos existentes ({blockedTimes.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sortedDates.map((dateKey) => (
                  <div key={dateKey} className="text-xs">
                    <p className="font-medium text-gray-700 mb-1">{dateKey}</p>
                    {blockedByDate.get(dateKey)!.map((bt) => (
                      <div key={bt.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded px-2.5 py-1.5 mb-1">
                        <span className="text-orange-700">
                          {bt.startTime}–{bt.endTime}
                          {bt.reason && <span className="text-orange-400 ml-1">({bt.reason})</span>}
                        </span>
                        <button
                          onClick={() => handleUnblock(bt.id)}
                          className="text-red-400 hover:text-red-600 p-0.5 transition-colors"
                          title="Desbloquear"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
