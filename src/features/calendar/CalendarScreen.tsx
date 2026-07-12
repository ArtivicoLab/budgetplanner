// Smart bill Calendar (competitor-parity #14). A month of money events on
// their dates — from logged transactions plus not-yet-logged recurring
// occurrences — with paid items greyed, today highlighted, header totals, and
// weekly balances. Week start follows the Settings preference.
//
// Two presentations of the same computed month:
//  • ≥900px — a ruled ledger grid (hairlines, not boxes) with an extra
//    "week margin" column carrying each week's In/Out/Net, like the sum
//    column of a paper ledger.
//  • <900px — a tappable mini month grid (day dots) + an agenda list, so
//    phones never sideways-scroll a 1080px table.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Chip, ChipRow } from "../../components/Chip";
import { HelpTip } from "../../components/HelpTip";
import { IconChevron, IconClose, IconPlus, IconRepeat } from "../../components/icons";
import { useTransactions, useRecurring, useAccounts } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { expandRecurrence } from "../../lib/recurrence";
import { recurringFromTxn } from "../../lib/recurringFromTxn";
import { money as fmtMoney } from "../../lib/ui";
import { fromISO, format, todayISO, endOfMonthISO, addDaysISO, addMonthsISO } from "../../lib/dates";
import { txnDirection, type TxnKind } from "../../lib/types";
import { navigate } from "../../router";

const KIND_COLOR: Record<TxnKind, string> = {
  income: "var(--success)", bill: "var(--cat-sky)", expense: "var(--cat-butter)",
  debt: "var(--cat-pink)", saving: "var(--cat-teal)", transfer: "var(--cat-lavender)",
};
const KIND_LABEL: Record<TxnKind, string> = {
  income: "Income", bill: "Bill", expense: "Expense", debt: "Debt", saving: "Saving", transfer: "Transfer",
};
// Kinds you can quick-add straight from a calendar day (transfers need a second
// account, so they stay in the full Transactions editor).
const QUICK_KINDS: TxnKind[] = ["income", "bill", "expense", "debt", "saving"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalEvent {
  key: string;
  date: string;
  name: string;
  kind: TxnKind;
  amount: number;
  paid: boolean;
  planned: boolean; // a recurring occurrence not yet logged
  txnId?: string;
  templateId?: string;
}

export function CalendarScreen() {
  const { items: txns, update: updateTxn, add: addTxn, remove: removeTxn } = useTransactions();
  const { items: recurring, add: addRecurring } = useRecurring();
  const { items: accounts } = useAccounts();
  const { currency, weekStart } = useSettings();
  const today = todayISO();
  const [anchor, setAnchor] = useState(() => today.slice(0, 7)); // "YYYY-MM"
  const [daySel, setDaySel] = useState<string | null>(null);
  const [quickKind, setQuickKind] = useState<TxnKind>("expense");
  // Write-in-the-cell quick add: which date is being typed into, and the draft.
  const [addFor, setAddFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const cal = useMemo(() => {
    const monthStart = `${anchor}-01`;
    const monthEnd = endOfMonthISO(monthStart);

    // 1) events from logged transactions in the month
    const events: CalEvent[] = [];
    const seen = new Set<string>();
    // Match a planned occurrence to a logged transaction on date + kind + amount,
    // so a recurring item and its logged actual collapse into one entry even if
    // categorized slightly differently.
    const keyOf = (date: string, kind: string, amount: number) => `${date}|${kind}|${amount.toFixed(2)}`;
    for (const t of txns) {
      if (t.date < monthStart || t.date > monthEnd) continue;
      const name = t.category || t.description || KIND_LABEL[t.kind];
      seen.add(keyOf(t.date, t.kind, t.amount));
      events.push({ key: `t:${t.id}`, date: t.date, name, kind: t.kind, amount: t.amount, paid: t.paid, planned: false, txnId: t.id });
    }
    // 2) recurring occurrences in the month not already logged → planned
    for (const r of recurring) {
      for (const date of expandRecurrence(r, monthStart, monthEnd)) {
        if (seen.has(keyOf(date, r.kind, r.amount))) continue;
        const name = r.name || r.category || KIND_LABEL[r.kind];
        events.push({ key: `r:${r.id}:${date}`, date, name, kind: r.kind, amount: r.amount, paid: false, planned: true, templateId: r.id });
      }
    }

    const byDate = new Map<string, CalEvent[]>();
    for (const e of events) {
      const arr = byDate.get(e.date) ?? [];
      arr.push(e);
      byDate.set(e.date, arr);
    }

    // grid: 6 weeks starting on the configured week-start
    const jsDow = new Date(`${monthStart}T00:00:00`).getDay();
    const offset = (jsDow - weekStart + 7) % 7;
    const gridStart = addDaysISO(monthStart, -offset);
    const weeks: { days: { date: string; inMonth: boolean; isToday: boolean; events: CalEvent[] }[]; sum: { in: number; out: number } }[] = [];
    for (let w = 0; w < 6; w++) {
      const days = [];
      let win = 0, wout = 0;
      for (let d = 0; d < 7; d++) {
        const date = addDaysISO(gridStart, w * 7 + d);
        const dayEvents = byDate.get(date) ?? [];
        for (const e of dayEvents) {
          const dir = txnDirection(e.kind);
          if (dir === "in") win += e.amount;
          else if (dir === "out") wout += e.amount;
        }
        days.push({ date, inMonth: date >= monthStart && date <= monthEnd, isToday: date === today, events: dayEvents });
      }
      weeks.push({ days, sum: { in: win, out: wout } });
    }

    const totals = events.reduce(
      (acc, e) => {
        const dir = txnDirection(e.kind);
        if (dir === "in") acc.in += e.amount;
        else if (dir === "out") { acc.out += e.amount; if (!e.paid) acc.upcoming += e.amount; }
        if (e.kind !== "income" && e.kind !== "transfer") acc.byKind[e.kind] += e.amount;
        return acc;
      },
      { in: 0, out: 0, upcoming: 0, byKind: { bill: 0, expense: 0, debt: 0, saving: 0 } as Record<string, number> }
    );

    // Agenda (phone): days with events, upcoming-first when viewing the
    // current month; every day for past/future months.
    const agenda = [...byDate.keys()]
      .filter((d) => d >= monthStart && d <= monthEnd)
      .filter((d) => (anchor === today.slice(0, 7) ? d >= today : true))
      .sort()
      .map((d) => ({ date: d, events: byDate.get(d)! }));

    return { weeks, byDate, totals, agenda, monthLabel: format(fromISO(monthStart), "MMMM yyyy") };
  }, [anchor, weekStart, txns, recurring, today]);

  // Last vs this vs next month spending, relative to the viewed month.
  const compare = useMemo(() => {
    const keyOf = (d: string, k: string, a: number) => `${d}|${k}|${a.toFixed(2)}`;
    const spendingForMonth = (ym: string) => {
      const ms = `${ym}-01`;
      const me = endOfMonthISO(ms);
      const seen = new Set<string>();
      let out = 0;
      for (const t of txns) {
        if (t.date < ms || t.date > me) continue;
        seen.add(keyOf(t.date, t.kind, t.amount));
        if (txnDirection(t.kind) === "out") out += t.amount;
      }
      for (const r of recurring) {
        for (const date of expandRecurrence(r, ms, me)) {
          if (seen.has(keyOf(date, r.kind, r.amount))) continue;
          if (txnDirection(r.kind) === "out") out += r.amount;
        }
      }
      return out;
    };
    const prev = addMonthsISO(`${anchor}-01`, -1).slice(0, 7);
    const next = addMonthsISO(`${anchor}-01`, 1).slice(0, 7);
    return [
      { ym: prev, label: format(fromISO(`${prev}-01`), "MMM"), value: spendingForMonth(prev), cur: false },
      { ym: anchor, label: format(fromISO(`${anchor}-01`), "MMM"), value: spendingForMonth(anchor), cur: true },
      { ym: next, label: format(fromISO(`${next}-01`), "MMM"), value: spendingForMonth(next), cur: false },
    ];
  }, [anchor, txns, recurring]);

  const weekdayRow = WEEKDAYS.slice(weekStart).concat(WEEKDAYS.slice(0, weekStart));
  const isCurrentMonth = anchor === today.slice(0, 7);
  const net = cal.totals.in - cal.totals.out;
  const daySheetEvents = daySel ? cal.byDate.get(daySel) ?? [] : [];

  function markPaid(e: CalEvent) {
    if (e.txnId) updateTxn(e.txnId, { paid: true });
  }
  function logPlanned(e: CalEvent) {
    const r = recurring.find((x) => x.id === e.templateId);
    if (!r) return;
    addTxn({ date: e.date, amount: r.amount, kind: r.kind, category: r.category, account: r.account, toAccount: r.toAccount, spender: r.spender, paid: true });
  }
  // Turn a one-off entry into a repeating template, then land on Recurring so
  // the user can adjust the cadence (defaults to monthly from this date).
  function makeRecurring(e: CalEvent) {
    const t = txns.find((x) => x.id === e.txnId);
    if (!t) return;
    addRecurring(recurringFromTxn(t));
    setDaySel(null);
    navigate("recurring");
  }

  // "Write in the cell": parse "Name 120" / "Name $120.50" → a transaction on
  // that date. No trailing number = a 0-amount placeholder she can edit later.
  function commitQuickAdd(date: string, kind: TxnKind = "expense") {
    const raw = draft.trim();
    setAddFor(null);
    setDraft("");
    if (!raw) return;
    const m = raw.match(/^(.*?)\s+\$?(\d+(?:[.,]\d{1,2})?)$/);
    const name = (m ? m[1] : raw).trim();
    const amount = m ? parseFloat(m[2].replace(",", ".")) : 0;
    addTxn({
      date,
      amount,
      kind,
      category: name || KIND_LABEL[kind],
      account: accounts[0]?.name ?? "",
      toAccount: "",
      spender: "",
      description: "",
      paid: date <= today, // future entries start as planned/unpaid
    });
  }
  function startQuickAdd(date: string) {
    setDraft("");
    setAddFor(date);
  }

  // The grid scrolls on the x-axis (roomy 200px day columns at every screen
  // size). Scroll minimally: only when today's column would start out of view,
  // and then left-align it with a sliver of the previous day as an affordance.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = scrollRef.current;
    if (!wrap) return;
    const todayCell = wrap.querySelector<HTMLElement>("[data-today]");
    if (!todayCell) {
      wrap.scrollLeft = 0;
      return;
    }
    // position of today's column relative to the scroll wrapper (offsetLeft
    // would measure against the page, not the scrollport)
    const left = todayCell.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft;
    const width = todayCell.getBoundingClientRect().width;
    wrap.scrollLeft = left + width > wrap.clientWidth ? Math.max(0, left - 12) : 0;
  }, [anchor]);

  const kindChips = [
    { kind: "bill" as const, label: "Bills", value: cal.totals.byKind.bill },
    { kind: "expense" as const, label: "Expenses", value: cal.totals.byKind.expense },
    { kind: "debt" as const, label: "Debt", value: cal.totals.byKind.debt },
    { kind: "saving" as const, label: "Savings", value: cal.totals.byKind.saving },
  ];

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Every payment, on its day</div>
        <h1 className="screen-head__title">
          Calendar
          <HelpTip text="Every income, bill, expense, debt and saving on the day it's due — from your transactions and recurring items. Paid ones grey out; today is highlighted. Tap a day for details." />
        </h1>
      </div>

      {/* Hero: month masthead + ledger totals */}
      <div className="card smcal-hero">
        <div className="smcal-hero__mast">
          <button className="smcal-navbtn" aria-label="Previous month" onClick={() => setAnchor(addMonthsISO(`${anchor}-01`, -1).slice(0, 7))}>
            <IconChevron size={18} className="ic-flip" />
          </button>
          <div className="smcal-hero__title">
            <span className="smcal-hero__month">{cal.monthLabel}</span>
            {!isCurrentMonth && (
              <button className="smcal-todaybtn" onClick={() => setAnchor(today.slice(0, 7))}>
                Back to today
              </button>
            )}
          </div>
          <button className="smcal-navbtn" aria-label="Next month" onClick={() => setAnchor(addMonthsISO(`${anchor}-01`, 1).slice(0, 7))}>
            <IconChevron size={18} />
          </button>
        </div>
        <div className="smcal-stats" data-tour="calendar-stats">
          <div className="smcal-stat">
            <span className="smcal-stat__label">In</span>
            <span className="smcal-stat__value pos">{fmtMoney(cal.totals.in, currency)}</span>
          </div>
          <div className="smcal-stat">
            <span className="smcal-stat__label">Out</span>
            <span className="smcal-stat__value">{fmtMoney(cal.totals.out, currency)}</span>
          </div>
          <div className="smcal-stat">
            <span className="smcal-stat__label">Still to pay</span>
            <span className={`smcal-stat__value${cal.totals.upcoming > 0 ? " neg" : ""}`}>{fmtMoney(cal.totals.upcoming, currency)}</span>
          </div>
          <div className="smcal-stat smcal-stat--net">
            <span className="smcal-stat__label">Net</span>
            <span className={`smcal-stat__value ${net < 0 ? "neg" : "pos"}`}>{fmtMoney(net, currency)}</span>
          </div>
        </div>
        <div className="smcal-kchips" data-tour="calendar-kinds" role="img" aria-label={kindChips.map((k) => `${k.label} ${fmtMoney(k.value, currency)}`).join(", ")}>
          {kindChips.map((k) => (
            <span key={k.kind} className="smcal-kchip" style={{ background: KIND_COLOR[k.kind] }}>
              <span className="smcal-kchip__label">{k.label}</span>
              <span className="smcal-kchip__amt">{fmtMoney(k.value, currency)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* The ledger grid: roomy day columns + a week-margin sum column,
          scrolling on the x-axis at every screen size. */}
      <div className="card smcal-card" data-tour="calendar-grid">
        <div className="smcal-scroll" ref={scrollRef}>
        <div className="smcal-grid">
          {weekdayRow.map((w) => <div key={w} className="smcal-dow">{w}</div>)}
          <div className="smcal-dow smcal-dow--wk">Week</div>
          {cal.weeks.map((wk, i) => (
            // skip a trailing week that's entirely outside the month
            wk.days.every((d) => !d.inMonth) ? null : (
            <Fragment key={i}>
              {wk.days.map((d) => (
                <div
                  key={d.date}
                  role="button"
                  tabIndex={0}
                  className={`smcal-cell${d.inMonth ? "" : " smcal-cell--out"}${d.isToday ? " smcal-cell--today" : ""}`}
                  data-today={d.isToday || undefined}
                  onClick={() => (d.events.length ? setDaySel(d.date) : startQuickAdd(d.date))}
                  onKeyDown={(ev) => ev.key === "Enter" && ev.target === ev.currentTarget && (d.events.length ? setDaySel(d.date) : startQuickAdd(d.date))}
                >
                  <span className="smcal-cell__head">
                    <span className="smcal-daynum">{parseInt(d.date.slice(8, 10), 10)}</span>
                    <button
                      className="smcal-add"
                      aria-label={`Add on ${format(fromISO(d.date), "MMM d")}`}
                      onClick={(ev) => { ev.stopPropagation(); startQuickAdd(d.date); }}
                    >
                      <IconPlus size={13} />
                    </button>
                  </span>
                  {d.events.slice(0, 4).map((e) => {
                    const dir = txnDirection(e.kind);
                    return (
                      <span key={e.key} className={`smcal-ev${e.paid ? " smcal-ev--paid" : ""}`} title={`${e.name} · ${fmtMoney(e.amount, currency)}${e.planned ? " · planned" : ""}`}>
                        <span className={`smcal-ev__tick${e.planned ? " smcal-ev__tick--planned" : ""}`} style={e.planned ? { borderColor: KIND_COLOR[e.kind] } : { background: KIND_COLOR[e.kind] }} />
                        <span className="smcal-ev__name">{e.name}</span>
                        <span className="smcal-ev__amt">{dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtMoney(e.amount, currency)}</span>
                      </span>
                    );
                  })}
                  {d.events.length > 4 && <span className="smcal-more">+{d.events.length - 4} more</span>}
                  {addFor === d.date && (
                    <input
                      className="smcal-cellinput"
                      autoFocus
                      value={draft}
                      placeholder="Groceries 120"
                      aria-label={`New entry on ${format(fromISO(d.date), "MMM d")}`}
                      onChange={(ev) => setDraft(ev.target.value)}
                      onClick={(ev) => ev.stopPropagation()}
                      onBlur={() => commitQuickAdd(d.date)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") commitQuickAdd(d.date);
                        if (ev.key === "Escape") { setAddFor(null); setDraft(""); }
                      }}
                    />
                  )}
                </div>
              ))}
              <div className={`smcal-wksum${wk.sum.in === 0 && wk.sum.out === 0 ? " smcal-wksum--empty" : ""}`}>
                {wk.sum.in === 0 && wk.sum.out === 0 ? (
                  <span className="smcal-wksum__dash">—</span>
                ) : (
                  <>
                    <span className="smcal-wksum__row"><span>In</span><span className="pos">{fmtMoney(wk.sum.in, currency)}</span></span>
                    <span className="smcal-wksum__row"><span>Out</span><span>{fmtMoney(wk.sum.out, currency)}</span></span>
                    <span className="smcal-wksum__row smcal-wksum__row--net"><span>Net</span><span className={wk.sum.in - wk.sum.out < 0 ? "neg" : "pos"}>{fmtMoney(wk.sum.in - wk.sum.out, currency)}</span></span>
                  </>
                )}
              </div>
            </Fragment>
            )
          ))}
        </div>
        </div>
      </div>

      {/* <900px companions: agenda + weekly balances */}
      <div className="smcal-mobile">
        <div className="section-title">
          {isCurrentMonth ? "Coming up" : "This month"}
          <HelpTip text="Each day's money events. Tap a day to see details, log a planned item, or mark it paid." />
        </div>
        <div className="card smcal-agenda" data-tour="calendar-agenda">
          {cal.agenda.length === 0 && (
            <div className="muted smcal-agenda__empty">Nothing due — enjoy the quiet.</div>
          )}
          {cal.agenda.map((day) => (
            <button key={day.date} className="smcal-aday" onClick={() => setDaySel(day.date)}>
              <span className={`smcal-aday__rail${day.date === today ? " smcal-aday__rail--today" : ""}`}>
                <span className="smcal-aday__num">{parseInt(day.date.slice(8, 10), 10)}</span>
                <span className="smcal-aday__wd">{format(fromISO(day.date), "EEE")}</span>
              </span>
              <span className="smcal-aday__list">
                {day.events.map((e) => {
                  const dir = txnDirection(e.kind);
                  return (
                    <span key={e.key} className={`smcal-ev${e.paid ? " smcal-ev--paid" : ""}`}>
                      <span className={`smcal-ev__tick${e.planned ? " smcal-ev__tick--planned" : ""}`} style={e.planned ? { borderColor: KIND_COLOR[e.kind] } : { background: KIND_COLOR[e.kind] }} />
                      <span className="smcal-ev__name">{e.name}</span>
                      <span className="smcal-ev__amt">{dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtMoney(e.amount, currency)}</span>
                    </span>
                  );
                })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Weekly balance — always visible, next to/below the grid */}
      <div className="section-title">
        Weekly balance
        <HelpTip text="Money in versus out for each week of the month, and the week's net." />
      </div>
      <div className="card smcal-weeks" data-tour="calendar-weeks">
        {cal.weeks.map((wk, i) => {
          if (wk.sum.in === 0 && wk.sum.out === 0) return null;
          const wnet = wk.sum.in - wk.sum.out;
          return (
            <div key={i} className="smcal-week">
              <span className="smcal-week__label">Week {i + 1}</span>
              <span className="pos">In {fmtMoney(wk.sum.in, currency)}</span>
              <span>Out {fmtMoney(wk.sum.out, currency)}</span>
              <span className={wnet < 0 ? "neg txt-strong" : "txt-strong"}>Net {fmtMoney(wnet, currency)}</span>
            </div>
          );
        })}
      </div>

      {/* Spending: last vs this vs next month */}
      <div className="card" data-tour="calendar-trend">
        <div className="section-title section-title--compact">
          Spending trend
          <HelpTip text="Total spending for last month, this month, and next — so you can see if you're trending up or down." />
        </div>
        <div className="smcal-compare">
          {compare.map((m) => {
            const max = Math.max(1, ...compare.map((c) => c.value));
            return (
              <div key={m.ym} className={`smcal-compare__col${m.cur ? " smcal-compare__col--cur" : ""}`}>
                <div className="smcal-compare__amt">{fmtMoney(m.value, currency)}</div>
                <div className="smcal-compare__track">
                  <div className="smcal-compare__bar" style={{ height: `${(m.value / max) * 100}%` }} />
                </div>
                <div className="smcal-compare__label">{m.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <BottomSheet open={!!daySel} title={daySel ? format(fromISO(daySel), "EEEE, MMM d") : ""} onClose={() => setDaySel(null)}>
        {daySheetEvents.map((e) => {
          const dir = txnDirection(e.kind);
          return (
            <div key={e.key} className="row smcal-dayrow">
              <span className="txn-row__dot" style={{ background: KIND_COLOR[e.kind] }} />
              <div className="row__body">
                <div className="row__title">{e.name}{e.planned && <span className="muted"> · planned</span>}</div>
                <div className="row__sub">{KIND_LABEL[e.kind]}{e.paid ? " · paid" : ""}</div>
              </div>
              {/* logged entries are editable right here: amount, paid, delete */}
              {e.txnId ? (
                <input
                  className="smcal-dayrow__amt"
                  type="number"
                  inputMode="decimal"
                  defaultValue={e.amount || ""}
                  placeholder="0"
                  aria-label={`${e.name} amount`}
                  onBlur={(ev) => {
                    const v = Number(ev.target.value) || 0;
                    if (v !== e.amount) updateTxn(e.txnId!, { amount: v });
                  }}
                />
              ) : (
                <span className={`txn-row__amt${dir === "in" ? " pos" : dir === "transfer" ? " muted" : ""}`}>
                  {dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtMoney(e.amount, currency)}
                </span>
              )}
              {e.planned ? (
                <button className="chip rec-log" onClick={() => logPlanned(e)}>Log</button>
              ) : !e.paid ? (
                <button className="chip rec-log" onClick={() => markPaid(e)}>Mark paid</button>
              ) : null}
              {e.txnId && (
                <button className="muted smcal-dayrow__del" aria-label={`Make ${e.name} recurring`} title="Make recurring" onClick={() => makeRecurring(e)}>
                  <IconRepeat size={16} />
                </button>
              )}
              {e.txnId && (
                <button className="muted smcal-dayrow__del" aria-label={`Delete ${e.name}`} onClick={() => removeTxn(e.txnId!)}>
                  <IconClose size={16} />
                </button>
              )}
            </div>
          );
        })}
        {/* write directly into the day: "Name amount" */}
        {daySel && (
          <div className="smcal-sheetadd" data-tour="calendar-dayadd">
            <ChipRow>
              {QUICK_KINDS.map((k) => (
                <Chip key={k} active={quickKind === k} onClick={() => setQuickKind(k)}>{KIND_LABEL[k]}</Chip>
              ))}
            </ChipRow>
            <div className="smcal-sheetadd__row">
              <input
                className="input"
                value={addFor === `sheet:${daySel}` ? draft : ""}
                placeholder={quickKind === "income" ? "e.g. Paycheck 2000" : "e.g. Groceries 120"}
                aria-label="Add an entry to this day"
                onFocus={() => { setAddFor(`sheet:${daySel}`); }}
                onChange={(ev) => setDraft(ev.target.value)}
                onKeyDown={(ev) => ev.key === "Enter" && commitQuickAdd(daySel, quickKind)}
              />
              <button className="btn btn--primary btn--auto" onClick={() => commitQuickAdd(daySel, quickKind)} disabled={!draft.trim()}>
                Add
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
