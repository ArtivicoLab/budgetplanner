// Transaction History (competitor-parity #6). A dated ledger of money movements
// with a filter bar (account · kind · paid · date range) + Total In / Out tiles.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Segmented } from "../../components/Segmented";
import { Chip, ChipRow } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { CountUp } from "../../components/CountUp";
import { HelpTip } from "../../components/HelpTip";
import { IconRepeat, IconPlus, IconClose } from "../../components/icons";
import { SpenderField } from "../../components/SpenderField";
import { useTransactions } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { money as fmtMoney } from "../../lib/ui";
import { fromISO, format, todayISO } from "../../lib/dates";
import { txnDirection, type Transaction, type TxnKind } from "../../lib/types";

const KINDS: { value: TxnKind; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "bill", label: "Bill" },
  { value: "expense", label: "Expense" },
  { value: "debt", label: "Debt" },
  { value: "saving", label: "Saving" },
  { value: "transfer", label: "Transfer" },
];

const KIND_COLOR: Record<TxnKind, string> = {
  income: "var(--success)",
  bill: "var(--cat-sky)",
  expense: "var(--cat-butter)",
  debt: "var(--cat-pink)",
  saving: "var(--cat-teal)",
  transfer: "var(--cat-lavender)",
};

// Manual list virtualization (#22) — no library. Above this many rows the ledger
// renders only the on-screen window; below it, the plain list keeps the exact
// look for the common case.
const VIRT_THRESHOLD = 80;
const ROW_H = 68; // fixed row height the virtualizer measures against (see CSS)
const OVERSCAN = 6;

function VirtualTxnList({ items, renderRow }: { items: Transaction[]; renderRow: (t: Transaction) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewH(el.clientHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);
  const slice = items.slice(start, end);
  return (
    <div ref={ref} className="card txn-vlist" onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
      <div style={{ height: items.length * ROW_H, position: "relative" }}>
        <div style={{ position: "absolute", top: start * ROW_H, left: 0, right: 0 }}>
          {slice.map(renderRow)}
        </div>
      </div>
    </div>
  );
}

export function TransactionsScreen() {
  const { items, add, update, remove } = useTransactions();
  const { currency } = useSettings();

  const [account, setAccount] = useState("all");
  const [kind, setKind] = useState<"all" | TxnKind>("all");
  const [paid, setPaid] = useState<"all" | "paid" | "unpaid">("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Transaction | null>(null);

  const accounts = useMemo(() => {
    const set = new Set<string>();
    for (const t of items) {
      if (t.account) set.add(t.account);
      if (t.toAccount) set.add(t.toAccount);
    }
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((t) => {
        if (account !== "all" && t.account !== account && t.toAccount !== account) return false;
        if (kind !== "all" && t.kind !== kind) return false;
        if (paid === "paid" && !t.paid) return false;
        if (paid === "unpaid" && t.paid) return false;
        if (start && t.date < start) return false;
        if (end && t.date > end) return false;
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [items, account, kind, paid, start, end]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        const dir = txnDirection(t.kind);
        if (dir === "in") acc.in += t.amount;
        else if (dir === "out") acc.out += t.amount;
        return acc;
      },
      { in: 0, out: 0 }
    );
  }, [filtered]);

  // Scheduled payments (#13): unpaid, today-or-future transactions. Marking one
  // paid converts it into an actual that counts toward balances and totals.
  const today = todayISO();
  const scheduled = useMemo(
    () => items.filter((t) => !t.paid && t.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [items, today]
  );

  const renderRow = (t: Transaction): ReactNode => {
    const dir = txnDirection(t.kind);
    return (
      <button key={t.id} className="row txn-row" onClick={() => { setEdit(t); setOpen(true); }}>
        <span className="txn-row__dot" style={{ background: KIND_COLOR[t.kind] }} />
        <div className="row__body">
          <div className="row__title">{t.category || KINDS.find((k) => k.value === t.kind)?.label}</div>
          <div className="row__sub">
            {format(fromISO(t.date), "MMM d")}
            {t.account ? ` · ${t.account}` : ""}
            {dir === "transfer" && t.toAccount ? ` → ${t.toAccount}` : ""}
            {t.spender ? ` · ${t.spender}` : ""}
            {!t.paid ? " · unpaid" : ""}
          </div>
        </div>
        <span className={`txn-row__amt${dir === "in" ? " pos" : dir === "transfer" ? " muted" : ""}`}>
          {dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtMoney(t.amount, currency)}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Every dollar, dated</div>
        <h1 className="screen-head__title">
          Transactions
          <HelpTip text="A running log of your money in and out. Filter by account, type, paid status, and date range. Transfers move money between your own accounts, so they don't count as income or spending." />
        </h1>
      </div>

      {/* Total in / out */}
      <div className="statgrid statgrid--2" data-tour="txn-stats">
        <div className="stat">
          <span className="stat__value tile__value--success">
            <CountUp value={totals.in} format={(n) => fmtMoney(n, currency)} />
          </span>
          <span className="stat__label">Total in</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            <CountUp value={totals.out} format={(n) => fmtMoney(n, currency)} />
          </span>
          <span className="stat__label">Total out</span>
        </div>
      </div>

      {/* Scheduled / upcoming payments (#13) */}
      {scheduled.length > 0 && (
        <div data-tour="txn-scheduled">
          <div className="section-title spread" style={{ display: "flex" }}>
            <span>Upcoming</span>
            <span className="muted">{scheduled.length} scheduled</span>
          </div>
          <div className="card txn-list">
            {scheduled.slice(0, 8).map((t) => {
              const dir = txnDirection(t.kind);
              return (
                <div key={t.id} className="row txn-row">
                  <span className="txn-row__dot" style={{ background: KIND_COLOR[t.kind] }} />
                  <div className="row__body">
                    <div className="row__title">{t.category || KINDS.find((k) => k.value === t.kind)?.label}</div>
                    <div className="row__sub">
                      {format(fromISO(t.date), "EEE, MMM d")}{t.account ? ` · ${t.account}` : ""}
                    </div>
                  </div>
                  <span className={`txn-row__amt${dir === "in" ? " pos" : dir === "transfer" ? " muted" : ""}`}>
                    {dir === "in" ? "+" : dir === "out" ? "−" : ""}{fmtMoney(t.amount, currency)}
                  </span>
                  <button className="chip rec-log" onClick={() => update(t.id, { paid: true })}>Mark paid</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card txn-filters" data-tour="txn-filters">
        <ChipRow>
          <Chip active={kind === "all"} onClick={() => setKind("all")}>All types</Chip>
          {KINDS.map((k) => (
            <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Chip>
          ))}
        </ChipRow>
        <div className="spread txn-filters__row">
          <Segmented
            options={[
              { value: "all", label: "All" },
              { value: "paid", label: "Paid" },
              { value: "unpaid", label: "Unpaid" },
            ]}
            value={paid}
            onChange={(v) => setPaid(v as typeof paid)}
          />
        </div>
        {accounts.length > 0 && (
          <div className="field txn-filters__field">
            <label className="field__label" htmlFor="txn-account">Account</label>
            <select id="txn-account" className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="all">All accounts</option>
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
        <div className="spread txn-filters__dates">
          <div className="field txn-filters__field">
            <label className="field__label" htmlFor="txn-start">From</label>
            <input id="txn-start" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field txn-filters__field">
            <label className="field__label" htmlFor="txn-end">To</label>
            <input id="txn-end" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="muted fs-12">{filtered.length} of {items.length} transactions</div>
      </div>

      {/* Ledger */}
      <div data-tour="txn-ledger">
      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconRepeat size={28} />} title="No transactions yet" sub="Log your first income or expense to build your ledger.">
            <button className="btn btn--primary" onClick={() => { setEdit(null); setOpen(true); }}>Add transaction</button>
          </EmptyState>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card txn-list"><div className="row"><span className="muted fs-14">No transactions match these filters.</span></div></div>
      ) : filtered.length > VIRT_THRESHOLD ? (
        // At scale (10k+ rows) render only the visible window — the DOM stays a
        // few dozen nodes no matter how long the ledger gets.
        <VirtualTxnList items={filtered} renderRow={renderRow} />
      ) : (
        <div className="card txn-list">{filtered.map(renderRow)}</div>
      )}
      </div>

      {items.length > 0 && (
        <button className="fab" data-tour="txn-fab" aria-label="Add transaction" onClick={() => { setEdit(null); setOpen(true); }}>
          <IconPlus />
        </button>
      )}

      <TxnSheet
        open={open}
        txn={edit}
        currency={currency}
        accounts={accounts}
        onClose={() => setOpen(false)}
        onSave={(patch) => { edit ? update(edit.id, patch) : add(patch); setOpen(false); }}
        onDelete={edit ? () => { remove(edit.id); setOpen(false); } : undefined}
      />
    </>
  );
}

function TxnSheet({
  open, txn, currency, accounts, onClose, onSave, onDelete,
}: {
  open: boolean;
  txn: Transaction | null;
  currency: string;
  accounts: string[];
  onClose: () => void;
  onSave: (patch: Partial<Transaction>) => void;
  onDelete?: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<TxnKind>("expense");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [spender, setSpender] = useState("");
  const [paid, setPaid] = useState(true);

  useMemo(() => {
    if (!open) return;
    setDate(txn?.date ?? todayISO());
    setAmount(txn ? String(txn.amount) : "");
    setKind(txn?.kind ?? "expense");
    setCategory(txn?.category ?? "");
    setAccount(txn?.account ?? "");
    setToAccount(txn?.toAccount ?? "");
    setSpender(txn?.spender ?? "");
    setPaid(txn?.paid ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit() {
    if (!amount) return;
    onSave({
      date,
      amount: Math.abs(Number(amount)) || 0,
      kind,
      category: category.trim(),
      account: account.trim(),
      toAccount: kind === "transfer" ? toAccount.trim() : "",
      spender: spender.trim(),
      paid,
    });
  }

  return (
    <BottomSheet open={open} title={txn ? "Edit transaction" : "New transaction"} onClose={onClose}>
      <div className="field">
        <label className="field__label">Type</label>
        <ChipRow>
          {KINDS.map((k) => (
            <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</Chip>
          ))}
        </ChipRow>
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="txn-amount">Amount ({currency})</label>
          <input id="txn-amount" className="input" type="number" inputMode="decimal" autoFocus value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="txn-date">Date</label>
          <input id="txn-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="txn-category">Category</label>
        <input id="txn-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Groceries" list="txn-account-list" />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="txn-account-in">{kind === "transfer" ? "From account" : "Account"}</label>
        <input id="txn-account-in" className="input" value={account} onChange={(e) => setAccount(e.target.value)}
          placeholder="e.g. Checking" list="txn-account-list" />
        <datalist id="txn-account-list">
          {accounts.map((a) => <option key={a} value={a} />)}
        </datalist>
      </div>
      {kind === "transfer" && (
        <div className="field">
          <label className="field__label" htmlFor="txn-toaccount">To account</label>
          <input id="txn-toaccount" className="input" value={toAccount} onChange={(e) => setToAccount(e.target.value)}
            placeholder="e.g. Credit Card" list="txn-account-list" />
        </div>
      )}
      <SpenderField id="txn-spender" value={spender} onChange={setSpender} />
      <label className="spread txn-paid-row">
        <span style={{ fontWeight: 600 }}>Paid / cleared</span>
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: "var(--success)" }} />
      </label>
      <button className="btn btn--primary" onClick={submit} disabled={!amount}>{txn ? "Save" : "Add"}</button>
      {onDelete && <button className="btn btn--danger mt-10" onClick={onDelete}><IconClose size={16} /> Delete</button>}
    </BottomSheet>
  );
}
