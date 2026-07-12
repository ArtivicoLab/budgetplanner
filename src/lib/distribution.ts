// Spender/earner distribution (competitor-parity #9). Pure + testable. Who earns
// and who spends, and each person's share of the household total. Transfers move
// money between the household's own accounts, so they're excluded.
import type { Transaction } from "./types";
import { txnDirection } from "./types";

export interface PersonFlow {
  person: string;
  income: number;
  spending: number;
  net: number;
  incomeShare: number; // 0..1 of household income
  spendingShare: number; // 0..1 of household spending
}

export interface Distribution {
  people: PersonFlow[];
  totalIncome: number;
  totalSpending: number;
}

export function spenderDistribution(txns: Transaction[], start = "", end = ""): Distribution {
  const map = new Map<string, { income: number; spending: number }>();
  let totalIncome = 0;
  let totalSpending = 0;

  for (const t of txns) {
    if (start && t.date < start) continue;
    if (end && t.date > end) continue;
    const dir = txnDirection(t.kind);
    if (dir === "transfer") continue;
    const person = t.spender.trim() || "Unassigned";
    const cur = map.get(person) ?? { income: 0, spending: 0 };
    if (dir === "in") {
      cur.income += t.amount;
      totalIncome += t.amount;
    } else {
      cur.spending += t.amount;
      totalSpending += t.amount;
    }
    map.set(person, cur);
  }

  const people: PersonFlow[] = [...map.entries()]
    .map(([person, f]) => ({
      person,
      income: f.income,
      spending: f.spending,
      net: f.income - f.spending,
      incomeShare: totalIncome > 0 ? f.income / totalIncome : 0,
      spendingShare: totalSpending > 0 ? f.spending / totalSpending : 0,
    }))
    .sort((a, b) => b.income + b.spending - (a.income + a.spending));

  return { people, totalIncome, totalSpending };
}
