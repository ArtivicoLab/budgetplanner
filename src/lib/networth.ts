// Net worth (competitor-parity #8). Pure + testable. Bank accounts (positive =
// asset, negative = liability) and debts are auto-included; manual NetWorthItems
// add the rest (house, car, investments, mortgage…).
import type { Account, Debt, NetWorthItem, Transaction } from "./types";
import { accountFlows } from "./accounts";
import { addMonthsISO, endOfMonthISO, format, fromISO, todayISO } from "./dates";

export interface Slice {
  label: string;
  value: number;
}

export interface NetWorthSummary {
  assets: number;
  liabilities: number;
  netWorth: number;
  assetBreakdown: Slice[];
  liabilityBreakdown: Slice[];
  annualGrowth: number; // projected net change/yr from asset growth − liability interest
}

export function netWorthSummary(
  accounts: Account[],
  debts: Debt[],
  items: NetWorthItem[],
  txns: Transaction[]
): NetWorthSummary {
  const assetBreakdown: Slice[] = [];
  const liabilityBreakdown: Slice[] = [];
  let assets = 0;
  let liabilities = 0;
  let annualGrowth = 0;

  for (const a of accounts) {
    const cur = accountFlows(a, txns).current;
    if (cur >= 0) {
      assets += cur;
      assetBreakdown.push({ label: a.name, value: cur });
    } else {
      liabilities += -cur;
      liabilityBreakdown.push({ label: a.name, value: -cur });
    }
  }
  for (const d of debts) {
    if (d.currentBalance <= 0) continue;
    liabilities += d.currentBalance;
    liabilityBreakdown.push({ label: d.name, value: d.currentBalance });
  }
  for (const it of items) {
    const interest = (it.value * it.rate) / 100;
    if (it.kind === "asset") {
      assets += it.value;
      assetBreakdown.push({ label: it.name, value: it.value });
      annualGrowth += interest; // assets appreciate
    } else {
      liabilities += it.value;
      liabilityBreakdown.push({ label: it.name, value: it.value });
      annualGrowth -= interest; // liabilities accrue interest against you
    }
  }

  return { assets, liabilities, netWorth: assets - liabilities, assetBreakdown, liabilityBreakdown, annualGrowth };
}

/**
 * Net worth month-by-month for the last `months`. Account balances are derived
 * from the transaction log at each month-end; debts and manual items are
 * point-in-time (a constant offset), so the trend reflects real account growth.
 */
export function netWorthTrend(
  accounts: Account[],
  debts: Debt[],
  items: NetWorthItem[],
  txns: Transaction[],
  months = 6
): Slice[] {
  const today = todayISO();
  const [y, m] = today.split("-");
  const firstOfThis = `${y}-${m}-01`;
  const manualAssets = items.filter((i) => i.kind === "asset").reduce((a, i) => a + i.value, 0);
  const manualLiab = items.filter((i) => i.kind === "liability").reduce((a, i) => a + i.value, 0);
  const debtsTotal = debts.reduce((a, d) => a + Math.max(0, d.currentBalance), 0);
  const offset = manualAssets - manualLiab - debtsTotal;

  const out: Slice[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const anchor = addMonthsISO(firstOfThis, -k);
    const monthEnd = endOfMonthISO(anchor);
    const cutoff = monthEnd > today ? today : monthEnd;
    const upTo = txns.filter((t) => t.date <= cutoff);
    let acctSum = 0;
    for (const a of accounts) acctSum += accountFlows(a, upTo).current;
    out.push({ label: format(fromISO(anchor), "MMM"), value: acctSum + offset });
  }
  return out;
}
