import { addMonths, endOfDay, isAfter, startOfDay, subDays } from "date-fns";

type CycleConfig = {
  referenceDate: Date;
  closingDay: number;
  dueDay?: number;
  now?: Date;
};

const clampToMonthDay = (year: number, month: number, day: number) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
};

export const normalizeStartOfDay = (date: Date) => startOfDay(date);
export const normalizeEndOfDay = (date: Date) => endOfDay(date);

export function getInitialCycleReferenceDate(today: Date, closingDay: number): Date {
  const normalizedToday = normalizeStartOfDay(today);
  const effectiveClosingDay = clampToMonthDay(
    normalizedToday.getFullYear(),
    normalizedToday.getMonth(),
    closingDay,
  );

  if (normalizedToday.getDate() >= effectiveClosingDay) {
    return addMonths(normalizedToday, 1);
  }

  return normalizedToday;
}

export function getCompetenceKeyFromDate(date: Date, closingDay: number) {
  const normalizedDate = normalizeStartOfDay(date);
  const effectiveClosingDay = clampToMonthDay(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
    closingDay,
  );

  let competenceYear = normalizedDate.getFullYear();
  let competenceMonth = normalizedDate.getMonth() + 1;

  if (normalizedDate.getDate() >= effectiveClosingDay) {
    competenceMonth += 1;
    if (competenceMonth > 12) {
      competenceMonth = 1;
      competenceYear += 1;
    }
  }

  return `${competenceYear}-${String(competenceMonth).padStart(2, "0")}`;
}

export function getCycleDates({ referenceDate, closingDay, dueDay = 10, now = new Date() }: CycleConfig) {
  const reference = normalizeStartOfDay(referenceDate);

  const startDay = clampToMonthDay(reference.getFullYear(), reference.getMonth() - 1, closingDay);
  const endDay = clampToMonthDay(reference.getFullYear(), reference.getMonth(), closingDay);
  const dueDayInMonth = clampToMonthDay(reference.getFullYear(), reference.getMonth(), dueDay);

  const cycleStart = normalizeStartOfDay(
    new Date(reference.getFullYear(), reference.getMonth() - 1, startDay),
  );
  const cycleEnd = normalizeStartOfDay(
    new Date(reference.getFullYear(), reference.getMonth(), endDay),
  );

  const cycleDueDate = normalizeStartOfDay(
    new Date(reference.getFullYear(), reference.getMonth(), dueDayInMonth),
  );
  const cycleLimitDate = normalizeEndOfDay(subDays(cycleDueDate, 1));

  return {
    cycleStart,
    cycleEnd,
    cycleLimitDate,
    isLate: isAfter(now, cycleLimitDate),
  };
}
