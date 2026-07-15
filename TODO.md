# TODO — Ultimate Budget

Running status board for AI agents / humans. Keep this current.
Last updated: 2026-07-06 (redesign + competitor-parity backlog).

**Note:** This is the finance-only "Ultimate Budget" app (converted from a broad life
planner). Non-finance modules (tasks, habits, goals, meals, grocery, fitness, weight,
hydration, time blocking, calendar, recurring) were removed. Kept: Dashboard, Budget,
Savings / Sinking Funds, Debt Payoff, Settings. Finance features still to build:
Recurring & Variable Transactions, Monthly + Annual dashboards, Smart (bill) Calendar,
50/30/20, Net Worth, Bank Accounts, Spender Distribution, Paycheck Dashboard. Some
entries below predate the conversion and refer to removed modules — treat as history.

## ✅ Done
- **Recurring price versioning (2026-07-07)**: a subscription/bill whose price changes
  no longer rewrites its own history. Editing a recurring item's amount (when it has
  committed history) opens a "What happened?" dialog: **price changed** (keep the old
  price, cap it at an effective date you pick, and start a new linked version),
  **fix a wrong amount** (overwrite in place), or **it stopped** (cap the old version,
  keep its past). Chained via a new `Recurring.supersedes` field (schema col added,
  tolerant, no DB bump). The list shows only current versions with a compact
  "was $X → $Y ▲Z%" badge; the edit sheet shows the full price-history timeline.
  Pure logic + 14 tests in `lib/priceHistory.ts` (`chainFor`, `supersedePlan`,
  `priceDelta`, …); demo seed gives Netflix a $13.99→$16 history. Verified headless
  end-to-end (badge, timeline, dialog, new version on confirm). 72 tests green.
- Scaffold: Vite + React 18 + TS, hash router, PWA (manifest + service worker + icons).
- Design system: tokens (**Eucalyptus Ledger** light / **Ember** dark — full 2026-07-06
  redesign: warm ivory paper, deep eucalyptus teal, terracotta, antique gold, sage;
  ledger treatments — hairline-bordered cards, ruled screen heads, double-rule cash-flow
  totals; audience is ~99% women but explicitly NOT pink, Inter sans only — see CLAUDE.md
  "Owner preferences"). Responsive: bottom tabs on phone, **left sidebar ≥900px**.
  All chrome tokens re-checked ≥4.5:1 AA in both themes; accent-paired text uses
  `var(--surface)` instead of `#fff` so dark mode stays readable.
- Icons: lucide-react set (`components/icons.tsx`). **No emojis anywhere.**
- Charts: CSS only — `ProgressRing` (conic-gradient), `Charts.tsx` (Donut/Bars/Columns).
  No SVG charts, no chart library.
- Persistence: IndexedDB (`db.ts`, DB_VERSION=3), one store per collection, offline queue.
- Zero-friction boot: opens on Dashboard, auto-seeds sample data (v1 + v2), `seedV2IfMissing`
  migration tops up v2 samples for pre-v2 users.
- **Recurrence engine** + tests (lazy materialization, clamps, leap year, DST). 18 tests.
- Stores: tasks, habits, budget, settings, sync + CRUD factory + v2 stores.
- **v1 screens:** Dashboard, Tasks (Smart Task Center), Calendar (month/week), Habits, Budget.
- **v2 screens (full 19-tab parity):** Goals, Savings/Sinking Funds, Debt Payoff
  (snowball/avalanche), Meal Planner, Grocery (auto-generated + categorized), Fitness,
  Weight (imperial/metric + BMI + trend), Hydration, Time Blocking, More hub.
- **Meal Setup** (recipe library — plan meals from saved recipes) + library picker in Meal Planner.
- **Recurring Task Schedule** screen — every series with its upcoming occurrences,
  "edited" badges on materialized variations, per-occurrence edit, pause/resume, delete future/all.
- Multi-participant `assignee` field on tasks/recurrences (owner added).
- Budget math + Debt payoff math + schema roundtrip tests. **34 tests total, green.**
- Google Sheets sync layer: `google/auth.ts`, `google/sheets.ts`, `sync.ts` (pull/push/
  connect/disconnect) + Settings UI. Mirrors all 15 collections to their tabs.
- **Customizable mobile bottom bar**: pin/unpin/reorder tabs in Settings ("Bottom bar"
  section), persisted as `settings.tabBarRoutes`; More is always the fixed catch-all.
  The bar scrolls on the x-axis so it isn't capped at a handful of items, and now shows
  the PWA icon as a brand mark, both in the tab bar (mobile) and the sidebar (≥900px).
- Docs: README (incl. Google Cloud setup), CLAUDE.md, this file.
- **Calendar reminders**: `google/calendar.ts` (all-day event create/update/delete + daily
  digest RRULE, mirrors `sheets.ts`'s fetch/retry style) + `reminders.ts` (pure
  `decideReminderAction` + best-effort `syncTaskReminder`/`syncBillReminder`/`syncDailyDigest`,
  no-op when not connected, errors swallowed). Wired into `useTasks`/`useBudget`
  `add*`/`update*` via a loop-safe `setCalendarEventId` setter; daily digest wired into
  `useSettings.update` on `digestTime` change only (keeps the `calendar.events` scope
  request lazy — never fired at boot or at Sheets-connect time). New `settings.digestEventId`
  field (local-only, not a synced Sheet tab). **`tests/reminders.test.ts`, 17 tests.**
- **Reminder cleanup on delete**: `deleteTask`/`deleteRecurrence`(mode "all")/`deleteMoney`
  now best-effort cancel any lingering Calendar event via a shared `cancelReminder` helper
  in `reminders.ts` before removing the row — closes the gap noted above.
- **Inline-style cleanup**: Dashboard/Settings/Debt/Calendar/Charts.tsx had 69/59/53/44/41
  one-off `style={{}}` objects; refactored into ~140 real CSS classes in `base.css` (shared
  utilities + per-screen banners). Data-driven values (computed widths, category/status
  colors) deliberately stay inline.
- **Accessibility pass**: Lighthouse a11y score 0.82 → 0.95 (Chrome was available locally).
  Added `role="progressbar"`/`aria-valuenow` + descriptive labels to `ProgressRing`, `role="img"`
  summaries to `Charts.tsx` (Donut/StatusBar/Bars/Columns) and the dashboard `HabitGrid`,
  fixed a label/name mismatch on the Header avatar button, restored pinch-zoom (removed
  `user-scalable=no`), added focus-on-open to `BottomSheet`, and added missing icon-button
  `aria-label`s / input-label associations across most screens. **Known gap, not fixed:**
  several light-theme ("Postcard") text/icon colors fail WCAG contrast against `--bg`/
  `--surface` — `--muted`, `--accent`, `--success`, `--alert`, `--warn`, and the `--cat-*`
  pastels used as icon/text color all fall short of the 4.5:1 (text) / 3:1 (UI) bar. This is
  a palette decision, left for the owner — see the "Needs the owner" section below.
- **Swipe gestures** on mobile task rows: touch-only (no library), right swipe completes,
  left swipe reveals an Edit/Delete tray (delete still needs a deliberate second tap).
  Existing checkbox/click/trash-button affordances are untouched — swipe is additive only.
- **Coach-mark tour**: 3 steps (Today hero card → Tasks nav entry → More hub/Sidebar),
  `src/components/CoachTour.tsx`, dashboard-only, shown once via `localStorage["tourSeen"]`,
  Skip or finishing step 3 both dismiss forever.
- **Full-year demo seed** (`src/lib/sample.ts`, 2026-07-07): rebuilt from a single
  canonical monthly TEMPLATE (dual income + ~29 line items across 11 categories) so
  every screen renders EVERY situation, not just a happy path — overdue/paid/upcoming
  bills, over/under-budget lines, two overspent months (a partner job-gap + car repair
  deep dip, a medical-bill shallow dip → the Balance trend goes red), a tax-refund
  income spike, 5 sinking funds at every stage (mid/early/reached/near/empty ring),
  5 debts whose snowball order (by balance) ≠ avalanche (by APR, incl. a 0%-APR one),
  and a full year of dated transactions across 3 accounts (checking/savings/credit)
  and 3 spenders — the source data the in-progress Transactions/Accounts/Distribution
  screens need. Deterministic (stable ids, fixed wobble, no Math.random). Verified
  in-app both themes; `DEFAULT_CATEGORIES` widened to match. Screenshots confirm the
  dashboard now shows "2 overdue" and a red negative Balance dip.
- **Calendar redesign — "ledger planner" (2026-07-07)**: CalendarScreen rebuilt visually
  (same data logic): hero masthead (centered month nav, In/Out/Still-to-pay/Net ledger
  stats, pastel kind chips), ruled month grid via a 1px-gap-over-hairline grid (no boxy
  cells) with a week-margin In/Out/Net sum column (double-rule before Net), kind-colored
  ticks (solid = logged, dashed = planned), paid items struck + faded, today = accent
  circle + wash. **Grid scrolls on the x-axis at every screen size** (roomy 200px day
  columns, owner request) — full event names + amounts, never ellipsized; auto-positions
  today's column into view (rect-relative math, minimal scroll). Phone gets a "Coming up"
  agenda with date rails below the grid. **Direct in-calendar editing** (owner request):
  click an empty day (or its hover +) and type "Nails 45" → logged transaction on that
  date (future dates start unpaid/planned); day bottom-sheet has editable amount inputs,
  Mark paid, delete, and an in-day quick-add. Verified via CDP-driven interaction:
  typed entry appears on the grid and every header/weekly total recomputes live.
- **Chart hover value readout — ALL charts (2026-07-07, owner request)**: every chart
  component in `Charts.tsx` now shows exact values on hover/touch-drag, stock-chart
  style — shared `ChartTip` bubble (ink bg, instant, themed, edge-flipping) +
  `hoverFromPointer` helper. Line/area/combo charts get a dashed crosshair + tracking
  dot(s); Columns/StackedColumns/Stacked100 get slot detection; Bars/GroupedBars/
  StatusBar get per-row bubbles; Donut does polar hit-testing on the ring band.
  `formatValue` plumbed at every money call site (Annual, Budget, Net Worth,
  Distribution, 50/30/20, Dashboard, Debt). Native `title` tooltips removed where the
  bubble replaces them. **Rule added to CLAUDE.md Owner preferences: never ship a
  chart without a hover readout.** Verified via CDP-driven pointer moves on Annual
  (combo crosshair "DEC Spending $5,531 / Income $6,480"; columns "MAR $3,744").

## 🔧 Needs the owner (not a code task)
- ~~Light-theme contrast fails WCAG AA~~ **Addressed by the 2026-07-06 redesign:** the
  Eucalyptus Ledger palette was chosen with every text-role token at ≥4.5:1 against the
  lightest surface (ratios noted per token in `tokens.css`). `--cat-*` pastels remain
  fills-only under `--ink` (use `--cat-*-ink` for text), same rule as before. A fresh
  Lighthouse a11y run to confirm the score would still be nice.
- ~~GitHub source URL for the Privacy screen~~ **Done.** Repo is live at
  https://github.com/ArtivicoLab/lifeplanner, pushed as the initial commit.
  `GITHUB_URL` is set in `src/lib/config.ts`; the Privacy screen's "Check the
  source on GitHub" button is active.
- ~~Google OAuth client ID~~ **Done.** `VITE_GOOGLE_CLIENT_ID` is set in `.env`;
  Settings → Connect Google Sheets verified working end-to-end this session
  (create sheet, push, connected status all confirmed).
- **Access codes for real buyers.** `VITE_ACCESS_CODES` in `.env` currently has
  one placeholder code (`LIFEPLANNER-2026`) for testing the activation gate —
  decide on the real code(s) to ship before selling.
- **Publish/verify the OAuth consent screen** to sell to the public (not just
  test users). Right now only manually-added test-user emails in Google Cloud
  can complete the Sheets sign-in — a real buyer connecting their own Google
  account will hit an "app not verified" wall until this is done. The app
  works fully without Sheets in the meantime, so this doesn't block selling
  the core product, only the optional sync feature.

## 🔒 Sync/auth bugs — fix before selling
Same Google Sheets sync architecture TrackerA (Life Planner) shipped with real paying
customers, then found and fixed a long, hard-won list of real bugs in — several caused
genuine, reported data loss for a buyer. TrackerB forked the chassis before most of those
fixes existed, so they're still live here. Full details + exact fix patterns are in this
file's own `CLAUDE.md`, under "Google Sheet as database" — start there, it names the
file/line and what TrackerA's corrected version looks like for each one. Ask Claude to
help port any of these if picking one back up — it did the original TrackerA fixes and
this TrackerB audit, and already knows the reasoning behind each one.
- [ ] `disconnect()` deletes the remembered spreadsheet id (`LS_ID`) — next connect()
      creates a brand-new sheet instead of relinking.
- [ ] `authedFetch` can pop an interactive Google sign-in from a background timer with no
      user gesture behind it — browsers block it silently, sync dies until reload.
- [ ] No timeout on the raw `fetch()` or on `requestToken()` — a dropped connection or a
      GIS callback that never fires can hang forever.
- [ ] One shared token slot for BOTH Sheets and Calendar scopes — getting one evicts the
      other, ping-ponging a popup on every save with a reminder set.
- [ ] Token cache is in-memory only, wiped by any reload (incl. the app's own auto-update
      reload) even when the real token still had time left.
- [ ] `connect()`'s reconnect-to-existing-sheet path calls `pull()` with no push first —
      **re-verify severity before porting verbatim**: `pull()` has since been rewritten to
      do a row-granular `updatedAt` merge + tombstones (`lib/merge.ts`), not a blind
      replace, which may already substantially mitigate this one. Confirm before assuming
      it's still the same data-loss shape as TrackerA's.
- [ ] **`window.confirm()` still used, confirmed live**: `SettingsScreen.tsx:557` — a raw
      system popup gates "Start over (erase everything)," the single scariest action in
      the app. Swap for `confirmDialog({..., danger: true})` from `useConfirm.ts`.
- [ ] Dirty-tab tracking (`syncDirty.ts`) is in-memory only — a reload before a push
      completes silently drops the pending push behind a falsely-confident "Synced" status.
- [ ] Sync pill shows a persistence claim during demo mode, contradicting the demo
      banner's own "Nothing here is saved" right above it (`demo` is read but never
      actually used in either `Header.tsx` or `Sidebar.tsx`'s pill).
- [ ] **Biggest one — no reauth/retry subsystem exists at all**: no `needsReauth` state,
      no retry-with-backoff on push failure (one attempt, then just "offline," nothing
      retries a blip on its own), no proactive token-warming, no click handler on the
      sync pill, no persistent "reconnect" banner. TrackerA built this over many
      iterations; it needs building here, not just porting a patch. See CLAUDE.md's
      writeup for the 5-part breakdown.

## 🎯 Competitor parity — "Ultimate Annual Budget" spreadsheets on Etsy
(Gap analysis vs the top-selling annual-budget spreadsheet listings, 2026-07-06.
Already at parity: balance area chart, income-vs-spending combo, left-to-spend ring,
planned/actual/diff rows with red negatives, snowball/avalanche + debt-free date,
periods with carry-forward — which beats their "duplicate your file every year" —
and **any-currency support** (their FAQ item; our Settings currency + `money()`
formatter already do this — just sanity-check non-$ symbols render well in the
tighter chart/ledger layouts as those screens land).

1. **Annual "Year Overview" dashboard** — the reference's centerpiece; we only have
   per-period views today. One screen (route `annual`?) aggregating all monthly periods
   of a chosen 12-month window:
   - ✅ **Built v1 this session** — `features/annual/AnnualScreen.tsx`, route `annual`,
     nav "Overview → Annual". Done: 4 summary tiles ($ + % of income), 12-month window
     stepper ("start on any month"), headline stats strip (left-to-spend/income/spending/
     saved/debt-paid), income-vs-spending ComboChart, Monthly-overview Columns with the
     income/bills/expenses/debt/savings kind-switcher, allocation Donut, end-balance
     Columns, and the cash-flow ledger table (per-month rows + ANNUAL TOTAL + MONTHLY
     AVERAGE, sticky first column, horiz-scroll on phone).
   - ⏳ **Still open (v2):** per-kind "Month by Month" matrices, per-kind sidebar donuts,
     and the Annual Planned-vs-Actual breakdown.
   - Four summary tiles: Annual Bills / Expenses / Debt payments / Savings — each as a
     total **and as % of total income** (their "$59,913 / $381,020 · 15.7%" pattern).
   - **Cash-flow summary table**: one ledger row per month (Income · Bills · Expenses ·
     Debt · Savings · End balance) + ANNUAL TOTAL and MONTHLY AVERAGE footer rows —
     pure ledger, plays perfectly into the new design language.
   - **End balance by month** horizontal bars + headline stats row (Left to spend ·
     Total income · Total spending · Total saved · Total debt paid).
   - **Allocation donut** (expenses/bills/debt/savings share of the year).
   - "Start on any month" = a start-month picker for the 12-month window (periods
     already support arbitrary start dates).
   - **Monthly Overview chart with a kind switcher** (their "customizable views:
     switch categories — income, bills, expenses, debts, or savings — and watch
     your chart update instantly"): the month-columns chart gets a Segmented/
     dropdown control to swap which kind it plots. One chart, five views.
   - **Per-kind "Month by Month" matrices** (their "detailed breakdown by
     category & subcategory"): for each kind, a ledger table with one row per
     line item (John Salary, Mortgage, Property Tax…) and columns
     **total | monthly average | then each month of the window** — e.g. "INCOME
     MONTH BY MONTH", "BILLS MONTH BY MONTH", etc. Wide table: horizontal
     scroll inside the card on phone, sticky first column; month values pull
     from each period's matching row (match by name — rows are per-period
     copies). Collapsible per kind so the screen stays scannable.
   - **Per-kind sidebar summaries**: Total Income / Total Bills / … blocks, each
     with a small donut splitting that kind by line item (their income pie by
     source with per-line legend) — Donut component, top-6 lines + "other".
   - **Annual Planned vs Actual breakdown** (their "fully automated / exclusive
     feature" page): a 12-month overview ledger by TYPE (Start balance · Income ·
     Expenses · Bills · Debts · Savings · End balance) with Planned / Actual / Diff
     columns, **color-coded diffs** (we already do red-negative; add the highlight
     treatment); annual planned-vs-actual grouped bars by type (GroupedBars exists);
     then a per-kind drill-down — month-by-month Planned/Actual/Diff table + grouped
     bars for each kind (Income by month, Bills by month, …) with a TOTAL footer row;
     and a month-grid of compact per-month P-v-A tables. All aggregation over
     existing `summarize()` outputs — no new data model needed.
2. **Top spending categories** — ranked horizontal bar list (their "Top 10"). MoneyRow
   names are the categories; aggregate actuals across the window, CSS bars only.
   Also a per-month **"Where does my money go" donut** on the Budget screen (spending
   split by category line, not just by kind — our current Donut splits by kind only).
   - ✅ **Built this session.** Annual screen: "Top spending categories" ranked Top-10
     CSS bars (non-income line items aggregated by name across the window, `.topcat`).
     Budget screen: "Where does my money go" Donut by line item (top 6 + Other, colored
     via `categoryColor`), below the existing by-kind Actual breakdown.
3. ✅ **Built this session.** `lib/debt.ts` now returns `scheduleByDebt` +
   `totalMinPayment` and takes `{ startDate, adjustments }` opts (per-debt schedule,
   configurable repayment start, per-month +/− applied to that month's repayment,
   floored at 0). Settings gained `debtStartDate` + `debtAdjustments`. DebtScreen:
   overall progress ring + Paid off / Total start / Min-per-month / Months-left stats,
   a "Repayment starts" month picker, a per-debt **detail sheet** (payoff date, ring,
   balances, its own month-by-month schedule, Edit), and per-month **+/−** steppers on
   the schedule (scrolls horizontally on phone). `tests/debt.test.ts` +4 cases (start
   date, +adjustment faster, −adjustment floored at 0, per-debt schedule); 29 tests green.
   ⏳ Still open: per-debt "repayment start" independent of the global one is not needed
   (global suffices); everything else in the original spec below is covered.

3. **Debt payoff — close the remaining gaps** (their Debt Payoff Planner page;
   we already have all 3 strategies ✓, extra-per-month ✓, months-to-debt-free
   columns ✓, per-debt payoff months ✓, APR/min-payment fields ✓, paid-off %
   bars ✓ — theirs caps at 30 debts, ours is unlimited):
   - **Per-debt detail view** — tap a debt → payoff-date headline (their
     "December 2025 PAYOFF DATE" cards), progress ring (their 100.0% ring),
     current/start balance, min payment, interest rate, and a per-debt
     month-by-month **payment / interest / balance schedule** (simulatePayoff
     computes the global schedule; expose per-debt rows).
   - **Overview block**: overall debt-free date + **overall progress ring**
     (their 6.4% = total paid ÷ total start), total balance · total start
     balance · total min payment · months left.
   - **Repayment start date** (their "REPAYMENT START DATE Dec 2025"): sim
     currently starts "now"; add a configurable start month (settings field)
     so schedules align to when she actually begins.
   - **Per-month payment adjustment ("+/− feature")** — their "easily add or
     reduce your repayment amount at any month": a month-keyed adjustments map
     (e.g. `{ "2026-03": +100, "2026-08": -200 }`, stored in settings or its
     own small collection) that `simulatePayoff` applies on top of min+extra
     for that month. Pure-function change in `lib/debt.ts` + a row-level +/−
     input on the schedule table. **Keep `tests/debt.test.ts` green; add cases**
     (adjustment months, negative adjustments floored at 0 payment, adjustments
     after payoff month ignored).
4. ✅ **Built this session.** Dashboard debt card now shows "Paid off $X · Y%"
   (start−current from the Debts tracker) with a progress bar; the Annual screen's
   headline strip already carries "Total debt paid" (window debt payments = their
   "$5,925 TOTAL DEBT PAID").

4. **"Total debt paid" stat** — we show total owed; also surface start−current paid-down
   total on Dashboard + the annual screen (their "$5,925.00 TOTAL DEBT PAID").
   (Their Savings/Sinking Funds tracker page: **full parity already** — header
   stats row (total goal · total saved · left to save · goals met · overall %),
   per-fund rings, goal dates, left-to-save, starting amount, budget-line
   auto-sync via `fundId`, and even the "Keep going! $X away" encouragement
   copy all exist in SavingsScreen. Their 30-fund cap is another unlimited-for-us
   listing point. No work needed.)
5. ✅ **Built this session.** `useBudget.rolloverYear(fromPeriodId, startDate, count=12)`
   chains `addPeriod` with carry (structure copied, actuals zeroed, balance carried
   forward month to month), lands on the first new month. Budget → period sheet →
   "Reuse year after year" section: a start-month picker (defaults to the month after
   your latest period) + "Create 12 months" button. Verified: creates exactly 12 periods.

5. **New-year rollover flow** — one-tap "Start 2027": create 12 monthly periods copying
   structure, zeroed actuals, carried balance (their "re-use year after year" badge is
   a manual file-duplication; ours can be a button).
6. ✅ **Built this session (foundation).** New `Transaction` collection end-to-end:
   `types.ts` (Transaction + `txnDirection`; transfers count as neither in nor out),
   `schema.ts` tab + serializers + roundtrip test, `db.ts` store (DB_VERSION → 2),
   `useTransactions` (crud), bootstrap load/seed, `sync.ts` push/pull, sample data.
   Screen `features/transactions/TransactionsScreen.tsx` (route `transactions`, nav
   Money → Transactions): Total In / Out tiles, filter bar (type chips · paid · account
   dropdown · date range), dated ledger list, add/edit sheet incl. transfer from/to
   accounts + spender/earner. 30 tests green. ⏳ Still open (needs #7 Accounts): moving
   money between accounts on a transfer, and daily-chart granularity wiring.

6. **Transaction History ("Transactions by Account" — their "exclusive feature")** —
   the foundational data-model gap: we track budget *lines* per period, not dated
   *transactions*. New `Transactions` collection (types.ts + schema.ts tab + db.ts
   store + DB_VERSION bump + store + bootstrap + sync, per the CLAUDE.md checklist):
   date, amount, direction (in/out), kind (income/bill/expense/debt/saving/
   **transfer**), category, accountId, spender/earner, description, paid/unpaid.
   **Transfers** (their "track credit card payments and money transfers between
   accounts") need `fromAccountId` + `toAccountId`, move money between accounts
   (#7), and are **excluded from income/spending totals** so a card payment never
   double-counts as an expense. Screen: filter bar (account · date range · paid
   status · kind) + **Total In / Total Out** tiles for the filtered window +
   sortable ledger row list (their "filter & sort all transactions easily").
   This also unlocks the daily/weekly chart granularity the Dashboard code
   comments already anticipate ("arrives with dated Transactions"), and true
   bank-statement reconciliation.
7. ✅ **Built this session (core).** `Account` collection end-to-end (types/schema/
   db DB_VERSION→3/`useAccounts`/bootstrap/sync/sample). `lib/accounts.ts` pure math
   (`accountFlows` derived current = start + adjustment + paid in − out; transfers move
   money between accounts; `accountsOverview` totals; `accountBalanceByDate`) with
   `tests/accounts.test.ts` (6 cases). Screen `features/accounts/AccountsScreen.tsx`
   (route `accounts`, nav Money → Accounts, bank icon): Net/Assets/Owed tiles + a
   Current-Balance table (current/start/in/out/adjust/last-checked, sticky first col,
   horiz-scroll) + add/edit sheet with type, credit limit, and a Reconcile
   (adjustment + last-checked) block. Verified: derived balances, credit card negative,
   transfers move money. ⏳ Deferred: balance-by-date-range UI (pure fn done + tested)
   and projected-balance / "transfer needed" (needs #10 recurring + #13 scheduled).

7. **Bank Accounts** — accounts collection powering the transaction account filter,
   per-account balances, and Net Worth assets below. Their "50 accounts" cap is a
   spreadsheet limit — ours is unlimited (listing point). Detailed spec from their
   "Track Your Account Balances" page:
   - **Fields**: name, type (checking / savings / cash / **credit card**), start
     balance, `creditLimit` (credit cards only), sort order. Credit cards carry
     *negative* balances naturally (their Chase Sapphire −8,923.30).
   - **Derived current balance** (their "updates automatically"): current = start
     balance + Σ(paid transactions in − out ± transfers) + Σ(adjustments) —
     computed, never hand-edited. Logging a transaction updates the account,
     Net Worth (#8), and daily balance (#11) in one write.
   - **Reconciliation adjustments** (their "adjustment +/− · last checked"
     columns): when the app's number drifts from the real bank statement, the
     user enters a one-off signed adjustment; store as a small adjustments log
     (amount, date, note) per account and stamp `lastChecked` — shown as
     "Reconciled Jun 30" on the account row. Gentle copy, not blame.
   - **Accounts overview screen**: TOTAL header row (their Current Balance table:
     total across accounts + total in/out), then one ledger row per account:
     current balance (red when negative), start balance, total in (paid), total
     out (paid), adjustment, last checked.
   - **Balance by date range**: pick start/end dates → per-account start balance,
     in (paid), out (paid), end balance for that window (their "plan ahead and
     avoid running short" view). Pure aggregation over Transactions (#6).
   - **Projected balance + "transfer needed"** (their killer column, spec it
     fully): projected = current balance + upcoming money in − upcoming money out,
     where "upcoming" = unpaid scheduled (#13) + recurring (#10) occurrences due
     in the selected window. Highlight projected < 0 (or beyond `creditLimit` for
     cards) in `--alert-soft` — their red cells — and compute **Transfer needed =
     max(0, −projected)** per account so she knows exactly how much to move to
     cover upcoming bills, no surprises. Surface the worst shortfall as a gentle
     Dashboard callout ("Chase Sapphire may run $2,400 short by Jul 31 — move
     $400 to cover it").
   - All math as pure functions in `lib/accounts.ts` with vitest coverage.
   (No real bank *linking*/Plaid — no backend; CSV import #20 is our answer to
   getting bank data in.)
8. ✅ **Built this session.** `NetWorthItem` collection (manual assets/liabilities;
   types/schema/db DB_VERSION→4/`useNetWorth`/bootstrap/sync/sample) + `netWorthGoal`
   setting. `lib/networth.ts`: `netWorthSummary` (accounts positive=asset, negative +
   debts + manual = liabilities) and `netWorthTrend` (account balances derived per
   month-end + point-in-time offset), `tests/networth.test.ts` (3 cases). Screen
   `features/networth/NetWorthScreen.tsx` (route `networth`, nav Money → Net Worth):
   goal ring, net-worth hero + Assets/Owed/to-goal, net-worth **AreaChart** trend,
   assets-distribution Donut, assets-vs-liabilities bars, editable goal, and add/edit
   asset & liability lists. Verified in-app ($156,304 net worth, smooth trend).
   ⏳ Deferred: per-account growth deltas list + full month-by-month ledger table.

8. **Net Worth Tracker** — assets & liabilities (bank accounts auto-included + manual
   assets/liabilities; theirs caps at 40/30 — ours needn't): net worth **goal** +
   goal-progress ring (their 114%), headline stats (Total assets · Total liabilities ·
   Net worth · Annual growth · Amount to goal), **month-by-month ledger table**
   (net worth / assets / liabilities per month), per-account growth list with
   up/down deltas, assets-distribution donut, assets-vs-liabilities trend chart —
   all CSS charts we already have primitives for.
9. ✅ **Built this session.** `spender` field already on transactions; `lib/distribution.ts`
   `spenderDistribution(txns, start, end)` → per-person income/spending/net + contribution
   shares (transfers excluded, blank → "Unassigned"), `tests/distribution.test.ts` (3).
   Screen `features/distribution/DistributionScreen.tsx` (route `distribution`, nav Money →
   Distribution): date range, household income/spending tiles, Income-by-person and
   Spending-by-person donuts, and a cash-flow-by-person table (income · share · spending ·
   share · left over) with totals. Covers the core of #17's Distribution Dashboard too.
   ⏳ #17 extras still open: stacked-by-kind columns per member, individual/shared toggle,
   income/expense ledger lists.

9. **Spender/Earner attribution** — person field on transactions (their
   "Family Shared / Sarah / Emily" column) + a Spender Distribution breakdown
   (who spends/earns what). Pairs with the household/multi-user backlog item.
10. ✅ **Built this session (core).** Rebuilt `lib/recurrence.ts` (pure engine,
    `expandRecurrence`/`nextOccurrence`, month-end clamps, 8 tests) for money. New
    `Recurring` collection (types/schema/db DB_VERSION→5/`useRecurring`/bootstrap/sync/
    sample) with cadences weekly/biweekly/every-4-weeks/semi-monthly/monthly/every-2-3-6
    months/yearly + first & last payment bounds + transfers. Screen
    `features/recurring/RecurringScreen.tsx` (route `recurring`, nav Money → Recurring):
    Upcoming occurrences (next 2 months, chronological, kind-colored, signed) each with a
    **Log** button that materializes a Transaction (greys once a matching txn exists), plus
    a Templates list with cadence + next date + active toggle, and a full add/edit sheet.
    Verified in-app (semimonthly paycheck on 1st/15th, transfers, 20 upcoming). ⏳ Deferred:
    budget planned-amount auto-fill from templates + per-occurrence "variation" override.

10. **Recurring & variable transactions** — the automation that makes their "Planned"
    column "no manual input required": recurring templates (rent, paycheck, Netflix…)
    with amount + cadence + kind + category that **auto-fill each period's planned
    amounts** (manually overridable per month, like their Monthly tabs), and
    - **Cadences** — their actual frequency dropdown (Automations page) is the
      canonical list: Every Week · Every 2 Weeks · **Every 4 Weeks** (distinct
      from monthly AND from semi-monthly — a 4-week cycle drifts through the
      calendar) · Every Month · **Every 2 Months** · Every 3 Months · Every 6
      Months · Every Year; plus semi-monthly (two fixed days, #16) and every-N
      custom. The v1 recurrence engine already models interval-based rules
      (every N days/weeks/months) with month-end clamps and leap-year handling —
      map these onto it rather than inventing a second rule format.
    - **Template date bounds** (their FIRST PAYMENT / LAST PAYMENT columns):
      each template has a required first-payment date (anchors the cycle — a
      biweekly rule starting 3/1 lands on different days than one starting 3/8)
      and an **optional last-payment date** (their "New Car Savings … last
      payment 12/31/2026") after which no occurrences generate. Both map to the
      v1 engine's start/end-date fields.
    - **Irregular paychecks & multiple incomes** (their "works for all
      paychecks" bullets): multiple incomes = simply several recurring income
      templates (works by construction); irregular income = no template, log it
      as a variable transaction when it arrives — make sure the empty-state /
      onboarding copy says so instead of forcing a frequency.
    - **Recurring transfers** (their FAQ "exclusive": recurring money transfers
      between accounts, e.g. monthly credit-card payment): a recurring template
      may be kind=transfer with from/to accounts (#6/#7) — excluded from
      income/spending math like all transfers, but it feeds projected balances
      (#7) and the calendar (#14). Theirs needs a video tutorial to set up;
      ours should be one form.
    materialize as dated Transactions (#6) when marked paid; one-off entries are
    "variable" transactions. Actuals then roll up from paid recurring + recorded
    variable transactions automatically. Reuse the v1 recurrence engine's lazy-
    materialization pattern (`recurrence.ts`) — it was built for exactly this.
    **Per-occurrence VARIATION** (their boxed "exclusive": adjust one payment's
    date, amount, or spender "anytime if needed" without touching the series):
    this is *literally* `recurrence.ts`'s materialize-and-override rule — an
    occurrence becomes a real row only when edited, the edited row overrides the
    computed one at that date, the series and past occurrences stay untouched.
    Expose it in the UI: edit an upcoming occurrence → "just this one / whole
    series" choice (the v1 Recurring Task Schedule screen had this pattern;
    rebuild it for money). Keep `tests/recurrence.test.ts` green.
11. ✅ **Built this session.** `lib/dailyBalance.ts` `dailyBalance(txns, start, end,
    opening)` → per-day {in, out, running} + totals from dated paid transactions
    (transfers/unpaid/out-of-range excluded), `tests/dailyBalance.test.ts` (2). Wired into
    the Budget screen as a "Daily balance" card for the current period: a running-balance
    **AreaChart** (with the start-balance reference line) + a Date/In/Out/Balance ledger
    (negative balances flagged). Verified in-app (Jul 1–7, ending $86).

11. **Daily balance overview** — their "track your daily in vs out and running
    balance — spot overspending and avoid overdraft": per-day ledger table for the
    current period (Date · In(+) · Out(−) · Running balance) + an intra-month daily
    balance area chart (the month card's little Balance chart). Depends on dated
    Transactions (#6) — impossible with period-level lines.
12. ✅ **Built this session.** Settings gained `checklistItems` (8 gentle defaults,
    editable) + `checklistDone` (periodId → done labels, so it auto-resets each period).
    Budget screen "To-do this month" card: live N/M progress bar, tick/untick with
    strike-through, add/remove items. Verified toggle 0/8 → 1/8. No new collection.

12. **Monthly money checklist** — their "TO DO · 11/20 things to do" side panel:
    a small, friendly recurring checklist on the Budget screen (Review monthly
    budget · Pay credit card bill · Check sinking funds · Reconcile transactions ·
    Adjust savings goals…). Ship sensible defaults, user-editable, auto-resets each
    period, progress count ("11/20"). Low-anxiety framing fits the product's gentle-
    finance principle; simple new collection or a field on BudgetPeriods.
13. ✅ **Built this session.** No new collection — a scheduled payment is an unpaid,
    future-dated Transaction (the add sheet already creates them). Transactions screen
    gained an "Upcoming · N scheduled" section listing unpaid today-or-future items with
    a one-tap **Mark paid** that converts them to an actual (counts toward balances/daily/
    totals). Sample seeds 3 (Car registration, Property tax, Annual subscription). Verified
    mark-paid 3 → 2. ⏳ Deferred: autopay flag + Google Calendar reminder wiring.

13. **Scheduled Payments** — third transaction flavor in their Transactions group
    (alongside Recurring #10 and Variable #6): a one-off *future-dated* planned
    payment (e.g. "car registration, Nov 14, $180"). Fields: name, amount, due date,
    kind, category, accountId, autopay flag, paid/unpaid. Behavior: counts toward
    that month's Planned; converts to an actual Transaction when marked paid;
    surfaces in Upcoming Bills, the Smart Calendar (#14), and — since we already
    have the Google Calendar reminder plumbing (`reminders.ts`, tested) — can get a
    real calendar reminder, which their spreadsheet can never do. Data-model-wise
    this may just be a MoneyRow/Transaction flag rather than a new collection —
    decide when building #6.
14. ✅ **Built this session (core).** `features/calendar/CalendarScreen.tsx` (route
    `calendar`, nav Overview → Calendar). Month grid (6 weeks, week-start from Settings)
    of money events = logged transactions ∪ not-yet-logged recurring occurrences
    (`expandRecurrence`), deduped on date+kind+amount. Kind-colored dots + signed amounts,
    paid greyed/struck-through, today outlined, leading/trailing days dimmed. Header
    totals (In / Out / Upcoming-unpaid), month nav, a Weekly Balance section (In/Out/Net
    per week), and a tap-a-day BottomSheet listing events with **Log** (materialize a
    planned occurrence) / **Mark paid**. Verified July: 19 events, today highlighted.
    ⏳ Deferred: user "highlight dates" (birthdays/holidays), the full weekly
    total|paid|unpaid rail, variable-toggle, and `@media print`.

14. **Smart (bill) Calendar** — month-grid screen showing money events on their
    dates; detailed spec from their dedicated page:
    - **Events shown**: all five kinds on their due dates — income (paychecks),
      bills, expenses, debts, savings — from recurring occurrences (#10) +
      scheduled payments (#13); a **toggle to also include variable
      transactions** (#6), off by default (their "tick the box" checkbox).
      Each cell entry = kind-colored dot/edge (use the reserved `--src-*` /
      kind colors) + name + **amount** (their cells show "$ 8,000.00" per item).
    - **Paid state**: paid items automatically **grey out** (strikethrough +
      reduced opacity — the removed v1 calendar's `.cal-item--done` treatment,
      still in base.css); inline check to mark paid right on the calendar.
      Overdue-unpaid = berry text.
    - **Month/year picker + week-start preference** (Mon–Sun): week start is a
      Settings field (synced); date math via `lib/dates.ts` (date-fns
      `weekStartsOn`), never ad-hoc.
    - **Today auto-highlighted** (our `.cal-cell--today` accent outline exists;
      theirs uses red — keep our accent, gentler).
    - **Highlight dates**: user-entered named dates (birthdays, holidays,
      trips — their "Family Getaway", "Emily's Birthday") rendered as banner
      chips on their days, so money is planned around real life. Small new
      collection (name + date) or a Settings list; synced.
    - **Header totals** for the shown month: Total In · Total Out · Upcoming
      Spending (unpaid remainder).
    - **Weekly Balance rail** (their "NEW/exclusive" — the standout): one card
      per week of the month: optional start balance, then INCOME / BILLS /
      EXPENSES / DEBT / SAVINGS rows each with **total | paid | unpaid**
      columns, and END BALANCE (total | paid | unpaid) so she knows exactly
      what's left each week; a toggle for whether variable expenses count
      toward the ending balance. Desktop: right-hand rail next to the grid;
      phone: cards stacked below it. Negative end balances in berry, gently.
    - **Layout**: phone = horizontal-scroll month grid (resurrect the removed
      v1 calendar's `.cal-scroll`/`.cal-grid` CSS — still in base.css — don't
      rebuild); tap a day → bottom-sheet with that day's items + mark-paid.
      Also the mini month-calendar widget on the Budget screen (their monthly
      tab) with dot-marked due days.
    - **Print**: their "printing option" badge — add a `@media print`
      stylesheet for this screen (grid + weekly balance, no nav chrome);
      browsers' Print-to-PDF covers the rest, no code beyond CSS.
    - Works minimally today off MoneyRow.dueDate (bills only); full version
      needs #10/#13, weekly-balance math as pure tested functions.
15. ✅ **Built this session.** `MoneyRow.bucket` field (needs/wants/savings/"" auto by
    kind) + schema column + sample "wants" tags. Settings `bucketGoals` (50/30/20, editable).
    `lib/framework.ts` (`defaultBucket`/`effectiveBucket`/`frameworkSummary`) with
    `tests/framework.test.ts` (4). Budget rows gained a tappable N/W/S allocation chip
    that cycles the bucket. Screen `features/framework/FrameworkScreen.tsx` (route
    `fiftythirty`, nav Overview → 50/30/20): income-used ring, editable ratio inputs
    (validates to 100%), breakdown donut, actual-vs-goal grouped bars, goal-vs-actual
    table (goal%·actual%·goal$·actual$, over-goal in bronze `--warn` not red), and three
    Needs/Wants/Savings bucket lists. Verified: Needs 57% (over), Wants 7%, Savings 21%.

15. **50/30/20 Dashboard** — Needs / Wants / Savings+Debt framework, detailed spec
    from their dedicated page:
    - **Data**: `bucket` tag (`needs` / `wants` / `savingsDebt`) on budget lines
      (types.ts + schema.ts column + db migration). Defaults on creation:
      debt & saving lines → savingsDebt, bills → needs, income → untagged,
      expenses → needs with a nudge to review. Editable per line via a small
      allocation chip/dropdown **directly in the Budget screen's kind lists**
      (their per-row "allocation" dropdown with colored chips — use
      `--success-soft`/`--cat-butter`/`--accent-soft` chip fills).
    - **Customizable ratios** (their "50/30/20, 60/20/20, 70/20/10, or any mix"):
      three goal percentages in Settings (default 50/30/20), validated to sum to
      100, stored in settings (synced). The screen title reflects the chosen mix.
    - **Screen layout** (route `fiftythirty`? name it "Needs & Wants"):
      - Date-range scope: current period by default, month picker + annual toggle.
      - **Income spent ring**: % of total income consumed by all tagged spending
        (their 59% ring), total income beneath.
      - **Percentage table**: per bucket — goal % vs actual % of income, + TOTAL
        row (goal 100% vs actual sum). **Amount table**: goal $ (ratio × income)
        vs actual $ per bucket + totals.
      - **Breakdown donut** (actual share per bucket) and **Actual vs Goal
        grouped horizontal bars** per bucket (GroupedBars component fits).
      - **Three ledger columns/lists** (Needs · Wants · Savings+Debt): each
        tagged line with its actual, per-bucket subtotal footer.
      - Over-goal styling in `--warn` (bronze), *never* red-alarm — "a little
        heavy on wants this month" tone, per the gentle-finance principle.
    - **Everything recomputes live** when an allocation chip changes (their
      "see ratios and reports update automatically") — it's all derived state
      over rows, no stored aggregates. Pure math in `lib/budget.ts` (or a new
      `lib/framework.ts`) with vitest cases: ratio validation, bucket rollups,
      untagged-line handling (show an "unassigned" nudge count, exclude from
      bucket math but include in income-spent).
16. ✅ **Built this session.** The Budget screen IS the paycheck dashboard scoped to a
    short period. Added the **semi-monthly** cadence to `BudgetCadence` + `computePeriodRange`
    (1st–15th / 16th–end split, month-end clamp) with `budget.test` cases, and surfaced it
    in the period picker. Added a paycheck **headline stats strip** (Left to spend · Total
    income · Total spending · Total saved · Total debt paid) with a **left-to-spend
    ProgressRing** to the top of the Budget screen. Verified strip + ring + semi-monthly chip.
    (Cash-flow P/A/D, allocation donut, daily balance, to-do checklist already there.)

16. **Paycheck Dashboard** — their page reveals this is not a separate analytics
    view: it's the **full budget overview scoped to a paycheck-length window**
    ("Apr 2 – Apr 15"), i.e. our existing Budget screen running on short periods.
    We're closer to parity here than anywhere else — gaps in detail:
    - **Cadences**: their frequency picker is weekly · biweekly · **semi-monthly**
      · monthly · custom. We have all but **semi-monthly** (paid on two fixed
      days, e.g. 1st & 15th — NOT the same as biweekly's every-14-days). Add it
      to `BudgetCadence` + `computePeriodRange` (+ the recurring cadences in
      #10), with tests: month-end clamps (15th & 31st → 28/30), which half a
      given start date falls in.
    - **Frequency + start date → window**: picking "Biweekly, starting 4/2/2026"
      generates the rolling paycheck periods (our PeriodSheet already takes
      cadence + start date — verify the flow feels this direct, one screen).
    - **Per-paycheck start balance**: exists (period.startBalance) ✓ — their
      "enter any start balance at the beginning of each paycheck" is our field
      + carry-forward toggle. Parity.
    - **Headline stats row** for the window: Left to spend · Total income ·
      Total spending · Total saved · Total debt paid (their blue strip; same
      component as #1's annual strip, scoped to the period).
    - **Left-to-spend ring** (their 20% "amount left to spend" ring): Budget
      screen currently uses a StatusBar; add/swap a ProgressRing variant so
      the money-shot matches (ring = spent ÷ (start+income), inverse label).
    - **Daily cash-flow Balance chart across the paycheck window** (their
      "visualize your daily cash flow throughout your paycheck" area chart):
      needs dated transactions — this is #11's daily running balance, scoped
      to the period. Blocked on #6.
    - **Mini calendar** of the window with due-date dots (shares the widget
      from #14) and the **To-Do checklist** scoped per paycheck (#12 — its
      auto-reset is per *period*, which covers paycheck periods for free).
    - Cash-flow planned/actual/diff table ✓, per-kind P/A/D lists ✓, allocation
      donut ✓ — all already on the Budget screen. "Where does my money go" pie
      = #2. Planned auto-fill from recurring = #10.
    - Net: after #10/#12/#14 land, this dashboard is mostly assembly + the
      semi-monthly cadence + the ring + the stats strip.
17. ✅ **Built this session.** Core landed with #9; this session added the extras to
    `DistributionScreen`: per-member **spending-distribution stacked columns** (stacked by
    Bills/Expenses/Debt/Savings, height = total), an **Everyone / per-member filter** (their
    Individual/Shared toggle) that scopes the ledgers, and **Income + Spending ledger lists**
    (category · date · earner/spender, date-range filtered). Verified: stacked cols + member
    filter + ledgers, no errors. ⏳ Deferred: the full per-member cash-flow matrix with
    distribution-% rows (the by-person table covers the essentials).

17. **Distribution Dashboard** (their dedicated page; absorbs the old "Income &
    Spending Distribution" note and is the payoff view for #9/#21 Layer 1) —
    "see each person's spending, earnings, and contribution ratio":
    - **Scope**: date-range selector (start/end, defaults to current 12-month
      window), everything below recomputes instantly (derived state, no stored
      aggregates).
    - **Members axis** (from the #21 household list): real people (John, Sarah,
      Emily…) plus **multiple shared pseudo-members** — their sheet has BOTH
      "Family Shared" and "Kids Shared", so shared buckets are user-creatable
      labels, not a single hardcoded one. Unassigned rows roll into a default
      shared bucket rather than disappearing.
    - **Income donut** (share of total income earned per member) and **Spending
      donut** (share of total spending per member) — Donut component, one slice
      per member, legend with member colors (hash members into the pastel pools
      like categories; same fills-under-ink discipline).
    - **Spending distribution stacked columns**: one column per member, stacked
      by kind (Bills / Expenses / Debts / Savings) — `StackedColumns`/
      `Stacked100` primitives already exist.
    - **Income vs Spending paired bars** per member (Total income vs Total
      spending side by side — GroupedBars shape).
    - **Cash Flow Distribution matrix** (their centerpiece table): one column
      per member; rows: INCOME + *distribution %* (member's share of household
      income — the "contribution ratio"), then BILLS / EXPENSES / DEBT PAYMENTS /
      SAVINGS, TOTAL SPENDING + distribution %, and **LEFT OVER + distribution %**
      — left-over can be negative per member (their −$48,555 Kids Shared) and
      must render honestly but gently (berry text, no alarm styling). Phone:
      this matrix scrolls horizontally inside the card (one member-column pair
      per ~110px), sticky row-label column.
    - **Two ledger lists** underneath: Income Distribution (category · payday ·
      amount · earner) and Expense Distribution (category · date · amount ·
      spender) — filtered by the date range, sorted by date; these are just
      person-annotated Transaction views (#6).
    - **Individual or Shared mode** (their badge): a toggle — "Individual"
      filters the whole dashboard to one member; "Shared" shows the matrix.
    - Depends on: #6 (dated, person-tagged transactions) + #21 Layer 1 (members
      list). Percentage math (`distribution %` rows, zero-income guards) as pure
      functions in `lib/` with vitest coverage.
18. ✅ **"Easy Setup" onboarding wizard** — their "Easy Setup" bullet + "full setup
    instructions": we already beat the spreadsheet on zero-friction (auto-seeded
    demo, no file copying), but after "Use my own data" the user currently lands on
    empty screens. Add a 3–4 step optional wizard: currency → income line(s) →
    pick common bills from presets (rent, phone, internet, subscriptions…) →
    starting balance; skippable at every step, writes ordinary MoneyRows. Keep it
    friendly and short (gentle-finance tone).
    DONE: `src/components/SetupWizard.tsx` (4 steps: Currency → Income → Bills →
    Balance, skippable at every step). Auto-opens once for a real non-demo user
    with no periods (`localStorage["wizardSeen"]`); also reachable via the
    empty-state "Quick setup" button. Finish writes a monthly period, an income
    MoneyRow per line, a MoneyRow per ticked bill preset, and the period
    startBalance. Fixed a latent demo→real bug along the way: `useBudget.setAll`
    now drops a `currentPeriodId` that isn't in the freshly-loaded periods, so new
    rows never orphan against a stale demo period id. Verified end-to-end headless
    (period=1, 9 rows, startBalance set, no orphans); tsc clean, 58 tests green.
19. **Setup guide & tutorial parity (mostly owner tasks)** — their listing ships
    "full setup instructions + video tutorial + in-depth YouTube tutorial":
    - ✅ **In-app done (2026-07-07):** Coach Tours now cover all 8 newer screens
      (Annual, Calendar, 50/30/20, Recurring, Transactions, Accounts, Net Worth,
      Distribution) via new `data-tour` anchors + `STEPS` entries in
      `CoachTour.tsx` — tap the compass on any screen to replay its guide.
      Added a **Help & guide** section under Settings (compass explainer +
      quick-start list + a "Replay the welcome tour" button that jumps to the
      Dashboard and reopens the first-run coach via a `coach:welcome` window
      event wired in `App.tsx`). Verified headless: every new screen's compass
      opens the right coach; welcome replay lands on Dashboard. 72 tests green.
    - ✅ **Written quick-start done (2026-07-07):** `docs/QUICKSTART.md` — a
      buyer-facing getting-started guide (look around → Quick Setup wizard →
      screen map → connect Google Sheet → CSV import → household → tips). Owner
      exports it to the listing PDF; the in-app Help section can link it.
    - Owner-only, cannot be done in code: the YouTube/video walkthrough for the
      listing.
    - Owner: written quick-start (can live in the repo/README → listing PDF) and
      a YouTube walkthrough video for the Etsy listing. Code can't do these.
    - **Non-goal:** Excel compatibility (their asterisk: "only works with
      Microsoft 365"). We're an offline PWA whose database is the user's Google
      Sheet — position that as the differentiator in the listing ("works on your
      phone, offline, no file to duplicate"), don't chase Excel.
20. **Bank CSV import — BUILT then REMOVED (2026-07-11).** Was fully implemented
    (`lib/csvImport.ts` pure + 20 tests, `TransactionImport.tsx` 3-step wizard:
    paste/file → auto column-map → preview + dedupe → write via `addMany`). Removed
    because it wasn't dependable against **real** bank exports: probing 7 major
    formats showed genuine failures our UI can't recover from — **preamble/summary
    rows above the header** (BofA-style) misalign everything, and **date+time
    stamps** make dates fail; plus greedy `parseAmount` mis-detects the description
    column, ambiguous DD.MM dates default to MM/DD, and credit-card positive-charge
    exports import as income (recoverable via manual re-map / flip-signs). Full impl
    is in git history if we revisit. **Open alternative to consider:** instead of a
    heavy in-app auto-detecting parser, ship a tiny importer that accepts ONE clean,
    documented column format (Date,Amount,Description,…) and tell buyers to have an
    AI (ChatGPT/Claude) reshape their bank CSV into it — far less code, far more
    robust across banks. (`addMany` on the CRUD factory was kept — the dev perf seed
    uses it.)
21. **Household / family use ("up to 9 users" — their FAQ "exclusive")** — detailed
    version of the old backlog note, in two independent layers:
    - ✅ **Layer 1 done (2026-07-07):** `settings.householdMembers` (already in the
      Settings type) is now managed in a **Household** section in Settings
      (add/rename/remove); "Family Shared" is a built-in, non-removable
      pseudo-member always offered (`lib/household.ts` `memberOptions` +
      `isBuiltInMember`, 3 tests). A reusable `components/SpenderField.tsx` (member
      chips + free-text + datalist) replaced the plain spender/earner input on the
      Transaction sheet, the Recurring sheet, and the CSV-import batch step, so
      tagging who earned/spent is one tap and consistent — feeding the existing
      per-person Distribution view (#17). No artificial cap. Verified headless.
      95 tests green.
    - Not done: retroactive rename (renaming a member doesn't rewrite the label on
      already-logged transactions — it's a suggestion list, spender is stored per row).
    - **Layer 2 — true multi-device sharing (later, riskier)**: the data already
      lives in the user's Google Sheet, so sharing the Sheet via Drive shares the
      budget; the blocker is sync semantics — current push is **full-tab
      overwrite, last-write-wins** (fine single-user, destructive for two
      writers). Prereq: row-granular merge on `updatedAt` (already stored on every
      row — see the Gotchas note). Don't market simultaneous editing until that
      lands; "view on any of your devices" is safe to claim today.
      - ✅ **Row merge done (2026-07-07):** `lib/merge.ts` `mergeById` (pure,
        6 tests) — last-writer-wins **per row** by `updatedAt`, unions one-sided
        rows, ties favor remote to converge. Wired into `sync.ts` `pull()`: it
        now merges the sheet with local instead of blind-replacing, and marks any
        tab where a local row survived dirty so the next flush pushes it back.
      - ✅ **Tombstones done (2026-07-07):** `lib/tombstones.ts` (pure helpers,
        7 tests) — a delete records `{id, collection, deletedAt}` (kv-backed, no
        DB bump) + a new **Tombstones** Sheet tab (schema + serializers). `pull()`
        unions local/remote tombstones (newest per id), prunes past a 120-day TTL,
        and `applyTombstones` drops any merged row a tombstone killed **unless it
        was edited after the delete** (edit un-deletes). Deletes are recorded in
        `crud.remove` + `useBudget.deleteMoney` (no-op in demo). Verified headless:
        deleting a transaction records the tombstone in kv. **Concurrent editing
        is now technically sound** (row merge + delete propagation); still
        prudent to soak-test with two real connected devices before heavily
        marketing simultaneous editing. 113 tests green.
    - Marketing note: no artificial cap — theirs stops at 9.
22. ✅ **Built this session (2026-07-07) — the high-ROI slice.**
    - **List virtualization** (`TransactionsScreen`): the ledger now windows —
      above 80 rows it renders only the on-screen slice into a fixed-height
      scroll container (manual windowing, no library, fixed 68px rows). Verified
      headless: **20,329 seeded transactions → ~20-26 DOM rows**, constant while
      scrolling (scrollHeight 1,382,372 = 20329×68).
    - **Per-collection dirty sync** (`lib/syncDirty.ts` + `sync.ts`): a mutation
      marks only its own tab dirty (via `touch(collection)` → `markDirty`), so a
      debounced flush rewrites just the changed tab instead of all 8 — a logged/
      imported transaction no longer re-uploads the ~1MB Transactions tab plus 7
      untouched tabs. `connect()`/`syncNow` force a full push; an untagged touch
      still marks all (safe fallback). 3 unit tests.
    - **Dev perf seed** (`lib/perfSeed.ts`): `?seed=N` bulk-inserts N synthetic
      transactions (deterministic; via the new `addMany`) behind an
      `import.meta.env.DEV` gate — confirmed absent from the prod bundle. 2 tests.
    - **Deferred (assessed low-ROI here):** IndexedDB `date`/`account` indexes +
      windowed loads — the stores are fully in-memory by design (offline-first),
      so indexes would go unused without a large query-layer refactor; not worth
      the regression risk yet. Chunked `values.update` not needed at current
      payloads (revisit if a single tab nears Google's request limit). Budget
      (`useBudget`) mutations still mark all tabs dirty (coarse but correct);
      only the v2/transaction hot path is optimized. **100 tests green, build
      128 KB gz.**
    Original spec retained below for the deferred items:
    - **IndexedDB**: transactions store needs indexes on `date` and `accountId`
      (idb `createIndex` in the `db.ts` upgrade) so date-window and per-account
      queries don't full-scan; keep loads windowed, not all-at-once.
    - **Derived-state memoization**: every dashboard recomputes from the
      transaction log (same architecture as theirs — their system diagram is
      exactly our #6/#10 hub-and-spoke). Aggregations (monthly rollups, account
      balances, distribution matrices) must be memoized selectors keyed on a
      store version stamp — never recompute 10k-row reductions per render.
      Pre-bucket by month once per change, aggregate buckets after.
    - **List virtualization**: the Transaction History list (#6) renders a
      window (simple manual windowing — ~50 rows + scroll sentinel; no
      react-window dependency, keep the no-new-libs discipline).
    - **Sheets sync at scale**: push is full-tab overwrite — a 10k-row tab is
      ~1MB+ per debounced push. Mitigations, in order: (a) per-collection dirty
      flags so only the Transactions tab rewrites, (b) chunked `values.update`
      calls, (c) the row-granular `updatedAt` merge already noted in Gotchas.
      Also verify Google's per-request payload limits + our retry/backoff at
      this size, and that first `pull` of a 10k-row tab parses without jank
      (parse in chunks over idle callbacks if needed).
    - **Budget**: keep initial JS ≤250KB gz (currently ~94KB); dashboards stay
      snappy on a mid-range phone with a 10k-row seed — add a dev-only seed
      generator (e.g. `?seed=10k` in LOCAL_MODE) to test this before shipping
      #6, not after.
    - Their "works with any pay schedule — 12, 24, or 26 times a year" =
      monthly / semi-monthly / biweekly, all covered once #16's semi-monthly
      cadence lands.

## 🔜 Next / backlog (prioritized)
0. **Live-formula "Summary" tab in the Google Sheet (make the Sheet compute on its own).**
   Decided scope: **aggregates via formulas** (owner picked this) — the app keeps its own
   offline math; the Sheet gets a parallel, standalone formula dashboard so a buyer can open
   the Sheet and see totals without the app. Iterative logic (debt payoff schedule, recurrence
   expansion) stays app-side — it doesn't reduce to cell formulas (would need bound Apps
   Script). **Built once this session then reverted on 2026-07-09 to tackle later** (git
   history has the full implementation: `lib/summarySheet.ts` + `writeSummaryTab` in `sync.ts`
   + a `valueInputOption` param on `sheets.ts` `writeTab`). To resume:
   - New `Summary` tab (add to `TAB` + `V2_TABS` so it's created, but NOT to `PUSH_TABS` so
     data pushes never overwrite it). Write it `USER_ENTERED` on connect + manual Sync now.
   - Formulas: cash flow (Transactions), budget plan-vs-actual + 50/30/20 buckets (Money),
     net worth (NetWorth), spending-by-category/person (QUERY). Consider adding per-account
     balances + a month-by-month table.
   - **Critical gotcha:** data tabs are written `valueInputOption=RAW`, so numbers are stored
     as TEXT — plain SUM/SUMIF ignore them. Coerce with `IFERROR(VALUE(x&""),0)` inside
     `SUMPRODUCT` (or switch numeric columns to be written as real numbers). QUERY sum() needs
     a numeric column → wrap in IFERROR.
   - **Needs live verification** (couldn't test headless — no interactive OAuth): after
     connecting, open the Summary tab and check totals aren't 0, and that formula
     argument-separators match the sheet **locale** (US `,` vs many locales `;`).
1. **Verify Google sync end-to-end**: create sheet/push/pull confirmed working this session;
   still untested: 401 refresh, offline queue, 404 relink. Add smoke coverage.
2. **Charts on Dashboard/Task tracker**: status/category/priority donuts + priority-by-
   category bars using `Charts.tsx` (CSS) to match the reference's "money shot."
3. **Multi-participant / household** (reference shows "up to 9 users"): assignee field on
   tasks, participant switcher already partly in Weight. v2.5 per spec (needs Drive sharing).
4. **Meal→time granularity, Time Blocking with real time slots** (tasks currently have no
   time field; add optional `startTime` if we want true blocking).
5. **Debt schedule chart** (months-to-debt-free column chart) + per-debt payoff dates UI.
6. **Lighthouse Perf + PWA installable pass** (A11y is done — 0.95, see above).
7. Playwright smoke test for the offline kill-switch scenario (spec §10.5).

## ⚠️ Gotchas / notes
- `recharts` is in package.json but MUST NOT be imported (owner wants CSS/JS charts).
- Charts must not use SVG (owner preference). Rings/donuts = conic-gradient.
- Push is full-tab overwrite (simple + safe for single user). If multi-device sync is
  added later, move to row-granular `updatedAt` merge (schema already stores `updatedAt`).
- DB_VERSION is 2. Adding a collection = bump it + add the object store in `db.ts` upgrade().
- Dashboard-first: always check the ≥900px sidebar layout, not just 390px.
- Dev server runs on **5510** for this project (not Vite's default 5173).
