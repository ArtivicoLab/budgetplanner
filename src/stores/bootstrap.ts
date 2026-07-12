// Hydrate every store from IndexedDB on boot; seed sample data on first run.

import * as db from "../lib/db";
import { buildSample, type Seed } from "../lib/sample";
import { isValidAccessCode } from "../lib/access";
import { isDemo, setDemoFlag } from "../lib/demo";
import { loadTombstones } from "../lib/tombstones";
import { useBudget } from "./useBudget";
import { useSettings } from "./useSettings";
import { useSync } from "./useSync";
import { useFunds, useDebts, useTransactions, useAccounts, useNetWorth, useRecurring } from "./v2";
import type { Account, BudgetPeriod, Debt, Fund, MoneyRow, NetWorthItem, Recurring, Transaction } from "../lib/types";

const SEEDED_KEY = "seeded"; // legacy flag: the OLD build wrote it when it seeded IndexedDB

async function loadStores() {
  const [periods, money, funds, debts, transactions, accounts, networth, recurring] = await Promise.all([
    db.all<BudgetPeriod>("periods"),
    db.all<MoneyRow>("money"),
    db.all<Fund>("funds"),
    db.all<Debt>("debts"),
    db.all<Transaction>("transactions"),
    db.all<Account>("accounts"),
    db.all<NetWorthItem>("networth"),
    db.all<Recurring>("recurring"),
  ]);
  // Backfill periods saved before `cadence` existed — IndexedDB has no schema,
  // so old rows would otherwise push a blank cadence cell to the Sheet on sync.
  useBudget.getState().setAll(periods.map((p) => ({ ...p, cadence: p.cadence || "monthly" })), money);
  useFunds.getState().setAll(funds);
  useDebts.getState().setAll(debts);
  useTransactions.getState().setAll(transactions);
  useAccounts.getState().setAll(accounts);
  useNetWorth.getState().setAll(networth);
  useRecurring.getState().setAll(recurring);
}

// Load the full-year sample straight into the in-memory stores. Nothing is
// written to IndexedDB (db writes are gated off while demo mode is on), so the
// dummy data is purely a display layer — it can never be pushed to a Sheet or
// mistaken for real data. Every reload rebuilds a fresh, complete demo.
function loadSampleIntoStores(s: Seed = buildSample()) {
  useBudget.getState().setAll(s.periods.map((p) => ({ ...p, cadence: p.cadence || "monthly" })), s.money);
  useFunds.getState().setAll(s.funds);
  useDebts.getState().setAll(s.debts);
  useTransactions.getState().setAll(s.transactions);
  useAccounts.getState().setAll(s.accounts);
  useNetWorth.getState().setAll(s.networth);
  useRecurring.getState().setAll(s.recurring);
}

// One-time migration off the OLD model, which seeded the sample straight into
// IndexedDB for un-activated users. Under the memory-only demo, IndexedDB must
// hold ONLY real data — otherwise a legacy visitor who turns demo OFF (or
// connects) would see stale seed rows masquerading as their own. So: if the old
// seed ran and they never became a real (activated) user, clear the collections.
const DEMO_MIGRATED_KEY = "demoMigratedV1";
async function migrateLegacySeed() {
  if (await db.getKV<boolean>(DEMO_MIGRATED_KEY)) return;
  const hadOldSeed = await db.getKV<boolean>(SEEDED_KEY);
  if (hadOldSeed && !useSettings.getState().activated) {
    for (const c of db.ALL_COLLECTIONS) {
      try { await db.clearStore(c); } catch { /* store may not exist yet */ }
    }
  }
  await db.setKV(DEMO_MIGRATED_KEY, true);
}

// Memoize so React StrictMode's double-invoked effect (or any repeat call)
// shares ONE run.
let bootPromise: Promise<void> | null = null;

export function bootstrap(): Promise<void> {
  if (!bootPromise) bootPromise = runBootstrap();
  return bootPromise;
}

async function runBootstrap() {
  await useSettings.getState().load();
  await loadTombstones();
  await migrateLegacySeed();
  const demo = isDemo();
  db.setDbDemoMode(demo);
  if (demo) {
    loadSampleIntoStores();
  } else {
    await loadStores();
  }
}

/**
 * Flip demo mode on/off at runtime (the Settings toggle). The choice persists
 * in localStorage (see lib/demo). Turning it ON shows the full-year sample
 * without touching the user's stored data; turning it OFF reloads their real
 * (possibly empty) data from IndexedDB.
 */
export async function setDemoMode(on: boolean): Promise<void> {
  setDemoFlag(on);
  db.setDbDemoMode(on);
  if (on) {
    loadSampleIntoStores();
  } else {
    await loadStores();
  }
}

/**
 * Unlock the real (Google Sheets-connectable) app with an Etsy purchase code.
 * Soft client-side check only (see lib/access.ts). Under the memory-only demo
 * model there's nothing to wipe — the sample was never written to IndexedDB —
 * so this just leaves demo mode and shows the user's own (blank for a new
 * buyer) data. It deliberately does NOT delete anything.
 */
export async function activate(code: string): Promise<boolean> {
  if (!isValidAccessCode(code)) return false;
  setDemoFlag(false);
  db.setDbDemoMode(false);
  if (!useSettings.getState().activated) {
    await loadStores();
    useSettings.getState().update({ activated: true, accessCode: code.trim().toUpperCase() });
  }
  return true;
}

export async function resetEverything() {
  // An explicit "start fresh" is a real-app action — leave demo so writes land
  // again and the user sees their now-empty real budget, not the sample.
  setDemoFlag(false);
  db.setDbDemoMode(false);
  await db.wipeAll();
  useBudget.getState().setAll([], []);
  useBudget.setState({ currentPeriodId: "" });
  useFunds.getState().setAll([]);
  useDebts.getState().setAll([]);
  useTransactions.getState().setAll([]);
  useAccounts.getState().setAll([]);
  useNetWorth.getState().setAll([]);
  useRecurring.getState().setAll([]);
}

export interface YearResetOptions {
  money: boolean; // this year's transactions (income/bills/expenses/savings/debt rows + budget periods)
}

/**
 * "Reuse year after year": clear this year's transactional history (budget
 * periods + their money rows) while keeping the reusable structures — Sinking
 * Funds, Debts, and all Settings (including custom categories).
 */
export async function resetForNewYear(opts: YearResetOptions): Promise<void> {
  if (opts.money) {
    await db.clearStore("periods");
    await db.clearStore("money");
    useBudget.getState().setAll([], []);
    useBudget.setState({ currentPeriodId: "" });
  }
  useSync.getState().touch();
}

export { loadStores, loadSampleIntoStores };
