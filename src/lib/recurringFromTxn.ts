// Turn a one-off transaction into a Recurring template (the "Make recurring"
// shortcut). Defaults to a monthly cadence anchored on the transaction's own
// date; the user can change the cadence on the Recurring screen afterward.
import type { Recurring, Transaction } from "./types";

export function recurringFromTxn(t: Transaction): Partial<Recurring> {
  return {
    name: t.category || t.description || t.kind,
    kind: t.kind,
    category: t.category,
    amount: t.amount,
    account: t.account,
    toAccount: t.toAccount,
    spender: t.spender,
    cadence: "monthly",
    anchorDate: t.date,
    active: true,
  };
}
