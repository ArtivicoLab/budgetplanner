// Finance module stores built on the CRUD factory.
import { createCrud } from "./crud";
import type { Debt, Fund } from "../lib/types";

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
