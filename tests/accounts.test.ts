import { describe, expect, it } from "vitest";
import { accountFlows, accountsOverview, accountBalanceByDate } from "../src/lib/accounts";
import type { Account, Transaction } from "../src/lib/types";

function acct(p: Partial<Account>): Account {
  return {
    id: "a", name: "Checking", type: "checking", startBalance: 0, creditLimit: 0,
    adjustment: 0, lastChecked: "", order: 0, createdAt: "", updatedAt: "", ...p,
  };
}
function txn(p: Partial<Transaction>): Transaction {
  return {
    id: "t", date: "2026-07-01", amount: 0, kind: "expense", category: "",
    account: "Checking", toAccount: "", spender: "", description: "", paid: true,
    createdAt: "", updatedAt: "", ...p,
  };
}

describe("accountFlows", () => {
  it("adds income and subtracts spending", () => {
    const a = acct({ startBalance: 100 });
    const f = accountFlows(a, [
      txn({ kind: "income", amount: 500 }),
      txn({ kind: "expense", amount: 120 }),
      txn({ kind: "bill", amount: 80 }),
    ]);
    expect(f.totalIn).toBe(500);
    expect(f.totalOut).toBe(200);
    expect(f.current).toBe(400); // 100 + 500 - 200
  });

  it("ignores unpaid transactions", () => {
    const a = acct({ startBalance: 0 });
    const f = accountFlows(a, [txn({ kind: "income", amount: 500, paid: false })]);
    expect(f.current).toBe(0);
  });

  it("applies the reconciliation adjustment", () => {
    const a = acct({ startBalance: 100, adjustment: -25 });
    expect(accountFlows(a, []).current).toBe(75);
  });

  it("moves money between accounts on a transfer", () => {
    const checking = acct({ name: "Checking", startBalance: 1000 });
    const card = acct({ name: "Card", type: "credit", startBalance: -500 });
    const txns = [txn({ kind: "transfer", amount: 300, account: "Checking", toAccount: "Card" })];
    expect(accountFlows(checking, txns).current).toBe(700); // 1000 - 300 out
    expect(accountFlows(card, txns).current).toBe(-200); // -500 + 300 in
  });
});

describe("accountsOverview", () => {
  it("totals across accounts and orders them", () => {
    const accounts = [
      acct({ id: "s", name: "Savings", order: 2, startBalance: 2000 }),
      acct({ id: "c", name: "Checking", order: 1, startBalance: 500 }),
    ];
    const txns = [txn({ kind: "income", amount: 100, account: "Checking" })];
    const { rows, totals } = accountsOverview(accounts, txns);
    expect(rows[0].account.name).toBe("Checking"); // ordered by `order`
    expect(totals.current).toBe(2600); // 600 + 2000
  });
});

describe("accountBalanceByDate", () => {
  it("splits opening balance, in-window flows, and end balance", () => {
    const a = acct({ startBalance: 0 });
    const txns = [
      txn({ date: "2026-06-01", kind: "income", amount: 1000 }), // before window
      txn({ date: "2026-07-05", kind: "income", amount: 500 }), // in window
      txn({ date: "2026-07-10", kind: "expense", amount: 200 }), // in window
      txn({ date: "2026-08-01", kind: "expense", amount: 999 }), // after window
    ];
    const r = accountBalanceByDate(a, txns, "2026-07-01", "2026-07-31");
    expect(r.startBalance).toBe(1000); // only the June income
    expect(r.totalIn).toBe(500);
    expect(r.totalOut).toBe(200);
    expect(r.endBalance).toBe(1300);
  });
});
