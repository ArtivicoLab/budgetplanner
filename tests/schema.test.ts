import { describe, expect, it } from "vitest";
import {
  moneyToRow,
  rowToMoney,
  periodToRow,
  rowToPeriod,
  fundToRow,
  rowToFund,
  debtToRow,
  rowToDebt,
} from "../src/lib/schema";
import type { BudgetPeriod, Debt, Fund, MoneyRow } from "../src/lib/types";

describe("schema serialize -> deserialize roundtrip", () => {
  it("BudgetPeriod roundtrips", () => {
    const p: BudgetPeriod = {
      id: "p1",
      label: "July",
      cadence: "monthly",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      startBalance: 500,
      createdAt: "a",
      updatedAt: "b",
    };
    expect(rowToPeriod(periodToRow(p))).toEqual(p);
  });

  it("Money roundtrips numbers + booleans", () => {
    const m: MoneyRow = {
      id: "m1",
      periodId: "p1",
      kind: "bill",
      name: "Electric",
      category: "Utilities",
      budgeted: 60,
      actual: 72.5,
      dueDate: "2026-07-15",
      paid: false,
      remind: true,
      calendarEventId: "",
      createdAt: "a",
      updatedAt: "b",
      fundId: "",
    };
    expect(rowToMoney(moneyToRow(m))).toEqual(m);
  });

  it("tolerates blank/short rows without throwing", () => {
    expect(() => rowToMoney([])).not.toThrow();
    expect(rowToMoney([]).kind).toBe("expense");
    expect(rowToPeriod([]).cadence).toBe("monthly");
  });

  it("Fund roundtrips", () => {
    const f: Fund = {
      id: "f1",
      name: "Emergency fund",
      icon: "piggy",
      goalAmount: 5000,
      currentBalance: 3100,
      startingAmount: 0,
      goalDate: "2026-12-31",
      createdAt: "a",
      updatedAt: "b",
    };
    expect(rowToFund(fundToRow(f))).toEqual(f);
  });

  it("Debt roundtrips including notes", () => {
    const d: Debt = {
      id: "d1", name: "Credit card", startBalance: 4000, currentBalance: 2400,
      apr: 19.9, minPayment: 80, notes: "Autopay on the 3rd",
      createdAt: "a", updatedAt: "b",
    };
    expect(rowToDebt(debtToRow(d))).toEqual(d);
  });
});
