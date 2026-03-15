import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, subMonths } from "date-fns";
import { getCycleDates, getInitialCycleReferenceDate } from "@/lib/cycleDates";

export function useCycleDates(groupId: string | undefined) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  const { data: groupSettings, isLoading } = useQuery({
    queryKey: ["group-settings-cycle", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const { data } = await supabase.from("groups").select("closing_day, due_day").eq("id", groupId).single();
      return data;
    },
    enabled: !!groupId,
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (!groupSettings) return;
    setCurrentDate(getInitialCycleReferenceDate(new Date(), groupSettings.closing_day || 1));
  }, [groupSettings]);

  const closingDay = groupSettings?.closing_day || 1;
  const dueDay = groupSettings?.due_day || 10;

  const { cycleStart, cycleEnd, cycleLimitDate, isLate } = useMemo(
    () => getCycleDates({ referenceDate: currentDate, closingDay, dueDay }),
    [currentDate, closingDay, dueDay],
  );

  const nextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));
  const prevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));

  return {
    currentDate,
    cycleStart,
    cycleEnd,
    cycleLimitDate,
    isLate,
    nextMonth,
    prevMonth,
    loading: isLoading,
    closingDay,
  };
}
