import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { getLocalDateString, getClinicDateString } from "@/lib/dates";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface BlockedTime {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

/**
 * ALL blocks from today forward (no month window). Used by BlockTimeModal,
 * which manages blocks globally — the hook's own list is scoped to the
 * selected month and would hide blocks from other months.
 */
export async function fetchAllBlockedTimes(doctorId: string): Promise<BlockedTime[]> {
  const startDate = new Date(getClinicDateString() + "T00:00:00Z").toISOString();
  const response = await authFetch(
    `${API_URL}/api/appointments/ranges/block?doctorId=${doctorId}&startDate=${startDate}`
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Error al cargar bloqueos");
  return data.data;
}

/**
 * @param visibleWindow Ventana VISIBLE a traer. Ver la nota de `useRanges`: derivarla del mes
 *   partía en dos las semanas a caballo entre dos meses.
 * @param selectedDate Día cuyos bloqueos se exponen en `blockedTimesForSelectedDate`.
 */
export function useBlockedTimes(
  doctorId: string | undefined,
  visibleWindow: { start: Date; end: Date },
  selectedDate: Date,
  /** `false` evita la petición cuando la vista no dibuja bloqueos (año). */
  enabled: boolean = true,
) {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedOnce = useRef(false);
  // Ver `useRanges`: gana la petición más reciente, no la que conteste al final.
  const lastRequestId = useRef(0);

  // Ver `useRanges`: se compara por string para no re-traer en cada render.
  const startKey = getLocalDateString(visibleWindow.start);
  const endKey = getLocalDateString(visibleWindow.end);

  const fetchBlockedTimes = useCallback(async () => {
    if (!doctorId) return;

    // Invalida lo que esté en vuelo: la respuesta tardía de una ventana vieja no debe pisar
    // a la nueva.
    const requestId = ++lastRequestId.current;

    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const startDate = new Date(startKey + "T00:00:00Z").toISOString();
      const endDate = new Date(endKey + "T23:59:59Z").toISOString();

      const response = await authFetch(
        `${API_URL}/api/appointments/ranges/block?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (requestId !== lastRequestId.current) return;
      if (data.success) {
        setBlockedTimes(data.data);
      }
    } catch (error) {
      if (requestId !== lastRequestId.current) return;
      console.error("Error fetching blocked times:", error);
    } finally {
      if (requestId === lastRequestId.current) {
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    }
  }, [doctorId, startKey, endKey]);

  // Ver `useRanges`: `enabled` corta la carga AUTOMÁTICA, no las llamadas explícitas
  // (bloquear/desbloquear, "Refrescar", el agente) que sí deben funcionar en cualquier vista.
  useEffect(() => {
    if (enabled) fetchBlockedTimes();
    else setLoading(false);
  }, [fetchBlockedTimes, enabled]);

  const blockTime = async (
    startDate: string,
    endDate: string,
    blockStartTime: string,
    blockEndTime: string,
    dryRun: boolean,
    reason?: string,
  ) => {
    const response = await authFetch(`${API_URL}/api/appointments/ranges/block`, {
      method: "POST",
      body: JSON.stringify({ doctorId, startDate, endDate, blockStartTime, blockEndTime, reason, dryRun }),
    });
    const data = await response.json();
    if (!dryRun && data.success) fetchBlockedTimes();
    return data;
  };

  const unblockTimes = async (ids: string[]) => {
    try {
      const response = await authFetch(`${API_URL}/api/appointments/ranges/block`, {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`${data.unblocked} bloqueo(s) eliminado(s)`);
        fetchBlockedTimes();
      } else {
        toast.error(data.error || "Error al desbloquear");
      }
      return data;
    } catch {
      toast.error("Error al desbloquear");
    }
  };

  const selectedDateStr = getLocalDateString(selectedDate);
  const blockedTimesForSelectedDate = blockedTimes.filter(
    (bt) => bt.date.split("T")[0] === selectedDateStr
  );
  return {
    blockedTimes,
    loading,
    fetchBlockedTimes,
    blockTime,
    unblockTimes,
    blockedTimesForSelectedDate,
  };
}
