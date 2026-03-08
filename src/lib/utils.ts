import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a date-only string (e.g. "2025-01-15") as local timezone.
 * Prevents the -1 day bug caused by `new Date("2025-01-15")` being parsed as UTC.
 */
export function parseLocalDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  // If it already has time info, parse normally
  if (dateStr.includes("T") || dateStr.includes(" ")) return new Date(dateStr);
  // Date-only string: append T00:00:00 to force local timezone
  return new Date(dateStr + "T00:00:00");
}
