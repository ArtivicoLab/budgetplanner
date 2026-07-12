// Recurrence engine (competitor-parity #10). Pure + testable. Expands a
// recurring template into the dated occurrences that fall inside a window —
// occurrences are computed, never pre-stored. Month cadences clamp to the
// month's length (e.g. the 31st becomes the 28th/30th).
import type { Cadence, Recurring } from "./types";
import { addDaysISO, addMonthsISO, endOfMonthISO } from "./dates";

const DAY_STEP: Partial<Record<Cadence, number>> = {
  weekly: 7,
  biweekly: 14,
  every4weeks: 28,
};
const MONTH_STEP: Partial<Record<Cadence, number>> = {
  monthly: 1,
  every2months: 2,
  every3months: 3,
  every6months: 6,
  yearly: 12,
};

/** Clamp a target day-of-month to a real date in the month `monthStart` begins. */
function clampDay(monthStartISO: string, day: number): string {
  const last = parseInt(endOfMonthISO(monthStartISO).slice(8, 10), 10);
  const dd = Math.min(Math.max(1, day), last);
  return `${monthStartISO.slice(0, 8)}${String(dd).padStart(2, "0")}`;
}

/**
 * Every occurrence date of `t` within [windowStart, windowEnd] (inclusive ISO).
 * Respects the template's anchor (first payment) and optional end (last payment).
 */
export function expandRecurrence(t: Recurring, windowStart: string, windowEnd: string): string[] {
  if (!t.active || !t.anchorDate) return [];
  const end = t.endDate && t.endDate < windowEnd ? t.endDate : windowEnd;
  if (end < t.anchorDate || end < windowStart) return [];

  const out: string[] = [];
  const MAX = 4000; // hard backstop against a runaway loop
  let i = 0;

  const dayStep = DAY_STEP[t.cadence];
  const monthStep = MONTH_STEP[t.cadence];

  if (dayStep) {
    let d = t.anchorDate;
    while (d <= end && i++ < MAX) {
      if (d >= windowStart) out.push(d);
      d = addDaysISO(d, dayStep);
    }
  } else if (monthStep) {
    const anchorDay = parseInt(t.anchorDate.slice(8, 10), 10);
    let monthStart = `${t.anchorDate.slice(0, 8)}01`;
    while (monthStart <= end && i++ < MAX) {
      const d = clampDay(monthStart, anchorDay);
      if (d >= t.anchorDate && d >= windowStart && d <= end) out.push(d);
      monthStart = addMonthsISO(monthStart, monthStep);
    }
  } else if (t.cadence === "semimonthly") {
    const day1 = parseInt(t.anchorDate.slice(8, 10), 10);
    const day2 = t.day2 || (day1 <= 15 ? day1 + 15 : day1 - 15);
    const [lo, hi] = day1 <= day2 ? [day1, day2] : [day2, day1];
    let monthStart = `${t.anchorDate.slice(0, 8)}01`;
    while (monthStart <= end && i++ < MAX) {
      for (const dy of [lo, hi]) {
        const d = clampDay(monthStart, dy);
        if (d >= t.anchorDate && d >= windowStart && d <= end) out.push(d);
      }
      monthStart = addMonthsISO(monthStart, 1);
    }
  }

  return out;
}

/** The next occurrence on or after `from` (ISO), or "" if none before end. */
export function nextOccurrence(t: Recurring, from: string, horizonMonths = 24): string {
  const end = addMonthsISO(from, horizonMonths);
  return expandRecurrence(t, from, end)[0] ?? "";
}
