// Sync layer (spec §8). Bridges the local IndexedDB stores and the user's Google
// Sheet. Single-user: we mirror each collection to its own tab. Reads pull the
// whole sheet; writes are local-first, then a debounced full-tab push
// (last-write-wins by the device that saved most recently — safe for one user).

import * as db from "./db";
import {
  HEADERS,
  SPREADSHEET_TITLE,
  TAB,
  V2_TABS,
  accountToRow,
  debtToRow,
  fundToRow,
  moneyToRow,
  netWorthToRow,
  periodToRow,
  recurringToRow,
  tombstoneToRow,
  txnToRow,
  rowToAccount,
  rowToDebt,
  rowToFund,
  rowToMoney,
  rowToNetWorth,
  rowToPeriod,
  rowToRecurring,
  rowToTombstone,
  rowToTxn,
} from "./schema";
import {
  batchGet,
  createSpreadsheet,
  ensureTabs,
  SheetNotFoundError,
  writeTab,
} from "./google/sheets";
import { currentToken, forgetToken, requestToken, SCOPE_SHEETS } from "./google/auth";
import { isValidAccessCode } from "./access";
import { isDemo } from "./demo";
import { DirtyTabs } from "./syncDirty";
import { mergeById } from "./merge";
import {
  getTombstones, setTombstones, mergeTombstones, applyTombstones, pruneTombstones, tombstoneCutoff,
} from "./tombstones";
import { useSettings } from "../stores/useSettings";
import { useBudget } from "../stores/useBudget";
import { useFunds, useDebts, useTransactions, useAccounts, useNetWorth, useRecurring } from "../stores/v2";
import type { Account, BudgetPeriod, Debt, Fund, MoneyRow, NetWorthItem, Recurring, Transaction } from "./types";

const LS_ID = "ub.spreadsheetId";

/** Accepts a raw spreadsheet id or a full Google Sheets URL and returns the id. */
export function extractSpreadsheetId(idOrUrl: string): string {
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export function getSpreadsheetId(): string {
  return localStorage.getItem(LS_ID) ?? "";
}
export function isConnected(): boolean {
  return getSpreadsheetId().length > 0;
}
function setSpreadsheetId(id: string) {
  localStorage.setItem(LS_ID, id);
}

const SYNC_TABS = [TAB.BudgetPeriods, TAB.Money, TAB.Funds, TAB.Debts, TAB.Transactions, TAB.Accounts, TAB.NetWorth, TAB.Recurring];
// Tombstones ride along in push/pull but aren't a "store" — handled specially.
const PUSH_TABS = [...SYNC_TABS, TAB.Tombstones];
const ALL_TABS = [...PUSH_TABS, ...V2_TABS];

// Per-collection dirty tracking (#22): a mutation marks only its own tab, so a
// debounced flush rewrites just what changed instead of all 8 tabs every time.
const COLLECTION_TO_TAB: Record<string, string> = {
  periods: TAB.BudgetPeriods,
  money: TAB.Money,
  funds: TAB.Funds,
  debts: TAB.Debts,
  transactions: TAB.Transactions,
  accounts: TAB.Accounts,
  networth: TAB.NetWorth,
  recurring: TAB.Recurring,
  tombstones: TAB.Tombstones,
};
const dirty = new DirtyTabs();

/** Flag a collection's tab dirty. An unknown/absent name marks everything —
    so any untagged mutation path still pushes fully (never silently skipped). */
export function markDirty(collection?: string): void {
  const tab = collection ? COLLECTION_TO_TAB[collection] : undefined;
  if (tab) dirty.markTab(tab);
  else dirty.markAll(PUSH_TABS);
}

// ---- push: build a full tab (header + current rows) from the live stores ----
function tabValues(tab: string): string[][] {
  const header = HEADERS[tab] ?? [];
  let rows: string[][] = [];
  switch (tab) {
    case TAB.BudgetPeriods: rows = useBudget.getState().periods.map(periodToRow); break;
    case TAB.Money: rows = useBudget.getState().money.map(moneyToRow); break;
    case TAB.Funds: rows = useFunds.getState().items.map(fundToRow); break;
    case TAB.Debts: rows = useDebts.getState().items.map(debtToRow); break;
    case TAB.Transactions: rows = useTransactions.getState().items.map(txnToRow); break;
    case TAB.Accounts: rows = useAccounts.getState().items.map(accountToRow); break;
    case TAB.NetWorth: rows = useNetWorth.getState().items.map(netWorthToRow); break;
    case TAB.Recurring: rows = useRecurring.getState().items.map(recurringToRow); break;
    case TAB.Tombstones: rows = getTombstones().map(tombstoneToRow); break;
  }
  return [header, ...rows];
}

export async function pushAll(force = false): Promise<void> {
  // Hard stop: never write the in-memory sample to a real Sheet. Demo mode
  // should always be off by the time anyone is connected (connect() clears it),
  // but this guarantees the sample can never leak upward even if it isn't.
  if (isDemo()) return;
  const id = getSpreadsheetId();
  if (!id) return;
  // Only the tabs that actually changed (all when forced or nothing tracked).
  // Sequential to stay well under rate limits for personal data volumes. A tab
  // is cleared from `dirty` only after its write succeeds, so a mid-flush
  // failure just retries it next time.
  const tabs = dirty.toPush(PUSH_TABS, force);
  for (const tab of tabs) {
    await writeTab(id, tab, tabValues(tab));
    dirty.clear(tab);
  }
}

// ---- pull: replace local data from the sheet ----
function parseRows<T>(rows: string[][], fromRow: (r: string[]) => T): T[] {
  // rows[0] is the header written by the app; skip it. Skip blank rows (no id).
  return rows
    .slice(1)
    .filter((r) => (r[0] ?? "").trim().length > 0)
    .map(fromRow);
}

export async function pull(): Promise<void> {
  const id = getSpreadsheetId();
  if (!id) return;
  const data = await batchGet(id, PUSH_TABS);

  // Delete markers first: union local + remote tombstones (newest per id),
  // prune expired ones, and persist. Rows are then filtered against the full
  // set so a deletion made on any device sticks after the merge below.
  const remoteTombs = parseRows(data[TAB.Tombstones] ?? [], rowToTombstone);
  const tombMerge = mergeTombstones(getTombstones(), remoteTombs);
  const tombstones = pruneTombstones(tombMerge.merged, tombstoneCutoff());
  setTombstones(tombstones);
  if (tombMerge.localContributed) markDirty("tombstones");

  // Row-granular merge (not blind replace): keep whichever copy of each row is
  // newer by `updatedAt`, so pulling the sheet on a second device doesn't clobber
  // that device's un-pushed edits, then drop anything a tombstone deleted. When a
  // local row survives, mark its tab dirty so the next flush converges the sheet.
  const merge = <T extends { id: string; updatedAt: string }>(
    collection: string,
    remoteRows: T[],
    localRows: T[]
  ): T[] => {
    const { merged, localContributed } = mergeById(localRows, remoteRows);
    if (localContributed) markDirty(collection);
    return applyTombstones(merged, tombstones);
  };

  const periods = merge("periods", parseRows<BudgetPeriod>(data[TAB.BudgetPeriods] ?? [], rowToPeriod), useBudget.getState().periods);
  const money = merge("money", parseRows<MoneyRow>(data[TAB.Money] ?? [], rowToMoney), useBudget.getState().money);
  const funds = merge("funds", parseRows<Fund>(data[TAB.Funds] ?? [], rowToFund), useFunds.getState().items);
  const debts = merge("debts", parseRows<Debt>(data[TAB.Debts] ?? [], rowToDebt), useDebts.getState().items);
  const transactions = merge("transactions", parseRows<Transaction>(data[TAB.Transactions] ?? [], rowToTxn), useTransactions.getState().items);
  const accounts = merge("accounts", parseRows<Account>(data[TAB.Accounts] ?? [], rowToAccount), useAccounts.getState().items);
  const networth = merge("networth", parseRows<NetWorthItem>(data[TAB.NetWorth] ?? [], rowToNetWorth), useNetWorth.getState().items);
  const recurring = merge("recurring", parseRows<Recurring>(data[TAB.Recurring] ?? [], rowToRecurring), useRecurring.getState().items);

  await Promise.all([
    replaceStore("periods", periods),
    replaceStore("money", money),
    replaceStore("funds", funds),
    replaceStore("debts", debts),
    replaceStore("transactions", transactions),
    replaceStore("accounts", accounts),
    replaceStore("networth", networth),
    replaceStore("recurring", recurring),
  ]);

  useBudget.getState().setAll(periods, money);
  useFunds.getState().setAll(funds);
  useDebts.getState().setAll(debts);
  useTransactions.getState().setAll(transactions);
  useAccounts.getState().setAll(accounts);
  useNetWorth.getState().setAll(networth);
  useRecurring.getState().setAll(recurring);
}

async function replaceStore<T extends { id: string }>(
  store: db.Collection,
  values: T[]
) {
  await db.clearStore(store);
  if (values.length) await db.putMany(store, values);
}

// ---- Meta tab: a tiny key/value store carried inside the user's own Sheet ----
async function readMetaTab(id: string): Promise<Map<string, string>> {
  const data = await batchGet(id, [TAB.Meta]).catch(() => ({}) as Record<string, string[][]>);
  const rows = (data[TAB.Meta] ?? []).slice(1); // skip header
  return new Map(rows.filter((r) => (r[0] ?? "").trim()).map((r) => [r[0], r[1] ?? ""]));
}

async function writeMetaKey(id: string, key: string, value: string): Promise<void> {
  const map = await readMetaTab(id);
  map.set(key, value);
  await writeTab(id, TAB.Meta, [["key", "value"], ...map.entries()]);
}

const ACCESS_CODE_META_KEY = "accessCode";

/**
 * Keep the buyer's Etsy access code and the Sheet in sync, both directions:
 * - Already activated locally → push our code up (so a second device that
 *   later connects to this same Sheet inherits it).
 * - Not yet activated, but this Sheet already carries a code from a previous
 *   device → adopt it locally. No local wipe here — pull() already brought
 *   down the real data for this Sheet, unlike a fresh manual code entry.
 */
async function syncAccessCode(id: string): Promise<void> {
  const settings = useSettings.getState();
  if (settings.activated && settings.accessCode) {
    await writeMetaKey(id, ACCESS_CODE_META_KEY, settings.accessCode).catch(() => {});
    return;
  }
  const map = await readMetaTab(id).catch(() => new Map<string, string>());
  const remoteCode = map.get(ACCESS_CODE_META_KEY) ?? "";
  if (remoteCode && isValidAccessCode(remoteCode)) {
    settings.update({ activated: true, accessCode: remoteCode });
  }
}

// ---- Household tab: one member name per row, mirrored from Settings ----
async function readHouseholdTab(id: string): Promise<string[]> {
  const data = await batchGet(id, [TAB.Household]).catch(() => ({}) as Record<string, string[][]>);
  const rows = (data[TAB.Household] ?? []).slice(1); // skip header
  return rows.map((r) => (r[0] ?? "").trim()).filter(Boolean);
}

async function writeHouseholdTab(id: string, names: string[]): Promise<void> {
  await writeTab(id, TAB.Household, [["name"], ...names.map((n) => [n])]);
}

/** Case-insensitive union that keeps `a`'s order, then appends new names from `b`. */
function unionMembers(a: string[], b: string[]): string[] {
  const out = [...a];
  const seen = new Set(a.map((m) => m.toLowerCase()));
  for (const m of b) {
    const k = m.toLowerCase();
    if (m && !seen.has(k)) { out.push(m); seen.add(k); }
  }
  return out;
}

/**
 * Roam the household member list through the Sheet's Household tab. Union both
 * ways (never drop a name at connect time): adopt any names this Sheet already
 * carries, and contribute any local names the Sheet is missing. Deliberate
 * removals propagate separately via pushHouseholdMembers() on the editing device.
 */
async function syncHousehold(id: string): Promise<void> {
  const settings = useSettings.getState();
  const local = settings.householdMembers ?? [];
  const remote = await readHouseholdTab(id).catch(() => [] as string[]);
  const merged = unionMembers(local, remote);
  if (merged.length !== local.length) settings.update({ householdMembers: merged });
  if (merged.length !== remote.length) await writeHouseholdTab(id, merged).catch(() => {});
}

/**
 * Best-effort authoritative push of the local household list to the Sheet, so an
 * add / rename / remove propagates immediately while connected. Guarded by a
 * valid silent token so editing a member can never trigger a sign-in popup — if
 * there's no cached token, the change simply rides along on the next connect().
 */
export async function pushHouseholdMembers(): Promise<void> {
  if (!isConnected() || !currentToken() || isDemo()) return;
  const id = getSpreadsheetId();
  if (!id) return;
  await writeHouseholdTab(id, useSettings.getState().householdMembers ?? []).catch(() => {});
}

/**
 * Connect a Google account. If a sheet id is remembered we relink + pull;
 * otherwise we create a fresh app-managed spreadsheet and push local data up.
 * Returns the spreadsheet id.
 */
export async function connect(): Promise<string> {
  // Ask for an interactive token FIRST, straight off the click — every other
  // Sheets call below tries a silent refresh before falling back to a popup,
  // which works for background sync but would delay the very first popup here
  // past the click's window for the browser to treat it as user-initiated.
  await requestToken(SCOPE_SHEETS, true);

  // Leaving demo BEFORE any push/pull: setDemoMode reloads the stores from the
  // user's real (blank for a new buyer) IndexedDB, so pushAll below seeds the
  // new sheet with THAT — never the in-memory sample. Dynamic import avoids the
  // sync ⇄ bootstrap ⇄ useSync require cycle.
  if (isDemo()) {
    const { setDemoMode } = await import("../stores/bootstrap");
    await setDemoMode(false);
  }

  const existing = getSpreadsheetId();
  if (existing) {
    try {
      await ensureTabs(existing, ALL_TABS);
      await pull();
      await syncAccessCode(existing);
      await syncHousehold(existing).catch(() => {});
      return existing;
    } catch (err) {
      if (err instanceof SheetNotFoundError) {
        localStorage.removeItem(LS_ID);
        // fall through to create a new one
      } else {
        throw err;
      }
    }
  }
  const id = await createSpreadsheet(SPREADSHEET_TITLE, ALL_TABS);
  setSpreadsheetId(id);
  await pushAll(true); // seed the new sheet fully (all tabs + headers)
  await syncAccessCode(id);
  await syncHousehold(id).catch(() => {});
  return id;
}

/**
 * Relink to a spreadsheet id (or full Sheets URL) the user pasted in — the
 * genuine cross-device path: a brand-new browser has no remembered id and no
 * local access code, so this is how it recovers both the real data AND the
 * activation state from an already-connected device's Sheet, with no re-typed
 * code and no wipe. Available even before local activation, since that's
 * exactly what it's for.
 */
export async function relink(idOrUrl: string): Promise<void> {
  const id = extractSpreadsheetId(idOrUrl);
  if (!id) throw new Error("That doesn't look like a Google Sheet link or ID.");
  await requestToken(SCOPE_SHEETS, true);
  await ensureTabs(id, ALL_TABS);
  setSpreadsheetId(id);
  await pull();
  await syncAccessCode(id);
  await syncHousehold(id).catch(() => {});
}

export function disconnect() {
  forgetToken();
  localStorage.removeItem(LS_ID);
}

// ---- debounced flush on every mutation ----
let timer: ReturnType<typeof setTimeout> | null = null;
export function scheduleFlush(onState: (s: "syncing" | "synced" | "offline") => void) {
  if (!isConnected()) return;
  if (!navigator.onLine) {
    onState("offline");
    return;
  }
  if (timer) clearTimeout(timer);
  onState("syncing");
  timer = setTimeout(() => {
    pushAll()
      .then(() => onState("synced"))
      .catch(() => onState("offline"));
  }, 2000);
}
