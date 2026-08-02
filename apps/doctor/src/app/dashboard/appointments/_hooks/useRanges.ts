import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";
import { getLocalDateString } from "@/lib/dates";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface AvailabilityRange {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  locationId: string | null;
  location: { name: string; address: string } | null;
}

/**
 * @param visibleWindow Ventana VISIBLE a traer. Antes se derivaba del mes de `selectedDate`, lo que
 *   dejaba media semana vacía cuando una semana cruza dos meses (p. ej. 29 jul – 4 ago) y
 *   hacía imposible la vista de año. El API ya aceptaba `startDate`/`endDate` arbitrarios.
 *   Usá `monthWindowFor(fecha)` de `useCalendar` para el comportamiento mensual de antes.
 * @param selectedDate Día cuyos rangos se exponen en `rangesForSelectedDate`.
 */
export function useRanges(
  doctorId: string | undefined,
  visibleWindow: { start: Date; end: Date },
  selectedDate: Date,
  /** `false` evita la petición cuando la vista no dibuja rangos (año). Ver `page.tsx`. */
  enabled: boolean = true,
) {
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  // Gana la petición MÁS RECIENTE, no la que conteste al final. Ver `fetchRanges`.
  const lastRequestId = useRef(0);

  // Los `Date` son objetos nuevos en cada render del padre; sin esto el `useCallback` se
  // invalidaría siempre y el `useEffect` traería datos en bucle infinito.
  const startKey = getLocalDateString(visibleWindow.start);
  const endKey = getLocalDateString(visibleWindow.end);

  const fetchRanges = useCallback(async () => {
    if (!doctorId) return;

    // Navegar con `‹ ›` dispara una petición por clic. Sin este guard, la respuesta de una
    // ventana vieja que llegue tarde pisa a la nueva, y como `hasLoadedOnce` ya apagó el
    // spinner no había ninguna señal de que lo pintado no correspondía al periodo en
    // pantalla — ni nada que lo corrigiera después.
    const requestId = ++lastRequestId.current;

    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const startDate = new Date(startKey + "T00:00:00Z").toISOString();
      const endDate = new Date(endKey + "T23:59:59Z").toISOString();

      const response = await authFetch(
        `${API_URL}/api/appointments/ranges?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (requestId !== lastRequestId.current) return;
      if (data.success) {
        setRanges(data.data);
      }
    } catch (error) {
      if (requestId !== lastRequestId.current) return;
      console.error("Error fetching ranges:", error);
      toast.error("Error al cargar los rangos de disponibilidad");
    } finally {
      if (requestId === lastRequestId.current) {
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    }
  }, [doctorId, startKey, endKey]);

  /**
   * `enabled` corta la carga AUTOMÁTICA, no la función.
   *
   * Estaba dentro de `fetchRanges`, y eso silenciaba también las llamadas EXPLÍCITAS: crear
   * un rango, purgar, "Refrescar" o una escritura del agente estando en vista de Año no
   * refrescaban nada y no avisaban — los datos sólo reaparecían al cambiar de vista. Ahora
   * lo que se evita es la petición de 365 días por navegar, que era el objetivo; una acción
   * deliberada del usuario siempre se atiende.
   */
  useEffect(() => {
    if (enabled) fetchRanges();
    // `loading` arranca en `true` y `page.tsx` cuelga su spinner de él: si nunca se carga,
    // hay que apagarlo a mano.
    else setLoading(false);
  }, [fetchRanges, enabled]);

  const deleteRange = async (rangeId: string) => {
    if (!await practiceConfirm("¿Estás seguro de que quieres eliminar este rango de disponibilidad?")) return;

    try {
      const response = await authFetch(`${API_URL}/api/appointments/ranges/${rangeId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Rango eliminado exitosamente");
        fetchRanges();
      } else {
        toast.error(data.error || "Error al eliminar el rango");
      }
    } catch {
      toast.error("Error al eliminar el rango");
    }
  };

  const selectedDateStr = getLocalDateString(selectedDate);
  const rangesForSelectedDate = ranges.filter(
    (r) => r.date.split("T")[0] === selectedDateStr
  );
  const datesWithRanges = new Set(ranges.map((r) => r.date.split("T")[0]));

  const bulkDeleteRanges = async (
    startDate: string,
    endDate: string,
    dryRun: boolean,
  ) => {
    const response = await authFetch(`${API_URL}/api/appointments/ranges/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ doctorId, startDate, endDate, dryRun }),
    });
    const data = await response.json();
    if (!dryRun && data.success) fetchRanges();
    return data;
  };

  return {
    ranges,
    loading,
    fetchRanges,
    deleteRange,
    bulkDeleteRanges,
    rangesForSelectedDate,
    datesWithRanges,
  };
}
