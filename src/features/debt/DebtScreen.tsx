import { useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Segmented } from "../../components/Segmented";
import { EmptyState } from "../../components/EmptyState";
import { CountUp } from "../../components/CountUp";
import { Columns } from "../../components/Charts";
import { ProgressRing } from "../../components/ProgressRing";
import { HelpTip } from "../../components/HelpTip";
import { IconCard, IconChevron, IconPlus } from "../../components/icons";
import { useDebts } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { simulatePayoff, type PayoffResult, type Strategy } from "../../lib/debt";
import { money as fmtMoney, pct } from "../../lib/ui";
import type { Debt } from "../../lib/types";

/** Effective payoff order: settings.debtOrder first (for ids that still exist),
    then any debts not yet ranked, in their natural order. */
function effectiveOrder(items: Debt[], debtOrder: string[]): string[] {
  const known = debtOrder.filter((id) => items.some((d) => d.id === id));
  const rest = items.filter((d) => !known.includes(d.id)).map((d) => d.id);
  return [...known, ...rest];
}

export function DebtScreen() {
  const { items, add, update, remove } = useDebts();
  const { currency, debtStrategy, debtOrder, monthlyExtra, debtStartDate, debtAdjustments, update: updateSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Debt | null>(null);
  const [detail, setDetail] = useState<Debt | null>(null);
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  const order = useMemo(() => effectiveOrder(items, debtOrder), [items, debtOrder]);

  const result = useMemo(
    () => simulatePayoff(items, debtStrategy, monthlyExtra, order, { startDate: debtStartDate || undefined, adjustments: debtAdjustments }),
    [items, debtStrategy, monthlyExtra, order, debtStartDate, debtAdjustments]
  );

  // Adjust one month's total repayment by ±delta (their "+/−" feature). Clearing
  // back to 0 removes the key so the map stays tidy.
  function adjustMonth(key: string, delta: number) {
    const next = { ...debtAdjustments, [key]: (debtAdjustments[key] ?? 0) + delta };
    if (Math.abs(next[key]) < 0.005) delete next[key];
    updateSettings({ debtAdjustments: next });
  }

  const overallPaidPct = result.totalStart > 0 ? (result.totalStart - result.totalCurrent) / result.totalStart : 0;

  const payoffColumns = items
    .filter((d) => result.payoffMonthByDebt[d.id] !== undefined)
    .map((d) => ({ label: d.name.split(" ")[0], value: result.payoffMonthByDebt[d.id] }))
    .sort((a, b) => a.value - b.value);

  const sortedDebts = useMemo(() => {
    if (debtStrategy === "custom") {
      return [...items].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return [...items].sort((a, b) =>
      debtStrategy === "snowball" ? a.currentBalance - b.currentBalance : b.apr - a.apr
    );
  }, [items, debtStrategy, order]);

  function moveInCustomOrder(id: string, dir: -1 | 1) {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    updateSettings({ debtOrder: next });
  }

  const scheduleRows = showFullSchedule ? result.schedule : result.schedule.slice(0, 12);
  const scheduleTruncated = !showFullSchedule && result.schedule.length > 12;

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Snowball · Avalanche · Custom</div>
        <h1 className="screen-head__title">
          Debt Payoff
          <HelpTip text="See your debt-free date and simulate paying it off faster. Extra money goes to one debt at a time based on your strategy." />
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconCard size={28} />} title="No debts tracked" sub="Add a debt to see your debt-free date.">
            <button className="btn btn--primary" onClick={() => { setEdit(null); setOpen(true); }}>Add a debt</button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="card" data-tour="debt-overview">
            <div className="spread spread--top">
              <div>
                <div className="muted eyebrow-12">DEBT-FREE</div>
                <div className="big-number">{result.debtFreeLabel}</div>
                <div className="muted fs-13">
                  {Number.isFinite(result.months) ? `${result.months} months` : "Raise your payment to finish"}
                </div>
              </div>
              <div className="text-right">
                <div className="muted eyebrow-12">TOTAL OWED</div>
                <div className="debt-total-value">
                  <CountUp value={result.totalCurrent} format={(n) => fmtMoney(n, currency)} />
                </div>
                <div className="neg fs-12">
                  Interest {fmtMoney(result.totalInterest, currency)}
                </div>
              </div>
            </div>
            <div className="debt-overview__stats">
              <ProgressRing
                value={overallPaidPct}
                size={68}
                stroke={7}
                ariaLabel={`${Math.round(overallPaidPct * 100)}% paid off`}
                center={<span className="txt-strong-800">{Math.round(overallPaidPct * 100)}%</span>}
              />
              <div className="debt-overview__statgrid">
                <div>
                  <div className="ov-cell__label">Paid off</div>
                  <div className="ov-cell__value tile__value--success">{fmtMoney(result.totalStart - result.totalCurrent, currency)}</div>
                </div>
                <div>
                  <div className="ov-cell__label">Total start</div>
                  <div className="ov-cell__value">{fmtMoney(result.totalStart, currency)}</div>
                </div>
                <div>
                  <div className="ov-cell__label">Min / month</div>
                  <div className="ov-cell__value">{fmtMoney(result.totalMinPayment, currency)}</div>
                </div>
                <div>
                  <div className="ov-cell__label">Months left</div>
                  <div className="ov-cell__value">{Number.isFinite(result.months) ? result.months : "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {payoffColumns.length > 0 && (
            <div className="card" data-tour="debt-chart">
              <div className="muted eyebrow-12 mb-3">MONTHS TO DEBT-FREE</div>
              <Columns points={payoffColumns} height={120} color="var(--cat-teal)" formatValue={(n) => `${Math.round(n)} mo`} />
            </div>
          )}

          <div className="card" data-tour="debt-strategy">
            <label className="field__label">
              Strategy
              <HelpTip text="Snowball pays the smallest balance first (fast wins). Avalanche pays the highest APR first (saves the most interest). Custom lets you pick the order." />
            </label>
            <Segmented
              options={[
                { value: "snowball", label: "Snowball" },
                { value: "avalanche", label: "Avalanche" },
                { value: "custom", label: "Custom" },
              ]}
              value={debtStrategy}
              onChange={(v) => updateSettings({ debtStrategy: v as Strategy })}
            />
            <div className="spread debt-extra-row">
              <label htmlFor="debt-extra-monthly" className="field__label field__label--flush">Extra per month</label>
              <input
                id="debt-extra-monthly"
                className="input debt-extra-input"
                type="number"
                inputMode="decimal"
                value={monthlyExtra || ""}
                onChange={(e) => updateSettings({ monthlyExtra: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="spread debt-extra-row">
              <label htmlFor="debt-start-month" className="field__label field__label--flush">
                Repayment starts
                <HelpTip text="The month your payoff plan begins, so the schedule dates line up with when you actually start." />
              </label>
              <input
                id="debt-start-month"
                className="input debt-extra-input"
                type="month"
                value={debtStartDate ? debtStartDate.slice(0, 7) : ""}
                onChange={(e) => updateSettings({ debtStartDate: e.target.value ? `${e.target.value}-01` : "" })}
              />
            </div>

            {debtStrategy === "custom" && (
              <div className="mt-4">
                <div className="muted eyebrow-12 mb-2">PAYOFF ORDER</div>
                {order.map((id, i) => {
                  const d = items.find((x) => x.id === id);
                  if (!d) return null;
                  return (
                    <div key={id} className="row row--pad8">
                      <span className="muted debt-order-num">{i + 1}</span>
                      <div className="row__body"><div className="row__title row__title--sm">{d.name}</div></div>
                      <button className="muted" aria-label="Move up" disabled={i === 0}
                        onClick={() => moveInCustomOrder(id, -1)} style={{ opacity: i === 0 ? 0.3 : 1 }}>
                        <IconChevron size={16} className="ic-rotate-up" />
                      </button>
                      <button className="muted" aria-label="Move down" disabled={i === order.length - 1}
                        onClick={() => moveInCustomOrder(id, 1)} style={{ opacity: i === order.length - 1 ? 0.3 : 1 }}>
                        <IconChevron size={16} className="ic-rotate-down" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div data-tour="debt-list">
          {sortedDebts.map((d) => {
            const paidPct = d.startBalance ? pct(d.startBalance - d.currentBalance, d.startBalance) : 0;
            const payoffMonth = result.payoffMonthByDebt[d.id];
            return (
              <div className="card" key={d.id}>
                <div className="spread">
                  <button className="debt-row-btn"
                    onClick={() => setDetail(d)}>
                    <div className="txt-strong">{d.name}</div>
                    <div className="muted fs-12">
                      {d.apr}% APR · min {fmtMoney(d.minPayment, currency)}
                      {payoffMonth ? ` · clear in ${payoffMonth}mo` : ""}
                    </div>
                    {d.notes && (
                      <div className="muted debt-notes">{d.notes}</div>
                    )}
                  </button>
                  <div className="text-right">
                    <div className="txt-strong-800">{fmtMoney(d.currentBalance, currency)}</div>
                    <div className="muted fs-11">of {fmtMoney(d.startBalance, currency)}</div>
                  </div>
                </div>
                <div className="pbar mt-10">
                  <div className="pbar__fill" style={{ width: `${paidPct}%`, background: "var(--success)" }} />
                </div>
                <div className="spread mt-2">
                  <span className="muted fs-12">{paidPct}% paid off</span>
                  <span className="debt-actions">
                    <button className="chip" onClick={() => update(d.id, { currentBalance: Math.max(0, d.currentBalance - d.minPayment) })}>
                      − Payment
                    </button>
                    <button className="chip" onClick={() => update(d.id, { currentBalance: d.currentBalance + 50 })}>
                      + $50
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
          </div>

          {result.schedule.length > 0 && (
            <div className="card" data-tour="debt-schedule">
              <div className="section-title section-title--compact">Payment schedule</div>
              <div className="muted fs-12 mb-2">
                Tap − or + on any month to plan paying more or less that month.
              </div>
              <div className="debt-schedule-scroll">
              <div className="col-stack col-stack--wide">
                <div className="spread muted debt-schedule__head">
                  <span className="debt-col-month">MONTH</span>
                  <span className="debt-col-amt">PAYMENT</span>
                  <span className="debt-col-amt">INTEREST</span>
                  <span className="debt-col-bal">BALANCE</span>
                  <span className="debt-col-adj">ADJUST</span>
                </div>
                {scheduleRows.map((r) => {
                  const adj = debtAdjustments[r.adjKey] ?? 0;
                  return (
                    <div key={r.month} className="spread debt-schedule__row">
                      <span className="debt-col-month">{r.label}</span>
                      <span className="debt-col-amt">{fmtMoney(r.payment, currency)}</span>
                      <span className="debt-col-amt neg">{fmtMoney(r.interest, currency)}</span>
                      <span className="debt-col-bal txt-strong">{fmtMoney(r.balance, currency)}</span>
                      <span className="debt-col-adj debt-adj">
                        <button className="debt-adj__btn" aria-label={`Reduce ${r.label} payment`} onClick={() => adjustMonth(r.adjKey, -50)}>−</button>
                        <span className={`debt-adj__val${adj > 0 ? " pos" : adj < 0 ? " neg" : ""}`}>
                          {adj === 0 ? "—" : `${adj > 0 ? "+" : "−"}${fmtMoney(Math.abs(adj), currency)}`}
                        </span>
                        <button className="debt-adj__btn" aria-label={`Increase ${r.label} payment`} onClick={() => adjustMonth(r.adjKey, 50)}>+</button>
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
              {scheduleTruncated && (
                <button className="btn btn--ghost mt-10"
                  onClick={() => setShowFullSchedule(true)}>
                  Show all {result.schedule.length} months
                </button>
              )}
              {showFullSchedule && result.schedule.length > 12 && (
                <button className="btn btn--ghost mt-10"
                  onClick={() => setShowFullSchedule(false)}>
                  Show fewer
                </button>
              )}
            </div>
          )}
        </>
      )}

      {items.length > 0 && (
        <button className="fab" data-tour="debt-fab" aria-label="Add debt" onClick={() => { setEdit(null); setOpen(true); }}>
          <IconPlus />
        </button>
      )}

      <DebtSheet
        open={open}
        debt={edit}
        currency={currency}
        onClose={() => setOpen(false)}
        onSave={(patch) => { edit ? update(edit.id, patch) : add(patch); setOpen(false); }}
        onDelete={edit ? () => { remove(edit.id); setOpen(false); } : undefined}
      />

      <DebtDetailSheet
        debt={detail}
        result={result}
        currency={currency}
        onClose={() => setDetail(null)}
        onEdit={(d) => { setDetail(null); setEdit(d); setOpen(true); }}
      />
    </>
  );
}

function DebtDetailSheet({
  debt, result, currency, onClose, onEdit,
}: {
  debt: Debt | null;
  result: PayoffResult;
  currency: string;
  onClose: () => void;
  onEdit: (d: Debt) => void;
}) {
  const paidPct = debt && debt.startBalance ? pct(debt.startBalance - debt.currentBalance, debt.startBalance) : 0;
  const payoffMonth = debt ? result.payoffMonthByDebt[debt.id] : undefined;
  const rows = debt ? result.scheduleByDebt[debt.id] ?? [] : [];
  const payoffLabel = rows.length > 0 ? rows[rows.length - 1].label : "—";

  return (
    <BottomSheet open={!!debt} title={debt?.name ?? "Debt"} onClose={onClose}>
      {debt && (
        <>
          <div className="spread spread--top mb-4">
            <div>
              <div className="muted eyebrow-12">PAYOFF DATE</div>
              <div className="big-number" style={{ fontSize: 26 }}>{payoffLabel}</div>
              <div className="muted fs-13">
                {payoffMonth ? `${payoffMonth} months from start` : "Raise your payment to finish"}
              </div>
            </div>
            <ProgressRing
              value={paidPct / 100}
              size={72}
              stroke={7}
              ariaLabel={`${paidPct}% paid off`}
              center={<span className="txt-strong-800">{paidPct}%</span>}
            />
          </div>

          <div className="ov-grid mb-4">
            <div>
              <div className="ov-cell__label">Current balance</div>
              <div className="ov-cell__value">{fmtMoney(debt.currentBalance, currency)}</div>
            </div>
            <div>
              <div className="ov-cell__label">Start balance</div>
              <div className="ov-cell__value">{fmtMoney(debt.startBalance, currency)}</div>
            </div>
            <div>
              <div className="ov-cell__label">Min payment</div>
              <div className="ov-cell__value">{fmtMoney(debt.minPayment, currency)}</div>
            </div>
            <div>
              <div className="ov-cell__label">Interest rate</div>
              <div className="ov-cell__value">{debt.apr}% APR</div>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="section-title section-title--compact">Payment schedule</div>
              <div className="col-stack debt-detail-schedule">
                <div className="spread muted debt-schedule__head">
                  <span className="debt-col-month">MONTH</span>
                  <span className="debt-col-amt">PAYMENT</span>
                  <span className="debt-col-amt">INTEREST</span>
                  <span className="debt-col-bal">BALANCE</span>
                </div>
                {rows.map((r) => (
                  <div key={r.month} className="spread debt-schedule__row">
                    <span className="debt-col-month">{r.label}</span>
                    <span className="debt-col-amt">{fmtMoney(r.payment, currency)}</span>
                    <span className="debt-col-amt neg">{fmtMoney(r.interest, currency)}</span>
                    <span className="debt-col-bal txt-strong">{fmtMoney(r.balance, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="btn btn--primary mt-10" onClick={() => onEdit(debt)}>Edit debt</button>
        </>
      )}
    </BottomSheet>
  );
}

function DebtSheet({
  open, debt, currency, onClose, onSave, onDelete,
}: {
  open: boolean;
  debt: Debt | null;
  currency: string;
  onClose: () => void;
  onSave: (patch: Partial<Debt>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState("");
  const [startBalance, setStart] = useState("");
  const [currentBalance, setCurrent] = useState("");
  const [apr, setApr] = useState("");
  const [minPayment, setMin] = useState("");
  const [notes, setNotes] = useState("");

  useMemo(() => {
    if (!open) return;
    setName(debt?.name ?? "");
    setStart(debt ? String(debt.startBalance) : "");
    setCurrent(debt ? String(debt.currentBalance) : "");
    setApr(debt ? String(debt.apr) : "");
    setMin(debt ? String(debt.minPayment) : "");
    setNotes(debt?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    if (!name.trim()) return;
    const start = Number(startBalance) || 0;
    onSave({
      name: name.trim(),
      startBalance: start,
      currentBalance: Number(currentBalance) || start,
      apr: Number(apr) || 0,
      minPayment: Number(minPayment) || 0,
      notes: notes.trim(),
    });
  }

  return (
    <BottomSheet open={open} title={debt ? "Edit debt" : "New debt"} onClose={onClose}>
      <div className="field">
        <label className="field__label" htmlFor="debt-name">Name</label>
        <input id="debt-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Credit card" />
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="debt-start-balance">Start balance ({currency})</label>
          <input id="debt-start-balance" className="input" type="number" value={startBalance} onChange={(e) => setStart(e.target.value)} placeholder="0" />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="debt-current-balance">Current ({currency})</label>
          <input id="debt-current-balance" className="input" type="number" value={currentBalance} onChange={(e) => setCurrent(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="debt-apr">APR %</label>
          <input id="debt-apr" className="input" type="number" value={apr} onChange={(e) => setApr(e.target.value)} placeholder="0" />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="debt-min-payment">Min payment ({currency})</label>
          <input id="debt-min-payment" className="input" type="number" value={minPayment} onChange={(e) => setMin(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="debt-notes">Notes</label>
        <textarea id="debt-notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Autopay on the 3rd" />
      </div>
      <button className="btn btn--primary" onClick={save} disabled={!name.trim()}>{debt ? "Save" : "Add debt"}</button>
      {onDelete && <button className="btn btn--danger mt-10" onClick={onDelete}>Delete</button>}
    </BottomSheet>
  );
}
