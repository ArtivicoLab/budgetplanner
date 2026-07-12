import { useMemo, useState } from "react";
import { ProgressRing } from "../../components/ProgressRing";
import { Segmented } from "../../components/Segmented";
import { CountUp } from "../../components/CountUp";
import { HelpTip } from "../../components/HelpTip";
import { AreaChart, Columns, ComboChart, Stacked100 } from "../../components/Charts";
import { useBudget } from "../../stores/useBudget";
import { useSettings } from "../../stores/useSettings";
import { useFunds, useDebts } from "../../stores/v2";
import { summarize } from "../../lib/budget";
import { simulatePayoff } from "../../lib/debt";
import { addDaysISO, dueLabel, format, fromISO, todayISO } from "../../lib/dates";
import { money as fmtMoney } from "../../lib/ui";
import { navigate } from "../../router";
import { DashboardHero } from "./DashboardHero";

type TrendRange = "3M" | "6M" | "1Y" | "All";
const RANGE_MONTHS: Record<TrendRange, number> = { "3M": 3, "6M": 6, "1Y": 12, All: Infinity };
const RANGE_OPTIONS = [
  { value: "3M" as const, label: "3M" },
  { value: "6M" as const, label: "6M" },
  { value: "1Y" as const, label: "1Y" },
  { value: "All" as const, label: "All" },
];

export function DashboardScreen() {
  const { periods, currentPeriodId, rowsFor } = useBudget();
  const { currency, debtStrategy, monthlyExtra } = useSettings();
  const { items: funds } = useFunds();
  const { items: debts } = useDebts();
  const today = todayISO();

  // ---------- finances (current budget period) ----------
  const period = periods.find((p) => p.id === currentPeriodId) ?? periods[0];
  const rows = period ? rowsFor(period.id) : [];
  const sum = period ? summarize(period, rows) : null;
  const unpaidBills = period
    ? rows
        .filter((m) => m.kind === "bill" && m.dueDate && !m.paid)
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    : [];
  const upcomingBills = unpaidBills.slice(0, 3);
  const weekEnd = addDaysISO(today, 7);
  const billsThisWeek = unpaidBills.filter((b) => b.dueDate >= today && b.dueDate <= weekEnd).length;
  const overdueBills = unpaidBills.filter((b) => b.dueDate < today).length;

  // budget vs actual groups
  const budgetGroups = sum
    ? [
        { label: "Income", budget: sum.incomeBudgeted, actual: sum.income },
        { label: "Bills", budget: rows.filter((r) => r.kind === "bill").reduce((a, r) => a + r.budgeted, 0), actual: sum.bills },
        { label: "Expenses", budget: rows.filter((r) => r.kind === "expense").reduce((a, r) => a + r.budgeted, 0), actual: sum.expenses },
        { label: "Savings", budget: rows.filter((r) => r.kind === "saving").reduce((a, r) => a + r.budgeted, 0), actual: sum.savings },
      ]
    : [];

  // ---------- savings (funds) ----------
  const savedTotal = funds.reduce((a, f) => a + f.currentBalance, 0);
  const goalTotal = funds.reduce((a, f) => a + f.goalAmount, 0);
  const savingsPct = goalTotal ? savedTotal / goalTotal : 0;
  const fundsAchieved = funds.filter((f) => f.goalAmount > 0 && f.currentBalance >= f.goalAmount).length;

  // ---------- debt ----------
  const payoff = useMemo(
    () => simulatePayoff(debts, debtStrategy, monthlyExtra),
    [debts, debtStrategy, monthlyExtra]
  );
  const debtPaidOff = payoff.totalStart - payoff.totalCurrent;
  const debtPaidPct = payoff.totalStart > 0 ? Math.round((debtPaidOff / payoff.totalStart) * 100) : 0;
  const payoffColumns = debts
    .filter((d) => payoff.payoffMonthByDebt[d.id] !== undefined)
    .map((d) => ({ label: d.name.split(" ")[0], value: payoff.payoffMonthByDebt[d.id] }))
    .sort((a, b) => a.value - b.value);

  // ---------- income vs spending trend (recent months, actuals) ----------
  // Yahoo-Finance-style range chips: zoom the visible window. Daily/weekly
  // granularity arrives with dated Transactions; monthly periods are what we
  // have real actuals for today.
  const [range, setRange] = useState<TrendRange>("1Y");
  const monthlyTrend = useMemo(() => {
    const monthly = periods
      .filter((p) => p.cadence === "monthly")
      .slice()
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    const curIdx = monthly.findIndex((p) => p.id === currentPeriodId);
    const end = curIdx >= 0 ? curIdx : monthly.length - 1;
    const startAt = Math.max(0, end - (RANGE_MONTHS[range] - 1));
    const win = monthly.slice(startAt, end + 1);
    const multiYear = win.length > 0 && win[0].startDate.slice(0, 4) !== win[win.length - 1].startDate.slice(0, 4);
    const summaries = win.map((p) => ({
      label: format(fromISO(p.startDate), multiYear ? "MMM ''yy" : "MMM"),
      s: summarize(p, rowsFor(p.id)),
    }));
    return {
      xLabels: summaries.map((x) => x.label),
      income: summaries.map((x) => x.s.income),
      spending: summaries.map((x) => x.s.actualOut),
      balance: summaries.map((x) => x.s.leftToSpend),
      mixColumns: summaries.map((x) => ({
        label: x.label,
        parts: [
          { label: "Bills", color: "var(--cat-sky)", value: x.s.bills },
          { label: "Expenses", color: "var(--cat-butter)", value: x.s.expenses },
          { label: "Debt", color: "var(--cat-pink)", value: x.s.debt },
          { label: "Savings", color: "var(--success)", value: x.s.savings },
        ],
      })),
    };
  }, [periods, currentPeriodId, rowsFor, range]);

  const heroContext = [
    billsThisWeek > 0 ? `${billsThisWeek} bill${billsThisWeek > 1 ? "s" : ""} this week` : null,
    overdueBills > 0 ? `${overdueBills} overdue` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <DashboardHero context={heroContext} />

      {/* Stat chips — all finance */}
      <div className="statgrid" data-tour="stats">
        <button className="stat" onClick={() => navigate("budget")}>
          <span className="stat__value" style={{ color: sum?.overspent ? "var(--alert)" : undefined }}>
            {sum ? <CountUp value={sum.leftToSpend} format={(n) => fmtMoney(n, currency)} /> : "—"}
          </span>
          <span className="stat__label">Left to spend</span>
        </button>
        <button className="stat" onClick={() => navigate("budget")}>
          <span className="stat__value" style={{ color: overdueBills ? "var(--alert)" : undefined }}>
            <CountUp value={billsThisWeek} />
          </span>
          <span className="stat__label">Bills this week</span>
        </button>
        <button className="stat" onClick={() => navigate("savings")}>
          <span className="stat__value tile__value--success">
            <CountUp value={Math.round(savingsPct * 100)} format={(n) => `${n}%`} />
          </span>
          <span className="stat__label">Saved</span>
        </button>
        <button className="stat" onClick={() => navigate("debt")}>
          <span className="stat__value">
            {debts.length ? <CountUp value={payoff.totalCurrent} format={(n) => fmtMoney(n, currency)} /> : "—"}
          </span>
          <span className="stat__label">Debt</span>
        </button>
      </div>

      {/* Balance over time — Yahoo-Finance-style area chart (hero) */}
      {monthlyTrend.balance.length >= 2 && (
        <div className="card" data-tour="cashflow">
          <div className="spread dash-chart-head">
            <div>
              <div className="section-title section-title--flush">
                Balance
                <HelpTip text="Your end-of-month balance over time, like a stock chart: green when you finished above where you started, red when below. Range chips zoom the window; daily and weekly views arrive with dated Transactions." />
              </div>
              <div className="muted fs-13">
                {fmtMoney(monthlyTrend.balance[monthlyTrend.balance.length - 1], currency)} · end of {monthlyTrend.xLabels[monthlyTrend.xLabels.length - 1]}
              </div>
            </div>
            <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
          </div>
          <AreaChart
            points={monthlyTrend.balance}
            xLabels={monthlyTrend.xLabels}
            height={240}
            referenceValue={monthlyTrend.balance[0]}
            formatValue={(n) => fmtMoney(n, currency)}
          />
        </div>
      )}

      {/* Income vs Spending — combo chart (bars + smooth line) */}
      {monthlyTrend.xLabels.length >= 2 && (
        <div className="card">
          <div className="section-title section-title--compact section-title--success">
            Income vs Spending
            <HelpTip text="Money coming in (smooth line) versus money going out (bars) each month. Zoom with the range chips above." />
          </div>
          <ComboChart
            xLabels={monthlyTrend.xLabels}
            bars={[{ label: "Spending", color: "var(--accent)", values: monthlyTrend.spending }]}
            lines={[{ label: "Income", color: "var(--success)", values: monthlyTrend.income, smooth: true }]}
            height={220}
            formatValue={(n) => fmtMoney(n, currency)}
          />
        </div>
      )}

      {/* Spending mix — 100% stacked bars */}
      {monthlyTrend.mixColumns.length >= 2 && (
        <div className="card">
          <div className="section-title section-title--compact">
            Spending mix
            <HelpTip text="What share of each month's money out went to bills, everyday expenses, debt, and savings. Every bar is 100%." />
          </div>
          <Stacked100 columns={monthlyTrend.mixColumns} height={200} />
        </div>
      )}

      <div className="bento">

      {/* ============ COLUMN 1 — Budget ============ */}
      <div className="bento__col">

      <div className="card" data-tour="finances">
        <div className="section-title section-title--compact section-title--success">
          Finances
          <HelpTip text="What's left to spend in your current Budget period." />
        </div>
        {sum ? (
          <>
            <div className={`big-number ${sum.overspent ? "neg" : ""}`}>
              <CountUp value={sum.leftToSpend} format={(n) => fmtMoney(n, currency)} />
            </div>
            <div className="muted dash-leftspend-label">left to spend</div>
            <div className="pbar mt-3">
              <div className={`pbar__fill${sum.overspent ? " pbar__fill--over" : ""}`}
                style={{ width: `${Math.min(100, Math.round((sum.actualOut / Math.max(1, sum.startBalance + sum.income)) * 100))}%` }} />
            </div>

            {/* Budget vs Actual */}
            <div className="mt-5">
              <div className="muted eyebrow-12 mb-3">BUDGET VS ACTUAL</div>
              <div className="dash-groupbars">
                {budgetGroups.map((g) => {
                  const isIncome = g.label === "Income";
                  const over = g.budget > 0 && g.actual > g.budget;
                  const ratio = g.budget > 0 ? Math.min(1, g.actual / g.budget) : g.actual > 0 ? 1 : 0;
                  const fill = isIncome ? "var(--success)" : over ? "var(--alert)" : "var(--accent)";
                  return (
                    <div key={g.label}>
                      <div className="spread row-label-12">
                        <span className="muted">{g.label}</span>
                        <span className="muted tabular-nums">
                          {fmtMoney(g.actual, currency)} / {fmtMoney(g.budget, currency)}
                          {over && (
                            <span className="dash-group-over" style={{ color: isIncome ? "var(--success)" : "var(--alert)" }}>
                              {" "}(+{fmtMoney(g.actual - g.budget, currency)})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="pbar">
                        <div className="pbar__fill" style={{ width: `${ratio * 100}%`, background: fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {upcomingBills.length > 0 && (
              <div className="mt-5">
                <span className="muted eyebrow-12">UPCOMING BILLS</span>
                {upcomingBills.map((b) => (
                  <div key={b.id} className="spread dash-billrow">
                    <span>{b.name}</span>
                    <span className="muted">{fmtMoney(b.budgeted, currency)} · {dueLabel(b.dueDate)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <button className="btn btn--ghost" onClick={() => navigate("budget")}>Set up your budget →</button>
        )}
      </div>

      </div>{/* /col1 */}

      {/* ============ COLUMN 2 — Savings & debt ============ */}
      <div className="bento__col">

      {/* Savings */}
      <div className="card" data-tour="savings-card">
        <div className="spread mb-4">
          <div className="section-title section-title--flush section-title--success">
            Savings
            <HelpTip text="How close your sinking funds are to their targets." />
          </div>
          {funds.length > 0 && (
            <ProgressRing value={savingsPct} size={54} stroke={6}
              ariaLabel={`${Math.round(savingsPct * 100)}% of savings goals`}
              center={<span className="dash-ring-label">{Math.round(savingsPct * 100)}%</span>} />
          )}
        </div>
        {funds.length === 0 ? (
          <button className="btn btn--ghost" onClick={() => navigate("savings")}>Start a savings fund →</button>
        ) : (
          <>
            <div className="spread mb-3">
              <div className="txt-strong">{fmtMoney(savedTotal, currency)} of {fmtMoney(goalTotal, currency)}</div>
              <span className="muted fs-13">{fundsAchieved}/{funds.length} reached</span>
            </div>
            <div className="dash-goals-list">
              {funds.slice(0, 5).map((f) => {
                const pct = f.goalAmount ? Math.min(100, Math.round((f.currentBalance / f.goalAmount) * 100)) : 0;
                return (
                  <div key={f.id}>
                    <div className="spread row-label-13">
                      <span>{f.name}</span>
                      <span className="muted">{pct}%</span>
                    </div>
                    <div className="pbar">
                      <div className="pbar__fill" style={{ width: `${pct}%`, background: "var(--success)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Debt */}
      <div className="card" data-tour="debt-card">
        <div className="section-title section-title--compact">
          Debt payoff
          <HelpTip text="When you'll be debt-free based on your chosen payoff strategy." />
        </div>
        {debts.length === 0 ? (
          <button className="btn btn--ghost" onClick={() => navigate("debt")}>Add a debt to plan payoff →</button>
        ) : (
          <>
            <div className="spread mb-3">
              <div>
                <div className="big-number">{fmtMoney(payoff.totalCurrent, currency)}</div>
                <div className="muted dash-leftspend-label">total owed</div>
              </div>
              <div className="txt-right">
                <div className="txt-strong">{payoff.debtFreeLabel}</div>
                <div className="muted fs-13">debt-free</div>
              </div>
            </div>
            <div className="spread row-label-13">
              <span className="muted">Paid off</span>
              <span className="txt-strong tile__value--success">{fmtMoney(debtPaidOff, currency)} · {debtPaidPct}%</span>
            </div>
            <div className="pbar mt-1 mb-3">
              <div className="pbar__fill" style={{ width: `${debtPaidPct}%`, background: "var(--success)" }} />
            </div>
            {payoffColumns.length > 0 && (
              <div className="mt-4">
                <div className="muted eyebrow-12 mb-3">MONTHS TO PAY OFF EACH</div>
                <Columns points={payoffColumns} height={90} color="var(--accent)" formatValue={(n) => `${Math.round(n)} mo`} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Savings + Debt — compact tiles */}
      {(funds.length > 0 || debts.length > 0) && (
        <div className="tile-row" data-tour="wealth-tiles">
          {funds.length > 0 && (
            <button className="tile" onClick={() => navigate("savings")}>
              <span className="tile__label">Savings</span>
              <span className="tile__value tile__value--success">{Math.round(savingsPct * 100)}%</span>
              <span className="tile__sub">{fmtMoney(savedTotal, currency)} of {fmtMoney(goalTotal, currency)}</span>
            </button>
          )}
          {debts.length > 0 && (
            <button className="tile" onClick={() => navigate("debt")}>
              <span className="tile__label">Debt</span>
              <span className="tile__value">{fmtMoney(payoff.totalCurrent, currency)}</span>
              <span className="tile__sub">free {payoff.debtFreeLabel}</span>
            </button>
          )}
        </div>
      )}

      </div>{/* /col2 */}

      </div>{/* .bento */}
    </>
  );
}
