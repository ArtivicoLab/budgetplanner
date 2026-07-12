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

export type BudgetCadence = "monthly" | "semimonthly" | "biweekly" | "weekly" | "paycheck" | "custom";

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
  bucket: string; // 50/30/20 allocation: "needs" | "wants" | "savings" | "" (auto by kind)
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

// ---- Transactions (dated money movements; the source of truth for daily
// charts, accounts, distribution, and bank reconciliation) ----
// A delete marker so a row removed on one device stays removed after another
// device (which still has the row) merges in (competitor-parity #21, Layer 2).
export interface Tombstone {
  id: string; // the deleted row's id
  collection: string; // which store it belonged to
  deletedAt: string; // ISO timestamp of the delete
}

export type TxnKind = "income" | "bill" | "expense" | "debt" | "saving" | "transfer";

export interface Transaction {
  id: string;
  date: string; // ISO yyyy-mm-dd
  amount: number; // positive magnitude; direction is derived from `kind`
  kind: TxnKind;
  category: string;
  account: string; // account name/label (for a transfer: the FROM account)
  toAccount: string; // transfers only: the destination account
  spender: string; // person / earner label (their "spender/earner" column)
  description: string;
  paid: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A transaction's cash direction. Transfers move money between the user's own
 *  accounts, so they count as neither income nor spending. */
export function txnDirection(kind: TxnKind): "in" | "out" | "transfer" {
  if (kind === "income") return "in";
  if (kind === "transfer") return "transfer";
  return "out";
}

// ---- Recurring transactions (templates that auto-generate dated occurrences) ----
export type Cadence =
  | "weekly"
  | "biweekly"
  | "every4weeks"
  | "monthly"
  | "every2months"
  | "every3months"
  | "every6months"
  | "yearly"
  | "semimonthly";

export interface Recurring {
  id: string;
  name: string;
  kind: TxnKind;
  category: string;
  amount: number;
  account: string; // for transfers: the FROM account
  toAccount: string; // transfers only
  spender: string;
  cadence: Cadence;
  anchorDate: string; // ISO — first payment (anchors the cycle)
  endDate: string; // ISO — last payment ("" = repeats forever)
  day2: number; // semimonthly: second day-of-month (0 = derive)
  active: boolean;
  // Price-versioning: the id of the older-price version this one replaces
  // ("" = original/only version). A subscription whose price changes becomes a
  // chain of rows linked by `supersedes`, so each old price keeps generating its
  // historical occurrences (capped by its `endDate`) and past-period math never
  // shifts retroactively. See lib/priceHistory.ts.
  supersedes: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Bank Accounts (balances powering the transaction filter + net worth) ----
export type AccountType = "checking" | "savings" | "cash" | "credit";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startBalance: number; // opening balance (credit cards carry a negative balance)
  creditLimit: number; // credit cards only (0 otherwise)
  adjustment: number; // reconciliation +/- when the app drifts from the real statement
  lastChecked: string; // ISO date the balance was last reconciled ("" = never)
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ---- Net worth: manual assets & liabilities beyond bank accounts (house, car,
// investments, mortgage…). Accounts + debts are auto-included; these fill the rest.
export type NetWorthKind = "asset" | "liability";

export interface NetWorthItem {
  id: string;
  name: string;
  kind: NetWorthKind;
  value: number; // positive magnitude
  rate: number; // annual % — growth for assets, interest cost for liabilities
  category: string; // e.g. Property / Vehicle / Investment / Loan
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
  debtStartDate: string; // "" = starts today; else ISO first-of-month repayment start
  debtAdjustments: Record<string, number>; // "yyyy-MM" -> +/- to that month's debt repayment
  netWorthGoal: number; // target net worth (0 = no goal set)
  bucketGoals: { needs: number; wants: number; savings: number }; // 50/30/20 target %
  checklistItems: string[]; // the monthly money to-do list (editable)
  checklistDone: Record<string, string[]>; // periodId -> completed item labels (auto-resets per period)
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
  "Insurance",
  "Subscriptions",
  "Food",
  "Transport",
  "Health",
  "Personal",
  "Home",
  "Family",
  "Savings",
  "Debt",
];
