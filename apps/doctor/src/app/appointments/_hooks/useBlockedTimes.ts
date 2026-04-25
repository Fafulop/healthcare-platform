import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from "@/lib/practice-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface BlockedTime {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export function useBlockedTimes(doctorId: string | undefined, selectedDate: Date) {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoadedOnce = useRef(false);

  const fetchBlockedTimes = useCallback(async () => {
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
        `${API_URL}/api/appointments/ranges/block?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setBlockedTimes(data.data);
      }
    } catch (error) {
      console.error("Error fetching blocked times:", error);
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [doctorId, selectedDate]);

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

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const blockedTimesForSelectedDate = blockedTimes.filter(
    (bt) => bt.date.split("T")[0] === selectedDateStr
  );
  const datesWithBlocks = new Set(blockedTimes.map((bt) => bt.date.split("T")[0]));

  return {
    blockedTimes,
    loading,
    fetchBlockedTimes,
    blockTime,
    unblockTimes,
    blockedTimesForSelectedDate,
    datesWithBlocks,
  };
}
