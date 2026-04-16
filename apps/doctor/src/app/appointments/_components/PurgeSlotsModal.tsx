"use client";

import { useState } from "react";
import { X, Trash2, Loader2, AlertTriangle, Search } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  onSuccess: () => void;
}

export function PurgeSlotsModal({ isOpen, onClose, doctorId, onSuccess }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const buildPayload = (dryRun: boolean) => {
    const payload: any = { doctorId, dryRun };
    if (dateFrom) payload.dateFrom = dateFrom;
    if (dateTo) payload.dateTo = dateTo;
    if (daysOfWeek.length > 0) payload.daysOfWeek = daysOfWeek;
    if (timeFrom) payload.timeFrom = timeFrom;
    if (timeTo) payload.timeTo = timeTo;
    return payload;
  };

  const handlePreview = async () => {
    setIsLoading(true);
    setPreviewCount(null);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/slots/purge`, {
        method: "DELETE",
        body: JSON.stringify(buildPayload(true)),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewCount(data.count);
      } else {
        toast.error(data.error || "Error al consultar horarios");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/api/appointments/slots/purge`, {
        method: "DELETE",
        body: JSON.stringify(buildPayload(false)),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        onSuccess();
        handleClose();
      } else {
        toast.error(data.error || "Error al eliminar horarios");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setPreviewCount(null);
    onClose();
  };

  const resetFilters = () => {
    setDateFrom("");
    setDateTo("");
    setDaysOfWeek([]);
    setTimeFrom("");
    setTimeTo("");
    setPreviewCount(null);
  };

  const hasAnyFilter = dateFrom || dateTo || daysOfWeek.length > 0 || timeFrom || timeTo;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-lg max-w-lg w-full my-4 sm:my-8">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" />
            Limpiar Horarios Disponibles
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 rounded p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[calc(100vh-120px)] sm:max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Safety notice */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-amber-700">
              Solo se eliminan horarios <strong>disponibles sin citas</strong>. Los horarios con reservas activas, bloqueados o privados no se tocan.
            </p>
          </div>

          {/* Date range filter */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Rango de fechas <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPreviewCount(null); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                placeholder="Desde"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPreviewCount(null); }}
                min={dateFrom || undefined}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                placeholder="Hasta"
              />
            </div>
          </div>

          {/* Days of week filter */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Días de la semana <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_NAMES.map((name, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => { toggleDay(index); setPreviewCount(null); }}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                    daysOfWeek.includes(index)
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Time range filter */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
              Rango de hora <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
                <select
                  value={timeFrom}
                  onChange={(e) => { setTimeFrom(e.target.value); setPreviewCount(null); }}
                  className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                >
                  <option value="">Cualquiera</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
                <select
                  value={timeTo}
                  onChange={(e) => { setTimeTo(e.target.value); setPreviewCount(null); }}
                  className="w-full px-2 sm:px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                >
                  <option value="">Cualquiera</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview result */}
          {previewCount !== null && (
            <div className={`rounded-lg p-3 border text-sm ${
              previewCount === 0
                ? "bg-gray-50 border-gray-200 text-gray-600"
                : "bg-red-50 border-red-200 text-red-700"
            }`}>
              {previewCount === 0
                ? "No hay horarios disponibles que coincidan con los filtros."
                : <>Se eliminarán <strong>{previewCount} horario(s)</strong> disponibles. Esta acción es irreversible.</>
              }
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t">
            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Limpiar filtros
              </button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="flex-1 sm:flex-none px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-lg transition-colors text-sm"
              >
                Cancelar
              </button>
              {previewCount === null || previewCount === 0 ? (
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Consultar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Eliminar {previewCount}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
