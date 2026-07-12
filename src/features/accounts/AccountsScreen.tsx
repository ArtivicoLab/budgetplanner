// Bank Accounts (competitor-parity #7). Each account's current balance is
// DERIVED from its opening balance + reconciliation adjustment + every paid
// transaction touching it — never hand-edited.
import { useMemo, useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import { Segmented } from "../../components/Segmented";
import { EmptyState } from "../../components/EmptyState";
import { CountUp } from "../../components/CountUp";
import { HelpTip } from "../../components/HelpTip";
import { IconCard, IconPlus, IconClose } from "../../components/icons";
import { useAccounts, useTransactions } from "../../stores/v2";
import { useSettings } from "../../stores/useSettings";
import { accountsOverview } from "../../lib/accounts";
import { money as fmtMoney } from "../../lib/ui";
import { fromISO, format, todayISO } from "../../lib/dates";
import type { Account, AccountType } from "../../lib/types";

const TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit" },
];

export function AccountsScreen() {
  const { items, add, update, remove } = useAccounts();
  const { items: txns } = useTransactions();
  const { currency } = useSettings();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Account | null>(null);

  const { rows, totals } = useMemo(() => accountsOverview(items, txns), [items, txns]);
  const assets = rows.reduce((a, r) => a + Math.max(0, r.current), 0);
  const liabilities = rows.reduce((a, r) => a + Math.min(0, r.current), 0);

  return (
    <>
      <div className="screen-head">
        <div className="screen-head__eyebrow">Where your money lives</div>
        <h1 className="screen-head__title">
          Accounts
          <HelpTip text="Balances update automatically from your paid transactions. Credit cards carry a negative balance. If the app drifts from your real statement, add a reconciliation adjustment." />
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconCard size={28} />} title="No accounts yet" sub="Add your checking, savings, and credit cards to track balances.">
            <button className="btn btn--primary" onClick={() => { setEdit(null); setOpen(true); }}>Add account</button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="statgrid statgrid--3" data-tour="accounts-stats">
            <div className="stat">
              <span className={`stat__value${totals.current < 0 ? " neg" : ""}`}>
                <CountUp value={totals.current} format={(n) => fmtMoney(n, currency)} />
              </span>
              <span className="stat__label">Net balance</span>
            </div>
            <div className="stat">
              <span className="stat__value tile__value--success">{fmtMoney(assets, currency)}</span>
              <span className="stat__label">Assets</span>
            </div>
            <div className="stat">
              <span className="stat__value neg">{fmtMoney(liabilities, currency)}</span>
              <span className="stat__label">Owed</span>
            </div>
          </div>

          <div className="card" data-tour="accounts-ledger">
            <div className="ledger-scroll">
              <table className="ledger ledger--accounts">
                <thead>
                  <tr>
                    <th className="ledger__monthcol">Account</th>
                    <th>Current</th>
                    <th>Start</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Adjust</th>
                    <th>Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.account.id} className="ledger__rowbtn" onClick={() => { setEdit(r.account); setOpen(true); }}>
                      <td className="ledger__monthcol">
                        {r.account.name}
                        <span className="acct-type">{TYPES.find((t) => t.value === r.account.type)?.label}</span>
                      </td>
                      <td className={r.current < 0 ? "neg txt-strong" : "txt-strong"}>{fmtMoney(r.current, currency)}</td>
                      <td>{fmtMoney(r.account.startBalance, currency)}</td>
                      <td className="pos">{fmtMoney(r.totalIn, currency)}</td>
                      <td>{fmtMoney(r.totalOut, currency)}</td>
                      <td>{r.account.adjustment ? fmtMoney(r.account.adjustment, currency) : "—"}</td>
                      <td className="muted">{r.account.lastChecked ? format(fromISO(r.account.lastChecked), "MMM d") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="ledger__total">
                    <td className="ledger__monthcol">Total</td>
                    <td className={totals.current < 0 ? "neg" : ""}>{fmtMoney(totals.current, currency)}</td>
                    <td>—</td>
                    <td className="pos">{fmtMoney(totals.totalIn, currency)}</td>
                    <td>{fmtMoney(totals.totalOut, currency)}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <button className="fab" data-tour="accounts-fab" aria-label="Add account" onClick={() => { setEdit(null); setOpen(true); }}>
            <IconPlus />
          </button>
        </>
      )}

      <AccountSheet
        open={open}
        account={edit}
        currency={currency}
        onClose={() => setOpen(false)}
        onSave={(patch) => { edit ? update(edit.id, patch) : add(patch); setOpen(false); }}
        onDelete={edit ? () => { remove(edit.id); setOpen(false); } : undefined}
      />
    </>
  );
}

function AccountSheet({
  open, account, currency, onClose, onSave, onDelete,
}: {
  open: boolean;
  account: Account | null;
  currency: string;
  onClose: () => void;
  onSave: (patch: Partial<Account>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [startBalance, setStart] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [lastChecked, setLastChecked] = useState("");

  useMemo(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "checking");
    setStart(account ? String(account.startBalance) : "");
    setCreditLimit(account && account.creditLimit ? String(account.creditLimit) : "");
    setAdjustment(account && account.adjustment ? String(account.adjustment) : "");
    setLastChecked(account?.lastChecked ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      type,
      startBalance: Number(startBalance) || 0,
      creditLimit: type === "credit" ? Number(creditLimit) || 0 : 0,
      adjustment: Number(adjustment) || 0,
      lastChecked,
    });
  }

  return (
    <BottomSheet open={open} title={account ? "Edit account" : "New account"} onClose={onClose}>
      <div className="field">
        <label className="field__label" htmlFor="acct-name">Name</label>
        <input id="acct-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chase Checking" />
      </div>
      <div className="field">
        <label className="field__label">Type</label>
        <Segmented options={TYPES} value={type} onChange={setType} />
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="acct-start">Start balance ({currency})</label>
          <input id="acct-start" className="input" type="number" value={startBalance} onChange={(e) => setStart(e.target.value)} placeholder="0" />
        </div>
        {type === "credit" && (
          <div className="field field--flex">
            <label className="field__label" htmlFor="acct-limit">Credit limit ({currency})</label>
            <input id="acct-limit" className="input" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="0" />
          </div>
        )}
      </div>
      <div className="section-title section-title--compact">
        Reconcile
        <HelpTip text="If the app's number drifts from your real bank statement, enter a one-off adjustment to line them up, and stamp the date you checked." />
      </div>
      <div className="spread">
        <div className="field field--flex">
          <label className="field__label" htmlFor="acct-adjust">Adjustment ({currency})</label>
          <input id="acct-adjust" className="input" type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} placeholder="0" />
        </div>
        <div className="field field--flex">
          <label className="field__label" htmlFor="acct-checked">Last checked</label>
          <input id="acct-checked" className="input" type="date" value={lastChecked} onChange={(e) => setLastChecked(e.target.value)} />
        </div>
      </div>
      <button className="btn btn--ghost" style={{ marginTop: -4, marginBottom: 8 }} onClick={() => setLastChecked(todayISO())}>Mark checked today</button>
      <button className="btn btn--primary" onClick={save} disabled={!name.trim()}>{account ? "Save" : "Add account"}</button>
      {onDelete && <button className="btn btn--danger mt-10" onClick={onDelete}><IconClose size={16} /> Delete</button>}
    </BottomSheet>
  );
}
