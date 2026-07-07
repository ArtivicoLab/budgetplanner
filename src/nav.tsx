// Single source of truth for navigation — consumed by the sidebar (desktop),
// the More hub (mobile) and the bottom tab bar.
import type { LucideIcon } from "lucide-react";
import type { Route } from "./router";
import {
  IconHome,
  IconBudget,
  IconPiggy,
  IconCard,
  IconSettings,
  IconChart,
} from "./components/icons";

export interface NavItem {
  route: Route;
  label: string;
  Icon: LucideIcon;
  color: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { route: "dashboard", label: "Dashboard", Icon: IconHome, color: "var(--cat-sky)" },
      { route: "annual", label: "Annual", Icon: IconChart, color: "var(--cat-lavender)" },
    ],
  },
  {
    title: "Money",
    items: [
      { route: "budget", label: "Budget", Icon: IconBudget, color: "var(--cat-butter)" },
      { route: "savings", label: "Savings", Icon: IconPiggy, color: "var(--cat-teal)" },
      { route: "debt", label: "Debt Payoff", Icon: IconCard, color: "var(--cat-pink)" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  route: "settings",
  label: "Settings",
  Icon: IconSettings,
  color: "var(--muted)",
};

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

// Every route's display name, including the ones with no nav entry (More,
// Privacy) — used to label the "Coach Tour" button with the screen it'll
// actually tour, so it's obvious the tour is scoped to where you are.
export const ROUTE_LABELS: Record<Route, string> = {
  ...Object.fromEntries(ALL_NAV_ITEMS.map((i) => [i.route, i.label])),
  settings: SETTINGS_ITEM.label,
  more: "More",
  privacy: "Privacy & source",
} as Record<Route, string>;

// The bottom tab bar (mobile) keeps the dashboard as fixed chrome, so hiding a
// section never breaks that layout — only the remaining "extra" modules are
// offered as hideable in Settings.
const CORE_ROUTES: Route[] = ["dashboard"];
export const HIDEABLE_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter(
  (i) => !CORE_ROUTES.includes(i.route)
);
