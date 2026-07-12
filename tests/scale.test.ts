import { describe, it, expect } from "vitest";
import { DirtyTabs } from "../src/lib/syncDirty";
import { makeSeedTransactions } from "../src/lib/perfSeed";

describe("DirtyTabs", () => {
  const ALL = ["A", "B", "C"];

  it("pushes only the dirty subset, in order", () => {
    const d = new DirtyTabs();
    d.markTab("C");
    d.markTab("A");
    expect(d.toPush(ALL)).toEqual(["A", "C"]);
  });

  it("pushes everything when nothing is tracked or when forced", () => {
    const d = new DirtyTabs();
    expect(d.toPush(ALL)).toEqual(ALL); // empty → all
    d.markTab("B");
    expect(d.toPush(ALL, true)).toEqual(ALL); // forced → all
  });

  it("markAll dirties every tab; clear removes one", () => {
    const d = new DirtyTabs();
    d.markAll(ALL);
    expect(d.size).toBe(3);
    d.clear("B");
    expect(d.toPush(ALL)).toEqual(["A", "C"]);
  });
});

describe("makeSeedTransactions", () => {
  it("produces N deterministic, valid rows", () => {
    const a = makeSeedTransactions(1000, "2026-07-07");
    const b = makeSeedTransactions(1000, "2026-07-07");
    expect(a).toHaveLength(1000);
    expect(a).toEqual(b); // deterministic
    for (const t of a.slice(0, 50)) {
      expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(t.amount).toBeGreaterThan(0);
      expect(t.paid).toBe(true);
    }
  });
  it("mixes income and outflow kinds", () => {
    const rows = makeSeedTransactions(90, "2026-07-07");
    const incomes = rows.filter((r) => r.kind === "income").length;
    expect(incomes).toBeGreaterThan(0);
    expect(incomes).toBeLessThan(rows.length);
  });
});
