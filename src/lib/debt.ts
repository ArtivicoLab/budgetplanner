// Debt payoff simulation (snowball / avalanche / custom order). Pure + testable.
import type { Debt } from "./types";
import { addMonthsISO, todayISO, format, fromISO } from "./dates";

export type Strategy = "snowball" | "avalanche" | "custom";

export interface ScheduleRow {
  month: number; // 1-based
  label: string; // e.g. "Aug 2026"
  adjKey: string; // "yyyy-MM" — key into the per-month adjustments map
  payment: number; // total paid across all debts this month
  interest: number; // total interest accrued this month
  balance: number; // total remaining balance after this month's payment
}

/** One debt's own month row (for the per-debt payoff schedule). */
export interface DebtScheduleRow {
  month: number;
  label: string;
  payment: number;
  interest: number;
  balance: number;
}

export interface PayoffOptions {
  /** Repayment start month (anchors schedule labels + debt-free date). Default = today. */
  startDate?: string;
  /** Per-month repayment adjustment keyed by "yyyy-MM" — add or reduce the total
   *  repayment for that month (their "+/−" feature). Total payment floored at 0. */
  adjustments?: Record<string, number>;
}

export interface PayoffResult {
  months: number; // months to debt-free (Infinity if never with this budget)
  debtFreeDate: string; // ISO ("" if never)
  debtFreeLabel: string;
  totalInterest: number;
  totalStart: number;
  totalCurrent: number;
  totalMinPayment: number;
  payoffMonthByDebt: Record<string, number>; // debtId -> month index paid off
  schedule: ScheduleRow[]; // month-by-month amortization (capped at 600 months)
  scheduleByDebt: Record<string, DebtScheduleRow[]>; // per-debt month rows
  startDate: string; // resolved repayment start
}

/**
 * Order debts by payoff priority. "custom" ranks by position in `customOrder`
 * (a list of debt ids); any debt not present falls to the end, in its
 * original relative order.
 */
function priorityOrder(debts: Debt[], strategy: Strategy, customOrder: string[] = []): Debt[] {
  const active = debts.filter((d) => d.currentBalance > 0.005);
  if (strategy === "custom") {
    const rank = new Map(customOrder.map((id, i) => [id, i]));
    return [...active].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  }
  return [...active].sort((a, b) =>
    strategy === "snowball"
      ? a.currentBalance - b.currentBalance
      : b.apr - a.apr
  );
}

export function simulatePayoff(
  debts: Debt[],
  strategy: Strategy,
  monthlyExtra: number,
  customOrder: string[] = [],
  opts: PayoffOptions = {}
): PayoffResult {
  const start = opts.startDate || todayISO();
  const adjustments = opts.adjustments ?? {};

  const totalStart = debts.reduce((a, d) => a + d.startBalance, 0);
  const totalCurrent = debts.reduce((a, d) => a + d.currentBalance, 0);
  const totalMinPayment = debts.reduce((a, d) => a + d.minPayment, 0);
  const bal = new Map(debts.map((d) => [d.id, d.currentBalance]));
  const meta = new Map(debts.map((d) => [d.id, d]));
  const payoffMonthByDebt: Record<string, number> = {};
  const schedule: ScheduleRow[] = [];
  const scheduleByDebt: Record<string, DebtScheduleRow[]> = {};
  for (const d of debts) scheduleByDebt[d.id] = [];

  const baseBudget = totalMinPayment + Math.max(0, monthlyExtra);

  let totalInterest = 0;
  let month = 0;
  const MAX = 600;

  const anyLeft = () => [...bal.values()].some((b) => b > 0.005);

  while (anyLeft() && month < MAX) {
    month++;
    const monthDate = addMonthsISO(start, month - 1);
    const label = format(fromISO(monthDate), "MMM yyyy");
    const adjKey = format(fromISO(monthDate), "yyyy-MM");
    const monthBudget = Math.max(0, baseBudget + (adjustments[adjKey] ?? 0));

    const dInterest = new Map<string, number>();
    const dPaid = new Map<string, number>();
    // Debts with a balance at the start of this month get a per-debt row.
    const activeAtStart = [...bal.entries()].filter(([, b]) => b > 0.005).map(([id]) => id);

    let monthInterest = 0;
    let monthPaid = 0;

    // 1) accrue interest
    for (const [id, b] of bal) {
      if (b <= 0.005) continue;
      const interest = (b * meta.get(id)!.apr) / 1200;
      monthInterest += interest;
      totalInterest += interest;
      bal.set(id, b + interest);
      dInterest.set(id, interest);
    }
    // 2) pay minimums (capped by the month's budget so a negative adjustment
    //    genuinely reduces that month's repayment; ≥ totalMin in the normal case
    //    so this is identical to paying every minimum in full).
    let available = monthBudget;
    for (const [id, b] of bal) {
      if (b <= 0.005) continue;
      const pay = Math.min(b, meta.get(id)!.minPayment, Math.max(0, available));
      bal.set(id, b - pay);
      monthPaid += pay;
      available -= pay;
      dPaid.set(id, (dPaid.get(id) ?? 0) + pay);
    }
    // 3) throw the rest at the priority debt(s)
    for (const d of priorityOrder(
      [...meta.values()].map((m) => ({ ...m, currentBalance: bal.get(m.id)! })),
      strategy,
      customOrder
    )) {
      if (available <= 0.005) break;
      const b = bal.get(d.id)!;
      if (b <= 0.005) continue;
      const pay = Math.min(b, available);
      bal.set(d.id, b - pay);
      monthPaid += pay;
      available -= pay;
      dPaid.set(d.id, (dPaid.get(d.id) ?? 0) + pay);
    }
    // 4) record newly-cleared debts
    for (const [id, b] of bal) {
      if (b <= 0.005 && payoffMonthByDebt[id] === undefined && meta.get(id)!.currentBalance > 0) {
        payoffMonthByDebt[id] = month;
      }
    }
    // 5) per-debt schedule rows
    for (const id of activeAtStart) {
      scheduleByDebt[id].push({
        month,
        label,
        payment: dPaid.get(id) ?? 0,
        interest: dInterest.get(id) ?? 0,
        balance: Math.max(0, bal.get(id)!),
      });
    }

    const balance = [...bal.values()].reduce((a, b) => a + Math.max(0, b), 0);
    schedule.push({ month, label, adjKey, payment: monthPaid, interest: monthInterest, balance });
  }

  const finished = !anyLeft();
  const months = finished ? month : Infinity;
  const debtFreeDate = finished ? addMonthsISO(start, month - 1) : "";
  const debtFreeLabel = finished ? format(fromISO(debtFreeDate), "MMM yyyy") : "—";

  return {
    months,
    debtFreeDate,
    debtFreeLabel,
    totalInterest,
    totalStart,
    totalCurrent,
    totalMinPayment,
    payoffMonthByDebt,
    schedule,
    scheduleByDebt,
    startDate: start,
  };
}
