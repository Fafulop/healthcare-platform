import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { getLocalDateString } from "@/lib/dates";

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
  const startDate = new Date(getLocalDateString(new Date()) + "T00:00:00Z").toISOString();
  const response = await authFetch(
    `${API_URL}/api/appointments/ranges/block?doctorId=${doctorId}&startDate=${startDate}`
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Error al cargar bloqueos");
  return data.data;
}

/**
 * @param window Ventana VISIBLE a traer. Ver la nota de `useRanges`: derivarla del mes
 *   partía en dos las semanas a caballo entre dos meses.
 * @param selectedDate Día cuyos bloqueos se exponen en `blockedTimesForSelectedDate`.
 */
export function useBlockedTimes(
  doctorId: string | undefined,
  window: { start: Date; end: Date },
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
  const startKey = getLocalDateString(window.start);
  const endKey = getLocalDateString(window.end);

  const fetchBlockedTimes = useCallback(async () => {
    if (!doctorId) return;

    // ANTES del corte por `enabled` — ver la nota extensa en `useRanges`: apagar el hook
    // también debe invalidar la petición que ya está en vuelo.
    const requestId = ++lastRequestId.current;

    if (!enabled) { setLoading(false); return; }

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
  }, [doctorId, enabled, startKey, endKey]);

  useEffect(() => { fetchBlockedTimes(); }, [fetchBlockedTimes]);

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
