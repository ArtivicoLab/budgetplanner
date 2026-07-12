// Easy Setup wizard (competitor-parity #18). A short, skippable onboarding that
// writes ordinary budget rows, so a new buyer isn't dropped onto empty screens.
import { useMemo, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { Chip, ChipRow } from "./Chip";
import { IconClose, IconPlus } from "./icons";
import { useSettings } from "../stores/useSettings";
import { useBudget } from "../stores/useBudget";
import { computePeriodRange } from "../lib/budget";
import { todayISO } from "../lib/dates";
import type { MoneyKind } from "../lib/types";

const CURRENCIES = ["$", "€", "£", "¥", "₹", "R$", "kr", "₩"];

const BILL_PRESETS: { name: string; kind: MoneyKind; category: string; amount: number }[] = [
  { name: "Rent / Mortgage", kind: "bill", category: "Housing", amount: 1500 },
  { name: "Electric", kind: "bill", category: "Utilities", amount: 90 },
  { name: "Internet", kind: "bill", category: "Utilities", amount: 65 },
  { name: "Phone", kind: "bill", category: "Utilities", amount: 80 },
  { name: "Groceries", kind: "expense", category: "Food", amount: 500 },
  { name: "Gas / Transport", kind: "expense", category: "Transport", amount: 150 },
  { name: "Subscriptions", kind: "bill", category: "Subscriptions", amount: 40 },
  { name: "Dining out", kind: "expense", category: "Food", amount: 150 },
];

const STEPS = ["Currency", "Income", "Bills", "Balance"];

export function SetupWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currency: savedCurrency, update: updateSettings } = useSettings();
  const { periods, currentPeriodId, addPeriod, addMoney, updatePeriod } = useBudget();

  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(savedCurrency || "$");
  const [incomes, setIncomes] = useState<{ name: string; amount: string }[]>([{ name: "Paycheck", amount: "" }]);
  const [bills, setBills] = useState<Record<string, { on: boolean; amount: string }>>(
    () => Object.fromEntries(BILL_PRESETS.map((b) => [b.name, { on: true, amount: String(b.amount) }]))
  );
  const [startBalance, setStartBalance] = useState("");

  // Reset to the first step whenever the wizard reopens.
  useMemo(() => {
    if (open) {
      setStep(0);
      setCurrency(savedCurrency || "$");
      setIncomes([{ name: "Paycheck", amount: "" }]);
      setBills(Object.fromEntries(BILL_PRESETS.map((b) => [b.name, { on: true, amount: String(b.amount) }])));
      setStartBalance("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function finish() {
    updateSettings({ currency });
    // Ensure a current monthly period exists. Only trust currentPeriodId if it
    // actually resolves to a real period (a demo→real switch can leave a stale id).
    let periodId = periods.find((p) => p.id === currentPeriodId)?.id || periods[0]?.id || "";
    if (!periodId) {
      const range = computePeriodRange("monthly", todayISO());
      periodId = addPeriod({ label: range.label, cadence: "monthly", startDate: range.startDate, endDate: range.endDate }).id;
    }
    for (const inc of incomes) {
      const amt = Number(inc.amount) || 0;
      if (inc.name.trim() && amt > 0) addMoney({ kind: "income", name: inc.name.trim(), category: "Income", budgeted: amt });
    }
    for (const preset of BILL_PRESETS) {
      const b = bills[preset.name];
      if (b?.on) addMoney({ kind: preset.kind, name: preset.name, category: preset.category, budgeted: Number(b.amount) || 0 });
    }
    if (startBalance) updatePeriod(periodId, { startBalance: Number(startBalance) || 0 });
    onClose();
  }

  const isLast = step === STEPS.length - 1;

  return (
    <BottomSheet open={open} title="Quick setup" onClose={onClose}>
      <div className="wizard-dots">
        {STEPS.map((s, i) => <span key={s} className={`wizard-dot${i === step ? " wizard-dot--on" : ""}${i < step ? " wizard-dot--done" : ""}`} />)}
      </div>

      {step === 0 && (
        <div className="field">
          <label className="field__label">What currency do you use?</label>
          <ChipRow>
            {CURRENCIES.map((c) => <Chip key={c} active={currency === c} onClick={() => setCurrency(c)}>{c}</Chip>)}
          </ChipRow>
          <input className="input" style={{ marginTop: 10 }} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Or type a symbol" maxLength={4} />
        </div>
      )}

      {step === 1 && (
        <>
          <div className="field__label">Your income</div>
          <p className="muted fs-13" style={{ marginTop: -4, marginBottom: 10 }}>Add every paycheck or income source. You can change these anytime.</p>
          {incomes.map((inc, i) => (
            <div key={i} className="spread wizard-income-row">
              <input className="input" value={inc.name} onChange={(e) => setIncomes(incomes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Paycheck" />
              <input className="input wizard-amt" type="number" inputMode="decimal" value={inc.amount} onChange={(e) => setIncomes(incomes.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} placeholder={`${currency}0`} />
              {incomes.length > 1 && <button className="muted" aria-label="Remove" onClick={() => setIncomes(incomes.filter((_, j) => j !== i))}><IconClose size={16} /></button>}
            </div>
          ))}
          <button className="btn btn--ghost" onClick={() => setIncomes([...incomes, { name: "", amount: "" }])}><IconPlus size={16} /> Add another income</button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="field__label">Pick your regular bills</div>
          <p className="muted fs-13" style={{ marginTop: -4, marginBottom: 10 }}>Tick the ones you have and tweak the amounts. Skip anything that doesn't fit.</p>
          {BILL_PRESETS.map((preset) => {
            const b = bills[preset.name];
            return (
              <label key={preset.name} className="spread wizard-bill-row">
                <span className="wizard-bill-name">
                  <input type="checkbox" checked={b.on} onChange={(e) => setBills({ ...bills, [preset.name]: { ...b, on: e.target.checked } })}
                    style={{ width: 20, height: 20, accentColor: "var(--success)" }} />
                  {preset.name}
                </span>
                <input className="input wizard-amt" type="number" inputMode="decimal" value={b.amount} disabled={!b.on}
                  onChange={(e) => setBills({ ...bills, [preset.name]: { ...b, amount: e.target.value } })} />
              </label>
            );
          })}
        </>
      )}

      {step === 3 && (
        <div className="field">
          <label className="field__label" htmlFor="wiz-balance">What's in your main account right now?</label>
          <input id="wiz-balance" className="input" type="number" inputMode="decimal" autoFocus value={startBalance} onChange={(e) => setStartBalance(e.target.value)} placeholder={`${currency}0`} />
          <p className="muted fs-13" style={{ marginTop: 8 }}>This becomes your starting balance so "left to spend" is accurate from day one.</p>
        </div>
      )}

      <div className="spread wizard-actions">
        <button className="btn btn--ghost" style={{ width: "auto" }} onClick={onClose}>Skip setup</button>
        <div className="wizard-actions__right">
          {step > 0 && <button className="btn btn--ghost" style={{ width: "auto" }} onClick={() => setStep(step - 1)}>Back</button>}
          {isLast
            ? <button className="btn btn--primary" style={{ width: "auto" }} onClick={finish}>Finish</button>
            : <button className="btn btn--primary" style={{ width: "auto" }} onClick={() => setStep(step + 1)}>Next</button>}
        </div>
      </div>
    </BottomSheet>
  );
}
