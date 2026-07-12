import { describe, expect, it } from "vitest";
import { dailyBalance } from "../src/lib/dailyBalance";
import type { Transaction } from "../src/lib/types";

function txn(p: Partial<Transaction>): Transaction {
  return {
    id: "t", date: "2026-07-01", amount: 0, kind: "expense", category: "",
    account: "", toAccount: "", spender: "", description: "", paid: true,
    createdAt: "", updatedAt: "", ...p,
  };
}

describe("dailyBalance", () => {
  it("accumulates a running balance from an opening amount", () => {
    const r = dailyBalance(
      [
        txn({ date: "2026-07-01", kind: "income", amount: 2000 }),
        txn({ date: "2026-07-01", kind: "expense", amount: 500 }),
        txn({ date: "2026-07-03", kind: "bill", amount: 300 }),
      ],
      "2026-07-01", "2026-07-31", 100
    );
    expect(r.days).toHaveLength(2);
    expect(r.days[0]).toMatchObject({ date: "2026-07-01", in: 2000, out: 500, running: 1600 });
    expect(r.days[1]).toMatchObject({ date: "2026-07-03", out: 300, running: 1300 });
    expect(r.totalIn).toBe(2000);
    expect(r.totalOut).toBe(800);
    expect(r.endBalance).toBe(1300);
  });

  it("excludes transfers, unpaid, and out-of-range days", () => {
    const r = dailyBalance(
      [
        txn({ date: "2026-07-05", kind: "transfer", amount: 999, account: "A", toAccount: "B" }),
        txn({ date: "2026-07-05", kind: "expense", amount: 50, paid: false }),
        txn({ date: "2026-06-30", kind: "expense", amount: 40 }),
        txn({ date: "2026-07-05", kind: "expense", amount: 20 }),
      ],
      "2026-07-01", "2026-07-31", 0
    );
    expect(r.totalOut).toBe(20);
    expect(r.days).toHaveLength(1);
  });
});
