import { describe, expect, it } from "vitest";
import { frameworkSummary, effectiveBucket, defaultBucket } from "../src/lib/framework";
import type { MoneyRow } from "../src/lib/types";

function row(p: Partial<MoneyRow>): MoneyRow {
  return {
    id: "m", periodId: "p", kind: "expense", name: "", category: "", budgeted: 0,
    actual: 0, dueDate: "", paid: false, remind: false, calendarEventId: "",
    createdAt: "", updatedAt: "", fundId: "", bucket: "", ...p,
  };
}

describe("bucket defaults", () => {
  it("bills/expenses default to needs, debt/savings to savings, income untagged", () => {
    expect(defaultBucket("bill")).toBe("needs");
    expect(defaultBucket("expense")).toBe("needs");
    expect(defaultBucket("debt")).toBe("savings");
    expect(defaultBucket("saving")).toBe("savings");
    expect(defaultBucket("income")).toBe("");
  });
  it("an explicit bucket overrides the default", () => {
    expect(effectiveBucket(row({ kind: "expense", bucket: "wants" }))).toBe("wants");
    expect(effectiveBucket(row({ kind: "bill" }))).toBe("needs");
  });
});

describe("frameworkSummary", () => {
  it("splits actuals into buckets and compares to goals", () => {
    const s = frameworkSummary(
      [
        row({ kind: "income", actual: 5000 }),
        row({ kind: "bill", actual: 2000 }), // needs
        row({ kind: "expense", actual: 500, bucket: "wants" }), // wants
        row({ kind: "expense", actual: 500 }), // needs (default)
        row({ kind: "saving", actual: 700 }), // savings
        row({ kind: "debt", actual: 300 }), // savings
      ],
      { needs: 50, wants: 30, savings: 20 }
    );
    expect(s.income).toBe(5000);
    expect(s.actual).toEqual({ needs: 2500, wants: 500, savings: 1000 });
    expect(s.actualPct.needs).toBeCloseTo(50, 5); // 2500/5000
    expect(s.goalAmount.needs).toBe(2500); // 50% of 5000
    expect(s.totalSpent).toBe(4000);
    expect(s.incomeSpentPct).toBeCloseTo(0.8, 5);
  });

  it("guards against zero income", () => {
    const s = frameworkSummary([row({ kind: "expense", actual: 100 })], { needs: 50, wants: 30, savings: 20 });
    expect(s.incomeSpentPct).toBe(0);
    expect(s.actualPct.needs).toBe(0);
  });
});
