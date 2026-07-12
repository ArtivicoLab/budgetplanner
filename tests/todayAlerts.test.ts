import { describe, it, expect } from "vitest";
import { todayAlerts } from "../src/lib/todayAlerts";
import type { Recurring, Transaction } from "../src/lib/types";

const TODAY = "2026-07-12";
function txn(p: Partial<Transaction>): Transaction {
  return { id: "t", date: TODAY, amount: 0, kind: "expense", category: "", account: "", toAccount: "", spender: "", description: "", paid: false, createdAt: "", updatedAt: "", ...p };
}
function rec(p: Partial<Recurring>): Recurring {
  return { id: "r", name: "", kind: "bill", category: "", amount: 0, account: "", toAccount: "", spender: "", cadence: "monthly", anchorDate: TODAY, endDate: "", day2: 0, active: true, supersedes: "", createdAt: "", updatedAt: "", ...p };
}

describe("todayAlerts", () => {
  it("counts unpaid outflow as due and income as payday", () => {
    const a = todayAlerts([
      txn({ id: "a", kind: "bill", amount: 100, paid: false }),
      txn({ id: "b", kind: "income", amount: 2000, paid: false }),
    ], [], TODAY);
    expect(a).toEqual({ due: 1, payday: 1, total: 2 });
  });

  it("ignores paid items and other days", () => {
    const a = todayAlerts([
      txn({ id: "a", kind: "bill", amount: 100, paid: true }),
      txn({ id: "b", kind: "expense", amount: 50, date: "2026-07-13", paid: false }),
    ], [], TODAY);
    expect(a.total).toBe(0);
  });

  it("counts recurring occurrences landing today", () => {
    const a = todayAlerts([], [
      rec({ id: "r1", kind: "bill", amount: 100, anchorDate: TODAY }),
      rec({ id: "r2", kind: "income", amount: 3000, anchorDate: TODAY }),
    ], TODAY);
    expect(a).toEqual({ due: 1, payday: 1, total: 2 });
  });

  it("does not double-count a recurring occurrence already logged today", () => {
    const a = todayAlerts(
      [txn({ id: "a", kind: "bill", amount: 100, paid: true })],
      [rec({ id: "r1", kind: "bill", amount: 100, anchorDate: TODAY })],
      TODAY
    );
    expect(a.total).toBe(0); // the paid txn covers the recurring occurrence
  });

  it("ignores transfers", () => {
    const a = todayAlerts([txn({ kind: "transfer", amount: 300, paid: false })], [], TODAY);
    expect(a.total).toBe(0);
  });
});
