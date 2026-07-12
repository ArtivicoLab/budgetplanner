// Finance module stores built on the CRUD factory.
import { createCrud } from "./crud";
import { todayISO } from "../lib/dates";
import type { Account, Debt, Fund, NetWorthItem, Recurring, Transaction } from "../lib/types";

export const useFunds = createCrud<Fund>("funds", () => ({
  name: "",
  icon: "piggy",
  goalAmount: 0,
  currentBalance: 0,
  startingAmount: 0,
  goalDate: "",
}));

export const useDebts = createCrud<Debt>("debts", () => ({
  name: "",
  startBalance: 0,
  currentBalance: 0,
  apr: 0,
  minPayment: 0,
  notes: "",
}));

export const useTransactions = createCrud<Transaction>("transactions", () => ({
  date: todayISO(),
  amount: 0,
  kind: "expense",
  category: "",
  account: "",
  toAccount: "",
  spender: "",
  description: "",
  paid: true,
}));

export const useAccounts = createCrud<Account>("accounts", () => ({
  name: "",
  type: "checking",
  startBalance: 0,
  creditLimit: 0,
  adjustment: 0,
  lastChecked: "",
  order: 0,
}));

export const useNetWorth = createCrud<NetWorthItem>("networth", () => ({
  name: "",
  kind: "asset",
  value: 0,
  rate: 0,
  category: "",
}));

export const useRecurring = createCrud<Recurring>("recurring", () => ({
  name: "",
  kind: "expense",
  category: "",
  amount: 0,
  account: "",
  toAccount: "",
  spender: "",
  cadence: "monthly",
  anchorDate: todayISO(),
  endDate: "",
  day2: 0,
  active: true,
  supersedes: "",
}));
