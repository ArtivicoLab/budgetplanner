// Daily balance overview (competitor-parity #11). Pure + testable. A day-by-day
// running balance from dated, paid transactions — "track your daily in vs out and
// running balance, spot overspending and avoid overdraft". Transfers move money
// between the household's own accounts, so they net out and are excluded.
import type { Transaction } from "./types";
import { txnDirection } from "./types";

export interface DayFlow {
  date: string;
  in: number;
  out: number;
  running: number; // balance after this day
}

export interface DailyBalance {
  days: DayFlow[];
  totalIn: number;
  totalOut: number;
  endBalance: number;
}

export function dailyBalance(
  txns: Transaction[],
  start: string,
  end: string,
  opening: number
): DailyBalance {
  const byDate = new Map<string, { in: number; out: number }>();
  let totalIn = 0;
  let totalOut = 0;

  for (const t of txns) {
    if (!t.paid) continue;
    if (t.date < start || t.date > end) continue;
    const dir = txnDirection(t.kind);
    if (dir === "transfer") continue;
    const d = byDate.get(t.date) ?? { in: 0, out: 0 };
    if (dir === "in") {
      d.in += t.amount;
      totalIn += t.amount;
    } else {
      d.out += t.amount;
      totalOut += t.amount;
    }
    byDate.set(t.date, d);
  }

  const dates = [...byDate.keys()].sort();
  let running = opening;
  const days: DayFlow[] = [];
  for (const date of dates) {
    const d = byDate.get(date)!;
    running += d.in - d.out;
    days.push({ date, in: d.in, out: d.out, running });
  }

  return { days, totalIn, totalOut, endBalance: running };
}
