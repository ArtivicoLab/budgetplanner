// Single source of truth for the Google Sheet layout (spec §4).
// Row 1 of every tab is a header written by the app. Records are keyed by `id`
// (column A) — NEVER by row position. Serializers here roundtrip a domain
// object <-> a flat string[] row so the Sheets sync layer stays trivial.

import type { Account, BudgetPeriod, Debt, Fund, MoneyRow, NetWorthItem, Recurring, Tombstone, Transaction } from "./types";

export const SPREADSHEET_TITLE = "Budget Planner Data (app-managed)";
export const SCHEMA_VERSION = 1;

export const TAB = {
  Meta: "Meta",
  Household: "Household",
  BudgetPeriods: "BudgetPeriods",
  Money: "Money",
  Funds: "Funds",
  Debts: "Debts",
  Transactions: "Transactions",
  Accounts: "Accounts",
  NetWorth: "NetWorth",
  Recurring: "Recurring",
  Tombstones: "Tombstones",
} as const;

// Tabs created (headers only) alongside the per-collection sync tabs. Meta is a
// key/value tab carrying the buyer's Etsy access code across devices; Household
// is a plain one-name-per-row list of the buyer's household members (spender/
// earner suggestions), mirrored from Settings so it roams across devices.
export const V2_TABS = [TAB.Meta, TAB.Household] as const;

export const HEADERS: Record<string, string[]> = {
  [TAB.Meta]: ["key", "value"],
  [TAB.Household]: ["name"],
  [TAB.BudgetPeriods]: [
    "id", "label", "startDate", "endDate", "startBalance", "createdAt", "updatedAt", "cadence",
  ],
  [TAB.Money]: [
    "id", "periodId", "kind", "name", "category", "budgeted", "actual",
    "dueDate", "paid", "remind", "calendarEventId", "createdAt", "updatedAt", "fundId", "bucket",
  ],
  [TAB.Funds]: [
    "id", "name", "icon", "goalAmount", "currentBalance", "startingAmount",
    "goalDate", "createdAt", "updatedAt",
  ],
  [TAB.Debts]: [
    "id", "name", "startBalance", "currentBalance", "apr", "minPayment",
    "createdAt", "updatedAt", "notes",
  ],
  [TAB.Transactions]: [
    "id", "date", "amount", "kind", "category", "account", "toAccount",
    "spender", "description", "paid", "createdAt", "updatedAt",
  ],
  [TAB.Accounts]: [
    "id", "name", "type", "startBalance", "creditLimit", "adjustment",
    "lastChecked", "order", "createdAt", "updatedAt",
  ],
  [TAB.NetWorth]: [
    "id", "name", "kind", "value", "rate", "category", "createdAt", "updatedAt",
  ],
  [TAB.Recurring]: [
    "id", "name", "kind", "category", "amount", "account", "toAccount", "spender",
    "cadence", "anchorDate", "endDate", "day2", "active", "supersedes", "createdAt", "updatedAt",
  ],
  [TAB.Tombstones]: ["id", "collection", "deletedAt"],
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
    m.dueDate, b(m.paid), b(m.remind), m.calendarEventId, m.createdAt, m.updatedAt, s(m.fundId), s(m.bucket),
  ];
}
export function rowToMoney(r: string[]): MoneyRow {
  return {
    id: s(r[0]), periodId: s(r[1]), kind: (s(r[2]) || "expense") as MoneyRow["kind"],
    name: s(r[3]), category: s(r[4]), budgeted: pn(r[5]), actual: pn(r[6]),
    dueDate: s(r[7]), paid: pb(r[8]), remind: pb(r[9]), calendarEventId: s(r[10]),
    createdAt: s(r[11]), updatedAt: s(r[12]), fundId: s(r[13]), bucket: s(r[14]),
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

// ---- Accounts ----
export function accountToRow(a: Account): string[] {
  return [
    a.id, a.name, a.type, num(a.startBalance), num(a.creditLimit), num(a.adjustment),
    s(a.lastChecked), num(a.order), a.createdAt, a.updatedAt,
  ];
}
export function rowToAccount(r: string[]): Account {
  return {
    id: s(r[0]), name: s(r[1]), type: (s(r[2]) || "checking") as Account["type"],
    startBalance: pn(r[3]), creditLimit: pn(r[4]), adjustment: pn(r[5]),
    lastChecked: s(r[6]), order: pn(r[7]), createdAt: s(r[8]), updatedAt: s(r[9]),
  };
}

// ---- Net worth items ----
export function netWorthToRow(n: NetWorthItem): string[] {
  return [n.id, n.name, n.kind, num(n.value), num(n.rate), s(n.category), n.createdAt, n.updatedAt];
}
export function rowToNetWorth(r: string[]): NetWorthItem {
  return {
    id: s(r[0]), name: s(r[1]), kind: (s(r[2]) || "asset") as NetWorthItem["kind"],
    value: pn(r[3]), rate: pn(r[4]), category: s(r[5]), createdAt: s(r[6]), updatedAt: s(r[7]),
  };
}

// ---- Recurring templates ----
export function recurringToRow(r: Recurring): string[] {
  return [
    r.id, r.name, r.kind, s(r.category), num(r.amount), s(r.account), s(r.toAccount),
    s(r.spender), r.cadence, r.anchorDate, s(r.endDate), num(r.day2), b(r.active),
    s(r.supersedes), r.createdAt, r.updatedAt,
  ];
}
export function rowToRecurring(r: string[]): Recurring {
  return {
    id: s(r[0]), name: s(r[1]), kind: (s(r[2]) || "expense") as Recurring["kind"],
    category: s(r[3]), amount: pn(r[4]), account: s(r[5]), toAccount: s(r[6]),
    spender: s(r[7]), cadence: (s(r[8]) || "monthly") as Recurring["cadence"],
    anchorDate: s(r[9]), endDate: s(r[10]), day2: pn(r[11]), active: pb(r[12]),
    supersedes: s(r[13]), createdAt: s(r[14]), updatedAt: s(r[15]),
  };
}

// ---- Tombstones (delete markers) ----
export function tombstoneToRow(t: Tombstone): string[] {
  return [t.id, t.collection, t.deletedAt];
}
export function rowToTombstone(r: string[]): Tombstone {
  return { id: s(r[0]), collection: s(r[1]), deletedAt: s(r[2]) };
}

// ---- Transactions ----
export function txnToRow(t: Transaction): string[] {
  return [
    t.id, t.date, num(t.amount), t.kind, t.category, s(t.account), s(t.toAccount),
    s(t.spender), s(t.description), b(t.paid), t.createdAt, t.updatedAt,
  ];
}
export function rowToTxn(r: string[]): Transaction {
  return {
    id: s(r[0]), date: s(r[1]), amount: pn(r[2]),
    kind: (s(r[3]) || "expense") as Transaction["kind"],
    category: s(r[4]), account: s(r[5]), toAccount: s(r[6]), spender: s(r[7]),
    description: s(r[8]), paid: pb(r[9]), createdAt: s(r[10]), updatedAt: s(r[11]),
  };
}
