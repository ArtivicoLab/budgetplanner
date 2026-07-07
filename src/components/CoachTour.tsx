// Coach-mark tour. Each screen has its own short coach, scoped to only what's
// actually rendered there right now — no cross-screen auto-navigation. A step
// spotlights a real, existing element via a `data-tour="<key>"` attribute (see
// the various screens, TabBar, Sidebar) — never invents UI that isn't there.
// Steps whose target isn't currently in the DOM (e.g. a card that only shows
// once you have goals) are filtered out before the tour ever opens, so a page
// with nothing relevant to show just doesn't open one.
// "Seen forever" (for the one automatic first-run showing, on the Dashboard)
// persists in plain localStorage — a UI preference, not user data, so it
// deliberately does NOT ride along with the IndexedDB reset/activate flow in
// stores/bootstrap.ts.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRoute, type Route } from "../router";

const TOUR_SEEN_KEY = "tourSeen";

interface TourStep {
  target: string; // matches a `data-tour` attribute value
  route?: Route; // screen this target lives on — omit for "dashboard"
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
    body: "Once you set up a budget, this card shows what's left to spend, budget vs. actual for income, bills, expenses and savings, and your upcoming bills — right here, without opening the Budget tab.",
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
    body: "Quick tiles for your total saved and total owed — each one taps through to its full screen.",
  },
  {
    target: "nav-more",
    title: "Everything else lives here",
    body: "Budget, Savings, and Debt Payoff each have their own full screen, one tap away. Each one has its own quick coach too — look for the compass.",
  },
  // ---------- Finances ----------
  {
    target: "budget-period",
    route: "budget",
    title: "Switch or rename your period",
    body: "Tap here to change or rename the current budget period — weekly, biweekly, or monthly, your call.",
  },
  {
    target: "budget-leftspend",
    route: "budget",
    title: "What's actually left",
    body: "Left to spend is your start balance plus real income, minus real bills, expenses, debt payments and savings — the number that matters day to day.",
  },
  {
    target: "budget-charts",
    route: "budget",
    title: "Budget vs. actual",
    body: "See how your plan compares to what really happened for income, bills, expenses, debt and savings, plus a full breakdown and cash-flow ledger below.",
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
    body: "Tap a fund to edit it. The repeat icon means it's linked to a Budget savings line — entering an amount there updates this ring automatically.",
  },
  {
    target: "savings-fab",
    route: "savings",
    title: "Fund specific goals",
    body: "Add a fund for something you're saving toward. Link it to a Budget savings line and its balance updates automatically every period.",
  },
  {
    target: "debt-overview",
    route: "debt",
    title: "Your debt-free date",
    body: "See the month you'll be debt-free and total interest paid, based on your strategy and any extra payment below.",
  },
  {
    target: "debt-strategy",
    route: "debt",
    title: "Snowball, avalanche, or your own order",
    body: "Snowball pays the smallest balance first for fast wins. Avalanche pays the highest interest rate first to save the most money. Custom lets you set the order yourself — your payoff date updates either way.",
  },
  {
    target: "debt-schedule",
    route: "debt",
    title: "The full payment schedule",
    body: "Month-by-month payment, interest, and remaining balance across every debt, all the way to debt-free.",
  },
  // ---------- Wrap-up ----------
  {
    target: "settings-sheets",
    route: "settings",
    title: "It's your data, in your Google Sheet",
    body: "Everything works fully offline on this device first. Connect your own Google Sheet here and it becomes the backup and single source of truth — synced automatically after that.",
  },
  {
    target: "settings-categories",
    route: "settings",
    title: "Your budget categories",
    body: "Add, rename, or recolor the tags your budget lines use — tap a tag's name to rename it, or its dot to change its color.",
  },
  {
    target: "settings-sections",
    route: "settings",
    title: "Show only what you use",
    body: "Hide sections you don't need to declutter the sidebar and More menu — nothing is deleted, and hidden sections stay one tap away if you bring them back.",
  },
  {
    target: "settings-yearreset",
    route: "settings",
    title: "Fresh start each year",
    body: "Clear out this year's budget transactions without rebuilding your budget — your savings funds, debts, and settings all stay exactly as they are.",
  },
  {
    target: "privacy-source",
    route: "privacy",
    title: "See for yourself",
    body: "The entire source is public. Open your browser's Network tab and you'll see no third-party calls — nothing leaves this device except to your own Google account, only if you connect it.",
  },
];

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked (private mode etc.) — don't force the tour
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // ignore — worst case the tour reappears next visit
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

  // The tour is scoped to whichever screen it was opened on. If the user
  // navigates elsewhere while it's up (a nav tap, a card link), just close it
  // rather than following them — each screen's coach is its own thing now.
  useEffect(() => {
    if (currentRoute !== openedRoute) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute]);

  // Build this page's step list once: only what's actually on screen right
  // now (e.g. no "Goals in progress" card tip if there are no goals yet).
  // Steps with a `demo` first ask the screen to render their example element
  // (via a `coach:<demo>-on` event), then we wait a frame for it to mount
  // before checking which targets exist — otherwise the demo-only target
  // would look absent and the step would be dropped.
  useLayoutEffect(() => {
    const relevant = STEPS.filter((s) => (s.route ?? "dashboard") === openedRoute);
    const demoKeys = [...new Set(relevant.map((s) => s.demo).filter(Boolean) as string[])];
    demoKeys.forEach((k) => window.dispatchEvent(new Event(`coach:${k}-on`)));

    let raf1 = 0, raf2 = 0, cancelled = false;
    const compute = () => { if (!cancelled) setPageSteps(relevant.filter((s) => targetExists(s.target))); };
    if (demoKeys.length) {
      raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(compute); });
    } else {
      compute();
    }
    return () => {
      cancelled = true;
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      demoKeys.forEach((k) => window.dispatchEvent(new Event(`coach:${k}-off`)));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // actually on screen at a given width — pick whichever has real size.
      return candidates.find((el) => el.getClientRects().length > 0);
    }
    function place() {
      const visible = findTarget();
      setRect(visible ? visible.getBoundingClientRect() : null);
    }
    // Some steps target cards further down a long screen scroll (or, on
    // desktop, further down the sidebar's own nested scroll) — bring the new
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
  }, [step, pageSteps]);

  // Anchor the card above or below the spotlighted element (whichever side
  // has room) so it never sits on top of the thing it's explaining — the
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
    // Work off the portion of the target actually on screen — a target
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
      // Neither side fits — pin to the bottom edge so the card stays fully
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
    // Any completed coach — on any page — is enough to stop auto-popping
    // the first-run one; it only needs to fire once, ever.
    markTourSeen();
    onDone();
  }

  function next() {
    if (!pageSteps || step >= pageSteps.length - 1) finish();
    else setStep((s) => s + 1);
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
        style={cardTop === null ? undefined : { top: cardTop, bottom: "auto" }}
      >
        <div className="tour__dots">
          {pageSteps.map((st, i) => (
            <span key={st.target} className={`tour__dot${i === step ? " tour__dot--on" : ""}`} />
          ))}
        </div>
        <div className="tour__title">{s.title}</div>
        <p className="tour__body">{s.body}</p>
        <div className="tour__actions">
          <button className="btn btn--ghost" onClick={finish}>Skip</button>
          <button className="btn btn--primary" onClick={next}>{isLast ? "Got it" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
