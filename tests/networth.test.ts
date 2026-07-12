import { describe, expect, it } from "vitest";
import { netWorthSummary, netWorthTrend } from "../src/lib/networth";
import type { Account, Debt, NetWorthItem, Transaction } from "../src/lib/types";

function acct(p: Partial<Account>): Account {
  return {
    id: "a", name: "Checking", type: "checking", startBalance: 0, creditLimit: 0,
    adjustment: 0, lastChecked: "", order: 0, createdAt: "", updatedAt: "", ...p,
  };
}
function debt(p: Partial<Debt>): Debt {
  return { id: "d", name: "Loan", startBalance: 0, currentBalance: 0, apr: 0, minPayment: 0, notes: "", createdAt: "", updatedAt: "", ...p };
}
function item(p: Partial<NetWorthItem>): NetWorthItem {
  return { id: "i", name: "House", kind: "asset", value: 0, rate: 0, category: "", createdAt: "", updatedAt: "", ...p };
}
const noTxns: Transaction[] = [];

describe("netWorthSummary", () => {
  it("nets accounts, debts, and manual items", () => {
    const s = netWorthSummary(
      [acct({ name: "Checking", startBalance: 5000 }), acct({ name: "Card", type: "credit", startBalance: -1200 })],
      [debt({ name: "Car loan", currentBalance: 8000 })],
      [item({ name: "House", kind: "asset", value: 300000 }), item({ name: "Mortgage", kind: "liability", value: 220000 })],
      noTxns
    );
    expect(s.assets).toBe(305000); // 5000 + 300000
    expect(s.liabilities).toBe(229200); // 1200 (card) + 8000 (loan) + 220000 (mortgage)
    expect(s.netWorth).toBe(75800);
  });

  it("projects annual growth from asset growth minus liability interest", () => {
    const s = netWorthSummary(
      [],
      [],
      [
        item({ name: "401k", kind: "asset", value: 100000, rate: 5 }), // +5000
        item({ name: "Mortgage", kind: "liability", value: 50000, rate: 4 }), // -2000
      ],
      noTxns
    );
    expect(s.annualGrowth).toBeCloseTo(3000, 5);
  });

  it("classifies a negative account as a liability", () => {
    const s = netWorthSummary([acct({ name: "Card", type: "credit", startBalance: -500 })], [], [], noTxns);
    expect(s.assets).toBe(0);
    expect(s.liabilities).toBe(500);
    expect(s.liabilityBreakdown[0]).toEqual({ label: "Card", value: 500 });
  });
});

describe("netWorthTrend", () => {
  it("returns one point per month", () => {
    const t = netWorthTrend([acct({ startBalance: 1000 })], [], [], noTxns, 6);
    expect(t.length).toBe(6);
    expect(t[t.length - 1].value).toBe(1000);
  });
});
