// Dev-only performance seed (competitor-parity #22). Generates N synthetic
// transactions so we can confirm the app (list virtualization, memoized
// aggregations, sync) stays fast at their advertised "10,000+ transactions".
// Deterministic — no Date.now()/Math.random() — so runs are reproducible.
// Triggered by `?seed=N` in dev only (see App.tsx); never ships behavior to prod.
import { addDaysISO, todayISO } from "./dates";
import { useTransactions } from "../stores/v2";
import type { Transaction, TxnKind } from "./types";

const CATS = [
  "Groceries", "Dining out", "Gas", "Coffee", "Shopping", "Utilities", "Rent",
  "Subscriptions", "Health", "Transport", "Gifts", "Entertainment",
];
const ACCOUNTS = ["Checking", "Savings", "Credit Card", "Cash"];
const SPENDERS = ["Me", "Partner", "Family Shared"];
const OUT_KINDS: TxnKind[] = ["expense", "bill", "debt", "saving"];

/** N transaction patches spread backward from `todayISO`, cycling categories,
    accounts, and amounts by index (deterministic). Feed to `addMany`. */
export function makeSeedTransactions(n: number, today: string): Partial<Transaction>[] {
  const out: Partial<Transaction>[] = [];
  for (let i = 0; i < n; i++) {
    const isIncome = i % 9 === 0; // ~1 in 9 rows is income
    const kind: TxnKind = isIncome ? "income" : OUT_KINDS[i % OUT_KINDS.length];
    const daysAgo = Math.floor(i / 3); // ~3 txns/day going back in time
    const amount = isIncome
      ? 1500 + (i % 5) * 200
      : 5 + ((i * 37) % 400) + ((i % 7) * 3);
    out.push({
      date: addDaysISO(today, -daysAgo),
      amount: Math.round(amount * 100) / 100,
      kind,
      category: isIncome ? "Income" : CATS[i % CATS.length],
      account: ACCOUNTS[i % ACCOUNTS.length],
      spender: SPENDERS[i % SPENDERS.length],
      description: `Seed #${i + 1}`,
      paid: true,
    });
  }
  return out;
}

/** Dev-only: `?seed=N` bulk-inserts N synthetic transactions for perf testing.
    Called from App behind an `import.meta.env.DEV` gate. */
export function devSeedFromUrl(): void {
  const raw = new URLSearchParams(window.location.search).get("seed");
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return;
  const capped = Math.min(Math.floor(n), 50000);
  useTransactions.getState().addMany(makeSeedTransactions(capped, todayISO()));
}
