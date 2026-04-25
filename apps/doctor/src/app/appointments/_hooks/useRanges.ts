import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";
import { practiceConfirm } from "@/lib/practice-confirm";

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

export function useRanges(doctorId: string | undefined, selectedDate: Date) {
  const [ranges, setRanges] = useState<AvailabilityRange[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);

  const fetchRanges = useCallback(async () => {
    if (!doctorId) return;

    if (!hasLoadedOnce.current) setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const startDate = new Date(startStr + "T00:00:00Z").toISOString();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const endDate = new Date(endStr + "T23:59:59Z").toISOString();

      const response = await authFetch(
        `${API_URL}/api/appointments/ranges?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setRanges(data.data);
      }
    } catch (error) {
      console.error("Error fetching ranges:", error);
      toast.error("Error al cargar los rangos de disponibilidad");
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [doctorId, selectedDate]);

  useEffect(() => { fetchRanges(); }, [fetchRanges]);

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

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const rangesForSelectedDate = ranges.filter(
    (r) => r.date.split("T")[0] === selectedDateStr
  );
  const datesWithRanges = new Set(ranges.map((r) => r.date.split("T")[0]));

  const bulkDeleteRanges = async (
    startDate: string,
    endDate: string,
    dryRun: boolean,
    startTime?: string,
    endTime?: string,
  ) => {
    const response = await authFetch(`${API_URL}/api/appointments/ranges/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ doctorId, startDate, endDate, startTime, endTime, dryRun }),
    });
    const data = await response.json();
    if (!dryRun && data.success) fetchRanges();
    return data;
  };

  const blockTimeInRanges = async (
    startDate: string,
    endDate: string,
    blockStartTime: string,
    blockEndTime: string,
    dryRun: boolean,
  ) => {
    const response = await authFetch(`${API_URL}/api/appointments/ranges/block`, {
      method: "POST",
      body: JSON.stringify({ doctorId, startDate, endDate, blockStartTime, blockEndTime, dryRun }),
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
    blockTimeInRanges,
    rangesForSelectedDate,
    datesWithRanges,
  };
}
