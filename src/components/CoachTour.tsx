// Coach-mark tour. Each screen has its own short coach, scoped to only what's
// actually rendered there right now: no cross-screen auto-navigation. A step
// spotlights a real, existing element via a `data-tour="<key>"` attribute (see
// the various screens, TabBar, Sidebar): never invents UI that isn't there.
// Steps whose target isn't currently in the DOM (e.g. a card that only shows
// once you have goals) are filtered out before the tour ever opens, so a page
// with nothing relevant to show just doesn't open one.
// "Seen forever" (for the one automatic first-run showing, on the Dashboard)
// persists in plain localStorage: a UI preference, not user data, so it
// deliberately does NOT ride along with the IndexedDB reset/activate flow in
// stores/bootstrap.ts.
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type CSSProperties } from "react";
import { useRoute, type Route } from "../router";
import { Segmented } from "./Segmented";
import { isDemo } from "../lib/demo";
import { loadSampleIntoStores, setDemoMode } from "../stores/bootstrap";
import { useBudget } from "../stores/useBudget";
import { useFunds, useDebts, useTransactions, useAccounts, useNetWorth, useRecurring } from "../stores/v2";

const TOUR_SEEN_KEY = "tourSeen";

interface TourStep {
  target: string; // matches a `data-tour` attribute value
  route?: Route; // screen this target lives on: omit for "dashboard"
  title: string;
  body: string;
  // Some targets only exist while the user is mid-action (e.g. the calendar
  // entry pickers appear only while typing). When a step names a `demo`, the
  // tour fires `coach:<demo>-on` while it's open so the screen can render a
  // safe, non-saving example that puts the target on screen to point at.
  demo?: string;
}

const STEPS: TourStep[] = [
  // ---------- Dashboard ----------
  {
    target: "stats",
    title: "Your numbers, up top",
    body: "What's left to spend, bills due this week, how much you've saved, and what you still owe. Tap any of them to jump straight into that section.",
  },
  {
    target: "finances",
    title: "Your budget, tracked",
    body: "Once you set up a budget, this card shows what's left to spend, budget vs. actual for income, bills, expenses and savings, and your upcoming bills: right here, without opening the Budget tab.",
  },
  {
    target: "savings-card",
    title: "Savings at a glance",
    body: "How close each of your sinking funds is to its target, with your overall progress in the ring. Tap through to add money or a new fund.",
  },
  {
    target: "debt-card",
    title: "Debt payoff",
    body: "What you still owe and the month you'll be debt-free, based on your chosen payoff strategy (snowball or avalanche).",
  },
  {
    target: "wealth-tiles",
    title: "Savings & debt tiles",
    body: "Quick tiles for your total saved and total owed: each one taps through to its full screen.",
  },
  {
    target: "nav-more",
    title: "Everything else lives here",
    body: "Budget, Savings, and Debt Payoff each have their own full screen, one tap away. Each one has its own quick coach too: look for the compass.",
  },
  // ---------- Finances ----------
  {
    target: "budget-period",
    route: "budget",
    title: "Switch or rename your period",
    body: "Tap here to change or rename the current budget period: weekly, biweekly, or monthly, your call.",
  },
  {
    target: "budget-strip",
    route: "budget",
    title: "Your period at a glance",
    body: "The headline strip: what's left to spend, your income, spending, saved, and debt paid, with a ring showing how much of your income is still free.",
  },
  {
    target: "budget-leftspend",
    route: "budget",
    title: "What's actually left",
    body: "Left to spend is your start balance plus real income, minus real bills, expenses, debt payments and savings: the number that matters day to day.",
  },
  {
    target: "budget-tobudget",
    route: "budget",
    title: "Left to budget",
    body: "Different from left to spend: this is your planned income minus what you've already assigned to lines. When it hits zero, every dollar has a job (that's zero-based budgeting).",
  },
  {
    target: "budget-todo",
    route: "budget",
    title: "Your monthly money to-do",
    body: "A gentle checklist that resets each period: review the budget, pay bills, log transactions. Tick things off as you go, or make the list your own.",
  },
  {
    target: "budget-charts",
    route: "budget",
    title: "Budget vs. actual",
    body: "See how your plan compares to what really happened for income, bills, expenses, debt and savings, plus a full breakdown and cash-flow ledger below.",
  },
  {
    target: "budget-breakdown",
    route: "budget",
    title: "Where it actually went",
    body: "A donut of your real spending split across bills, expenses, debt and savings: the shape of this period at a glance.",
  },
  {
    target: "budget-wheremoney",
    route: "budget",
    title: "Where does my money go",
    body: "The same spending, but broken out by individual line item, your biggest six with the rest grouped as Other. This is where you spot the sneaky category eating your budget.",
  },
  {
    target: "budget-cashflow",
    route: "budget",
    title: "The cash-flow math",
    body: "Start balance, plus income and savings, minus bills, expenses and debt, equals what's left, budgeted versus actual side by side.",
  },
  {
    target: "budget-daily",
    route: "budget",
    title: "Your balance, day by day",
    body: "A running balance from your real transactions this period, so you can spot a dip heading toward zero before it becomes an overdraft.",
  },
  {
    target: "budget-lines",
    route: "budget",
    title: "Every line you're tracking",
    body: "Your income, bills, expenses, debt and savings lines, grouped by type. Tap any to edit it, tick it paid, or set its 50/30/20 bucket.",
  },
  {
    target: "budget-fab",
    route: "budget",
    title: "Add income, bills, or expenses",
    body: "Tap + to add a line to this period. \"Left to spend\" and the budget-vs-actual bars update the moment you log a real payment against it.",
  },
  {
    target: "savings-totals",
    route: "savings",
    title: "Every fund, at a glance",
    body: "Total saved across all your funds, how much is left to reach every goal, and how many goals you've already hit.",
  },
  {
    target: "savings-funds",
    route: "savings",
    title: "Each fund's own ring",
    body: "Tap a fund to edit it. The repeat icon means it's linked to a Budget savings line: entering an amount there updates this ring automatically.",
  },
  {
    target: "savings-fab",
    route: "savings",
    title: "Start a savings goal",
    body: "Add a fund for something you're saving toward, a car, a trip, an emergency cushion. Link it to a Budget savings line and its balance tops up automatically every period.",
  },
  {
    target: "debt-overview",
    route: "debt",
    title: "Your debt-free date",
    body: "See the month you'll be debt-free and total interest paid, based on your strategy and any extra payment below.",
  },
  {
    target: "debt-chart",
    route: "debt",
    title: "Months to debt-free",
    body: "How long until each debt is gone, one bar per debt, so you can see which one clears first and which one's the long haul.",
  },
  {
    target: "debt-strategy",
    route: "debt",
    title: "Snowball, avalanche, or your own order",
    body: "Snowball pays the smallest balance first for fast wins. Avalanche pays the highest interest rate first to save the most money. Custom lets you set the order yourself: your payoff date updates either way. Add any extra per month here to speed it all up.",
  },
  {
    target: "debt-list",
    route: "debt",
    title: "Each debt, tracked",
    body: "Every debt with its balance, rate, and progress bar. Tap one to edit it or log a payment, and it drops out of the plan the month it hits zero.",
  },
  {
    target: "debt-schedule",
    route: "debt",
    title: "The full payment schedule",
    body: "Month-by-month payment, interest, and remaining balance across every debt, all the way to debt-free.",
  },
  {
    target: "debt-fab",
    route: "debt",
    title: "Add a debt",
    body: "Add a credit card, loan, or anything you owe, with its balance, rate, and minimum payment, and it joins the payoff plan instantly.",
  },
  // ---------- Annual ----------
  {
    target: "annual-range",
    route: "annual",
    title: "Step through your year",
    body: "This is a rolling 12-month view. Use the arrows to slide the window to any stretch: last year, this year, or straddling both.",
  },
  {
    target: "annual-stats",
    route: "annual",
    title: "Where your money goes",
    body: "Bills, expenses, debt and savings totalled across the window, each shown as a share of your income, so you can see your mix at a glance.",
  },
  {
    target: "annual-strip",
    route: "annual",
    title: "The year in one line",
    body: "Left to spend, total income, total spending, and your net (income minus everything out): the headline numbers for the whole window in a single strip.",
  },
  {
    target: "annual-combo",
    route: "annual",
    title: "Income vs. spending, month by month",
    body: "The green line is income; the bars are everything going out. When the bars poke above the line, that month spent more than it earned.",
  },
  {
    target: "annual-monthly",
    route: "annual",
    title: "Break it down by type",
    body: "The same months, one category at a time: tap Bills, Expenses, Debt or Savings to see just that line trend across the year.",
  },
  {
    target: "annual-allocation",
    route: "annual",
    title: "Your allocation",
    body: "How the year's money-out splits across bills, expenses, debt and savings: the big picture of where it all went.",
  },
  {
    target: "annual-endbalance",
    route: "annual",
    title: "What was left each month",
    body: "Your end-of-month balance across the window: a quick read on whether you're trending up or dipping into the red.",
  },
  {
    target: "annual-topcat",
    route: "annual",
    title: "Your biggest categories",
    body: "The line items that ate the most across the whole window, largest first: the quickest place to spot where to trim.",
  },
  {
    target: "annual-ledger",
    route: "annual",
    title: "The full cash-flow table",
    body: "Every month's income, bills, expenses, debt, savings and end balance in one grid, with yearly totals and monthly averages at the bottom. Scrolls sideways on a phone.",
  },
  // ---------- Calendar ----------
  {
    target: "calendar-stats",
    route: "calendar",
    title: "Every bill on a calendar",
    body: "Money in, money out, what's still to pay, and the net for the month you're viewing. Step months with the arrows up top.",
  },
  {
    target: "calendar-kinds",
    route: "calendar",
    title: "The month by type",
    body: "A quick colour-coded breakdown of the month's totals: income, bills, expenses, debt and savings, so you can see the mix at a glance.",
  },
  {
    target: "calendar-grid",
    route: "calendar",
    title: "The easiest place to start",
    body: "Tap any day to add income, a bill, or an expense right there: pick the type, type \"Name amount\", done. Solid ticks are paid, dashed are still planned. New here? Just start dropping things onto the calendar.",
  },
  {
    target: "calendar-grid",
    route: "calendar",
    title: "How things land on days",
    body: "Everything sits on its own date. A transaction shows on the day it happened, a recurring bill or paycheck on each day its schedule falls, and anything you add on the day you tapped. A bill and its actual payment merge into one entry, so nothing is ever counted twice.",
  },
  {
    target: "calendar-grid",
    route: "calendar",
    title: "Edit it, or make it repeat",
    body: "Tap a day to open its entries: change an amount, mark it paid, delete it, or tap the repeat icon to turn a one-off into a recurring bill or paycheck. For a full edit (rename, category, account) open it from the Transactions screen.",
  },
  {
    target: "calendar-agenda",
    route: "calendar",
    title: "Coming up, as a list",
    body: "On a phone, the same month reads as a tidy agenda: every day with something due, newest first. Tap a day to open it.",
  },
  {
    target: "calendar-weeks",
    route: "calendar",
    title: "Week-by-week balance",
    body: "In, out, and net for each week of the month: a faster read than scanning every day when you just want the weekly rhythm.",
  },
  {
    target: "calendar-trend",
    route: "calendar",
    title: "Last month vs. this vs. next",
    body: "Total spending across three months side by side, so you can see whether you're trending up or down before the month even ends.",
  },
  // ---------- 50/30/20 ----------
  {
    target: "framework-hero",
    route: "fiftythirty",
    title: "The 50/30/20 rule",
    body: "How much of your income goes to Needs, Wants, and Savings. Tag each budget line and this ring shows whether your split matches the plan.",
  },
  {
    target: "framework-mix",
    route: "fiftythirty",
    title: "Make it your own mix",
    body: "50/30/20 is just the default: set any target split (60/20/20, 70/20/10, whatever fits) and everything below recalculates instantly.",
  },
  {
    target: "framework-breakdown",
    route: "fiftythirty",
    title: "Where you actually land",
    body: "Your real spending split across Needs, Wants and Savings: the donut shows the shape of where your money actually went.",
  },
  {
    target: "framework-vsgoal",
    route: "fiftythirty",
    title: "Target vs. reality",
    body: "Each bucket's goal amount next to what you actually spent, side by side: the fastest way to spot the one that's over.",
  },
  {
    target: "framework-table",
    route: "fiftythirty",
    title: "The exact numbers",
    body: "Goal and actual for every bucket, as both a percentage and a dollar amount: anything running over its target is flagged.",
  },
  {
    target: "framework-list-needs",
    route: "fiftythirty",
    title: "Needs, itemized",
    body: "The exact must-have lines that make up your Needs bucket: rent, utilities, groceries, each with what you actually spent.",
  },
  {
    target: "framework-list-wants",
    route: "fiftythirty",
    title: "Wants, itemized",
    body: "Everything you tagged as a Want: dining out, subscriptions, the nice-to-haves, so you can see exactly where the fun money went.",
  },
  {
    target: "framework-list-savings",
    route: "fiftythirty",
    title: "Savings, itemized",
    body: "Every line feeding future you: savings transfers and debt payments, the third of the 50/30/20 split that builds wealth.",
  },
  // ---------- Recurring ----------
  {
    target: "recurring-upcoming",
    route: "recurring",
    title: "What's coming up",
    body: "Every payment your recurring items will generate over the next couple of months, in order. Tap Log on any one to turn it into a real, paid transaction.",
  },
  {
    target: "recurring-templates",
    route: "recurring",
    title: "Set a bill once, track it forever",
    body: "Every repeating income, bill, or transfer lives here and auto-generates on schedule. When a subscription's price changes, we keep the old price's history instead of rewriting it: tap one to see its price trail.",
  },
  {
    target: "recurring-fab",
    route: "recurring",
    title: "Add a recurring item",
    body: "Add your paycheck, rent, or a subscription once, pick how often it repeats, and it fills your calendar and upcoming list automatically.",
  },
  // ---------- Transactions ----------
  {
    target: "txn-stats",
    route: "transactions",
    title: "Everything you've spent and earned",
    body: "Your running log of real money movements. The totals up top react to your date and account filters, so you can slice any window you like.",
  },
  {
    target: "txn-scheduled",
    route: "transactions",
    title: "Upcoming, still unpaid",
    body: "Anything dated today or later that hasn't cleared yet. Tap Mark paid when it goes through and it drops into your real ledger below.",
  },
  {
    target: "txn-filters",
    route: "transactions",
    title: "Slice it any way",
    body: "Filter by type, account, paid status, and date range. The totals up top update to match, so you can answer \"how much on groceries in March?\" in seconds.",
  },
  {
    target: "txn-ledger",
    route: "transactions",
    title: "The full ledger",
    body: "Every transaction, newest first: tap one to edit or delete it. It stays fast even at thousands of rows by only drawing what's on screen.",
  },
  {
    target: "txn-fab",
    route: "transactions",
    title: "Log a transaction",
    body: "Add anything you spent or received. Tag it with an account and a person, and every dashboard, balance, and net-worth figure updates from it automatically.",
  },
  // ---------- Accounts ----------
  {
    target: "accounts-stats",
    route: "accounts",
    title: "All your balances in one place",
    body: "Your net balance across every account, plus what you own versus what you owe: kept current from your transactions.",
  },
  {
    target: "accounts-ledger",
    route: "accounts",
    title: "Every account, balance by balance",
    body: "Each account's current balance, derived from its opening balance plus every paid transaction (credit cards carry a negative). Tap a row to edit it, or add a reconciliation adjustment when the app drifts from your real statement.",
  },
  {
    target: "accounts-fab",
    route: "accounts",
    title: "Add an account",
    body: "Add each place your money lives. Its balance moves automatically as you log transactions and transfers against it.",
  },
  // ---------- Net Worth ----------
  {
    target: "networth-hero",
    route: "networth",
    title: "What you're really worth",
    body: "Everything you own minus everything you owe. Your accounts and debts flow in automatically; add a home, car, or investment below and set a growth rate to project it forward.",
  },
  {
    target: "networth-trend",
    route: "networth",
    title: "Growing over time",
    body: "Your net worth month by month: the single most important line in personal finance. Up and to the right is the whole game.",
  },
  {
    target: "networth-assetdist",
    route: "networth",
    title: "Where your assets sit",
    body: "How your total assets split across accounts, property, and investments: a quick check on whether you're too concentrated in any one place.",
  },
  {
    target: "networth-split",
    route: "networth",
    title: "Assets vs. what you owe",
    body: "The two sides of your net worth side by side: grow the green, shrink the red, and watch the gap widen over time.",
  },
  {
    target: "networth-goal",
    route: "networth",
    title: "Set a target",
    body: "Give yourself a net-worth goal and the ring up top fills as you close in on it: a north star for the years ahead.",
  },
  {
    target: "networth-assets",
    route: "networth",
    title: "Add what you own",
    body: "Your accounts flow in automatically, but add anything else here: a home, car, investments, each with an optional growth rate so it projects forward.",
  },
  {
    target: "networth-liabilities",
    route: "networth",
    title: "…and what you owe",
    body: "Debts flow in automatically, but add any other liability here: a mortgage, a personal loan, with its interest rate, so the red side of your net worth is complete.",
  },
  // ---------- Distribution ----------
  {
    target: "dist-filters",
    route: "distribution",
    title: "Pick your window",
    body: "Set a date range and everything below recalculates for it: compare a single month, a quarter, or the whole year.",
  },
  {
    target: "dist-stats",
    route: "distribution",
    title: "Who earns, who spends",
    body: "For couples and families sharing a budget: total household income and spending up top, then broken down per person below.",
  },
  {
    target: "dist-people",
    route: "distribution",
    title: "Split by person",
    body: "Two donuts: one for who brought money in, one for who spent it, so each person's share of the household is obvious at a glance.",
  },
  {
    target: "dist-spending",
    route: "distribution",
    title: "Each person's share",
    body: "Everyone's spending stacked by type: a taller column means they spent more overall. Tag transactions with a spender to fill this in.",
  },
  {
    target: "dist-cashflow",
    route: "distribution",
    title: "Cash flow, per person",
    body: "The full table: each person's income, spending, contribution ratio, and what's left over. It settles \"who's carrying what\" without an argument.",
  },
  {
    target: "dist-ledger",
    route: "distribution",
    title: "Zoom into one person",
    body: "Filter to Everyone or a single person, then read their income and their spending line by line, exactly what they brought in and where it went.",
  },
  // ---------- Wrap-up ----------
  {
    target: "settings-sheets",
    route: "settings",
    title: "It's your data, in your Google Sheet",
    body: "Everything works fully offline on this device first. Connect your own Google Sheet here and it becomes the backup and single source of truth: synced automatically after that.",
  },
  {
    target: "settings-categories",
    route: "settings",
    title: "Your budget categories",
    body: "Add, rename, or recolor the tags your budget lines use: tap a tag's name to rename it, or its dot to change its color.",
  },
  {
    target: "settings-sections",
    route: "settings",
    title: "Show only what you use",
    body: "Hide sections you don't need to declutter the sidebar and More menu: nothing is deleted, and hidden sections stay one tap away if you bring them back.",
  },
  {
    target: "settings-yearreset",
    route: "settings",
    title: "Fresh start each year",
    body: "Clear out this year's budget transactions without rebuilding your budget: your savings funds, debts, and settings all stay exactly as they are.",
  },
  {
    target: "privacy-source",
    route: "privacy",
    title: "See for yourself",
    body: "The entire source is public. Open your browser's Network tab and you'll see no third-party calls: nothing leaves this device except to your own Google account, only if you connect it.",
  },
];

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked (private mode etc.): don't force the tour
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // ignore: worst case the tour reappears next visit
  }
}

function targetExists(key: string): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)).some(
    (el) => el.getClientRects().length > 0
  );
}

const CARD_GAP = 16;

export function CoachTour({ onDone }: { onDone: () => void }) {
  const currentRoute = useRoute();
  const [openedRoute] = useState(currentRoute);
  const [pageSteps, setPageSteps] = useState<TourStep[] | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardTop, setCardTop] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // The tour needs something to point at. If the user isn't in demo mode, load
  // the sample data into the stores for the duration of the tour so every step
  // has a populated card to spotlight, then restore their real data on close.
  const wasDemo = useRef(isDemo());
  const [sampleOn, setSampleOn] = useState(true); // the tour starts populated
  const [dataTick, setDataTick] = useState(0); // bump to re-measure the spotlight after a toggle

  // A synchronous snapshot of the real user's data, taken before we swap in the
  // sample, so restoring is instant (no async IndexedDB read that could race a
  // StrictMode re-mount and clobber the freshly-loaded sample).
  const realSnap = useRef<{
    periods: unknown[]; money: unknown[]; currentPeriodId: string;
    funds: unknown[]; debts: unknown[]; transactions: unknown[];
    accounts: unknown[]; networth: unknown[]; recurring: unknown[];
  } | null>(null);

  function captureReal() {
    realSnap.current = {
      periods: useBudget.getState().periods,
      money: useBudget.getState().money,
      currentPeriodId: useBudget.getState().currentPeriodId,
      funds: useFunds.getState().items,
      debts: useDebts.getState().items,
      transactions: useTransactions.getState().items,
      accounts: useAccounts.getState().items,
      networth: useNetWorth.getState().items,
      recurring: useRecurring.getState().items,
    };
  }
  function restoreReal() {
    const s = realSnap.current;
    if (!s) return;
    useBudget.getState().setAll(s.periods as never, s.money as never);
    useBudget.setState({ currentPeriodId: s.currentPeriodId });
    useFunds.getState().setAll(s.funds as never);
    useDebts.getState().setAll(s.debts as never);
    useTransactions.getState().setAll(s.transactions as never);
    useAccounts.getState().setAll(s.accounts as never);
    useNetWorth.getState().setAll(s.networth as never);
    useRecurring.getState().setAll(s.recurring as never);
  }

  // The on-card toggle: flip between the sample data (so the tour has content)
  // and the user's own data. For someone who was already in demo, it drives the
  // real, persistent demo flag (so they can turn demo off right here); for a
  // real user it's a temporary preview that's reverted when the tour closes.
  function toggleSample(on: boolean) {
    setSampleOn(on);
    if (wasDemo.current) {
      void setDemoMode(on);
    } else if (on) {
      loadSampleIntoStores();
    } else {
      restoreReal();
    }
    requestAnimationFrame(() => setDataTick((t) => t + 1));
  }

  // Drag-to-move: once the user drags the card by its grip, it stays where they
  // put it (dragPos wins over the auto above/below-the-spotlight placement).
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  function onGripDown(e: RPointerEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onGripMove(e: RPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const card = cardRef.current;
    if (!card) return;
    const x = Math.max(6, Math.min(e.clientX - dragOffset.current.dx, window.innerWidth - card.offsetWidth - 6));
    const y = Math.max(6, Math.min(e.clientY - dragOffset.current.dy, window.innerHeight - card.offsetHeight - 6));
    setDragPos({ x, y });
  }
  function onGripUp(e: RPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  // The tour is scoped to whichever screen it was opened on. If the user
  // navigates elsewhere while it's up (a nav tap, a card link), just close it
  // rather than following them: each screen's coach is its own thing now.
  useEffect(() => {
    if (currentRoute !== openedRoute) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute]);

  // Build this page's step list once: only what's actually on screen right
  // now (e.g. no "Goals in progress" card tip if there are no goals yet).
  // Steps with a `demo` first ask the screen to render their example element
  // (via a `coach:<demo>-on` event), then we wait a frame for it to mount
  // before checking which targets exist: otherwise the demo-only target
  // would look absent and the step would be dropped.
  useLayoutEffect(() => {
    // Populate the app with sample data for the duration of the tour if the user
    // isn't already in demo, so every step has a real, filled card to point at.
    // (A real user's own data is reloaded on close; see the restore effect below.)
    const filled = !wasDemo.current;
    if (filled) { captureReal(); loadSampleIntoStores(); }

    const relevant = STEPS.filter((s) => (s.route ?? "dashboard") === openedRoute);
    const demoKeys = [...new Set(relevant.map((s) => s.demo).filter(Boolean) as string[])];
    demoKeys.forEach((k) => window.dispatchEvent(new Event(`coach:${k}-on`)));

    let rafId = 0, cancelled = false, frames = 0;
    const measure = () => relevant.filter((s) => targetExists(s.target));
    if (filled || demoKeys.length) {
      // Wait for the just-loaded sample data (or a demo-only element) to render
      // before measuring. A fixed wait is racy: a heavier screen like Annual,
      // which has only ONE anchor, can render a frame late, dropping its single
      // step so the tour closes with nothing. So poll each frame until a target
      // appears (or we give up after ~12 frames).
      const poll = () => {
        if (cancelled) return;
        const found = measure();
        if (found.length > 0 || frames >= 12) { setPageSteps(found); return; }
        frames++;
        rafId = requestAnimationFrame(poll);
      };
      rafId = requestAnimationFrame(poll);
    } else {
      setPageSteps(measure());
    }
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      demoKeys.forEach((k) => window.dispatchEvent(new Event(`coach:${k}-off`)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the real user's data when the tour closes. Demo-origin users keep
  // whatever the toggle last set (the toggle drives the persistent demo flag for
  // them), so only revert for someone who started outside demo.
  useEffect(() => () => { if (!wasDemo.current) restoreReal(); }, []);

  useEffect(() => {
    if (pageSteps && pageSteps.length === 0) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSteps]);

  useLayoutEffect(() => {
    if (!pageSteps || pageSteps.length === 0) return;

    function findTarget() {
      const key = pageSteps![step].target;
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)
      );
      // Mobile and desktop chrome both carry the attribute; only one is
      // actually on screen at a given width: pick whichever has real size.
      return candidates.find((el) => el.getClientRects().length > 0);
    }
    function place() {
      const visible = findTarget();
      setRect(visible ? visible.getBoundingClientRect() : null);
    }
    // Some steps target cards further down a long screen scroll (or, on
    // desktop, further down the sidebar's own nested scroll): bring the new
    // target into view before measuring. Instant + synchronous, so there's no
    // animation to race against the scroll listener below. Tall cards (e.g.
    // Today) scroll to their top edge so the heading stays visible; smaller
    // ones center for a nicer frame.
    const target = findTarget();
    if (target) {
      const tall = target.getBoundingClientRect().height > window.innerHeight * 0.55;
      target.scrollIntoView({ block: tall ? "start" : "center", behavior: "auto" });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [step, pageSteps, dataTick]);

  // Anchor the card above or below the spotlighted element (whichever side
  // has room) so it never sits on top of the thing it's explaining: the
  // bottom tab bar targets especially, which used to sit right under the
  // fixed-bottom card. Falls back to the default bottom-sheet CSS position
  // when there's no target (or somehow no room on either side).
  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl || !rect) {
      setCardTop(null);
      return;
    }
    const vh = window.innerHeight;
    const cardH = cardEl.offsetHeight;
    // Work off the portion of the target actually on screen: a target
    // taller than the viewport (e.g. Today) has no true "above" or "below",
    // so comparing against the full off-screen rect would just pick
    // whichever side is relatively bigger and still overlap it.
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, vh);
    const spaceBelow = vh - visibleBottom;
    const spaceAbove = visibleTop;
    if (spaceBelow >= cardH + CARD_GAP) {
      setCardTop(visibleBottom + CARD_GAP);
    } else if (spaceAbove >= cardH + CARD_GAP) {
      setCardTop(visibleTop - cardH - CARD_GAP);
    } else {
      // Neither side fits: pin to the bottom edge so the card stays fully
      // visible; the target's top (and its heading) is what we scrolled to,
      // so it remains visible above the card.
      setCardTop(Math.max(CARD_GAP, vh - cardH - CARD_GAP));
    }
  }, [rect, step]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    // Any completed coach: on any page: is enough to stop auto-popping
    // the first-run one; it only needs to fire once, ever.
    markTourSeen();
    onDone();
  }

  function next() {
    if (!pageSteps || step >= pageSteps.length - 1) finish();
    else setStep((s) => s + 1);
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (!pageSteps || pageSteps.length === 0) return null;

  const s = pageSteps[step];
  const isLast = step === pageSteps.length - 1;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={s.title}>
      <div className="tour__scrim" style={{ background: rect ? "transparent" : undefined }} onClick={finish} />
      {rect && (
        <div
          className="tour__spot"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        ref={cardRef}
        className="tour__card"
        style={
          dragPos
            ? { left: dragPos.x, top: dragPos.y, right: "auto", bottom: "auto", transform: "none" }
            : cardTop === null
              ? undefined
              : ({ top: cardTop, bottom: "auto" } as CSSProperties)
        }
      >
        <div
          className="tour__grip"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          title="Drag to move"
          aria-label="Drag to move"
        />
        <div className="tour__dots">
          {pageSteps.map((st, i) => (
            <span key={st.target} className={`tour__dot${i === step ? " tour__dot--on" : ""}`} />
          ))}
        </div>
        <div className="tour__title">{s.title}</div>
        <p className="tour__body">{s.body}</p>
        <div className="tour__demo">
          <Segmented
            options={[{ value: "sample", label: "Sample data" }, { value: "mine", label: "My data" }]}
            value={sampleOn ? "sample" : "mine"}
            onChange={(v) => toggleSample(v === "sample")}
          />
        </div>
        <div className="tour__actions">
          <button className="btn btn--ghost" onClick={finish}>Skip</button>
          <div className="tour__actions-right">
            {step > 0 && <button className="btn btn--ghost" onClick={prev}>Back</button>}
            <button className="btn btn--primary" onClick={next}>{isLast ? "Got it" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
