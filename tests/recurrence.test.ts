import { describe, expect, it } from "vitest";
import { expandRecurrence, nextOccurrence } from "../src/lib/recurrence";
import type { Recurring } from "../src/lib/types";

function rec(p: Partial<Recurring>): Recurring {
  return {
    id: "r", name: "Rent", kind: "bill", category: "Housing", amount: 1500,
    account: "", toAccount: "", spender: "", cadence: "monthly",
    anchorDate: "2026-01-15", endDate: "", day2: 0, active: true, supersedes: "",
    createdAt: "", updatedAt: "", ...p,
  };
}

describe("expandRecurrence", () => {
  it("weekly lands every 7 days", () => {
    const d = expandRecurrence(rec({ cadence: "weekly", anchorDate: "2026-01-01" }), "2026-01-01", "2026-01-31");
    expect(d).toEqual(["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22", "2026-01-29"]);
  });

  it("monthly repeats on the anchor day and clamps short months", () => {
    const d = expandRecurrence(rec({ cadence: "monthly", anchorDate: "2026-01-31" }), "2026-01-01", "2026-03-31");
    expect(d).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("respects the last-payment end date", () => {
    const d = expandRecurrence(rec({ cadence: "monthly", anchorDate: "2026-01-15", endDate: "2026-02-28" }), "2026-01-01", "2026-12-31");
    expect(d).toEqual(["2026-01-15", "2026-02-15"]);
  });

  it("every 2 months steps correctly", () => {
    const d = expandRecurrence(rec({ cadence: "every2months", anchorDate: "2026-01-10" }), "2026-01-01", "2026-06-30");
    expect(d).toEqual(["2026-01-10", "2026-03-10", "2026-05-10"]);
  });

  it("semi-monthly emits two days per month", () => {
    const d = expandRecurrence(rec({ cadence: "semimonthly", anchorDate: "2026-01-01", day2: 15 }), "2026-01-01", "2026-02-28");
    expect(d).toEqual(["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-15"]);
  });

  it("only returns occurrences inside the window", () => {
    const d = expandRecurrence(rec({ cadence: "monthly", anchorDate: "2026-01-15" }), "2026-03-01", "2026-04-30");
    expect(d).toEqual(["2026-03-15", "2026-04-15"]);
  });

  it("inactive templates produce nothing", () => {
    expect(expandRecurrence(rec({ active: false }), "2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("nextOccurrence finds the first upcoming date", () => {
    expect(nextOccurrence(rec({ cadence: "monthly", anchorDate: "2026-01-15" }), "2026-03-20")).toBe("2026-04-15");
  });
});
