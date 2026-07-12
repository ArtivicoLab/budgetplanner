// Recurring transactions (competitor-parity #10). Templates auto-generate dated
// occurrences via the recurrence engine; logging one materializes a Transaction.
import { useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Chip, ChipRow } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { HelpTip } from "../../components/HelpTip";
import { IconRepeat, IconPlus, IconClose, IconCheck, IconTrend, IconTrendDown, IconArrowRight } from "../../components/icons";
import { SpenderField } from "../../components/SpenderField";
import { useRecurring, useTransactions } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { expandRecurrence, nextOccurrence } from "../../lib/recurrence";
import {
  currentVersions, chainFor, latestChange, hasCommittedHistory, supersedePlan, priceDelta,
  type PriceChain, type PriceDelta,
} from "../../lib/priceHistory";
import { money as fmtMoney } from "../../lib/ui";
import { fromISO, format, todayISO, addMonthsISO } from "../../lib/dates";
import { txnDirection, type Cadence, type Recurring, type TxnKind } from "../../lib/types";

const KINDS: { value: TxnKind; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "bill", label: "Bill" },
  { value: "expense", label: "Expense" },
  { value: "debt", label: "Debt" },
  { value: "saving", label: "Saving" },
  { value: "transfer", label: "Transfer" },
];
const KIND_COLOR: Record<TxnKind, string> = {
  income: "var(--success)", bill: "var(--cat-sky)", expense: "var(--cat-butter)",
  debt: "var(--cat-pink)", saving: "var(--cat-teal)", transfer: "var(--cat-lavender)",
};
const CADENCES: { value: Cadence; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "every4weeks", label: "Every 4 weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
  { value: "every2months", label: "Every 2 months" },
  { value: "every3months", label: "Every 3 months" },
  { value: "every6months", label: "Every 6 months" },
  { value: "yearly", label: "Yearly" },
];
const cadenceLabel = (c: Cadence) => CADENCES.find((x) => x.value === c)?.label ?? c;

export function RecurringScreen() {
  const { items, add, update, remove } = useRecurring();
  const { items: txns, add: addTxn } = useTransactions();
  const { currency } = useSettings();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Recurring | null>(null);
  // When an existing item's amount changes and it has committed history, we don't
  // silently overwrite it — we ask what happened (price change / typo / stopped).
  const [priceChange, setPriceChange] = useState<{ old: Recurring; patch: Partial<Recurring> } | null>(null);
  const today = todayISO();

  // The list shows only current (un-superseded) versions; old price versions are
  // folded into each item's history and still power past-period math.
  const shown = useMemo(() => currentVersions(items), [items]);

  // Upcoming occurrences across all active templates for the next 2 months.
  const upcoming = useMemo(() => {
    const end = addMonthsISO(today, 2);
    const rows: { key: string; date: string; t: Recurring }[] = [];
    for (const t of items) {
      for (const date of expandRecurrence(t, today, end)) {
        rows.push({ key: `${t.id}:${date}`, date, t });
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, 40);
  }, [items, today]);

  // An occurrence is "logged" once a matching transaction exists (survives reload).
  function isLogged(t: Recurring, date: string) {
    return txns.some(
      (x) => x.date === date && x.kind === t.kind && x.category === t.category &&
        x.account === t.account && Math.abs(x.amount - t.amount) < 0.005
    );
  }

  function logOccurrence(t: Recurring, date: string) {
    addTxn({
      date, amount: t.amount, kind: t.kind, category: t.category,
      account: t.account, toAccount: t.toAccount, spender: t.spender, paid: true,
    });
  }

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Set once, tracks forever</div>
        <h1 className="screen-head__title">
          Recurring
          <HelpTip text="Set up income, bills, and transfers once. They auto-generate on schedule — mark each one paid to log it as a transaction. No copy-pasting every month." />
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconRepeat size={28} />} title="No recurring items yet" sub="Add your paycheck, rent, and subscriptions once.">
            <button className="btn btn--primary" onClick={() => { setEdit(null); setOpen(true); }}>Add recurring</button>
          </EmptyState>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div data-tour="recurring-upcoming">
              <div className="section-title">Upcoming</div>
              <div className="card txn-list">
                {upcoming.map(({ key, date, t }) => {
                  const dir = txnDirection(t.kind);
                  const logged = isLogged(t, date);
                  return (
                    <div key={key} className={`row txn-row${logged ? " txn-row--done" : ""}`}>
                      <span className="txn-row__dot" style={{ background: KIND_COLOR[t.kind] }} />
                      <div className="row__body">
                        <div className="row__title">{t.name}</div>
                        <div className="row__sub">
                          {format(fromISO(date), "EEE, MMM d")}
                          {dir === "transfer" && t.toAccount ? ` · ${t.account} → ${t.toAccount}` : t.account ? ` · ${t.account}` : ""}
                        </div>
                      </div>
                      <span className={`txn-row__amt${dir === "in" ? " pos" : dir === "transfer" ? " muted" : ""}`}>
                        {dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtMoney(t.amount, currency)}
                      </span>
                      {logged ? (
                        <span className="rec-logged" aria-label="Logged"><IconCheck size={16} /></span>
                      ) : (
                        <button className="chip rec-log" onClick={() => logOccurrence(t, date)}>Log</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div data-tour="recurring-templates">
          <div className="section-title">Templates</div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {shown.map((t) => {
              const dir = txnDirection(t.kind);
              const next = nextOccurrence(t, today);
              const change = latestChange(items, t.id);
              return (
                <button key={t.id} className="row" style={{ width: "100%", textAlign: "left", background: "none" }} onClick={() => { setEdit(t); setOpen(true); }}>
                  <span className="txn-row__dot" style={{ background: KIND_COLOR[t.kind], opacity: t.active ? 1 : 0.3 }} />
                  <div className="row__body">
                    <div className="row__title">{t.name}{!t.active && <span className="muted"> · paused</span>}</div>
                    <div className="row__sub">
                      {cadenceLabel(t.cadence)}
                      {next ? ` · next ${format(fromISO(next), "MMM d")}` : t.active ? " · no upcoming" : ""}
                    </div>
                    {change && (
                      <div className="rec-price-badge">
                        <span className="muted">was {fmtMoney(change.from, currency)}</span>
                        <IconArrowRight size={12} />
                        <span className="txt-strong">{fmtMoney(change.to, currency)}</span>
                        <DeltaChip delta={change.delta} />
                      </div>
                    )}
                  </div>
                  <span className={`txn-row__amt${dir === "in" ? " pos" : ""}`}>{fmtMoney(t.amount, currency)}</span>
                </button>
              );
            })}
          </div>
          </div>

          <button className="fab" data-tour="recurring-fab" aria-label="Add recurring" onClick={() => { setEdit(null); setOpen(true); }}>
            <IconPlus />
          </button>
        </>
      )}

      <RecurringSheet
        open={open}
        rec={edit}
        history={edit ? chainFor(items, edit.id) : null}
        currency={currency}
        onClose={() => setOpen(false)}
        onSave={(patch) => {
          // A brand-new item, an unchanged amount, or an item with no committed
          // history: commit straight through. Otherwise ask what happened so we
          // never rewrite a past price.
          if (
            edit &&
            typeof patch.amount === "number" &&
            Math.abs(patch.amount - edit.amount) > 0.005 &&
            hasCommittedHistory(edit, today)
          ) {
            setPriceChange({ old: edit, patch });
            setOpen(false);
            return;
          }
          edit ? update(edit.id, patch) : add(patch);
          setOpen(false);
        }}
        onEnd={edit ? () => { update(edit.id, { endDate: today }); setOpen(false); } : undefined}
        onDelete={edit ? () => { remove(edit.id); setOpen(false); } : undefined}
      />

      <PriceChangeDialog
        change={priceChange}
        currency={currency}
        today={today}
        onCancel={() => setPriceChange(null)}
        onResolve={(mode, effective) => {
          if (!priceChange) return;
          const { old, patch } = priceChange;
          if (mode === "changed") {
            const { closePatch, newVersion } = supersedePlan(old, patch, effective);
            update(old.id, closePatch);
            add(newVersion);
          } else if (mode === "fix") {
            update(old.id, patch);
          } else {
            // stopped: keep the old price and its past occurrences (leave `active`
            // alone — flipping it off would erase history from the recurrence
            // engine); just cap future generation at the effective date.
            update(old.id, { endDate: effective });
          }
          setPriceChange(null);
        }}
      />
    </>
  );
}

function DeltaChip({ delta }: { delta: PriceDelta }) {
  if (delta.direction === "same" || delta.direction === "first") return null;
  const up = delta.direction === "up";
  return (
    <span className={`rec-delta ${up ? "rec-delta--up" : "rec-delta--down"}`}>
      {up ? <IconTrend size={12} /> : <IconTrendDown size={12} />}
      {up ? "+" : ""}{delta.pct}%
    </span>
  );
}

type ChangeMode = "changed" | "fix" | "stopped";

function PriceChangeDialog({
  change, currency, today, onResolve, onCancel,
}: {
  change: { old: Recurring; patch: Partial<Recurring> } | null;
  currency: string;
  today: string;
  onResolve: (mode: ChangeMode, effective: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<ChangeMode>("changed");
  const [effective, setEffective] = useState(today);

  useMemo(() => {
    if (change) { setMode("changed"); setEffective(today); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change]);

  if (!change) return null;
  const oldAmt = change.old.amount;
  const newAmt = typeof change.patch.amount === "number" ? change.patch.amount : oldAmt;
  const delta = priceDelta(oldAmt, newAmt);
  const up = delta.direction === "up";
  const name = change.old.name || "This item";

  const OPTIONS: { value: ChangeMode; title: string; sub: string }[] = [
    { value: "changed", title: `The price ${up ? "went up" : delta.direction === "down" ? "went down" : "changed"}`, sub: `Keep the ${fmtMoney(oldAmt, currency)} history and start ${fmtMoney(newAmt, currency)} going forward.` },
    { value: "fix", title: "Fix a wrong amount", sub: `The ${fmtMoney(oldAmt, currency)} was a mistake. Just correct it everywhere.` },
    { value: "stopped", title: "It stopped", sub: `Close ${name}. I'm not paying it anymore.` },
  ];

  return (
    <BottomSheet open={!!change} title={`${name} changed`} onClose={onCancel}>
      <div className="pc-summary">
        <span className="muted">{fmtMoney(oldAmt, currency)}</span>
        <IconArrowRight size={16} />
        <span className="pc-summary__new">{fmtMoney(newAmt, currency)}</span>
        {delta.direction !== "same" && <DeltaChip delta={delta} />}
      </div>
      <p className="muted fs-13" style={{ marginTop: -4, marginBottom: 12 }}>
        What happened? This keeps your past months accurate.
      </p>

      {OPTIONS.map((o) => (
        <button key={o.value} className={`pc-opt${mode === o.value ? " pc-opt--on" : ""}`} onClick={() => setMode(o.value)}>
          <span className="pc-opt__radio" aria-hidden />
          <span className="pc-opt__body">
            <span className="pc-opt__title">{o.title}</span>
            <span className="pc-opt__sub muted">{o.sub}</span>
          </span>
        </button>
      ))}

      {mode === "changed" && (
        <div className="field" style={{ marginTop: 12 }}>
          <label className="field__label" htmlFor="pc-eff">Effective date (when the new price starts)</label>
          <input id="pc-eff" className="input" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
        </div>
      )}

      <button className="btn btn--primary mt-10" onClick={() => onResolve(mode, effective)}>
        {mode === "changed" ? "Save price change" : mode === "fix" ? "Correct the amount" : "Close it out"}
      </button>
      <button className="btn btn--ghost mt-10" onClick={onCancel}>Cancel</button>
    </BottomSheet>
  );
}

function RecurringSheet({
  open, rec, history, currency, onClose, onSave, onEnd, onDelete,
}: {
  open: boolean;
  rec: Recurring | null;
  history: PriceChain | null;
  currency: string;
  onClose: () => void;
  onSave: (patch: Partial<Recurring>) => void;
  onEnd?: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TxnKind>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [spender, setSpender] = useState("");
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [anchorDate, setAnchor] = useState(todayISO());
  const [endDate, setEnd] = useState("");
  const [day2, setDay2] = useState("");
  const [active, setActive] = useState(true);

  useMemo(() => {
    if (!open) return;
    setName(rec?.name ?? "");
    setKind(rec?.kind ?? "expense");
    setAmount(rec ? String(rec.amount) : "");
    setCategory(rec?.category ?? "");
    setAccount(rec?.account ?? "");
    setToAccount(rec?.toAccount ?? "");
    setSpender(rec?.spender ?? "");
    setCadence(rec?.cadence ?? "monthly");
    setAnchor(rec?.anchorDate ?? todayISO());
    setEnd(rec?.endDate ?? "");
    setDay2(rec && rec.day2 ? String(rec.day2) : "");
    setActive(rec?.active ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    if (!name.trim() || !amount) return;
    onSave({
      name: name.trim(), kind, amount: Math.abs(Number(amount)) || 0, category: category.trim(),
      account: account.trim(), toAccount: kind === "transfer" ? toAccount.trim() : "",
      spender: spender.trim(), cadence, anchorDate,
      endDate, day2: cadence === "semimonthly" ? Number(day2) || 0 : 0, active,
    });
  }

  return (
    <BottomSheet open={open} title={rec ? "Edit recurring" : "New recurring"} onClose={onClose}>
      {history && history.versions.length > 1 && (
        <div className="price-timeline">
          <div className="field__label">Price history</div>
          {history.versions.map((v, i) => (
            <div key={v.rec.id} className={`price-timeline__row${i === history.versions.length - 1 ? " price-timeline__row--current" : ""}`}>
              <span className="price-timeline__dot" />
              <span className="price-timeline__amt">{fmtMoney(v.amount, currency)}</span>
              <span className="price-timeline__range muted">
                {format(fromISO(v.from), "MMM yyyy")}{v.to ? ` to ${format(fromISO(v.to), "MMM yyyy")}` : " to now"}
              </span>
              {v.delta.direction !== "first" && <DeltaChip delta={v.delta} />}
            </div>
          ))}
          <p className="muted fs-12" style={{ marginTop: 8 }}>
            Change the amount below and we'll ask whether to keep this history or fix a typo.
          </p>
        </div>
      )}
      <div className="field">
        <label className="field__label">Type</label>
        <ChipRow>{KINDS.map((k) => <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Chip>)}</ChipRow>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="rec-name">Name</label>
        <input id="rec-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent" />
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="rec-amount">Amount ({currency})</label>
          <input id="rec-amount" className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="rec-cat">Category</label>
          <input id="rec-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Housing" />
        </div>
      </div>
      <div className="field">
        <label className="field__label">Frequency</label>
        <ChipRow>{CADENCES.map((c) => <Chip key={c.value} active={cadence === c.value} onClick={() => setCadence(c.value)}>{c.label}</Chip>)}</ChipRow>
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="rec-anchor">First payment</label>
          <input id="rec-anchor" className="input" type="date" value={anchorDate} onChange={(e) => setAnchor(e.target.value)} />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="rec-end">Last payment (optional)</label>
          <input id="rec-end" className="input" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {cadence === "semimonthly" && (
        <div className="field">
          <label className="field__label" htmlFor="rec-day2">Second day of month</label>
          <input id="rec-day2" className="input" type="number" min={1} max={31} value={day2} onChange={(e) => setDay2(e.target.value)} placeholder="e.g. 15" />
        </div>
      )}
      <div className="field">
        <label className="field__label" htmlFor="rec-account">{kind === "transfer" ? "From account" : "Account"}</label>
        <input id="rec-account" className="input" value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Checking" />
      </div>
      {kind === "transfer" && (
        <div className="field">
          <label className="field__label" htmlFor="rec-toaccount">To account</label>
          <input id="rec-toaccount" className="input" value={toAccount} onChange={(e) => setToAccount(e.target.value)} placeholder="e.g. Credit Card" />
        </div>
      )}
      <SpenderField id="rec-spender" value={spender} onChange={setSpender} />
      <label className="spread txn-paid-row">
        <span style={{ fontWeight: 600 }}>Active</span>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--success)" }} />
      </label>
      <button className="btn btn--primary" onClick={save} disabled={!name.trim() || !amount}>{rec ? "Save" : "Add"}</button>
      {onEnd && rec && (!rec.endDate || rec.endDate > todayISO()) && (
        <button className="btn btn--ghost mt-10" onClick={onEnd}>End it (keep history)</button>
      )}
      {onDelete && <button className="btn btn--danger mt-10" onClick={onDelete}><IconClose size={16} /> Delete</button>}
    </BottomSheet>
  );
}
