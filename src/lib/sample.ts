// Sample data — a realistic full year (11 past + current + 12 upcoming monthly
// periods) for a dual-income household, built so the demo exercises EVERY
// situation the screens render, not just a healthy happy-path:
//   • overdue unpaid bills, due-this-week bills, and already-paid bills (current)
//   • over-budget and under-budget lines (red/green diffs)
//   • two overspent months — one deep (a job gap + car repair), one shallow
//     (a medical bill) — so the Balance trend dips (and can go red) and the
//     "overspent" styling is reachable
//   • an income spike (tax refund) for a green bump + income-source variety
//   • broad category coverage (housing, utilities, insurance, subscriptions,
//     food, transport, personal, home, family, health) so allocation donuts,
//     spending mix and future top-category / distribution views look alive
//   • sinking funds at every stage: mid, early, reached, near-reached, empty
//   • debts whose snowball order (by balance) differs from avalanche (by APR),
//     including a 0%-APR nearly-paid one, so the strategy toggle visibly changes
//   • a full year of dated transactions across several accounts and spenders —
//     the source for daily charts, account balances, and distribution
// Deterministic: stable ids + a fixed month-to-month wobble (no Math.random),
// so screenshots and the demo stay identical every reload.

import { nowIso } from "./id";
import { addDaysISO, addMonthsISO, todayISO } from "./dates";
import { computePeriodRange } from "./budget";
import type { Account, BudgetPeriod, Debt, Fund, MoneyKind, MoneyRow, NetWorthItem, Recurring, Transaction } from "./types";

export interface Seed {
  periods: BudgetPeriod[];
  money: MoneyRow[];
  funds: Fund[];
  debts: Debt[];
  transactions: Transaction[];
  accounts: Account[];
  networth: NetWorthItem[];
  recurring: Recurring[];
}

type Phase = "past" | "current" | "future";

// Canonical monthly structure — the SAME line items every month, so the annual
// month-by-month matrices and distribution views have consistent rows to align
// across periods (match by name). Amounts are the planned/budgeted figures;
// actuals are derived per phase below.
interface Line {
  kind: MoneyKind;
  name: string;
  category: string;
  budgeted: number;
  due?: number; // days after period start (bills & debts)
  remind?: boolean;
  variable?: boolean; // income that some months is 0 (side gig)
  partner?: boolean; // second earner — can have a "job gap" month
  over?: boolean; // tends to run OVER budget (actual > budgeted)
  under?: boolean; // tends to run UNDER budget
  fund?: boolean; // link the current-month row to the Emergency fund
  bucket?: string; // 50/30/20 allocation override ("" derives from kind)
}

const TEMPLATE: Line[] = [
  // ---- Income (dual earner + a variable side gig) ----
  { kind: "income", name: "Paycheck", category: "Income", budgeted: 3200 },
  { kind: "income", name: "Partner income", category: "Income", budgeted: 2400, partner: true },
  { kind: "income", name: "Side gig", category: "Income", budgeted: 400, variable: true },
  // ---- Bills (due dates + a couple reminders) ----
  { kind: "bill", name: "Rent", category: "Housing", budgeted: 1500, due: 3, remind: true },
  { kind: "bill", name: "Electric", category: "Utilities", budgeted: 95, due: 7, over: true },
  { kind: "bill", name: "Water", category: "Utilities", budgeted: 45, due: 6 },
  { kind: "bill", name: "Internet", category: "Utilities", budgeted: 65, due: 11 },
  { kind: "bill", name: "Phone", category: "Utilities", budgeted: 80, due: 14 },
  { kind: "bill", name: "Car insurance", category: "Insurance", budgeted: 130, due: 18 },
  { kind: "bill", name: "Health insurance", category: "Insurance", budgeted: 210, due: 2 },
  { kind: "bill", name: "Netflix", category: "Subscriptions", budgeted: 16, due: 20, bucket: "wants" },
  { kind: "bill", name: "Spotify", category: "Subscriptions", budgeted: 11, due: 22, bucket: "wants" },
  { kind: "bill", name: "Gym", category: "Health", budgeted: 40, due: 9 },
  // ---- Expenses ----
  { kind: "expense", name: "Groceries", category: "Food", budgeted: 520, over: true },
  { kind: "expense", name: "Dining out", category: "Food", budgeted: 180, over: true, bucket: "wants" },
  { kind: "expense", name: "Gas", category: "Transport", budgeted: 140 },
  { kind: "expense", name: "Car maintenance", category: "Transport", budgeted: 70, under: true },
  { kind: "expense", name: "Shopping", category: "Personal", budgeted: 120, bucket: "wants" },
  { kind: "expense", name: "Household", category: "Home", budgeted: 70 },
  { kind: "expense", name: "Childcare", category: "Family", budgeted: 400 },
  { kind: "expense", name: "Entertainment", category: "Personal", budgeted: 90, over: true, bucket: "wants" },
  // ---- Savings ----
  { kind: "saving", name: "Emergency fund", category: "Savings", budgeted: 300, fund: true },
  { kind: "saving", name: "Vacation", category: "Savings", budgeted: 150 },
  { kind: "saving", name: "Retirement", category: "Savings", budgeted: 200 },
  // ---- Debt payments ----
  { kind: "debt", name: "Credit card", category: "Debt", budgeted: 120, due: 9 },
  { kind: "debt", name: "Store card", category: "Debt", budgeted: 35, due: 12 },
  { kind: "debt", name: "Car loan", category: "Debt", budgeted: 260, due: 16 },
  { kind: "debt", name: "Student loan", category: "Debt", budgeted: 130, due: 24 },
  { kind: "debt", name: "Medical", category: "Debt", budgeted: 50, due: 5 },
];

// Current-month bill states: which are already paid, and which is overdue.
const PAID_NOW = new Set(["Internet", "Health insurance", "Netflix", "Spotify", "Gym"]);
const OVERDUE_NOW = "Water"; // unpaid + due date in the past → drives the "overdue" paths

// One-off shocks injected into specific past months (keyed by monthsAgo), so the
// trend has real dips/spikes and the overspent + income-spike paths are covered.
const SHOCKS: Record<number, Line[]> = {
  4: [{ kind: "expense", name: "Car repair", category: "Transport", budgeted: 0 }],
  6: [{ kind: "income", name: "Tax refund", category: "Income", budgeted: 0 }],
  8: [{ kind: "expense", name: "Medical bill", category: "Health", budgeted: 0 }],
};
const SHOCK_ACTUAL: Record<string, number> = {
  "Car repair": 1400,
  "Tax refund": 1500,
  "Medical bill": 1800,
};
const PARTNER_GAP_MONTHS_AGO = 4; // partner between jobs → their income is 0 that month

export function buildSample(): Seed {
  const ts = nowIso();
  const today = todayISO();

  // Deterministic, stable ids so re-seeding overwrites the same records instead
  // of creating duplicates (idempotent). Every buildSample() call yields
  // identical ids.
  let idN = 0;
  const newId = () => `smpl-${++idN}`;

  const [todayYear, todayMonth] = today.split("-");
  const firstOfThisMonth = `${todayYear}-${todayMonth}-01`;

  const emergencyFundId = newId();

  const periods: BudgetPeriod[] = [];
  const money: MoneyRow[] = [];

  // Build one month of money rows from the template for a given period + phase.
  // `monthsAgo` (>0) selects the deterministic wobble and any injected shocks.
  function fillMonth(periodId: string, periodStart: string, phase: Phase, monthsAgo: number) {
    // Small, stable month-to-month wobble so filled months don't look identical.
    const wobble = 1 + (((monthsAgo * 7) % 5) - 2) * 0.04;
    const lineNoise = (l: Line) => (l.over ? 1.12 : l.under ? 0.82 : 1);

    const lines: Line[] = [...TEMPLATE, ...(SHOCKS[monthsAgo] ?? [])];

    for (const l of lines) {
      const isShock = l.budgeted === 0 && l.name in SHOCK_ACTUAL;
      let actual = 0;
      if (phase !== "future") {
        if (isShock) {
          actual = SHOCK_ACTUAL[l.name];
        } else if (l.partner && phase === "past" && monthsAgo === PARTNER_GAP_MONTHS_AGO) {
          actual = 0; // job gap
        } else if (l.variable && phase === "past" && monthsAgo % 3 === 0) {
          actual = 0; // side gig: nothing some months
        } else {
          actual = Math.round(l.budgeted * wobble * lineNoise(l));
        }
      }

      // Bill/debt due date + paid state per phase.
      let dueDate = "";
      let paid = false;
      if (l.due !== undefined) {
        if (phase === "current") {
          dueDate = l.name === OVERDUE_NOW ? addDaysISO(today, -2) : addDaysISO(periodStart, l.due);
          paid = PAID_NOW.has(l.name);
        } else {
          dueDate = addDaysISO(periodStart, l.due);
          paid = phase === "past"; // past fully paid, future all unpaid
        }
      }

      money.push({
        id: newId(),
        periodId,
        kind: l.kind,
        name: l.name,
        category: l.category,
        budgeted: l.budgeted,
        actual,
        dueDate,
        paid,
        remind: !!l.remind && phase !== "past",
        calendarEventId: "",
        createdAt: ts,
        updatedAt: ts,
        fundId: l.fund && phase === "current" ? emergencyFundId : "",
        bucket: l.bucket ?? "",
      });
    }
  }

  // ---- Current period (this calendar month) — the demo's hero ----
  const thisMonth = computePeriodRange("monthly", firstOfThisMonth);
  const currentId = newId();
  periods.push({
    id: currentId,
    label: thisMonth.label,
    cadence: "monthly",
    startDate: thisMonth.startDate,
    endDate: thisMonth.endDate,
    startBalance: 500,
    createdAt: ts,
    updatedAt: ts,
  });
  fillMonth(currentId, thisMonth.startDate, "current", 0);

  // ---- 11 past months (fully paid history for the trend + carry-over) ----
  for (let monthsAgo = 1; monthsAgo <= 11; monthsAgo++) {
    const range = computePeriodRange("monthly", addMonthsISO(firstOfThisMonth, -monthsAgo));
    const id = newId();
    periods.push({
      id,
      label: range.label,
      cadence: "monthly",
      startDate: range.startDate,
      endDate: range.endDate,
      startBalance: Math.round(400 + monthsAgo * 15),
      createdAt: ts,
      updatedAt: ts,
    });
    fillMonth(id, range.startDate, "past", monthsAgo);
  }

  // ---- 12 upcoming months (planned forward: budgeted set, actuals 0) ----
  for (let monthsAhead = 1; monthsAhead <= 12; monthsAhead++) {
    const range = computePeriodRange("monthly", addMonthsISO(firstOfThisMonth, monthsAhead));
    const id = newId();
    periods.push({
      id,
      label: range.label,
      cadence: "monthly",
      startDate: range.startDate,
      endDate: range.endDate,
      startBalance: 500,
      createdAt: ts,
      updatedAt: ts,
    });
    fillMonth(id, range.startDate, "future", -monthsAhead);
  }

  // ---- Sinking funds at every stage: mid · early · reached · near · empty ----
  const funds: Fund[] = [
    { id: emergencyFundId, name: "Emergency fund", icon: "piggy", goalAmount: 5000, currentBalance: 3100, startingAmount: 0, goalDate: addDaysISO(today, 200), createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Vacation", icon: "sun", goalAmount: 2000, currentBalance: 650, startingAmount: 0, goalDate: addDaysISO(today, 160), createdAt: ts, updatedAt: ts },
    { id: newId(), name: "New laptop", icon: "star", goalAmount: 1500, currentBalance: 1500, startingAmount: 0, goalDate: addDaysISO(today, 30), createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Christmas", icon: "heart", goalAmount: 1000, currentBalance: 900, startingAmount: 0, goalDate: addDaysISO(today, 120), createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Car down payment", icon: "target", goalAmount: 8000, currentBalance: 0, startingAmount: 0, goalDate: addDaysISO(today, 300), createdAt: ts, updatedAt: ts },
  ];

  // ---- Debts: snowball order (by balance) deliberately ≠ avalanche (by APR) ----
  // balance:  Medical 300 < Store 600 < Credit 2400 < Student 5600 < Car 7200
  // APR:      Store 24.9 > Credit 19.9 > Car 6.5 > Student 4.2 > Medical 0
  const debts: Debt[] = [
    { id: newId(), name: "Credit card", startBalance: 4000, currentBalance: 2400, apr: 19.9, minPayment: 120, notes: "Autopay on the 9th", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Store card", startBalance: 1500, currentBalance: 600, apr: 24.9, minPayment: 35, notes: "", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Car loan", startBalance: 12000, currentBalance: 7200, apr: 6.5, minPayment: 260, notes: "", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Student loan", startBalance: 9000, currentBalance: 5600, apr: 4.2, minPayment: 130, notes: "", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Medical", startBalance: 1200, currentBalance: 300, apr: 0, minPayment: 50, notes: "0% payment plan", createdAt: ts, updatedAt: ts },
  ];

  // ---- A full year of dated transactions — the source for daily charts,
  // account balances, spender distribution and transfers. Consistent with the
  // budget above (same household, categories, accounts, people). Only dates on
  // or before today are emitted, so "today" is the live edge of the ledger.
  const CHECKING = "Chase Checking";
  const SAVINGS = "Ally Savings";
  const CARD = "Chase Sapphire";

  interface TxnDef {
    day: number; // day-of-month the event lands on
    kind: Transaction["kind"];
    category: string;
    amount: number;
    account: string;
    toAccount?: string;
    spender: string;
  }
  // One month's worth of recurring movements (weekly items repeated per week).
  const MONTHLY_TXNS: TxnDef[] = [
    { day: 1, kind: "income", category: "Paycheck", amount: 1600, account: CHECKING, spender: "Me" },
    { day: 15, kind: "income", category: "Paycheck", amount: 1600, account: CHECKING, spender: "Me" },
    { day: 15, kind: "income", category: "Partner income", amount: 2400, account: CHECKING, spender: "Partner" },
    { day: 1, kind: "bill", category: "Rent", amount: 1500, account: CHECKING, spender: "Shared" },
    { day: 2, kind: "bill", category: "Health insurance", amount: 210, account: CHECKING, spender: "Shared" },
    { day: 6, kind: "bill", category: "Water", amount: 45, account: CHECKING, spender: "Shared" },
    { day: 7, kind: "bill", category: "Electric", amount: 96, account: CHECKING, spender: "Shared" },
    { day: 11, kind: "bill", category: "Internet", amount: 65, account: CHECKING, spender: "Shared" },
    { day: 14, kind: "bill", category: "Phone", amount: 80, account: CHECKING, spender: "Me" },
    { day: 18, kind: "bill", category: "Car insurance", amount: 130, account: CHECKING, spender: "Shared" },
    { day: 20, kind: "bill", category: "Netflix", amount: 16, account: CARD, spender: "Shared" },
    { day: 20, kind: "bill", category: "Spotify", amount: 11, account: CARD, spender: "Partner" },
    { day: 9, kind: "bill", category: "Gym", amount: 40, account: CARD, spender: "Me" },
    { day: 25, kind: "expense", category: "Childcare", amount: 400, account: CHECKING, spender: "Shared" },
    // weekly-ish variable spending on the card
    { day: 3, kind: "expense", category: "Groceries", amount: 132, account: CARD, spender: "Shared" },
    { day: 10, kind: "expense", category: "Groceries", amount: 118, account: CARD, spender: "Shared" },
    { day: 17, kind: "expense", category: "Groceries", amount: 141, account: CARD, spender: "Shared" },
    { day: 24, kind: "expense", category: "Groceries", amount: 129, account: CARD, spender: "Shared" },
    { day: 5, kind: "expense", category: "Dining out", amount: 48, account: CARD, spender: "Partner" },
    { day: 19, kind: "expense", category: "Dining out", amount: 62, account: CARD, spender: "Me" },
    { day: 8, kind: "expense", category: "Gas", amount: 46, account: CARD, spender: "Me" },
    { day: 22, kind: "expense", category: "Gas", amount: 51, account: CARD, spender: "Partner" },
    { day: 4, kind: "expense", category: "Coffee", amount: 6, account: CARD, spender: "Me" },
    { day: 12, kind: "expense", category: "Coffee", amount: 6, account: CARD, spender: "Me" },
    { day: 21, kind: "expense", category: "Shopping", amount: 120, account: CARD, spender: "Partner" },
    // debt + savings movements (transfers between the user's own accounts)
    { day: 16, kind: "debt", category: "Car loan", amount: 260, account: CHECKING, spender: "Shared" },
    { day: 9, kind: "transfer", category: "Credit card payment", amount: 350, account: CHECKING, toAccount: CARD, spender: "Shared" },
    { day: 25, kind: "transfer", category: "To savings", amount: 300, account: CHECKING, toAccount: SAVINGS, spender: "Shared" },
    { day: 28, kind: "income", category: "Side gig", amount: 350, account: CHECKING, spender: "Me" },
  ];

  const transactions: Transaction[] = [];
  const pushTxn = (t: Omit<Transaction, "id" | "createdAt" | "updatedAt">) =>
    transactions.push({ id: newId(), createdAt: ts, updatedAt: ts, ...t });

  // Emit 11 months back through the current month, dated; skip anything after today.
  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const monthStart = addMonthsISO(firstOfThisMonth, -monthsAgo);
    const wobble = 1 + (((monthsAgo * 7) % 5) - 2) * 0.04;
    for (const d of MONTHLY_TXNS) {
      // partner "job gap": no partner income that month
      if (monthsAgo === PARTNER_GAP_MONTHS_AGO && d.category === "Partner income") continue;
      // side gig only lands some months
      if (d.category === "Side gig" && monthsAgo % 3 === 0) continue;
      const date = addDaysISO(monthStart, d.day - 1);
      if (date > today) continue; // don't seed the future in the ledger
      const varies = d.kind === "expense" || d.category === "Electric";
      // Netflix has a price history ($13.99 -> $16 from June this year); keep the
      // logged transactions consistent with the recurring versions so the
      // Calendar shows the real split, not a flat amount.
      const netflixPrice = d.category === "Netflix" ? (date < `${todayYear}-06-01` ? 13.99 : 16) : null;
      pushTxn({
        date,
        amount: netflixPrice ?? (varies ? Math.round(d.amount * wobble) : d.amount),
        kind: d.kind,
        category: d.category,
        account: d.account,
        toAccount: d.toAccount ?? "",
        spender: d.spender,
        description: "",
        paid: true,
      });
    }
  }
  // One-off shocks in the ledger too, so daily charts show the same dips/spikes.
  const shockTxns: { monthsAgo: number; def: Omit<TxnDef, "day"> & { day: number } }[] = [
    { monthsAgo: 4, def: { day: 14, kind: "expense", category: "Car repair", amount: 1400, account: CARD, spender: "Shared" } },
    { monthsAgo: 8, def: { day: 20, kind: "expense", category: "Medical bill", amount: 1800, account: CHECKING, spender: "Shared" } },
    { monthsAgo: 6, def: { day: 10, kind: "income", category: "Tax refund", amount: 1500, account: CHECKING, spender: "Shared" } },
  ];
  for (const { monthsAgo, def } of shockTxns) {
    const date = addDaysISO(addMonthsISO(firstOfThisMonth, -monthsAgo), def.day - 1);
    if (date > today) continue;
    pushTxn({
      date,
      amount: def.amount,
      kind: def.kind,
      category: def.category,
      account: def.account,
      toAccount: "",
      spender: def.spender,
      description: "",
      paid: true,
    });
  }

  // A few one-off scheduled (unpaid, future-dated) payments (#13) so the
  // Transactions "Upcoming" list and mark-paid flow have something to show.
  transactions.push(
    { id: newId(), date: addDaysISO(today, 10), amount: 180, kind: "bill", category: "Car registration", account: CHECKING, toAccount: "", spender: "Shared", description: "", paid: false, createdAt: ts, updatedAt: ts },
    { id: newId(), date: addDaysISO(today, 21), amount: 420, kind: "bill", category: "Property tax", account: CHECKING, toAccount: "", spender: "Shared", description: "", paid: false, createdAt: ts, updatedAt: ts },
    { id: newId(), date: addDaysISO(today, 35), amount: 90, kind: "expense", category: "Annual subscription", account: CARD, toAccount: "", spender: "Me", description: "", paid: false, createdAt: ts, updatedAt: ts },
  );

  // Accounts the transactions above flow through (checking, savings, and a
  // credit card that carries a negative balance). Names must match the
  // transaction account/toAccount strings so balances derive correctly.
  const accounts: Account[] = [
    { id: newId(), name: CHECKING, type: "checking", startBalance: 4200, creditLimit: 0, adjustment: 0, lastChecked: addDaysISO(today, -7), order: 0, createdAt: ts, updatedAt: ts },
    { id: newId(), name: SAVINGS, type: "savings", startBalance: 8600, creditLimit: 0, adjustment: 0, lastChecked: addDaysISO(today, -30), order: 1, createdAt: ts, updatedAt: ts },
    { id: newId(), name: CARD, type: "credit", startBalance: -1450, creditLimit: 12000, adjustment: 0, lastChecked: addDaysISO(today, -7), order: 2, createdAt: ts, updatedAt: ts },
  ];

  // Manual assets & liabilities beyond the bank accounts, so Net Worth shows a
  // full picture (accounts + debts are auto-included).
  const networth: NetWorthItem[] = [
    { id: newId(), name: "Home", kind: "asset", value: 340000, rate: 3, category: "Property", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Car", kind: "asset", value: 18000, rate: 0, category: "Vehicle", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "401(k)", kind: "asset", value: 52000, rate: 7, category: "Investment", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Mortgage", kind: "liability", value: 268000, rate: 3.4, category: "Loan", createdAt: ts, updatedAt: ts },
  ];

  // Recurring templates — the automation behind the transactions above. Anchor
  // dates use this month so upcoming occurrences are always visible in the demo.
  const rc = (p: Partial<Recurring>): Recurring => ({
    id: newId(), name: "", kind: "expense", category: "", amount: 0,
    account: CHECKING, toAccount: "", spender: "Shared", cadence: "monthly",
    anchorDate: firstOfThisMonth, endDate: "", day2: 0, active: true, supersedes: "",
    createdAt: ts, updatedAt: ts, ...p,
  });
  // Netflix has a price history: it went from $13.99 to $16 mid-year. The old
  // price is kept as a closed (capped endDate) version so its earlier months
  // still cost $13.99, and the current version links back to it — showcasing
  // the price-change flow (see lib/priceHistory.ts).
  const netflixOld = rc({ name: "Netflix", kind: "bill", category: "Subscriptions", amount: 13.99, account: CARD, anchorDate: `${todayYear}-01-20`, endDate: `${todayYear}-05-31` });
  const recurring: Recurring[] = [
    rc({ name: "Paycheck", kind: "income", category: "Income", amount: 1600, spender: "Me", cadence: "semimonthly", day2: 15 }),
    rc({ name: "Partner income", kind: "income", category: "Income", amount: 2400, spender: "Partner", cadence: "monthly", anchorDate: `${todayYear}-${todayMonth}-15` }),
    rc({ name: "Rent", kind: "bill", category: "Housing", amount: 1500 }),
    rc({ name: "Health insurance", kind: "bill", category: "Insurance", amount: 210, anchorDate: `${todayYear}-${todayMonth}-02` }),
    netflixOld,
    rc({ name: "Netflix", kind: "bill", category: "Subscriptions", amount: 16, account: CARD, anchorDate: `${todayYear}-06-20`, supersedes: netflixOld.id }),
    rc({ name: "Gym", kind: "bill", category: "Health", amount: 40, account: CARD, spender: "Me", anchorDate: `${todayYear}-${todayMonth}-09` }),
    rc({ name: "Car loan", kind: "debt", category: "Debt", amount: 260, anchorDate: `${todayYear}-${todayMonth}-16` }),
    rc({ name: "To savings", kind: "transfer", category: "Savings transfer", amount: 300, toAccount: SAVINGS, cadence: "monthly", anchorDate: `${todayYear}-${todayMonth}-25` }),
    rc({ name: "Credit card payment", kind: "transfer", category: "Card payment", amount: 350, toAccount: CARD, anchorDate: `${todayYear}-${todayMonth}-09` }),
  ];

  return { periods, money, funds, debts, transactions, accounts, networth, recurring };
}
