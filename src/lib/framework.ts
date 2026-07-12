// 50/30/20 framework (competitor-parity #15). Pure + testable. Splits spending
// into Needs / Wants / Savings(+Debt) and compares against customizable goals.
import type { MoneyRow } from "./types";

export type Bucket = "needs" | "wants" | "savings";

/** Default bucket for a line when it hasn't been tagged: bills & expenses are
 *  Needs (user re-tags the discretionary ones to Wants), debt & savings roll up
 *  to Savings, income is untagged. */
export function defaultBucket(kind: MoneyRow["kind"]): Bucket | "" {
  if (kind === "income") return "";
  if (kind === "debt" || kind === "saving") return "savings";
  return "needs";
}

export function effectiveBucket(row: MoneyRow): Bucket | "" {
  if (row.kind === "income") return "";
  return (row.bucket as Bucket) || (defaultBucket(row.kind) as Bucket);
}

export interface BucketGoals {
  needs: number;
  wants: number;
  savings: number;
}

export interface FrameworkSummary {
  income: number;
  actual: BucketGoals; // actual $ per bucket
  goalPct: BucketGoals; // goal % per bucket
  actualPct: BucketGoals; // actual % of income per bucket
  goalAmount: BucketGoals; // goal $ (goal% × income)
  totalSpent: number;
  incomeSpentPct: number; // totalSpent / income (0..1+)
  untagged: number; // count of expense/bill/debt/saving lines with a value but no clear bucket (always 0 here — defaults cover all)
}

export function frameworkSummary(rows: MoneyRow[], goals: BucketGoals): FrameworkSummary {
  let income = 0;
  const actual: BucketGoals = { needs: 0, wants: 0, savings: 0 };
  for (const r of rows) {
    const a = r.actual || 0;
    if (r.kind === "income") {
      income += a;
      continue;
    }
    const bkt = effectiveBucket(r);
    if (bkt) actual[bkt] += a;
  }
  const totalSpent = actual.needs + actual.wants + actual.savings;
  const pctOf = (v: number) => (income > 0 ? (v / income) * 100 : 0);
  return {
    income,
    actual,
    goalPct: goals,
    actualPct: { needs: pctOf(actual.needs), wants: pctOf(actual.wants), savings: pctOf(actual.savings) },
    goalAmount: {
      needs: (income * goals.needs) / 100,
      wants: (income * goals.wants) / 100,
      savings: (income * goals.savings) / 100,
    },
    totalSpent,
    incomeSpentPct: income > 0 ? totalSpent / income : 0,
    untagged: 0,
  };
}
