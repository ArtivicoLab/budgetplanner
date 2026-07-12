// Price versioning for recurring items (subscriptions / recurring bills).
//
// A Recurring template drives EVERY occurrence from a single `amount`, so naively
// editing that amount rewrites the price of all past months too and corrupts
// historical period math. Instead, a price change becomes a chain: the old-price
// row is capped with an `endDate` (its earlier months keep the old price) and a
// NEW row starts at the change date, linked back via `supersedes`. This can
// repeat any number of times, giving each subscription a real price trajectory.
//
// Pure + testable — no store or React here. See RecurringScreen for the UI.
import type { Recurring } from "./types";
import { addDaysISO } from "./dates";

export type PriceDirection = "up" | "down" | "same" | "first";

export interface PriceDelta {
  abs: number; // newAmount - oldAmount
  pct: number; // percent change vs the old amount (0 if old is 0)
  direction: PriceDirection;
}

export interface PriceVersion {
  rec: Recurring;
  amount: number;
  from: string; // anchorDate
  to: string; // endDate ("" = still current / open-ended)
  delta: PriceDelta; // vs the previous version (direction "first" for the oldest)
}

export interface PriceChain {
  rootId: string;
  currentId: string; // the latest (un-superseded) version's id
  name: string;
  versions: PriceVersion[]; // oldest -> newest
}

/** Percent/direction of a price move. */
export function priceDelta(oldAmount: number, newAmount: number): PriceDelta {
  const abs = round2(newAmount - oldAmount);
  const pct = oldAmount === 0 ? 0 : round2((abs / Math.abs(oldAmount)) * 100);
  const direction: PriceDirection = abs > 0.005 ? "up" : abs < -0.005 ? "down" : "same";
  return { abs, pct, direction };
}

/** True when some other row supersedes `recId` (i.e. it's an older price version). */
export function isSuperseded(items: Recurring[], recId: string): boolean {
  return items.some((r) => r.supersedes === recId);
}

/** The rows to show in the main list: current (un-superseded) versions only. */
export function currentVersions(items: Recurring[]): Recurring[] {
  return items.filter((r) => !isSuperseded(items, r.id));
}

/** Build the full price chain (oldest -> newest) that `recId` belongs to. */
export function chainFor(items: Recurring[], recId: string): PriceChain {
  const byId = new Map(items.map((r) => [r.id, r]));
  const start = byId.get(recId);
  if (!start) return { rootId: recId, currentId: recId, name: "", versions: [] };

  // Walk back to the root (oldest version).
  let root = start;
  const back = new Set<string>([root.id]);
  while (root.supersedes && byId.has(root.supersedes) && !back.has(root.supersedes)) {
    root = byId.get(root.supersedes)!;
    back.add(root.id);
  }

  // Walk forward following successors.
  const ordered: Recurring[] = [root];
  const seen = new Set<string>([root.id]);
  let cur = root;
  for (;;) {
    const next = items.find((r) => r.supersedes === cur.id && !seen.has(r.id));
    if (!next) break;
    ordered.push(next);
    seen.add(next.id);
    cur = next;
  }

  const versions: PriceVersion[] = ordered.map((rec, i) => ({
    rec,
    amount: rec.amount,
    from: rec.anchorDate,
    to: rec.endDate,
    delta: i === 0 ? { abs: 0, pct: 0, direction: "first" } : priceDelta(ordered[i - 1].amount, rec.amount),
  }));

  return { rootId: root.id, currentId: ordered[ordered.length - 1].id, name: root.name, versions };
}

/** The most recent price move for the chain `recId` is in, or null if it has none. */
export function latestChange(items: Recurring[], recId: string): { from: number; to: number; delta: PriceDelta } | null {
  const chain = chainFor(items, recId);
  if (chain.versions.length < 2) return null;
  const last = chain.versions[chain.versions.length - 1];
  const prev = chain.versions[chain.versions.length - 2];
  return { from: prev.amount, to: last.amount, delta: last.delta };
}

/** True when `rec` has real history to protect (an occurrence on/before `today`). */
export function hasCommittedHistory(rec: Recurring, today: string): boolean {
  return !!rec.anchorDate && rec.anchorDate <= today;
}

/**
 * Plan a price change: cap the old version the day before `effectiveISO`, and
 * describe the new version that starts on `effectiveISO`. Pure — the caller
 * applies `closePatch` via update() and `newVersion` via add().
 */
export function supersedePlan(
  old: Recurring,
  patch: Partial<Recurring>,
  effectiveISO: string
): { closePatch: Partial<Recurring>; newVersion: Partial<Recurring> } {
  return {
    closePatch: { endDate: addDaysISO(effectiveISO, -1) },
    newVersion: {
      ...patch,
      anchorDate: effectiveISO,
      endDate: patch.endDate ?? "",
      supersedes: old.id,
      active: true,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
