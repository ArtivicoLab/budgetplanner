import { describe, expect, it } from "vitest";
import { spenderDistribution } from "../src/lib/distribution";
import type { Transaction } from "../src/lib/types";

function txn(p: Partial<Transaction>): Transaction {
  return {
    id: "t", date: "2026-07-01", amount: 0, kind: "expense", category: "",
    account: "", toAccount: "", spender: "Me", description: "", paid: true,
    createdAt: "", updatedAt: "", ...p,
  };
}

describe("spenderDistribution", () => {
  it("splits income and spending by person with shares", () => {
    const d = spenderDistribution([
      txn({ kind: "income", amount: 6000, spender: "Me" }),
      txn({ kind: "income", amount: 2000, spender: "Partner" }),
      txn({ kind: "expense", amount: 1000, spender: "Me" }),
      txn({ kind: "expense", amount: 3000, spender: "Partner" }),
    ]);
    expect(d.totalIncome).toBe(8000);
    expect(d.totalSpending).toBe(4000);
    const me = d.people.find((p) => p.person === "Me")!;
    expect(me.incomeShare).toBeCloseTo(0.75, 5);
    expect(me.net).toBe(5000);
    const partner = d.people.find((p) => p.person === "Partner")!;
    expect(partner.spendingShare).toBeCloseTo(0.75, 5);
  });

  it("excludes transfers and buckets blank spenders as Unassigned", () => {
    const d = spenderDistribution([
      txn({ kind: "transfer", amount: 500, spender: "Me", account: "A", toAccount: "B" }),
      txn({ kind: "expense", amount: 100, spender: "" }),
    ]);
    expect(d.totalSpending).toBe(100); // transfer excluded
    expect(d.people[0].person).toBe("Unassigned");
  });

  it("respects a date range", () => {
    const d = spenderDistribution(
      [
        txn({ kind: "income", amount: 100, date: "2026-06-30" }),
        txn({ kind: "income", amount: 200, date: "2026-07-15" }),
      ],
      "2026-07-01",
      "2026-07-31"
    );
    expect(d.totalIncome).toBe(200);
  });
});
