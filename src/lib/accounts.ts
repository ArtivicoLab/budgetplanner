// Account balance math (competitor-parity #7). Pure + testable. An account's
// current balance is DERIVED from its opening balance, a reconciliation
// adjustment, and every paid transaction touching it — never hand-edited.
import type { Account, Transaction } from "./types";
import { txnDirection } from "./types";

export interface AccountFlows {
  totalIn: number; // money into the account (paid)
  totalOut: number; // money out of the account (paid)
  current: number; // startBalance + adjustment + in − out
}

/**
 * Sum the paid flows through one account and derive its current balance.
 * - income into the account → in
 * - bill/expense/debt/saving out of the account → out
 * - transfer: leaves the `account` side (out), lands on the `toAccount` side (in)
 * Unpaid transactions are pending, so they don't move the real balance yet.
 */
export function accountFlows(account: Account, txns: Transaction[]): AccountFlows {
  let totalIn = 0;
  let totalOut = 0;
  for (const t of txns) {
    if (!t.paid) continue;
    const dir = txnDirection(t.kind);
    if (t.account === account.name) {
      if (dir === "in") totalIn += t.amount;
      else totalOut += t.amount; // out kinds AND transfer-from both leave this account
    } else if (dir === "transfer" && t.toAccount === account.name) {
      totalIn += t.amount; // transfer landing here
    }
  }
  const current = account.startBalance + account.adjustment + totalIn - totalOut;
  return { totalIn, totalOut, current };
}

export interface AccountRow extends AccountFlows {
  account: Account;
}

/** Every account with its derived flows, plus household totals. */
export function accountsOverview(accounts: Account[], txns: Transaction[]) {
  const rows: AccountRow[] = [...accounts]
    .sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : 1))
    .map((account) => ({ account, ...accountFlows(account, txns) }));
  const totals = rows.reduce(
    (acc, r) => {
      acc.totalIn += r.totalIn;
      acc.totalOut += r.totalOut;
      acc.current += r.current;
      return acc;
    },
    { totalIn: 0, totalOut: 0, current: 0 }
  );
  return { rows, totals };
}

/**
 * Balance for a date window: opening balance as of `start`, the in/out that
 * happened within [start, end], and the resulting end balance. Pure aggregation
 * over the transaction log (their "Balance by date range" view).
 */
export function accountBalanceByDate(
  account: Account,
  txns: Transaction[],
  start: string,
  end: string
): { startBalance: number; totalIn: number; totalOut: number; endBalance: number } {
  const before = txns.filter((t) => t.date < start);
  const within = txns.filter((t) => t.date >= start && t.date <= end);
  // Opening balance as of `start` = account.current using only transactions before it.
  const startBalance = accountFlows(account, before).current;
  const wf = accountFlows(account, within);
  return {
    startBalance,
    totalIn: wf.totalIn,
    totalOut: wf.totalOut,
    endBalance: startBalance + wf.totalIn - wf.totalOut,
  };
}
