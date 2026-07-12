import { describe, it, expect } from "vitest";
import {
  priceDelta,
  isSuperseded,
  currentVersions,
  chainFor,
  latestChange,
  hasCommittedHistory,
  supersedePlan,
} from "../src/lib/priceHistory";
import type { Recurring } from "../src/lib/types";

function rec(p: Partial<Recurring>): Recurring {
  return {
    id: "r", name: "Netflix", kind: "bill", category: "Subscriptions", amount: 15,
    account: "", toAccount: "", spender: "", cadence: "monthly",
    anchorDate: "2026-01-20", endDate: "", day2: 0, active: true, supersedes: "",
    createdAt: "", updatedAt: "", ...p,
  };
}

// Netflix: $13.99 (Jan–May) -> $15 (Jun–now) -> $17 (open)
const v1 = rec({ id: "a", amount: 13.99, anchorDate: "2026-01-20", endDate: "2026-05-31" });
const v2 = rec({ id: "b", amount: 15, anchorDate: "2026-06-20", endDate: "2026-08-31", supersedes: "a" });
const v3 = rec({ id: "c", amount: 17, anchorDate: "2026-09-01", endDate: "", supersedes: "b" });
const chain = [v3, v1, v2]; // deliberately unordered

describe("priceDelta", () => {
  it("computes an increase", () => {
    expect(priceDelta(15, 17)).toEqual({ abs: 2, pct: 13.33, direction: "up" });
  });
  it("computes a decrease", () => {
    const d = priceDelta(20, 15);
    expect(d.direction).toBe("down");
    expect(d.abs).toBe(-5);
    expect(d.pct).toBe(-25);
  });
  it("no change is 'same'", () => {
    expect(priceDelta(15, 15).direction).toBe("same");
  });
  it("guards divide-by-zero", () => {
    expect(priceDelta(0, 15).pct).toBe(0);
  });
});

describe("supersession helpers", () => {
  it("isSuperseded flags older versions", () => {
    expect(isSuperseded(chain, "a")).toBe(true);
    expect(isSuperseded(chain, "b")).toBe(true);
    expect(isSuperseded(chain, "c")).toBe(false);
  });
  it("currentVersions returns only the latest of each chain", () => {
    expect(currentVersions(chain).map((r) => r.id)).toEqual(["c"]);
  });
});

describe("chainFor", () => {
  it("orders oldest -> newest regardless of input order, from any member", () => {
    for (const id of ["a", "b", "c"]) {
      const c = chainFor(chain, id);
      expect(c.versions.map((v) => v.rec.id)).toEqual(["a", "b", "c"]);
      expect(c.rootId).toBe("a");
      expect(c.currentId).toBe("c");
    }
  });
  it("annotates per-version deltas", () => {
    const c = chainFor(chain, "c");
    expect(c.versions[0].delta.direction).toBe("first");
    expect(c.versions[1].delta.direction).toBe("up"); // 13.99 -> 15
    expect(c.versions[2].delta).toEqual({ abs: 2, pct: 13.33, direction: "up" }); // 15 -> 17
  });
  it("a lone item is a single-version chain", () => {
    const solo = chainFor([rec({ id: "x" })], "x");
    expect(solo.versions).toHaveLength(1);
    expect(solo.currentId).toBe("x");
  });
});

describe("latestChange", () => {
  it("reports the most recent move", () => {
    const lc = latestChange(chain, "c");
    expect(lc).toEqual({ from: 15, to: 17, delta: { abs: 2, pct: 13.33, direction: "up" } });
  });
  it("is null with no history", () => {
    expect(latestChange([rec({ id: "x" })], "x")).toBeNull();
  });
});

describe("hasCommittedHistory", () => {
  it("true once the anchor is on/before today", () => {
    expect(hasCommittedHistory(rec({ anchorDate: "2026-01-20" }), "2026-07-07")).toBe(true);
  });
  it("false for a wholly future item", () => {
    expect(hasCommittedHistory(rec({ anchorDate: "2026-12-01" }), "2026-07-07")).toBe(false);
  });
});

describe("supersedePlan", () => {
  it("caps the old version the day before the change and starts a linked new one", () => {
    const old = rec({ id: "a", amount: 15 });
    const { closePatch, newVersion } = supersedePlan(old, { ...old, amount: 17 }, "2026-09-01");
    expect(closePatch.endDate).toBe("2026-08-31");
    expect(newVersion.amount).toBe(17);
    expect(newVersion.anchorDate).toBe("2026-09-01");
    expect(newVersion.supersedes).toBe("a");
    expect(newVersion.active).toBe(true);
    expect(newVersion.endDate).toBe("");
  });
});
