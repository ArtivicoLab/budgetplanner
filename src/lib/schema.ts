// Single source of truth for the Google Sheet layout (spec §4).
// Row 1 of every tab is a header written by the app. Records are keyed by `id`
// (column A) — NEVER by row position. Serializers here roundtrip a domain
// object <-> a flat string[] row so the Sheets sync layer stays trivial.

import type { BudgetPeriod, Debt, Fund, MoneyRow } from "./types";

export const SPREADSHEET_TITLE = "Budget Planner Data (app-managed)";
export const SCHEMA_VERSION = 1;

export const TAB = {
  Meta: "Meta",
  BudgetPeriods: "BudgetPeriods",
  Money: "Money",
  Funds: "Funds",
  Debts: "Debts",
} as const;

// Tabs created (headers only) alongside the per-collection sync tabs. Meta is a
// key/value tab carrying the buyer's Etsy access code across devices.
export const V2_TABS = [TAB.Meta] as const;

export const HEADERS: Record<string, string[]> = {
  [TAB.Meta]: ["key", "value"],
  [TAB.BudgetPeriods]: [
    "id", "label", "startDate", "endDate", "startBalance", "createdAt", "updatedAt", "cadence",
  ],
  [TAB.Money]: [
    "id", "periodId", "kind", "name", "category", "budgeted", "actual",
    "dueDate", "paid", "remind", "calendarEventId", "createdAt", "updatedAt", "fundId",
  ],
  [TAB.Funds]: [
    "id", "name", "icon", "goalAmount", "currentBalance", "startingAmount",
    "goalDate", "createdAt", "updatedAt",
  ],
  [TAB.Debts]: [
    "id", "name", "startBalance", "currentBalance", "apr", "minPayment",
    "createdAt", "updatedAt", "notes",
  ],
};

// ---- primitive (de)serializers ----
const b = (v: boolean): string => (v ? "TRUE" : "FALSE");
const pb = (s: string | undefined): boolean => String(s).toUpperCase() === "TRUE";
const num = (n: number): string => String(n ?? 0);
const pn = (s: string | undefined): number => {
  const v = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};
const s = (v: string | undefined): string => (v ?? "").toString();

// ---- BudgetPeriods ----
export function periodToRow(p: BudgetPeriod): string[] {
  return [
    p.id, p.label, p.startDate, p.endDate, num(p.startBalance),
    p.createdAt, p.updatedAt, s(p.cadence),
  ];
}
export function rowToPeriod(r: string[]): BudgetPeriod {
  return {
    id: s(r[0]), label: s(r[1]), startDate: s(r[2]), endDate: s(r[3]),
    startBalance: pn(r[4]), createdAt: s(r[5]), updatedAt: s(r[6]),
    cadence: (s(r[7]) || "monthly") as BudgetPeriod["cadence"],
  };
}

// ---- Money ----
export function moneyToRow(m: MoneyRow): string[] {
  return [
    m.id, m.periodId, m.kind, m.name, m.category, num(m.budgeted), num(m.actual),
    m.dueDate, b(m.paid), b(m.remind), m.calendarEventId, m.createdAt, m.updatedAt, s(m.fundId),
  ];
}
export function rowToMoney(r: string[]): MoneyRow {
  return {
    id: s(r[0]), periodId: s(r[1]), kind: (s(r[2]) || "expense") as MoneyRow["kind"],
    name: s(r[3]), category: s(r[4]), budgeted: pn(r[5]), actual: pn(r[6]),
    dueDate: s(r[7]), paid: pb(r[8]), remind: pb(r[9]), calendarEventId: s(r[10]),
    createdAt: s(r[11]), updatedAt: s(r[12]), fundId: s(r[13]),
  };
}

// ---- Funds ----
export function fundToRow(f: Fund): string[] {
  return [f.id, f.name, f.icon, num(f.goalAmount), num(f.currentBalance), num(f.startingAmount), f.goalDate, f.createdAt, f.updatedAt];
}
export function rowToFund(r: string[]): Fund {
  return {
    id: s(r[0]), name: s(r[1]), icon: s(r[2]) || "piggy", goalAmount: pn(r[3]),
    currentBalance: pn(r[4]), startingAmount: pn(r[5]), goalDate: s(r[6]),
    createdAt: s(r[7]), updatedAt: s(r[8]),
  };
}

// ---- Debts ----
export function debtToRow(d: Debt): string[] {
  return [d.id, d.name, num(d.startBalance), num(d.currentBalance), num(d.apr), num(d.minPayment), d.createdAt, d.updatedAt, s(d.notes)];
}
export function rowToDebt(r: string[]): Debt {
  return {
    id: s(r[0]), name: s(r[1]), startBalance: pn(r[2]), currentBalance: pn(r[3]),
    apr: pn(r[4]), minPayment: pn(r[5]), createdAt: s(r[6]), updatedAt: s(r[7]), notes: s(r[8]),
  };
}
