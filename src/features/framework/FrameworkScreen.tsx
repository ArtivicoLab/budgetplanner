// 50/30/20 dashboard (competitor-parity #15). Needs / Wants / Savings framework
// with customizable goal ratios, derived live from the current budget period.
import { useMemo } from "react";
import { ProgressRing } from "../../components/ProgressRing";
import { Donut, GroupedBars } from "../../components/Charts";
import { CountUp } from "../../components/CountUp";
import { HelpTip } from "../../components/HelpTip";
import { EmptyState } from "../../components/EmptyState";
import { IconBudget } from "../../components/icons";
import { useBudget } from "../../stores/useBudget";
import { useSettings } from "../../stores/useSettings";
import { frameworkSummary, effectiveBucket, type Bucket } from "../../lib/framework";
import { money as fmtMoney } from "../../lib/ui";
import { navigate } from "../../router";

const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: "needs", label: "Needs", color: "var(--cat-sky)" },
  { key: "wants", label: "Wants", color: "var(--cat-pink)" },
  { key: "savings", label: "Savings + Debt", color: "var(--cat-teal)" },
];

export function FrameworkScreen() {
  const { periods, currentPeriodId, rowsFor } = useBudget();
  const { currency, bucketGoals, update: updateSettings } = useSettings();
  const period = periods.find((p) => p.id === currentPeriodId) ?? periods[0];
  const rows = useMemo(() => (period ? rowsFor(period.id) : []), [period, rowsFor]);
  const sum = useMemo(() => frameworkSummary(rows, bucketGoals), [rows, bucketGoals]);

  const goalTotal = bucketGoals.needs + bucketGoals.wants + bucketGoals.savings;

  function setGoal(bucket: Bucket, value: number) {
    updateSettings({ bucketGoals: { ...bucketGoals, [bucket]: Math.max(0, value) } });
  }

  if (!period) {
    return (
      <>
        <Head goals={bucketGoals} />
        <EmptyState icon={<IconBudget size={28} />} title="No budget yet" sub="Set up a budget and tag lines as Needs, Wants, or Savings.">
          <button className="btn btn--primary" onClick={() => navigate("budget")}>Go to Budget</button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Head goals={bucketGoals} />

      {/* Income spent ring */}
      <div className="card nw-hero" data-tour="framework-hero">
        <ProgressRing
          value={Math.min(1, sum.incomeSpentPct)}
          size={92}
          stroke={9}
          ariaLabel={`${Math.round(sum.incomeSpentPct * 100)}% of income used`}
          center={<span className="txt-strong-800">{Math.round(sum.incomeSpentPct * 100)}%</span>}
        />
        <div className="nw-hero__body">
          <div className="muted eyebrow-12">INCOME USED</div>
          <div className="big-number">
            <CountUp value={sum.totalSpent} format={(n) => fmtMoney(n, currency)} />
          </div>
          <div className="muted fs-13">of {fmtMoney(sum.income, currency)} income</div>
        </div>
      </div>

      {/* Ratio editor */}
      <div className="card" data-tour="framework-mix">
        <div className="section-title section-title--compact">
          Your target mix
          <HelpTip text="Customize the split — 50/30/20, 60/20/20, 70/20/10, or any mix. Everything below updates instantly." />
        </div>
        <div className="fw-ratios">
          {BUCKETS.map((b) => (
            <div key={b.key} className="fw-ratio">
              <span className="fw-ratio__dot" style={{ background: b.color }} />
              <label className="field__label field__label--flush" htmlFor={`ratio-${b.key}`}>{b.label}</label>
              <input id={`ratio-${b.key}`} className="input fw-ratio__input" type="number" inputMode="decimal"
                value={bucketGoals[b.key] || ""} onChange={(e) => setGoal(b.key, Number(e.target.value) || 0)} />
              <span className="muted">%</span>
            </div>
          ))}
        </div>
        {goalTotal !== 100 && <div className="fw-warn">Your targets add up to {goalTotal}% — adjust to total 100%.</div>}
      </div>

      <div className="bento">
        <div className="bento__col">
          {/* Breakdown donut */}
          <div className="card" data-tour="framework-breakdown">
            <div className="section-title section-title--compact">Breakdown</div>
            <Donut
              formatValue={(n) => fmtMoney(n, currency)}
              size={150}
              slices={BUCKETS.map((b) => ({ label: b.label, value: sum.actual[b.key], color: b.color }))}
              center={<div className="txt-strong fs-13">{fmtMoney(sum.totalSpent, currency)}</div>}
            />
          </div>
        </div>
        <div className="bento__col">
          {/* Actual vs goal */}
          <div className="card" data-tour="framework-vsgoal">
            <div className="section-title section-title--compact">Actual vs. goal</div>
            <GroupedBars formatValue={(n) => fmtMoney(n, currency)} data={BUCKETS.map((b) => ({ label: b.label, budget: sum.goalAmount[b.key], actual: sum.actual[b.key] }))} />
          </div>
        </div>
      </div>

      {/* Percentage + amount table */}
      <div className="card" data-tour="framework-table">
        <div className="section-title section-title--compact">Goal vs actual</div>
        <div className="ledger-scroll">
          <table className="ledger ledger--accounts">
            <thead>
              <tr>
                <th className="ledger__monthcol">Bucket</th>
                <th>Goal %</th>
                <th>Actual %</th>
                <th>Goal $</th>
                <th>Actual $</th>
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map((b) => {
                const over = sum.actualPct[b.key] > sum.goalPct[b.key] + 0.5;
                return (
                  <tr key={b.key}>
                    <td className="ledger__monthcol"><span className="dist-dot" style={{ background: b.color }} />{b.label}</td>
                    <td className="muted">{Math.round(sum.goalPct[b.key])}%</td>
                    <td className={over ? "fw-over" : ""}>{Math.round(sum.actualPct[b.key])}%</td>
                    <td className="muted">{fmtMoney(sum.goalAmount[b.key], currency)}</td>
                    <td className={over ? "fw-over txt-strong" : "txt-strong"}>{fmtMoney(sum.actual[b.key], currency)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ledger__total">
                <td className="ledger__monthcol">Total</td>
                <td>{goalTotal}%</td>
                <td>{Math.round(sum.incomeSpentPct * 100)}%</td>
                <td>{fmtMoney(sum.goalAmount.needs + sum.goalAmount.wants + sum.goalAmount.savings, currency)}</td>
                <td>{fmtMoney(sum.totalSpent, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Three bucket lists */}
      {BUCKETS.map((b) => {
        const lines = rows.filter((r) => effectiveBucket(r) === b.key && (r.actual || 0) > 0);
        if (lines.length === 0) return null;
        const total = lines.reduce((a, r) => a + (r.actual || 0), 0);
        return (
          <div key={b.key} data-tour={`framework-list-${b.key}`}>
            <div className="section-title spread" style={{ display: "flex" }}>
              <span><span className="dist-dot" style={{ background: b.color }} />{b.label}</span>
              <span>{fmtMoney(total, currency)}</span>
            </div>
            <div className="card" style={{ padding: "4px 16px" }}>
              {lines.map((r) => (
                <div key={r.id} className="row">
                  <div className="row__body"><div className="row__title">{r.name || "Untitled"}</div></div>
                  <span className="txt-strong">{fmtMoney(r.actual || 0, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Head({ goals }: { goals: { needs: number; wants: number; savings: number } }) {
  return (
    <div className="screen-head">
      <div className="screen-head__eyebrow">Needs · Wants · Savings</div>
      <h1 className="screen-head__title">
        {goals.needs}/{goals.wants}/{goals.savings}
        <HelpTip text="The 50/30/20 framework splits your money into Needs, Wants, and Savings + Debt. Tag each budget line, then see how your actual spending compares to your target mix." />
      </h1>
    </div>
  );
}
