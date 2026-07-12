// Spender/Earner Distribution (competitor-parity #9). Who earns and who spends,
// and each person's share of the household total. Derived from the person-tagged
// transaction log — transfers excluded.
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { CountUp } from "../../components/CountUp";
import { Donut } from "../../components/Charts";
import { HelpTip } from "../../components/HelpTip";
import { IconUsers } from "../../components/icons";
import { useTransactions } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { spenderDistribution } from "../../lib/distribution";
import { money as fmtMoney, categoryColor } from "../../lib/ui";
import { pct } from "../../lib/ui";
import { fromISO, format } from "../../lib/dates";
import { txnDirection, type TxnKind } from "../../lib/types";
import { navigate } from "../../router";

const OUT_KINDS: { key: TxnKind; label: string; color: string }[] = [
  { key: "bill", label: "Bills", color: "var(--cat-sky)" },
  { key: "expense", label: "Expenses", color: "var(--cat-butter)" },
  { key: "debt", label: "Debt", color: "var(--cat-pink)" },
  { key: "saving", label: "Savings", color: "var(--cat-teal)" },
];

export function DistributionScreen() {
  const { items: txns } = useTransactions();
  const { currency } = useSettings();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [member, setMember] = useState("all");

  const inRange = useMemo(
    () => txns.filter((t) => (!start || t.date >= start) && (!end || t.date <= end)),
    [txns, start, end]
  );
  const dist = useMemo(() => spenderDistribution(txns, start, end), [txns, start, end]);

  // Per-member spending stacked by kind (their "spending distribution" columns).
  const stacked = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const t of inRange) {
      if (txnDirection(t.kind) !== "out") continue;
      const person = t.spender.trim() || "Unassigned";
      const cur = map.get(person) ?? { bill: 0, expense: 0, debt: 0, saving: 0 };
      cur[t.kind] = (cur[t.kind] ?? 0) + t.amount;
      map.set(person, cur);
    }
    return [...map.entries()]
      .map(([person, k]) => ({ person, parts: k, total: k.bill + k.expense + k.debt + k.saving }))
      .sort((a, b) => b.total - a.total);
  }, [inRange]);
  const stackMax = Math.max(1, ...stacked.map((s) => s.total));

  const members = ["all", ...dist.people.map((p) => p.person)];
  const ledgerTxns = inRange
    .filter((t) => member === "all" || t.spender.trim() === member || (!t.spender.trim() && member === "Unassigned"))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const incomeLedger = ledgerTxns.filter((t) => txnDirection(t.kind) === "in");
  const expenseLedger = ledgerTxns.filter((t) => txnDirection(t.kind) === "out");

  if (dist.people.length === 0) {
    return (
      <>
        <Head />
        <EmptyState icon={<IconUsers size={28} />} title="No one to compare yet" sub="Tag transactions with a spender or earner to see the split.">
          <button className="btn btn--primary" onClick={() => navigate("transactions")}>Go to Transactions</button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Head />

      <div className="card txn-filters" data-tour="dist-filters">
        <div className="spread txn-filters__dates">
          <div className="field txn-filters__field">
            <label className="field__label" htmlFor="dist-start">From</label>
            <input id="dist-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field txn-filters__field">
            <label className="field__label" htmlFor="dist-end">To</label>
            <input id="dist-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="statgrid statgrid--2" data-tour="dist-stats">
        <div className="stat">
          <span className="stat__value tile__value--success">
            <CountUp value={dist.totalIncome} format={(n) => fmtMoney(n, currency)} />
          </span>
          <span className="stat__label">Household income</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            <CountUp value={dist.totalSpending} format={(n) => fmtMoney(n, currency)} />
          </span>
          <span className="stat__label">Household spending</span>
        </div>
      </div>

      <div className="bento" data-tour="dist-people">
        <div className="bento__col">
          <div className="card">
            <div className="section-title section-title--compact section-title--success">
              Income by person
              <HelpTip text="Each person's share of the household's total earnings for the range." />
            </div>
            <Donut
              formatValue={(n) => fmtMoney(n, currency)}
              size={150}
              slices={dist.people.filter((p) => p.income > 0).map((p) => ({ label: p.person, value: p.income, color: categoryColor(p.person) }))}
            />
          </div>
        </div>
        <div className="bento__col">
          <div className="card">
            <div className="section-title section-title--compact">
              Spending by person
              <HelpTip text="Each person's share of the household's total spending for the range." />
            </div>
            <Donut
              formatValue={(n) => fmtMoney(n, currency)}
              size={150}
              slices={dist.people.filter((p) => p.spending > 0).map((p) => ({ label: p.person, value: p.spending, color: categoryColor(p.person) }))}
            />
          </div>
        </div>
      </div>

      {/* Spending distribution — per member, stacked by kind */}
      <div className="card" data-tour="dist-spending">
        <div className="section-title section-title--compact">
          Spending distribution
          <HelpTip text="Each person's spending stacked by type — a taller column means they spent more overall." />
        </div>
        <div className="dist-stack-legend">
          {OUT_KINDS.map((k) => (
            <span key={k.key} className="chart-legend-item"><span className="combochart__swatch" style={{ background: k.color }} /><span className="muted">{k.label}</span></span>
          ))}
        </div>
        <div className="dist-stack">
          {stacked.map((s) => (
            <div key={s.person} className="dist-stack__col">
              <div className="dist-stack__amt">{fmtMoney(s.total, currency)}</div>
              <div className="dist-stack__bar-wrap">
                <div className="dist-stack__bar" style={{ height: `${(s.total / stackMax) * 100}%` }}>
                  {OUT_KINDS.map((k) => {
                    const v = s.parts[k.key] || 0;
                    if (!v) return null;
                    return <div key={k.key} className="dist-stack__seg" style={{ flex: v, background: k.color }} title={`${s.person} · ${k.label}: ${fmtMoney(v, currency)}`} />;
                  })}
                </div>
              </div>
              <div className="dist-stack__label muted">{s.person}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" data-tour="dist-cashflow">
        <div className="section-title section-title--compact">
          Cash flow by person
          <HelpTip text="Income, spending, contribution ratios, and what's left over per person." />
        </div>
        <div className="ledger-scroll">
          <table className="ledger ledger--accounts">
            <thead>
              <tr>
                <th className="ledger__monthcol">Person</th>
                <th>Income</th>
                <th>Share</th>
                <th>Spending</th>
                <th>Share</th>
                <th>Left over</th>
              </tr>
            </thead>
            <tbody>
              {dist.people.map((p) => (
                <tr key={p.person}>
                  <td className="ledger__monthcol">
                    <span className="dist-dot" style={{ background: categoryColor(p.person) }} />
                    {p.person}
                  </td>
                  <td className="pos">{fmtMoney(p.income, currency)}</td>
                  <td className="muted">{pct(p.income, dist.totalIncome)}%</td>
                  <td>{fmtMoney(p.spending, currency)}</td>
                  <td className="muted">{pct(p.spending, dist.totalSpending)}%</td>
                  <td className={p.net < 0 ? "neg txt-strong" : "txt-strong"}>{fmtMoney(p.net, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ledger__total">
                <td className="ledger__monthcol">Total</td>
                <td className="pos">{fmtMoney(dist.totalIncome, currency)}</td>
                <td>—</td>
                <td>{fmtMoney(dist.totalSpending, currency)}</td>
                <td>—</td>
                <td>{fmtMoney(dist.totalIncome - dist.totalSpending, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Individual / shared member filter */}
      <div data-tour="dist-ledger">
      <div className="section-title">
        Ledger
        <HelpTip text="Filter to one person to see exactly what they earned and spent, or Everyone for the whole household." />
      </div>
      <div className="card dist-memberbar">
        {members.map((m) => (
          <button key={m} className={`chip${member === m ? " chip--on" : ""}`} onClick={() => setMember(m)}>{m === "all" ? "Everyone" : m}</button>
        ))}
      </div>

      {incomeLedger.length > 0 && (
        <>
          <div className="section-title spread" style={{ display: "flex" }}><span>Income</span><span className="muted">{incomeLedger.length}</span></div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {incomeLedger.slice(0, 25).map((t) => (
              <div key={t.id} className="row">
                <div className="row__body">
                  <div className="row__title">{t.category || "Income"}</div>
                  <div className="row__sub">{format(fromISO(t.date), "MMM d")} · {t.spender || "Unassigned"}</div>
                </div>
                <span className="txn-row__amt pos">+{fmtMoney(t.amount, currency)}</span>
              </div>
            ))}
            {incomeLedger.length > 25 && <div className="row"><span className="muted fs-12">+{incomeLedger.length - 25} more</span></div>}
          </div>
        </>
      )}

      {expenseLedger.length > 0 && (
        <>
          <div className="section-title spread" style={{ display: "flex" }}><span>Spending</span><span className="muted">{expenseLedger.length}</span></div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {expenseLedger.slice(0, 25).map((t) => (
              <div key={t.id} className="row">
                <div className="row__body">
                  <div className="row__title">{t.category || "Expense"}</div>
                  <div className="row__sub">{format(fromISO(t.date), "MMM d")} · {t.spender || "Unassigned"}</div>
                </div>
                <span className="txn-row__amt">−{fmtMoney(t.amount, currency)}</span>
              </div>
            ))}
            {expenseLedger.length > 25 && <div className="row"><span className="muted fs-12">+{expenseLedger.length - 25} more</span></div>}
          </div>
        </>
      )}
      </div>
    </>
  );
}

function Head() {
  return (
    <div className="screen-head">
      <div className="screen-head__eyebrow">Who earns, who spends</div>
      <h1 className="screen-head__title">
        Distribution
        <HelpTip text="See each person's earnings, spending, and contribution ratio. Great for couples and families sharing a budget." />
      </h1>
    </div>
  );
}
