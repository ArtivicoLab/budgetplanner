// Sample data — a filled current budget period plus a full year of past and
// upcoming monthly periods, three sinking funds, and three debts, so the demo
// always looks alive: the Budget period switcher, carry-over math, Savings
// rings, and Debt payoff all have real depth to show, not just a single week.

import { nowIso } from "./id";
import { addDaysISO, addMonthsISO, todayISO } from "./dates";
import { computePeriodRange } from "./budget";
import type { BudgetPeriod, Debt, Fund, MoneyRow } from "./types";

export interface Seed {
  periods: BudgetPeriod[];
  money: MoneyRow[];
  funds: Fund[];
  debts: Debt[];
}

export function buildSample(): Seed {
  const ts = nowIso();
  const today = todayISO();

  // Deterministic, stable ids so re-seeding overwrites the same records instead
  // of creating duplicates (idempotent). Every buildSample() call yields
  // identical ids.
  let idN = 0;
  const newId = () => `smpl-${++idN}`;

  // The current period is the current calendar month, so it lines up cleanly
  // with the past/future monthly fill below (no duplicated or skipped month on
  // the Income vs Spending trend).
  const [todayYear, todayMonth] = today.split("-");
  const firstOfThisMonth = `${todayYear}-${todayMonth}-01`;
  const thisMonth = computePeriodRange("monthly", firstOfThisMonth);
  const periodId = newId();
  const periods: BudgetPeriod[] = [
    {
      id: periodId,
      label: thisMonth.label,
      cadence: "monthly",
      startDate: thisMonth.startDate,
      endDate: thisMonth.endDate,
      startBalance: 500,
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  const m = (p: Partial<MoneyRow>): MoneyRow => ({
    id: newId(),
    periodId,
    kind: "expense",
    name: "",
    category: "",
    budgeted: 0,
    actual: 0,
    dueDate: "",
    paid: false,
    remind: false,
    calendarEventId: "",
    createdAt: ts,
    updatedAt: ts,
    fundId: "",
    ...p,
  });

  const emergencyFundId = newId();
  const money: MoneyRow[] = [
    m({ kind: "income", name: "Paycheck", budgeted: 3000, actual: 3000 }),
    m({ kind: "income", name: "Side gig", budgeted: 400, actual: 350 }),
    m({ kind: "bill", name: "Rent", category: "Housing", budgeted: 1200, actual: 1200, dueDate: addDaysISO(today, 5), paid: false, remind: true }),
    m({ kind: "bill", name: "Electric", category: "Utilities", budgeted: 60, actual: 72, dueDate: addDaysISO(today, 8), paid: false }),
    m({ kind: "bill", name: "Internet", category: "Utilities", budgeted: 50, actual: 50, dueDate: addDaysISO(today, 12), paid: true }),
    m({ kind: "expense", name: "Groceries", category: "Food", budgeted: 400, actual: 260 }),
    m({ kind: "expense", name: "Dining out", category: "Food", budgeted: 150, actual: 190 }),
    m({ kind: "expense", name: "Transport", category: "Auto", budgeted: 120, actual: 80 }),
    // Linked to the "Emergency fund" Fund below — demonstrates the auto-sync:
    // editing `actual` here moves the fund's currentBalance by the same delta.
    m({ kind: "saving", name: "Emergency fund", budgeted: 300, actual: 300, fundId: emergencyFundId }),
    m({ kind: "debt", name: "Credit card", category: "Debt", budgeted: 200, actual: 200, dueDate: addDaysISO(today, 10), paid: false }),
    m({ kind: "debt", name: "Student loans", category: "Debt", budgeted: 200, actual: 200, dueDate: addDaysISO(today, 25), paid: false }),
  ];

  // 11 more calendar-month periods stretching back a full year, each fully
  // filled in and paid, so switching between past periods (and the carry-over
  // math) has real history to test, not just the one in-progress period.
  for (let monthsAgo = 1; monthsAgo <= 11; monthsAgo++) {
    const anchor = addMonthsISO(firstOfThisMonth, -monthsAgo);
    const range = computePeriodRange("monthly", anchor);
    const pastPeriodId = newId();
    // Small deterministic month-to-month wobble so past periods don't all
    // look identical, without relying on Math.random() for a "stable" demo.
    const wobble = 1 + (((monthsAgo * 7) % 5) - 2) * 0.04;
    periods.push({
      id: pastPeriodId,
      label: range.label,
      cadence: "monthly",
      startDate: range.startDate,
      endDate: range.endDate,
      startBalance: Math.round(400 + monthsAgo * 15),
      createdAt: ts,
      updatedAt: ts,
    });
    const pm = (p: Partial<MoneyRow>): MoneyRow => m({ periodId: pastPeriodId, ...p });
    money.push(
      pm({ kind: "income", name: "Paycheck", budgeted: 3000, actual: Math.round(3000 * wobble) }),
      pm({ kind: "bill", name: "Rent", category: "Housing", budgeted: 1200, actual: 1200, dueDate: addDaysISO(range.startDate, 4), paid: true }),
      pm({ kind: "bill", name: "Electric", category: "Utilities", budgeted: 60, actual: Math.round(65 * wobble), dueDate: addDaysISO(range.startDate, 7), paid: true }),
      pm({ kind: "bill", name: "Internet", category: "Utilities", budgeted: 50, actual: 50, dueDate: addDaysISO(range.startDate, 11), paid: true }),
      pm({ kind: "expense", name: "Groceries", category: "Food", budgeted: 400, actual: Math.round(380 * wobble) }),
      pm({ kind: "expense", name: "Dining out", category: "Food", budgeted: 150, actual: Math.round(140 * wobble) }),
      pm({ kind: "expense", name: "Transport", category: "Auto", budgeted: 120, actual: Math.round(100 * wobble) }),
      pm({ kind: "saving", name: "Emergency fund", budgeted: 300, actual: 300 }),
      pm({ kind: "debt", name: "Credit card", category: "Debt", budgeted: 200, actual: 200, dueDate: addDaysISO(range.startDate, 9), paid: true }),
      pm({ kind: "debt", name: "Student loans", category: "Debt", budgeted: 200, actual: 200, dueDate: addDaysISO(range.startDate, 24), paid: true }),
    );
  }

  // Upcoming monthly periods (next full year) so the Budget period switcher is
  // populated forward too. Future bills are unpaid, with future due dates.
  for (let monthsAhead = 1; monthsAhead <= 12; monthsAhead++) {
    const anchor = addMonthsISO(firstOfThisMonth, monthsAhead);
    const range = computePeriodRange("monthly", anchor);
    const futPeriodId = newId();
    periods.push({
      id: futPeriodId,
      label: range.label,
      cadence: "monthly",
      startDate: range.startDate,
      endDate: range.endDate,
      startBalance: 500,
      createdAt: ts,
      updatedAt: ts,
    });
    const fm = (p: Partial<MoneyRow>): MoneyRow => m({ periodId: futPeriodId, ...p });
    money.push(
      fm({ kind: "income", name: "Paycheck", budgeted: 3000, actual: 0 }),
      fm({ kind: "bill", name: "Rent", category: "Housing", budgeted: 1200, actual: 0, dueDate: addDaysISO(range.startDate, 4), paid: false, remind: true }),
      fm({ kind: "bill", name: "Electric", category: "Utilities", budgeted: 60, actual: 0, dueDate: addDaysISO(range.startDate, 7), paid: false }),
      fm({ kind: "bill", name: "Internet", category: "Utilities", budgeted: 50, actual: 0, dueDate: addDaysISO(range.startDate, 11), paid: false }),
      fm({ kind: "expense", name: "Groceries", category: "Food", budgeted: 400, actual: 0 }),
      fm({ kind: "expense", name: "Transport", category: "Auto", budgeted: 120, actual: 0 }),
      fm({ kind: "saving", name: "Emergency fund", budgeted: 300, actual: 0 }),
      fm({ kind: "debt", name: "Credit card", category: "Debt", budgeted: 200, actual: 0, dueDate: addDaysISO(range.startDate, 9), paid: false }),
      fm({ kind: "debt", name: "Student loans", category: "Debt", budgeted: 200, actual: 0, dueDate: addDaysISO(range.startDate, 24), paid: false }),
    );
  }

  const funds: Fund[] = [
    { id: emergencyFundId, name: "Emergency fund", icon: "piggy", goalAmount: 5000, currentBalance: 3100, startingAmount: 0, goalDate: addDaysISO(today, 200), createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Vacation", icon: "sun", goalAmount: 2000, currentBalance: 650, startingAmount: 0, goalDate: addDaysISO(today, 160), createdAt: ts, updatedAt: ts },
    { id: newId(), name: "New laptop", icon: "star", goalAmount: 1500, currentBalance: 1500, startingAmount: 0, goalDate: addDaysISO(today, 30), createdAt: ts, updatedAt: ts },
  ];

  const debts: Debt[] = [
    { id: newId(), name: "Credit card", startBalance: 4000, currentBalance: 2400, apr: 19.9, minPayment: 80, notes: "", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Car loan", startBalance: 12000, currentBalance: 7200, apr: 6.5, minPayment: 240, notes: "", createdAt: ts, updatedAt: ts },
    { id: newId(), name: "Student loan", startBalance: 9000, currentBalance: 5600, apr: 4.2, minPayment: 120, notes: "", createdAt: ts, updatedAt: ts },
  ];

  return { periods, money, funds, debts };
}
