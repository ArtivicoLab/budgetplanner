// What needs attention TODAY: bills/expenses/debt due (and not yet paid) and any
// income arriving (payday). Powers the header notification badge. Mirrors the
// calendar's event logic but scoped to a single day and to pending items only:
// a logged+paid entry is "done" and doesn't nag; a recurring occurrence that
// already has a matching logged entry isn't double-counted.
import { expandRecurrence } from "./recurrence";
import { txnDirection, type Recurring, type Transaction } from "./types";

export interface TodayAlerts {
  due: number; // bills/expenses/debt/savings due today, still unpaid
  payday: number; // income arriving today
  total: number;
}

export function todayAlerts(txns: Transaction[], recurring: Recurring[], today: string): TodayAlerts {
  const seen = new Set<string>();
  const key = (d: string, k: string, a: number) => `${d}|${k}|${a.toFixed(2)}`;
  let due = 0;
  let payday = 0;

  // Logged transactions dated today: paid ones are done (but still registered so
  // a matching recurring occurrence doesn't re-count); unpaid ones are pending.
  for (const t of txns) {
    if (t.date !== today) continue;
    seen.add(key(t.date, t.kind, t.amount));
    if (t.paid) continue;
    const dir = txnDirection(t.kind);
    if (dir === "in") payday++;
    else if (dir === "out") due++;
  }

  // Recurring occurrences landing today that aren't already logged → pending.
  for (const r of recurring) {
    for (const d of expandRecurrence(r, today, today)) {
      if (seen.has(key(d, r.kind, r.amount))) continue;
      const dir = txnDirection(r.kind);
      if (dir === "in") payday++;
      else if (dir === "out") due++;
    }
  }

  return { due, payday, total: due + payday };
}
