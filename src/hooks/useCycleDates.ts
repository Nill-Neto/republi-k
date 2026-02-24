import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, subMonths, subDays, isAfter, isSameDay } from "date-fns";

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
    staleTime: 1000 * 60 * 30, // 30 mins
  });

  useEffect(() => {
    if (groupSettings) {
      const today = new Date();
      // If today is on or after closing day, we are in the next month's cycle
      if (today.getDate() >= (groupSettings.closing_day || 1)) {
        setCurrentDate(addMonths(today, 1));
      } else {
        setCurrentDate(today);
      }
    }
  }, [groupSettings]);

  const closingDay = groupSettings?.closing_day || 1;
  const dueDay = groupSettings?.due_day || 10;

  const cycleStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay);
  const cycleEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), closingDay);
  
  // Set times to ensure correct comparisons
  cycleStart.setHours(0, 0, 0, 0);
  cycleEnd.setHours(0, 0, 0, 0);

  const cycleDueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay);
  const cycleLimitDate = subDays(cycleDueDate, 1);
  const now = new Date();
  const isLate = isAfter(now, cycleLimitDate) && !isSameDay(now, cycleLimitDate);

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
  };
}