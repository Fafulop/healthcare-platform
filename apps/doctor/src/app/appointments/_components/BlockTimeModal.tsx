"use client";

import { useState, useMemo } from "react";
import { X, Ban, Loader2, Search, ShieldCheck, Trash2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";
import { getLocalDateString } from "@/lib/dates";
import type { BlockedTime } from "../_hooks/useBlockedTimes";

const TIME_OPTIONS_30 = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = String((i % 2) * 30).padStart(2, "0");
  return `${h}:${m}`;
});

const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

interface PreviewResult {
  datesToBlock: number;
  skippedDuplicates: number;
  skippedNoRanges: number;
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

type BlockMode = "all_day" | "time_range";

export function BlockTimeModal({ isOpen, onClose, blockTime, unblockTimes, blockedTimes, onSuccess }: Props) {
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Block config
  const [blockMode, setBlockMode] = useState<BlockMode>("all_day");
  const [blockStartTime, setBlockStartTime] = useState("09:00");
  const [blockEndTime, setBlockEndTime] = useState("18:00");
  const [reason, setReason] = useState("");

  // Preview / execution
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const today = getLocalDateString(new Date());

  // Calendar computation
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [startDayOfWeek, daysInMonth]);

  // Existing blocks as a set of date strings for visual indicators
  const blockedDateSet = useMemo(
    () => new Set(blockedTimes.map((bt) => bt.date.split("T")[0])),
    [blockedTimes],
  );

  const handleClose = () => {
    setSelectedDates(new Set());
    setBlockMode("all_day");
    setBlockStartTime("09:00");
    setBlockEndTime("18:00");
    setReason("");
    setPreview(null);
    onClose();
  };

  const toggleDate = (dateStr: string) => {
    setPreview(null);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const sortedSelected = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates],
  );

  const effectiveStart = blockMode === "all_day" ? "00:00" : blockStartTime;
  const effectiveEnd = blockMode === "all_day" ? "23:30" : blockEndTime;

  const canPreview =
    selectedDates.size > 0 &&
    (blockMode === "all_day" || (blockStartTime && blockEndTime && blockStartTime < blockEndTime));

  const handlePreview = async () => {
    if (!canPreview) return;
    setIsLoading(true);
    setPreview(null);

    // The API expects a contiguous date range, so for multi-select non-contiguous dates
    // we call per-date and aggregate (or use min/max — API iterates every date in between).
    // Since our API iterates each date in the range and skips those without ranges,
    // we can just send min..max and it will only block dates that have ranges.
    // But we only want the selected dates blocked. So we call once per selected date.
    let totalDatesToBlock = 0;
    let totalSkippedDuplicates = 0;
    let totalSkippedNoRanges = 0;
    let totalConflicts = 0;
    let allConflictDetails: PreviewResult["conflictDetails"] = [];

    try {
      for (const dateStr of sortedSelected) {
        const data = await blockTime(dateStr, dateStr, effectiveStart, effectiveEnd, true, reason || undefined);
        if (data.success) {
          totalDatesToBlock += data.datesToBlock ?? 0;
          totalSkippedDuplicates += data.skippedDuplicates ?? 0;
          totalSkippedNoRanges += data.skippedNoRanges ?? 0;
          totalConflicts += data.conflicts ?? 0;
          if (data.conflictDetails) allConflictDetails.push(...data.conflictDetails);
        }
      }
      setPreview({
        datesToBlock: totalDatesToBlock,
        skippedDuplicates: totalSkippedDuplicates,
        skippedNoRanges: totalSkippedNoRanges,
        conflicts: totalConflicts,
        conflictDetails: allConflictDetails,
      });
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      let totalBlocked = 0;
      let totalSkippedDuplicates = 0;
      let totalSkippedNoRanges = 0;
      let totalConflicts = 0;

      for (const dateStr of sortedSelected) {
        const data = await blockTime(dateStr, dateStr, effectiveStart, effectiveEnd, false, reason || undefined);
        if (data.success) {
          totalBlocked += data.datesBlocked ?? 0;
          totalSkippedDuplicates += data.skippedDuplicates ?? 0;
          totalSkippedNoRanges += data.skippedNoRanges ?? 0;
          totalConflicts += data.conflicts ?? 0;
        }
      }

      const parts: string[] = [];
      if (totalBlocked > 0) parts.push(`${totalBlocked} día(s) bloqueado(s)`);
      if (totalSkippedDuplicates > 0) parts.push(`${totalSkippedDuplicates} ya existente(s)`);
      if (totalSkippedNoRanges > 0) parts.push(`${totalSkippedNoRanges} sin rangos`);
      if (totalConflicts > 0) parts.push(`${totalConflicts} con conflictos`);
      toast.success(parts.join(". ") || "Operación completada");
      onSuccess();
      handleClose();
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

  const handleUnblockAll = async () => {
    if (blockedTimes.length === 0) return;
    if (!await practiceConfirm(`¿Desbloquear los ${blockedTimes.length} horario(s) bloqueados?`)) return;
    await unblockTimes(blockedTimes.map((bt) => bt.id));
    onSuccess();
  };

  // Group blocked times by date for display
  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedTime[]>();
    for (const bt of blockedTimes) {
      const dateKey = bt.date.split("T")[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(bt);
    }
    return map;
  }, [blockedTimes]);
  const sortedBlockedDates = useMemo(() => [...blockedByDate.keys()].sort(), [blockedByDate]);

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

          {/* Step 1: Calendar picker */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              1. Seleccionar fecha(s) a bloquear
            </label>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2 bg-gray-50 px-3 py-1.5 rounded-lg">
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(year, month - 1))}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-700 capitalize">
                {currentMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentMonth(new Date(year, month + 1))}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_LABELS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-gray-500 py-0.5">
                  {d}
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} />;

                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isPast = dateStr < today;
                const isSelected = selectedDates.has(dateStr);
                const hasBlock = blockedDateSet.has(dateStr);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => !isPast && toggleDate(dateStr)}
                    disabled={isPast}
                    className={`aspect-square rounded-md text-xs font-medium transition-all relative ${
                      isSelected
                        ? "bg-orange-600 text-white ring-2 ring-orange-300"
                        : hasBlock
                        ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                        : isPast
                        ? "text-gray-300"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {day}
                    {hasBlock && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected dates summary */}
            {selectedDates.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sortedSelected.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => toggleDate(d)}
                      className="hover:text-orange-900 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {selectedDates.size > 1 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedDates(new Set()); setPreview(null); }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {selectedDates.size === 0 && (
              <div className="text-center py-2">
                <Calendar className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Toca uno o varios días para seleccionarlos</p>
              </div>
            )}
          </div>

          {/* Step 2: Block mode */}
          {selectedDates.size > 0 && (
            <div className="border-t pt-4">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                2. Tipo de bloqueo
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setBlockMode("all_day"); setPreview(null); }}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    blockMode === "all_day"
                      ? "border-orange-600 bg-orange-50 text-orange-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <p className="font-semibold">Todo el día</p>
                  <p className="text-[10px] mt-0.5 opacity-70">Bloquea completamente</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setBlockMode("time_range"); setPreview(null); }}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    blockMode === "time_range"
                      ? "border-orange-600 bg-orange-50 text-orange-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <p className="font-semibold">Rango de horas</p>
                  <p className="text-[10px] mt-0.5 opacity-70">Elige horario específico</p>
                </button>
              </div>

              {/* Time range selectors */}
              {blockMode === "time_range" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                    <select
                      value={blockStartTime}
                      onChange={(e) => { setBlockStartTime(e.target.value); setPreview(null); }}
                      className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                    >
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
                      {TIME_OPTIONS_30.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  {blockStartTime >= blockEndTime && (
                    <p className="col-span-2 text-xs text-red-500">La hora de inicio debe ser anterior a la hora de fin</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reason (optional) */}
          {selectedDates.size > 0 && (
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
          )}

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
                  : <>
                      Se bloqueará{" "}
                      <strong>
                        {blockMode === "all_day" ? "todo el día" : `${effectiveStart}–${effectiveEnd}`}
                      </strong>{" "}
                      en <strong>{preview.datesToBlock} día(s)</strong>.
                    </>
                }
                {preview.skippedDuplicates > 0 && (
                  <span className="text-gray-500"> ({preview.skippedDuplicates} ya bloqueado(s))</span>
                )}
                {preview.skippedNoRanges > 0 && (
                  <span className="text-gray-500"> ({preview.skippedNoRanges} sin rangos)</span>
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
          {selectedDates.size > 0 && (
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
                  Bloquear {preview.datesToBlock} día(s)
                </button>
              )}
            </div>
          )}

          {/* Existing blocked times */}
          {sortedBlockedDates.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-orange-500" />
                  Bloqueos existentes ({blockedTimes.length})
                </h3>
                <button
                  onClick={handleUnblockAll}
                  className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Desbloquear todos
                </button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sortedBlockedDates.map((dateKey) => (
                  <div key={dateKey} className="text-xs">
                    <p className="font-medium text-gray-700 mb-1">{dateKey}</p>
                    {blockedByDate.get(dateKey)!.map((bt) => (
                      <div key={bt.id} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded px-2.5 py-1.5 mb-1">
                        <span className="text-orange-700">
                          {bt.startTime === "00:00" && bt.endTime === "23:30"
                            ? "Todo el día"
                            : `${bt.startTime}–${bt.endTime}`
                          }
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
