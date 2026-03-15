import { describe, expect, it } from "vitest";
import { getCycleDates, getInitialCycleReferenceDate } from "@/lib/cycleDates";

describe("cycleDates", () => {
  it("considera fechamento no dia atual como próxima competência", () => {
    const today = new Date(2026, 4, 5, 10, 30, 0);
    const reference = getInitialCycleReferenceDate(today, 5);

    expect(reference.getFullYear()).toBe(2026);
    expect(reference.getMonth()).toBe(5);
    expect(reference.getDate()).toBe(5);
  });

  it("calcula corretamente virada de mês", () => {
    const { cycleStart, cycleEnd, cycleLimitDate } = getCycleDates({
      referenceDate: new Date(2026, 2, 1),
      closingDay: 31,
      dueDay: 10,
      now: new Date(2026, 2, 9, 12, 0, 0),
    });

    expect(cycleStart.toISOString()).toBe(new Date(2026, 1, 28, 0, 0, 0).toISOString());
    expect(cycleEnd.toISOString()).toBe(new Date(2026, 2, 31, 0, 0, 0).toISOString());
    expect(cycleLimitDate.toISOString()).toBe(new Date(2026, 2, 9, 23, 59, 59, 999).toISOString());
  });

  it("ajusta fevereiro com fechamento acima do último dia", () => {
    const { cycleStart, cycleEnd } = getCycleDates({
      referenceDate: new Date(2025, 1, 10),
      closingDay: 31,
      dueDay: 10,
    });

    expect(cycleStart.toISOString()).toBe(new Date(2025, 0, 31, 0, 0, 0).toISOString());
    expect(cycleEnd.toISOString()).toBe(new Date(2025, 1, 28, 0, 0, 0).toISOString());
  });

  it("funciona na virada de ano", () => {
    const reference = getInitialCycleReferenceDate(new Date(2025, 11, 31, 8, 0, 0), 31);
    const { cycleStart, cycleEnd } = getCycleDates({
      referenceDate: reference,
      closingDay: 31,
      dueDay: 10,
    });

    expect(reference.toISOString()).toBe(new Date(2026, 0, 31, 0, 0, 0).toISOString());
    expect(cycleStart.toISOString()).toBe(new Date(2025, 11, 31, 0, 0, 0).toISOString());
    expect(cycleEnd.toISOString()).toBe(new Date(2026, 0, 31, 0, 0, 0).toISOString());
  });

  it("só marca atraso após o fim do dia limite", () => {
    const resultSameDay = getCycleDates({
      referenceDate: new Date(2026, 5, 1),
      closingDay: 5,
      dueDay: 10,
      now: new Date(2026, 5, 9, 10, 0, 0),
    });

    const resultAfter = getCycleDates({
      referenceDate: new Date(2026, 5, 1),
      closingDay: 5,
      dueDay: 10,
      now: new Date(2026, 5, 10, 0, 0, 0),
    });

    expect(resultSameDay.isLate).toBe(false);
    expect(resultAfter.isLate).toBe(true);
  });
});
