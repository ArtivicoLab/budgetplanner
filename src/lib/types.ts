// Domain types — mirror the Google Sheet schema (see schema.ts).
// Budget Planner is finance-only: budget periods, money rows (income / bills /
// expenses / savings / debt), sinking funds, and debts.

// Retained as lightweight shared vocabularies (e.g. category swatch helpers in
// lib/ui.ts) even though the task-centric screens that once drove them are gone.
export type Priority = "VeryLow" | "Low" | "Medium" | "High" | "VeryHigh";
export type Status =
  | "NotStarted"
  | "InProgress"
  | "OnHold"
  | "Pending"
  | "Delayed"
  | "Completed"
  | "Cancelled";

export type BudgetCadence = "monthly" | "biweekly" | "weekly" | "paycheck" | "custom";

export interface BudgetPeriod {
  id: string;
  label: string;
  cadence: BudgetCadence;
  startDate: string;
  endDate: string;
  startBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type MoneyKind = "income" | "bill" | "expense" | "saving" | "debt";

export interface MoneyRow {
  id: string;
  periodId: string;
  kind: MoneyKind;
  name: string;
  category: string;
  budgeted: number;
  actual: number;
  dueDate: string; // bills
  paid: boolean;
  remind: boolean;
  calendarEventId: string;
  createdAt: string;
  updatedAt: string;
  fundId: string; // kind:"saving" only — links to a Fund; "" = not linked.
  // Changing `actual` on a linked row auto-adjusts the fund's currentBalance.
}

export interface Fund {
  id: string;
  name: string;
  icon: string; // icon name
  goalAmount: number;
  currentBalance: number;
  startingAmount: number;
  goalDate: string; // ISO
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: string;
  name: string;
  startBalance: number;
  currentBalance: number;
  apr: number; // annual %
  minPayment: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  name: string; // what to call the user in greetings ("" = not set yet)
  currency: string;
  weekStart: 0 | 1; // 0 = Sunday, 1 = Monday
  theme: "auto" | "light" | "dark";
  digestTime: string; // "" = off, else "HH:mm"
  digestEventId: string; // Calendar event id for the digest — local-only, per device (Settings isn't a synced Sheet tab)
  debtStrategy: "snowball" | "avalanche" | "custom";
  debtOrder: string[]; // debt ids, custom payoff priority (strategy:"custom" only)
  monthlyExtra: number; // extra $ toward debt each month
  categories: string[]; // user-editable money categories (add/rename/remove)
  categoryColors: Record<string, string>; // category name -> chosen swatch token; falls back to the auto-assigned color if unset
  hiddenRoutes: string[]; // nav sections the user has hidden (still reachable by URL)
  householdMembers: string[]; // shared name list — feeds spender/earner suggestions
  tabBarRoutes: string[]; // pinned routes shown in the mobile bottom bar, in order ("more" is always appended, never stored here)
  accessCode: string; // Etsy purchase code the buyer entered ("" = not activated)
  activated: boolean; // true once a valid accessCode was entered — unlocks Google Sheets connect
  hideAtsHint?: boolean;
  tourDone?: boolean;
}

export const DEFAULT_CATEGORIES = [
  "Income",
  "Housing",
  "Utilities",
  "Food",
  "Transport",
  "Savings",
  "Debt",
];
