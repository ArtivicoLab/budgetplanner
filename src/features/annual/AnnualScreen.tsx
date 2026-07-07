// Annual "Year Overview" dashboard (TODO competitor-parity #1). Aggregates a
// rolling 12-month window of monthly budget periods — no new data model, all
// derived from summarize() over existing periods.
import { useMemo, useState } from "react";
import { HelpTip } from "../../components/HelpTip";
import { CountUp } from "../../components/CountUp";
import { Donut, Columns, ComboChart } from "../../components/Charts";
import { IconChevron, IconBudget } from "../../components/icons";
import { useBudget } from "../../stores/useBudget";
import { useSettings } from "../../stores/useSettings";
import { summarize } from "../../lib/budget";
import { format, fromISO } from "../../lib/dates";
import { money as fmtMoney } from "../../lib/ui";
import { EmptyState } from "../../components/EmptyState";
import { navigate } from "../../router";

type Kind = "income" | "bills" | "expenses" | "debt" | "savings";
const KINDS: { key: Kind; label: string; color: string }[] = [
  { key: "income", label: "Income", color: "var(--success)" },
  { key: "bills", label: "Bills", color: "var(--cat-sky)" },
  { key: "expenses", label: "Expenses", color: "var(--cat-butter)" },
  { key: "debt", label: "Debt", color: "var(--cat-pink)" },
  { key: "savings", label: "Savings", color: "var(--cat-teal)" },
];

const WINDOW = 12;

export function AnnualScreen() {
  const { periods, currentPeriodId, rowsFor } = useBudget();
  const { currency } = useSettings();

  const monthly = useMemo(
    () =>
      periods
        .filter((p) => p.cadence === "monthly")
        .slice()
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    [periods]
  );

  // Default the window to end at the current month (trailing 12 months of real
  // actuals), then let the user step it a month at a time ("start on any month").
  const currentIdx = Math.max(0, monthly.findIndex((p) => p.id === currentPeriodId));
  const [startIdx, setStartIdx] = useState(() => Math.max(0, currentIdx - (WINDOW - 1)));

  const view = useMemo(() => {
    const win = monthly.slice(startIdx, startIdx + WINDOW);
    const rows = win.map((p) => {
      const s = summarize(p, rowsFor(p.id));
      return {
        label: format(fromISO(p.startDate), "MMM ''yy"),
        short: format(fromISO(p.startDate), "MMM"),
        income: s.income,
        bills: s.bills,
        expenses: s.expenses,
        debt: s.debt,
        savings: s.savings,
        end: s.leftToSpend,
      };
    });
    const sum = (k: keyof (typeof rows)[number]) =>
      rows.reduce((a, r) => a + (r[k] as number), 0);
    const totals = {
      income: sum("income"),
      bills: sum("bills"),
      expenses: sum("expenses"),
      debt: sum("debt"),
      savings: sum("savings"),
    };
    const totalSpending = totals.bills + totals.expenses;
    const leftToSpend = totals.income - totals.bills - totals.expenses - totals.debt - totals.savings;
    return { win, rows, totals, totalSpending, leftToSpend };
  }, [monthly, startIdx, rowsFor]);

  const [kind, setKind] = useState<Kind>("income");

  if (monthly.length === 0) {
    return (
      <>
        <div className="screen-head">
          <div className="screen-head__eyebrow">Year overview</div>
          <h1 className="screen-head__title">Annual</h1>
        </div>
        <EmptyState
          icon={<IconBudget size={28} />}
          title="No budget periods yet"
          sub="Set up a monthly budget and your yearly overview builds itself."
        >
          <button className="btn btn--primary" onClick={() => navigate("budget")}>Go to Budget</button>
        </EmptyState>
      </>
    );
  }

  const { rows, totals, totalSpending, leftToSpend } = view;
  const rangeLabel =
    rows.length > 0 ? `${rows[0].label} – ${rows[rows.length - 1].label}` : "";
  const pct = (n: number) => (totals.income > 0 ? Math.round((n / totals.income) * 100) : 0);

  const kindColor = KINDS.find((k) => k.key === kind)!.color;
  const kindColumns = rows.map((r) => ({ label: r.short, value: r[kind] }));

  const canPrev = startIdx > 0;
  const canNext = startIdx + WINDOW < monthly.length;

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Year overview</div>
        <h1 className="screen-head__title">
          Annual
          <HelpTip text="A rolling 12-month view of your budget: totals, cash flow, and where your money goes across the year. Step the window to start on any month." />
        </h1>
      </div>

      {/* window stepper */}
      <div className="spread annual-range">
        <button className="btn btn--ghost annual-range__btn" disabled={!canPrev} onClick={() => setStartIdx((i) => Math.max(0, i - 1))} aria-label="Earlier 12 months">
          <IconChevron size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
        <div className="annual-range__label">{rangeLabel}</div>
        <button className="btn btn--ghost annual-range__btn" disabled={!canNext} onClick={() => setStartIdx((i) => Math.min(monthly.length - 1, i + 1))} aria-label="Later 12 months">
          <IconChevron size={18} />
        </button>
      </div>

      {/* four summary tiles: total + % of income */}
      <div className="statgrid">
        {(["bills", "expenses", "debt", "savings"] as const).map((k) => {
          const meta = KINDS.find((m) => m.key === k)!;
          return (
            <div key={k} className="stat annual-tile">
              <span className="annual-tile__dot" style={{ background: meta.color }} />
              <span className="stat__value">
                <CountUp value={totals[k]} format={(n) => fmtMoney(n, currency)} />
              </span>
              <span className="stat__label">{meta.label} · {pct(totals[k])}% of income</span>
            </div>
          );
        })}
      </div>

      {/* headline stats strip */}
      <div className="card annual-strip">
        <div className="annual-strip__item">
          <span className="muted annual-strip__label">Left to spend</span>
          <span className={`annual-strip__val${leftToSpend < 0 ? " neg" : ""}`}>{fmtMoney(leftToSpend, currency)}</span>
        </div>
        <div className="annual-strip__item">
          <span className="muted annual-strip__label">Total income</span>
          <span className="annual-strip__val tile__value--success">{fmtMoney(totals.income, currency)}</span>
        </div>
        <div className="annual-strip__item">
          <span className="muted annual-strip__label">Total spending</span>
          <span className="annual-strip__val">{fmtMoney(totalSpending, currency)}</span>
        </div>
        <div className="annual-strip__item">
          <span className="muted annual-strip__label">Total saved</span>
          <span className="annual-strip__val tile__value--success">{fmtMoney(totals.savings, currency)}</span>
        </div>
        <div className="annual-strip__item">
          <span className="muted annual-strip__label">Total debt paid</span>
          <span className="annual-strip__val">{fmtMoney(totals.debt, currency)}</span>
        </div>
      </div>

      <div className="bento">
        {/* Monthly income vs spending */}
        <div className="bento__col">
          <div className="card">
            <div className="section-title section-title--compact section-title--success">
              Monthly income vs spending
              <HelpTip text="Income (line) against everything going out (bars) each month of the window." />
            </div>
            <ComboChart
              xLabels={rows.map((r) => r.short)}
              bars={[{ label: "Spending", color: "var(--accent)", values: rows.map((r) => r.bills + r.expenses + r.debt + r.savings) }]}
              lines={[{ label: "Income", color: "var(--success)", values: rows.map((r) => r.income), smooth: true }]}
              height={210}
              formatValue={(n) => fmtMoney(n, currency)}
            />
          </div>

          {/* Monthly overview with kind switcher */}
          <div className="card">
            <div className="spread dash-chart-head">
              <div className="section-title section-title--flush">Monthly overview</div>
              <div className="annual-kindchips">
                {KINDS.map((k) => (
                  <button
                    key={k.key}
                    className={`chip annual-kindchip${kind === k.key ? " annual-kindchip--on" : ""}`}
                    onClick={() => setKind(k.key)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            <Columns points={kindColumns} height={170} color={kindColor} min={0} />
          </div>
        </div>

        {/* Allocation donut + end balance bars */}
        <div className="bento__col">
          <div className="card">
            <div className="section-title section-title--compact">
              Allocation
              <HelpTip text="Share of the year's money out across bills, expenses, debt and savings." />
            </div>
            <Donut
              size={150}
              slices={[
                { label: "Bills", value: totals.bills, color: "var(--cat-sky)" },
                { label: "Expenses", value: totals.expenses, color: "var(--cat-butter)" },
                { label: "Debt", value: totals.debt, color: "var(--cat-pink)" },
                { label: "Savings", value: totals.savings, color: "var(--cat-teal)" },
              ]}
            />
          </div>

          <div className="card">
            <div className="section-title section-title--compact">
              End balance by month
              <HelpTip text="What was left at the end of each month." />
            </div>
            <Columns
              points={rows.map((r) => ({ label: r.short, value: r.end }))}
              height={150}
              color="var(--accent)"
            />
          </div>
        </div>
      </div>

      {/* Cash-flow summary ledger */}
      <div className="card">
        <div className="section-title section-title--compact">
          Cash-flow summary
          <HelpTip text="Every month's income, bills, expenses, debt, savings and end balance, with yearly totals and monthly averages." />
        </div>
        <div className="ledger-scroll">
          <table className="ledger">
            <thead>
              <tr>
                <th className="ledger__monthcol">Month</th>
                <th>Income</th>
                <th>Bills</th>
                <th>Expenses</th>
                <th>Debt</th>
                <th>Savings</th>
                <th>End balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="ledger__monthcol">{r.label}</td>
                  <td>{fmtMoney(r.income, currency)}</td>
                  <td>{fmtMoney(r.bills, currency)}</td>
                  <td>{fmtMoney(r.expenses, currency)}</td>
                  <td>{fmtMoney(r.debt, currency)}</td>
                  <td>{fmtMoney(r.savings, currency)}</td>
                  <td className={r.end < 0 ? "neg" : ""}>{fmtMoney(r.end, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ledger__total">
                <td className="ledger__monthcol">Annual total</td>
                <td>{fmtMoney(totals.income, currency)}</td>
                <td>{fmtMoney(totals.bills, currency)}</td>
                <td>{fmtMoney(totals.expenses, currency)}</td>
                <td>{fmtMoney(totals.debt, currency)}</td>
                <td>{fmtMoney(totals.savings, currency)}</td>
                <td>—</td>
              </tr>
              <tr className="ledger__avg">
                <td className="ledger__monthcol">Monthly average</td>
                <td>{fmtMoney(totals.income / rows.length, currency)}</td>
                <td>{fmtMoney(totals.bills / rows.length, currency)}</td>
                <td>{fmtMoney(totals.expenses / rows.length, currency)}</td>
                <td>{fmtMoney(totals.debt / rows.length, currency)}</td>
                <td>{fmtMoney(totals.savings / rows.length, currency)}</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
