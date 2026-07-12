// Net Worth Tracker (competitor-parity #8). Accounts + debts are auto-included;
// manual NetWorthItems add the rest. All derived — nothing double-entered.
import { useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Segmented } from "../../components/Segmented";
import { CountUp } from "../../components/CountUp";
import { ProgressRing } from "../../components/ProgressRing";
import { AreaChart, Donut } from "../../components/Charts";
import { HelpTip } from "../../components/HelpTip";
import { IconPlus, IconClose } from "../../components/icons";
import { useNetWorth, useAccounts, useDebts, useTransactions } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { netWorthSummary, netWorthTrend } from "../../lib/networth";
import { money as fmtMoney, categoryColor } from "../../lib/ui";
import type { NetWorthItem, NetWorthKind } from "../../lib/types";

function topSlices(slices: { label: string; value: number }[], n = 6) {
  const sorted = [...slices].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, n);
  const rest = sorted.slice(n).reduce((a, s) => a + s.value, 0);
  if (rest > 0) top.push({ label: "Other", value: rest });
  return top;
}

export function NetWorthScreen() {
  const { items, add, update, remove } = useNetWorth();
  const { items: accounts } = useAccounts();
  const { items: debts } = useDebts();
  const { items: txns } = useTransactions();
  const { currency, netWorthGoal, update: updateSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<NetWorthItem | null>(null);
  const [goalInput, setGoalInput] = useState(netWorthGoal ? String(netWorthGoal) : "");

  const summary = useMemo(() => netWorthSummary(accounts, debts, items, txns), [accounts, debts, items, txns]);
  const trend = useMemo(() => netWorthTrend(accounts, debts, items, txns, 12), [accounts, debts, items, txns]);

  const goalPct = netWorthGoal > 0 ? summary.netWorth / netWorthGoal : 0;
  const amountToGoal = netWorthGoal - summary.netWorth;
  const growth = trend.length >= 2 ? trend[trend.length - 1].value - trend[0].value : 0;

  const assetSlices = topSlices(summary.assetBreakdown);

  const manualAssets = items.filter((i) => i.kind === "asset");
  const manualLiabilities = items.filter((i) => i.kind === "liability");

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Assets minus what you owe</div>
        <h1 className="screen-head__title">
          Net Worth
          <HelpTip text="Everything you own minus everything you owe. Your bank accounts and debts flow in automatically; add anything else (home, car, investments, loans) below." />
        </h1>
      </div>

      {/* Hero */}
      <div className="card nw-hero" data-tour="networth-hero">
        {netWorthGoal > 0 && (
          <ProgressRing
            value={Math.min(1, Math.max(0, goalPct))}
            size={92}
            stroke={9}
            ariaLabel={`${Math.round(goalPct * 100)}% of net worth goal`}
            center={<span className="txt-strong-800">{Math.round(goalPct * 100)}%</span>}
          />
        )}
        <div className="nw-hero__body">
          <div className="muted eyebrow-12">NET WORTH</div>
          <div className={`big-number ${summary.netWorth < 0 ? "neg" : ""}`}>
            <CountUp value={summary.netWorth} format={(n) => fmtMoney(n, currency)} />
          </div>
          <div className="nw-hero__stats">
            <span className="tile__value--success">Assets {fmtMoney(summary.assets, currency)}</span>
            <span className="neg">Owed {fmtMoney(summary.liabilities, currency)}</span>
            {summary.annualGrowth !== 0 && (
              <span className={summary.annualGrowth >= 0 ? "tile__value--success" : "neg"}>
                {summary.annualGrowth >= 0 ? "+" : "−"}{fmtMoney(Math.abs(summary.annualGrowth), currency)}/yr
              </span>
            )}
            {netWorthGoal > 0 && (
              <span className="muted">{amountToGoal > 0 ? `${fmtMoney(amountToGoal, currency)} to goal` : "Goal reached"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Trend */}
      {trend.length >= 2 && (
        <div className="card" data-tour="networth-trend">
          <div className="section-title section-title--compact section-title--success">
            Net worth over time
            <HelpTip text="Your net worth month by month. The line tracks your bank-account balances through the year; debts and manual items are point-in-time." />
          </div>
          <div className="muted fs-13 mb-2">{growth >= 0 ? "+" : ""}{fmtMoney(growth, currency)} over {trend.length} months</div>
          <AreaChart
            points={trend.map((t) => t.value)}
            xLabels={trend.map((t) => t.label)}
            height={220}
            referenceValue={netWorthGoal > 0 ? netWorthGoal : undefined}
            formatValue={(n) => fmtMoney(n, currency)}
          />
        </div>
      )}

      <div className="bento">
        <div className="bento__col">
          {/* Assets distribution */}
          {assetSlices.length > 0 && (
            <div className="card" data-tour="networth-assetdist">
              <div className="section-title section-title--compact">
                Assets distribution
                <HelpTip text="Where your assets sit — accounts and anything you've added." />
              </div>
              <Donut
                formatValue={(n) => fmtMoney(n, currency)}
                size={150}
                slices={assetSlices.map((s) => ({ label: s.label, value: s.value, color: categoryColor(s.label) }))}
                center={<div className="txt-strong fs-13">{fmtMoney(summary.assets, currency)}</div>}
              />
            </div>
          )}
        </div>

        <div className="bento__col">
          {/* Assets vs liabilities */}
          <div className="card" data-tour="networth-split">
            <div className="section-title section-title--compact">Assets vs. what you owe</div>
            <div className="nw-avl">
              <div className="spread row-label-13"><span className="muted">Assets</span><span className="tile__value--success">{fmtMoney(summary.assets, currency)}</span></div>
              <div className="pbar mb-3"><div className="pbar__fill" style={{ width: "100%", background: "var(--success)" }} /></div>
              <div className="spread row-label-13"><span className="muted">Liabilities</span><span className="neg">{fmtMoney(summary.liabilities, currency)}</span></div>
              <div className="pbar"><div className="pbar__fill" style={{ width: `${summary.assets > 0 ? Math.min(100, (summary.liabilities / summary.assets) * 100) : 0}%`, background: "var(--alert)" }} /></div>
            </div>
          </div>

          {/* Goal */}
          <div className="card" data-tour="networth-goal">
            <div className="section-title section-title--compact">Net worth goal</div>
            <div className="spread debt-extra-row" style={{ marginTop: 0 }}>
              <label htmlFor="nw-goal" className="field__label field__label--flush">Target ({currency})</label>
              <input id="nw-goal" className="input debt-extra-input" type="number" inputMode="decimal"
                value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                onBlur={() => updateSettings({ netWorthGoal: Number(goalInput) || 0 })}
                placeholder="0" />
            </div>
          </div>
        </div>
      </div>

      {/* Manual items */}
      <ItemList title="Assets" tourKey="networth-assets" items={manualAssets} currency={currency} onEdit={(it) => { setEdit(it); setOpen(true); }} onAdd={() => { setEdit({ kind: "asset" } as NetWorthItem); setOpen(true); }} />
      <ItemList title="Liabilities" tourKey="networth-liabilities" items={manualLiabilities} currency={currency} onEdit={(it) => { setEdit(it); setOpen(true); }} onAdd={() => { setEdit({ kind: "liability" } as NetWorthItem); setOpen(true); }} />

      <ItemSheet
        open={open}
        item={edit && edit.id ? edit : null}
        defaultKind={edit?.kind ?? "asset"}
        currency={currency}
        onClose={() => setOpen(false)}
        onSave={(patch) => { edit && edit.id ? update(edit.id, patch) : add(patch); setOpen(false); }}
        onDelete={edit && edit.id ? () => { remove(edit.id); setOpen(false); } : undefined}
      />
    </>
  );
}

function ItemList({
  title, tourKey, items, currency, onEdit, onAdd,
}: {
  title: string;
  tourKey?: string;
  items: NetWorthItem[];
  currency: string;
  onEdit: (it: NetWorthItem) => void;
  onAdd: () => void;
}) {
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <div data-tour={tourKey}>
      <div className="section-title spread" style={{ display: "flex" }}>
        <span>{title}</span>
        <span>{fmtMoney(total, currency)}</span>
      </div>
      <div className="card" style={{ padding: "4px 16px" }}>
        {items.map((it) => (
          <button key={it.id} className="row" style={{ width: "100%", textAlign: "left", background: "none" }} onClick={() => onEdit(it)}>
            <div className="row__body">
              <div className="row__title">{it.name || "Untitled"}</div>
              {(it.category || it.rate) && (
                <div className="row__sub">{[it.category, it.rate ? `${it.rate}%` : ""].filter(Boolean).join(" · ")}</div>
              )}
            </div>
            <span className="txt-strong">{fmtMoney(it.value, currency)}</span>
          </button>
        ))}
        <button className="btn btn--ghost" style={{ padding: 12 }} onClick={onAdd}>+ Add {title.toLowerCase().replace(/s$/, "")}</button>
      </div>
    </div>
  );
}

function ItemSheet({
  open, item, defaultKind, currency, onClose, onSave, onDelete,
}: {
  open: boolean;
  item: NetWorthItem | null;
  defaultKind: NetWorthKind;
  currency: string;
  onClose: () => void;
  onSave: (patch: Partial<NetWorthItem>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<NetWorthKind>("asset");
  const [value, setValue] = useState("");
  const [rate, setRate] = useState("");
  const [category, setCategory] = useState("");

  useMemo(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setKind(item?.kind ?? defaultKind);
    setValue(item ? String(item.value) : "");
    setRate(item && item.rate ? String(item.rate) : "");
    setCategory(item?.category ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), kind, value: Number(value) || 0, rate: Number(rate) || 0, category: category.trim() });
  }

  return (
    <BottomSheet open={open} title={item ? "Edit item" : "New item"} onClose={onClose}>
      <div className="field">
        <label className="field__label">Type</label>
        <Segmented options={[{ value: "asset", label: "Asset" }, { value: "liability", label: "Liability" }]} value={kind} onChange={setKind} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="nw-name">Name</label>
        <input id="nw-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home" />
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="nw-value">Value ({currency})</label>
          <input id="nw-value" className="input" type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="nw-rate">{kind === "asset" ? "Growth" : "Interest"} rate %</label>
          <input id="nw-rate" className="input" type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="nw-cat">Category</label>
        <input id="nw-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Property" />
      </div>
      <button className="btn btn--primary" onClick={save} disabled={!name.trim()}>{item ? "Save" : "Add"}</button>
      {onDelete && <button className="btn btn--danger mt-10" onClick={onDelete}><IconClose size={16} /> Delete</button>}
    </BottomSheet>
  );
}
