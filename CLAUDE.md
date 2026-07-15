# CLAUDE.md — Ultimate Budget

Guidance for any AI agent (or human) working in this repo. Read this first.

## Git — never auto-commit or push
Do not run `git commit`, `git push`, or `git add` toward a commit unless the
user explicitly asks for it **in that same turn**. This repo is routinely
edited by more than one agent session at once — an unprompted commit can
silently sweep up and push another session's in-progress, unreviewed changes
together with yours. GitHub Pages deploys straight from `main` (see
`.github/workflows/deploy.yml`), so an unwanted commit can also mean an
unwanted production deploy. Build, typecheck, and test freely; leave the
working tree uncommitted for the user to review and push themselves. Being
asked to commit once does not carry over to later turns — ask again each time.

**CONFIRMED on TrackerC, 2026-07-15 — same risk applies here: a push landing
mid-agent-edit shipped a broken build, exactly the risk above, materialized.**
An agent was mid-way through a multi-step rename in TrackerC's
`src/lib/access.ts` (`BASE_LOCK_MS` → `FIRST_LOCK_MS`/`HOUR_MS`) — one edit
had already renamed the constant declarations, a second edit (renaming the
function body that used it) hadn't landed yet. A commit+push happened in
that exact narrow window, shipping a file that was internally inconsistent.
GitHub Actions' `build` job caught it immediately and correctly (`tsc -b`
failing with `Cannot find name 'BASE_LOCK_MS'`, `deploy` never even ran) —
the CI pipeline did exactly its job here, this was not a pipeline bug, and
without a typecheck step this class of mistake would have shipped silently
broken JS instead of failing loudly with an exact file/line. **The fix was
never to debug `deploy.yml` or Pages settings** — it was to notice the
on-disk working tree already had the finished, consistent edit (`git status`
still showed the file as "modified" against the broken commit), re-verify it
locally (`tsc --noEmit` + `npm run build` + tests, all clean), and
commit+push that as a new commit superseding the broken one. **General rule:
if a deploy fails on a build/typecheck error right after a multi-step edit
was in progress, check the current working tree against the broken commit
before assuming the logic itself is wrong** — the fix might just be "finish
committing what's already correct on disk," not a code change. Also: run
`tsc --noEmit` immediately before `git commit`, not just after finishing an
edit — it's the cheapest way to catch an accidentally-mid-edit snapshot
before it ships, rather than waiting for CI to catch it several minutes
later.

## Version control — always keep the version number real and visible
The app must always show a version number that actually reflects what's
deployed — no hardcoded placeholder strings, ever (a past bug had the Settings
footer hardcoded to a static `"v1.0"` that never changed).
- Version comes from `src/lib/config.ts`: `APP_VERSION` (from `package.json`'s
  `version` field, baked in via `__APP_VERSION__` in `vite.config.ts`) and
  `BUILD_SHA` (CI's `VITE_COMMIT_SHA` when set, else the local git HEAD via
  `__LOCAL_COMMIT_SHA__` in `vite.config.ts` — so the footer always shows a
  real, changing commit sha, even in local dev where `APP_VERSION` alone
  never moves).
- It's displayed in three places, all must stay wired to the real values:
  Settings screen footer, desktop `Sidebar.tsx` footer, and `PrivacyScreen.tsx`.
  If you add another place the version could show, pull from `config.ts` —
  never hardcode a version string anywhere.
- `.github/workflows/deploy.yml` auto-bumps the patch version to that run's
  `$GITHUB_RUN_NUMBER` before building (ephemeral, not committed back to the
  repo) so every real deploy shows a version number that visibly changed —
  don't remove that step.
- `main.tsx` actively checks the service worker for updates whenever the app
  regains focus (`visibilitychange`) and auto-reloads once a new worker takes
  control (`controllerchange`), so an installed/long-open PWA can't get stuck
  serving a stale cached build. Keep this behavior if you touch `sw.js` or the
  SW registration.
- Settings screen also has a manual "Check for updates" button for the user to
  force a refresh — keep it working if you touch that screen.

## What this is
A **static, phone-first PWA** — an **"Ultimate Annual Budget"** money manager sold
on Etsy. It is the *interface*; the user's own **Google Sheet is the database**.
Runs fully offline on-device (IndexedDB) and optionally syncs to Google Sheets.

This is a **finance-only** app, converted from a broader life planner. The non-finance
modules (tasks, habits, goals, meals, grocery, fitness, weight, hydration, time blocking,
calendar, recurring tasks) were removed. **Kept modules:** Dashboard, Budget, Savings /
Sinking Funds, Debt Payoff, Settings. **Finance roadmap to build:** Recurring & Variable
Transactions, Monthly + Annual dashboards, Smart (bill) Calendar, 50/30/20, Net Worth,
Bank Accounts, Spender Distribution, Paycheck Dashboard.

## THE DATABASE IS THE USER'S GOOGLE SHEET — nothing else (must connect)
This is the product, not a nice-to-have. There is **no backend and no other
database**. The user's **Google Sheet is the single source of truth**; IndexedDB
is only an **offline cache** in front of it. Any persisted field must roundtrip
through `schema.ts` to a Sheet column, or it does not really exist.

**Connected as of last check** (this section used to say "currently NOT
done" — that was stale; verify current state by grepping `LOCAL_MODE` in
`src/lib/config.ts` and checking for `.env`, don't trust old prose here):
- `src/lib/config.ts` → `LOCAL_MODE = false`, and `.env` has a real
  `VITE_GOOGLE_CLIENT_ID`.

To connect from scratch (owner-only step — needs a real Google OAuth **Web**
client ID from Google Cloud Console; an AI agent cannot mint one):
1. Create the OAuth client, add authorized origins, copy the client ID.
2. `cp .env.example .env` and set `VITE_GOOGLE_CLIENT_ID=…`.
3. Flip `LOCAL_MODE = false` in `config.ts`, restart dev/build.
4. **Declare every scope the app actually requests on the OAuth consent
   screen's Data Access page — this is a SEPARATE step from creating the
   OAuth client, and it is NOT optional.** Google Cloud Console → APIs &
   Services → the OAuth consent screen ("Google Auth Platform" in the newer
   UI) → **Data Access** → **Add or Remove Scopes**. Add BOTH:
   - `https://www.googleapis.com/auth/drive.file` (Google Drive API —
     non-sensitive, no verification needed for this one alone)
   - `https://www.googleapis.com/auth/calendar.events` (Google Calendar
     API — classified sensitive/restricted, WILL require Google's
     verification review once added; the Calendar API itself must also be
     separately **enabled** in the API Library first, or its scope won't
     even appear in the picker table)
   **CONFIRMED LIVE BUG on TrackerA, 2026-07-14 — check this here too, not
   yet verified for TrackerB specifically:** TrackerA's Data Access page
   showed "No rows to display" in every scope category despite its code
   requesting both scopes at runtime the whole time. This produced a
   cluster of symptoms that looked exactly like code bugs but weren't:
   "Connect Google Sheets" intermittently failing with "Google sign-in
   didn't complete," and separately "Google hasn't verified this app...
   requesting access to sensitive info" even for an account that had
   connected successfully before. An undeclared scope and a
   declared-but-unverified scope show nearly identical warning text to the
   user but need completely different fixes — no code change fixes a scope
   that was never declared. **If this app ever shows similar "unverified
   app" symptoms, check Verification Center → Data Access in Google Cloud
   Console FIRST, before spending time on code-level auth debugging.**
   Two-step save gotcha confirmed live: checking the scope's box and
   clicking "Update" in the picker only stages it — there's a separate
   "Save" button on the main Data Access page that actually persists it.
5. In-app: Settings → Connect Google → sync creates the sheet + pushes local
   data.

**Product principles (do not violate):**
1. No backend of ours — static hosting only (Netlify/Pages). No server code.
2. User data lives in the user's Google Drive via Sheets API (`drive.file` scope only).
3. Offline-first: everything works from the IndexedDB cache; sync when online.
4. Phone-first, designed at 390px — **but dashboard-first**, so desktop (≥900px,
   sidebar layout) must also look great. Many buyers use it on a computer.
5. Friendly, low-anxiety finance UX = a design requirement: progress rings everywhere,
   low-friction capture, gentle language around overspend/negatives, no notification firehose.
6. **Zero friction for buyers:** the app opens straight to the Dashboard (no
   onboarding gate) and auto-seeds sample data on first run so it looks alive.

## Access-code gate — soft by design, now throttled (know the real ceiling)
`src/lib/access.ts`'s Etsy product-code check (`isValidAccessCode`) is a plain
array comparison against a list baked into the client bundle at build time
from `VITE_ACCESS_CODES` — there's no backend to check it against (see "no
backend of ours" above), so it was never real license enforcement, only a
soft gate to keep casual visitors on demo data and point genuine buyers at
Connect. **Flagged 2026-07-15: it had zero brute-force protection** —
`isValidAccessCode()` is a synchronous local function with no network
round-trip, so anyone with devtools open could call it directly, unlimited
times, instantly. Added `tryUnlock()` (same file) as an honest, not
bulletproof, speed bump: an escalating lockout after wrong guesses made
through the real UI — attempts 1-5 free (real buyers mistype), attempt 6 a
flat 30s, then attempt 7 on a much harder exponential wall in HOURS (1h, 2h,
4h, 8h, 16h...) capped at 24h so a genuine buyer isn't locked out for good —
persisted to BOTH `localStorage` and IndexedDB's `kv` store (`db.ts`) so a
plain refresh, or clearing just one of the two, doesn't hand back a free
reset — whichever storage shows the more restrictive state wins, and both are
re-synced to match on every check. `SettingsScreen.tsx`'s product-code form
now goes through `tryUnlock()`, never `isValidAccessCode()` directly.
**This does not, and architecturally cannot, make the codes brute-force-proof
from a static site.** Two ceilings, both inherent to "no backend," not bugs
to "fix" later: (1) the valid codes still ship in the client bundle in plain
text — anyone can read `ACCESS_CODES` straight out of the built JS with zero
guessing, which undersells "brute force" as the real risk; hashing them at
build time would stop that specific read but not a script that calls
`tryUnlock()`/`isValidAccessCode()` directly from the console, bypassing the
UI (and therefore the localStorage/IndexedDB lockout) entirely. (2) Any
client-only lockout is inherently clearable by clearing all site data or
opening a private window — there's no server to own the rate limit against.
If real license enforcement ever matters more than it does today, that needs
an actual backend endpoint to check codes against, which is a deliberate
architecture change, not a patch to this file — don't reach for it without
discussing the trade-off first, since it contradicts the static-hosting-only
principle above. Ported identically to TrackerA and TrackerC the same day —
see their own CLAUDE.md for their (identical logic, different localStorage
key prefix) copies.

## Owner preferences (learned — honor these)
- **Audience is ~99% women** — design for her, but **not with pink**: the owner
  explicitly rejected a pink/blush app. Current palette is "Eucalyptus Ledger"
  (warm ivory paper, deep eucalyptus teal primary, terracotta secondary, antique
  gold eyebrows, sage green for money-positive) — elegant/warm, not girly-pink.
- **No decorative or hard-to-read fonts.** Inter/system sans everywhere; a serif
  display face was tried and rejected. Readability first.
- **No emojis in the UI.** Use icons only (lucide-react via `src/components/icons.tsx`).
- **Charts must be CSS/JS, not SVG and not a chart library.** Rings/donuts use CSS
  `conic-gradient`; bars/columns use flex divs. See `src/components/{ProgressRing,Charts}.tsx`.
  (recharts is in package.json but intentionally NOT imported — do not add it.)
- **Every chart must have a stock-chart-style hover readout.** Hovering (or touch-
  dragging) any bar, dot, line, segment or slice shows the exact value instantly in
  the shared `ChartTip` bubble (`Charts.tsx`) — crosshair + tracking dot on line/area
  charts, value bubble on bars/columns/stacks/donuts. Native `title` tooltips alone
  are NOT acceptable (slow, unstyled). When adding a NEW chart component, wire in
  `ChartTip`/`hoverFromPointer` and pass a `formatValue` (money formatter for money
  values) — never ship a chart whose numbers can't be read on hover.
- Icons should be a clean, simple standard set (lucide), not hand-drawn SVG paths.
- **Never use the native `window.confirm()`/`window.alert()`.** They render as the
  browser's raw unstyled system popup — on an installed PWA that looks like the app
  is broken, and it can't be themed for dark mode or match the rest of the UI. This
  bug shipped live in TrackerA/TrackerC too (a `confirm()` on "Delete all planner
  data") before being caught. Build a `confirmDialog({ title, message, confirmLabel?,
  danger? })` helper (a zustand store returning a `Promise<boolean>`) rendered through
  the existing `BottomSheet` via a `ConfirmHost` mounted once in `App.tsx` — same call
  shape as `confirm()`, just `await` it. For non-blocking confirmations, use a toast,
  not `alert()`. **Re-verified 2026-07-15: this genuinely does NOT exist here yet** —
  no `src/stores/useConfirm.ts`, no `ConfirmHost` in `App.tsx`, nothing imports
  `confirmDialog` anywhere. (The "CONFIRMED LIVE VIOLATION" bullet further down this
  file claims to fix it by swapping in `confirmDialog(...)` "same pattern already used
  elsewhere" — that's inaccurate, there's no "elsewhere"; fixing that bullet's item
  means building the whole helper first, same as this bullet already said.)
- **`LockGatedButton` (`src/components/LockGatedButton.tsx`) — added 2026-07-15, ported
  from TrackerA, wired into "Start over" only** (TrackerB has no "start a new sheet"
  feature to gate a second instance on). Two tap-to-unlock padlock latches flank the
  button; both must open before a tap does anything, an early tap shakes + haptic-buzzes,
  and while still locked each latch strobes red/blue like a police light (JS
  `setTimeout` with a randomized delay each tick, not a CSS loop, so it never settles
  into an exact repeat — tuned same day from an initial red/white 90-320ms pass to
  red/blue at 280-650ms, plus a low-opacity white radial-gradient "film" overlay so it
  reads as light through frosted glass; see TrackerA's CLAUDE.md for the fuller
  writeup). Not real security, just friction for the scariest action in the app.
  **Its `onConfirm` still
  wraps the pre-existing native `confirm()`** (see the bullet above) rather than
  `confirmDialog()`, since TrackerA/TrackerC's pattern nests a themed confirm there and
  TrackerB doesn't have one to nest — porting the padlock didn't silently expand into
  also building the confirmDialog system. Do that first if picking this back up.

## Tech stack (fixed — do not substitute)
- Vite + React 18 + TypeScript, SPA, hash router (no react-router), deploys as static files.
- Hand-written CSS with design tokens (`src/styles/tokens.css`). No Tailwind, no UI kit.
- **Zustand** for state (one store per domain). **date-fns** for dates (all date math
  goes through `src/lib/dates.ts`). **idb** for IndexedDB. **lucide-react** for icons.
- Google: raw REST + Google Identity Services (no gapi client).
- Vitest for the pure logic (recurrence, budget, debt, schema). 34 tests currently green.

## Architecture map
```
src/
  lib/
    types.ts        domain types (v1 + v2)
    schema.ts       SINGLE SOURCE OF TRUTH for Sheet tabs/columns + row (de)serializers
    dates.ts        ALL date math (plain ISO yyyy-mm-dd; no times except Calendar events)
    recurrence.ts   THE recurrence engine — lazy materialization (see below)
    budget.ts       budget summary + carry-over math
    debt.ts         snowball/avalanche payoff simulation
    db.ts           IndexedDB (one object store per collection) + offline queue
    sync.ts         Sheets pull / push-all / debounced flush / connect
    google/
      auth.ts       GIS token client (drive.file scope)
      sheets.ts     REST wrapper: create / batchGet / writeTab (clear+update)
    ui.ts           category colors, priority colors, money/pct formatters
    sample.ts       first-run sample data (v1 + v2)
    config.ts       DB_NAME/VERSION, LOCAL_MODE flag
  stores/           zustand: useTasks, useHabits, useBudget, useSettings, useSync,
                    crud.ts (factory), v2.ts (goals/funds/debts/meals/grocery/
                    workouts/weight/hydration), bootstrap.ts (hydrate + seed + migrate)
  components/        ProgressRing, Charts, BottomSheet, Chip, Segmented, Checkbox,
                    HabitGrid, EmptyState, CountUp, TabBar, Sidebar, Header, icons.tsx
  features/<module>/ one folder per screen
  nav.tsx           SINGLE nav config consumed by Sidebar + More hub + TabBar
  router.ts         tiny hash router (Route union type lists every route)
  App.tsx           shell: Sidebar (desktop) + Header + <main> + TabBar (mobile)
tests/              recurrence / budget / debt / schema
```

## The recurrence engine (most important module)
`src/lib/recurrence.ts` — **lazy materialization**:
- `Recurrences` are templates; occurrences are computed, never pre-stored.
- `expandOccurrences(rec, windowStart, windowEnd)` is a PURE function.
- An occurrence becomes a real `Tasks` row only when it needs identity (completed,
  edited, reminder toggled). Materialized rows override the computed ones at that date.
- Editing one occurrence = materialize + edit that row only. Editing the series edits
  the `Recurrences` row; already-materialized past rows are never changed retroactively.
- Rules: month-end clamps (31→28/30), Feb 29→Feb 28, DST-safe (plain dates).
- **Any change here MUST keep `tests/recurrence.test.ts` green.**

## Google Sheet as database
- `schema.ts` defines every tab + column order. Row 1 is an app-written header.
- Records keyed by `id` (col A, nanoid) — NEVER by row position. Tolerate extra
  user columns, reordered/blank rows.
- v1 tabs: Tasks, Recurrences, Habits, HabitLog, BudgetPeriods, Money.
- v2 tabs (now built): Goals, Funds, Debts, Meals, Grocery, Workouts, WeightLog, Hydration.
- Sync (`sync.ts`): pull = batchGet all tabs → replace IndexedDB + stores. Push = full-tab
  overwrite (clear + write) per collection, debounced 2s after any mutation. Single-user
  last-write-wins. `connect()` creates the sheet + pushes local data on first link.
- **KNOWN LIVE BUG, confirmed 2026-07-13, not yet fixed here:** `disconnect()`
  (`sync.ts`) does `localStorage.removeItem(LS_ID)`, deleting the remembered spreadsheet
  id outright. The next `connect()` then finds no "existing" id and creates a BRAND NEW
  spreadsheet instead of relinking to the user's real one — confirmed on TrackerA via
  Cloud Console API metrics showing 4 `CreateSpreadsheet` calls from one test account's
  repeated disconnect/reconnect, scattering that account's data across several sheets. Fix
  (already applied in TrackerA, port the same pattern here): disconnect() must NEVER
  remove `LS_ID`. Instead use a separate opt-OUT flag (e.g. `lp.disconnected` — its
  ABSENCE means connected, not its presence meaning connected) that disconnect() sets and
  connect()/relink() clear via `setSpreadsheetId()`. Opt-out, not opt-in, matters here: an
  opt-in "active" flag that only gets set inside connect() would silently break syncing
  for every already-connected session the moment it ships (isConnected() would start
  returning false for them with no error, since nothing ever set the new flag for their
  existing connection) — see TrackerA's `src/lib/sync.ts` for the corrected version.
- **KNOWN LIVE BUG, confirmed 2026-07-13, not yet fixed here:** `authedFetch` in
  `src/lib/google/sheets.ts` falls back to an INTERACTIVE (popup) Google token request
  whenever a silent refresh fails, with no regard for whether the call is inside a real
  user click or a background timer. The debounced background push can run long after the
  token (~1hr lifetime) has expired; if the silent refresh fails there, this tries to pop
  up a Google sign-in with no user gesture behind it — browsers block that popup, the
  callback never fires, and the Promise hangs forever with no error. Result: leave a tab
  open for a while and sync silently, permanently stops working until the page is
  reloaded. Fix (already applied in TrackerA, port the same pattern here): thread an
  `allowInteractive` flag through `authedFetch`/`writeTab`; the background flush must pass
  `false` and throw a typed `ReauthRequiredError` instead of attempting the popup, and the
  UI should offer a real "tap to reconnect" affordance (only a genuine click may open the
  popup). See TrackerA's `src/lib/google/sheets.ts` and `src/components/Header.tsx`.
- **Also confirmed missing here:** neither `authedFetch`'s raw `fetch()` call nor
  `requestToken()` in `auth.ts` has any timeout — a dropped connection, unresponsive
  server, or a silent GIS callback that never fires (real, happens under strict
  third-party cookie blocking) can hang the sync pill on "Syncing…" forever with nothing
  to catch it, a SEPARATE cause of the same symptom as the bug above. Port TrackerA's
  `AbortController`/`FETCH_TIMEOUT_MS` (in `sheets.ts`) and
  `SILENT_TOKEN_TIMEOUT_MS`/`INTERACTIVE_TOKEN_TIMEOUT_MS` (in `auth.ts`).
- **Two more confirmed here:** (1) `auth.ts` uses one shared `let state` token slot for
  BOTH Sheets and Calendar scopes — requesting one silently evicts the other, so any
  save with a Calendar reminder on ping-pongs between scopes needing a fresh token (and a
  popup) on every save. Port TrackerA's scope-keyed `tokenCache: Map<string, TokenState>`.
  (2) `useSync.ts`'s `online` event listener calls `pushAll()`/`syncNow()` with no
  interactive-popup guard at all — the network reconnecting has nothing to do with a user
  click and can fire while the tab isn't focused, which is how a Google popup can appear
  "while the window is not used." TrackerB doesn't have the `allowInteractive` concept at
  all yet (`pushAll(force = false)` here is a different, unrelated flag) — porting bug 5's
  fix needs this threaded through too, with the `online` listener passing `false`.
- **Likely ROOT CAUSE behind repeated Google popups, also present here:** the token cache
  (`let state` in `auth.ts`) is ONLY ever in-memory, never persisted. A page reload for any
  reason (a new deploy's service-worker auto-update, a manual refresh, a backgrounded tab
  getting reclaimed) wipes a token that might still have had real time left, forcing a
  fresh sign-in from zero every time — reads as "the connection keeps dying" when it's
  actually the RELOAD discarding a still-valid token, not real expiry (confirmed in
  TrackerA 2026-07-13). Port TrackerA's `sessionStorage`-backed persistence
  (`persistToken`/`getCached`/`forgetPersistedToken` in `auth.ts`) once the scope-keyed
  cache above is ported — persistence should key off the same per-scope map.
- **REAL DATA LOSS BUG, confirmed live here too (2026-07-13):** `connect()`'s
  reconnect-to-an-existing-sheet branch (`if (existing) { ... await pull(); ... }`) calls
  `pull()` with no push first. `pull()` unconditionally REPLACES local IndexedDB with
  whatever's currently in the Sheet. If the device kept working through a stretch where
  the connection was stuck needing reauth (background pushes failing that whole time, so
  the Sheet is the STALE side, not the device), the moment reconnect finally succeeds that
  `pull()` silently overwrites every change made while disconnected with the old Sheet
  content — no backup, no undo, genuinely unrecoverable. Confirmed as real, reported data
  loss on TrackerA: "once I signed back in everything was cleared although everything was
  still there while I was disconnected." Fix (already applied in TrackerA, port verbatim):
  add `await pushAll(true)` immediately BEFORE `await pull()` in that branch — the
  interactive token from earlier in the same `connect()` call makes the push reliable, so
  local changes reach the Sheet before pull reads it back. Do NOT add this to `relink()` —
  that path is for a genuinely new device with nothing local to lose.
  **Update, 2026-07-14: the description above is now stale — re-verify before porting
  verbatim.** `pull()` has since been rewritten to do a row-granular merge by `updatedAt`
  (`mergeById` in `src/lib/merge.ts`) plus tombstones for deletes, NOT a blind full
  IndexedDB replace. That may already substantially mitigate this bug's actual severity
  (a stale Sheet read no longer necessarily clobbers newer local rows outright), but it
  hasn't been confirmed sufficient — a human should check whether the merge logic actually
  protects a locally-edited row against a stale/pre-disconnect Sheet snapshot the same way
  `pushAll(true)`-before-`pull()` does, before assuming this one's covered or still needs
  the verbatim TrackerA fix.
- **CONFIRMED LIVE VIOLATION, 2026-07-14, of this file's own "never use window.confirm()"
  rule (see Owner preferences above):** `src/features/settings/SettingsScreen.tsx:557` —
  `if (confirm("Delete all planner data on this device? This cannot be undone."))` gates
  "Start over (erase everything)." A native, unstyled system popup on exactly the single
  scariest, most irreversible action in the whole app. Fix: swap for `confirmDialog({
  title, message, confirmLabel: "Erase everything", danger: true })` from
  `src/stores/useConfirm.ts`, same pattern already used elsewhere for destructive actions.
- **KNOWN LIVE BUG, confirmed 2026-07-14 (dirty-tracking doesn't survive a reload):**
  `DirtyTabs` (`src/lib/syncDirty.ts`) is held as one in-memory module singleton
  (`const dirty = new DirtyTabs();`, `sync.ts:88`), never persisted. `useSync.ts:32`'s
  initial `status` (`navigator.onLine ? "synced" : "offline"`) is a blind guess that never
  checks whether anything is actually still pending. A reload before a push completes
  silently drops the pending-push flag — the edit stays safe in IndexedDB, but nothing ever
  retries pushing it, while the freshly reloaded page confidently shows "Synced" for data
  that never reached the Sheet. Confirmed as real, reported data loss on TrackerA: "when i
  refresh the page it says synced in the left panel but its not synced at all since new
  entry are not sent to the sheet." Fix (already applied in TrackerA, port the same
  pattern): mirror `DirtyTabs`'s set into `localStorage` on every add/clear, hydrate from it
  on construction instead of starting empty, and have `useSync.ts`'s boot path check
  pending state to set the initial status accurately and kick a resume push instead of
  defaulting to "synced." See TrackerA's `src/lib/sync.ts`
  (`LS_DIRTY_TABS`/`loadDirtyTabs`/`persistDirtyTabs`/`hasPendingPush`) and
  `src/stores/useSync.ts`'s boot-time resume effect.
- **KNOWN LIVE BUG, confirmed 2026-07-14 (sync pill contradicts demo mode):** `Header.tsx`
  reads `const demo = useDemo((s) => s.demo);` but it's a dead variable, never referenced
  again — the sync pill renders unconditionally regardless of demo mode. `Sidebar.tsx` uses
  `demo` only for its brand badge; its own sync pill is equally ungated. Both will show a
  persistence claim ("Saved"/"Synced"/etc.) directly contradicting `DemoBanner`'s own
  "Nothing here is saved" shown right above them. Fix (already applied in TrackerA, port
  the same pattern): hide the sync pill entirely whenever `demo` is true (`{!demo && (...)}`
  around the whole pill block in both files) — the demo brand badge and `DemoBanner` already
  say it, a third claim adds only noise (and visibly wraps/breaks on a phone-width header).
- **MISSING ENTIRE SUBSYSTEM, confirmed 2026-07-14: TrackerB has no reauth/retry
  infrastructure at all, not just an isolated bug.** Unlike the fixes above (each a
  self-contained patch to something that already exists), TrackerB is missing the whole
  concept TrackerA built up over many iterations to handle a lapsed Google token gracefully:
  - No `ReauthRequiredError` type anywhere, and no `needsReauth` state in `useSync.ts` — a
    failed silent token refresh just falls through to `authedFetch`'s interactive-popup
    fallback (the bug already documented above) instead of failing fast with a typed error.
  - No retry-with-backoff on push failure at all — `scheduleFlush()` (`sync.ts:392-407`)
    makes ONE attempt 2s after the last edit and on failure just sets status "offline,"
    nothing ever retries a transient failure (rate limit, a blip) on its own.
  - No token-warming / proactive health check whatsoever — no `keepTokenWarm`, no
    `TOKEN_REFRESH_MARGIN`, no `setInterval`/`visibilitychange` listener for token health
    anywhere in `auth.ts`.
  - The sync pill has no click handler in either `Header.tsx` or `Sidebar.tsx` — nothing
    for a user to tap even once `needsReauth` exists.
  - No persistent "you need to reconnect" indicator of any kind — `DemoBanner.tsx`
    (mounted in `App.tsx`) already establishes the exact right pattern (a slim,
    always-visible bar with its own action button, gated on a store flag) to clone for this.
  Porting this properly means building the whole chain, not isolated patches: (1) add
  `ReauthRequiredError` + `allowInteractive` threading (ties into the already-documented
  popup-fallback bug above), (2) add `needsReauth` to `useSync.ts` + retry-with-backoff in
  the push flow that returns immediately (no reschedule) on `ReauthRequiredError`
  specifically, (3) add a click handler to the sync pill requesting ONLY `SCOPE_SHEETS`
  interactively-first (TrackerB already keeps `SCOPE_SHEETS`/`SCOPE_CALENDAR` as separate
  constants in `auth.ts`, a decent foundation — never request the combined scope outside
  genuine first-connect, it triggers Google's heavier "unverified app" consent screen every
  time), (4) add token-warming (interval + visibilitychange + one immediate call at boot),
  (5) clone `ReconnectBanner.tsx` from `DemoBanner.tsx`'s shape. See TrackerA's
  `src/lib/sync.ts`, `src/lib/google/auth.ts`, `src/stores/useSync.ts`, and
  `src/components/ReconnectBanner.tsx` for the full reference implementation — this is
  genuinely the biggest remaining piece of sync work across all three apps, not a quick port.
- **MORE CONFIRMED-LIVE BUGS, from TrackerA's 2026-07-14 full-app QA pass — not yet fixed
  here, verified present in this repo's current code:**
  - `tabValues()`/its equivalent in `sync.ts` builds what gets pushed from THIS tab/window's
    in-memory Zustand state, not from IndexedDB. Two tabs/windows open on one device (the
    installed PWA icon plus a leftover browser tab is a completely normal pattern for a
    no-login-gate app) each hydrate independently and never learn about a sibling's edits —
    whichever tab pushes LAST clear+overwrites the Sheet tab with its own stale snapshot,
    silently erasing whatever the sibling already got onto the Sheet. Fix (already applied in
    TrackerA, port the same pattern): make the push-builder read straight from IndexedDB
    (`db.all(collection)`) instead of the store, since IndexedDB is genuinely shared across
    tabs/windows on the same origin. See TrackerA's `src/lib/sync.ts`'s `tabValues()`.
  - Any boot-time "resume a pending push" logic that lives at a store module's own top-level
    scope (rather than being explicitly called AFTER hydration finishes) races ahead of
    `bootstrap()`'s async IndexedDB reads and can push the stores' still-empty defaults,
    clear+overwriting a real Sheet tab with just a header row. Check `useSync.ts` for this
    exact shape. Fix (already applied in TrackerA): moved into an exported
    `resumePendingPush()`, called as the LAST line of `bootstrap.ts`'s `runBootstrap()`, never
    at module-eval time. See TrackerA's `src/stores/useSync.ts`/`src/stores/bootstrap.ts`.
  - `CoachTour.tsx` swaps a real (non-demo) user's live stores for fake sample data via
    `loadSampleIntoStores()` without ever flipping `isDemo()` true, so a pending/retrying push
    firing while the tour is open can write sample rows over the real Sheet with no dirty flag
    left to ever self-correct. Fix (already applied in TrackerA): a separate, purely in-memory
    `syncSuspended` flag (`suspendSync()`/`resumeSync()` in `sync.ts`), checked alongside
    `isDemo()` in both push functions, set/cleared by `CoachTour.tsx` at every point it
    swaps/restores data (including its unmount cleanup). See TrackerA's `src/lib/sync.ts` +
    `src/components/CoachTour.tsx`.
  - A Sheet tab that doesn't exist yet on this (older, already-connected) spreadsheet fails
    every write forever, AND — if the write loop has no per-tab isolation — that one broken
    tab starves every OTHER pending edit queued behind it in the same pass. Check whether
    `pushDirty`/`pushAll` here call `ensureTabs()` proactively and isolate each tab's write in
    its own try/catch. Fix (already applied in TrackerA): both push functions call
    `ensureTabs()` on whatever they're about to write before the loop, and the shared write
    loop only aborts the whole pass on `ReauthRequiredError` (same token backs every call, so a
    dead token fails every tab identically) — any other single-tab error is remembered and
    re-thrown only after every tab in the pass has been attempted. See TrackerA's
    `src/lib/sync.ts`'s `writeAllTabs()`.
  - Nothing stops `pushAll()` (Sync Now / connect / reauth / disconnect) from running
    CONCURRENTLY with a background `pushDirty()` if `pushInFlight` (or equivalent) only guards
    ONE of the two call paths — two clear+write cycles against the same tab can resolve out of
    order, and whichever finishes second silently overwrites a newer write with an older one,
    while both sides independently clear the dirty flag. Fix (already applied in TrackerA): a
    simple promise-chain mutex (`serialized()` in `sync.ts`) that every push call — regardless
    of which function or caller — goes through, so the next one always waits for whatever's
    already running to fully settle first.
  - `relink()` (the cross-device "paste a Sheet link" recovery path) never leaves demo mode
    before pulling — on a brand-new device (which defaults to demo mode ON, exactly this
    path's target scenario), the real data it pulls down shows for that session only and never
    persists, silently reverting to the sample on the next reload while the app still says
    "Connected." Fix (already applied in TrackerA): `relink()` now checks `isDemo()` and calls
    `setDemoMode(false)` before `pull()`, mirroring `connect()`'s existing pattern.
- **CONFIRMED PRESENT HERE, same 2026-07-14 QA pass, non-sync bugs:**
  - `src/components/CountUp.tsx:26` and `src/components/ProgressRing.tsx` both hardcode
    animating FROM `0` on every value change (not just initial mount), so any small update
    (e.g. a budget number ticking up or down) visibly snaps the whole counter/ring back toward
    empty before re-animating — `ProgressRing` hits nearly every screen with a progress ring.
    Fix (already applied in TrackerA): track the currently-displayed value in a `ref` and
    animate FROM that ref TO the new target, only seeding it with `0` on initial mount. See
    TrackerA's `src/components/CountUp.tsx`/`ProgressRing.tsx`.
  - `src/components/BottomSheet.tsx:24` (`if (e.key === "Escape") onClose();`) binds Escape
    per-instance with no stack awareness — a nested confirm dialog (via `ConfirmHost`) opened
    on top of an already-open edit sheet fires BOTH sheets' `onClose` on one Escape press,
    silently discarding an unsaved edit underneath, and unconditionally unlocks body scroll
    even while the outer sheet is still open. Fix (already applied in TrackerA): a
    module-level stack of open-sheet ids; only the topmost sheet's Escape handler acts, body
    scroll only unlocks once the stack is fully empty. See TrackerA's `src/components/BottomSheet.tsx`.
  - `src/features/debt/DebtScreen.tsx:449` (`Number(currentBalance) || start`) — a falsy-zero
    bug: paying a debt down to exactly $0 and typing "0" is silently treated as an empty field
    and resets Current back to the full Start balance, since `Number("0") || start` evaluates
    the fallback. Fix (already applied in TrackerA): check the raw input string for blank
    explicitly (`currentBalance.trim() === "" ? start : Number(currentBalance) || 0`) instead
    of the parsed number's truthiness.
  - `useBudget.ts`'s `deleteMoney` (line ~218) removes a Money row without ever reversing the
    Fund-balance delta it previously applied via `syncFundBalance` (confirmed: `updateMoney`
    correctly reverses/reapplies on every `actual` change, `deleteMoney` doesn't). Deleting a
    linked "saving" line leaves the Fund permanently overstated by whatever that line's
    `actual` was. Fix (already applied in TrackerA): call `syncFundBalance(existing,
    -existing.actual)` before removing the row (TrackerA also has a `debtId`/`syncDebtBalance`
    equivalent to reverse for debt-linked rows — this repo's `useBudget.ts` doesn't have that
    linking feature yet at all, so only the Fund-reversal half applies here; port the Debt
    equivalent too if/when `debtId` linking gets built here).
  - `src/lib/google/calendar.ts`'s `addMinutes()`/`digestBody()` — confirmed the same pattern
    exists here (`digestBody` combines `addMinutes(time, 15)` with the same `date` for `end`).
    A digest time in the last 15 minutes of the day (23:45-23:59) produces an `end` earlier
    than `start` on the same calendar date, an invalid event body Google's API rejects
    silently. Fix (already applied in TrackerA): detect the midnight wrap (compare the
    zero-padded `HH:mm` strings lexicographically) and advance the end date by one day when it
    occurs.
  - `src/stores/useInstall.ts:16` (`/iphone|ipad|ipod/i.test(ua)`) — confirmed the same gap
    exists here: iPadOS 13+ Safari's default user agent reports as desktop macOS (no
    "ipad" substring), so a real iPad falls through to wrong, non-functional desktop install
    guidance. Fix (already applied in TrackerA): also check
    `navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1` and classify that as
    iOS too.

## Data flow for a mutation
store action → update in-memory state → `db.put(...)` (IndexedDB) → `useSync.touch()`
→ if connected, debounced `pushAll()` to Sheets; else flash "Saved".

## Conventions
- Match the surrounding code's style. New screens: `features/<name>/<Name>Screen.tsx`,
  add the `Route` to `router.ts`, an entry to `nav.tsx`, and a case in `App.tsx`.
- New persisted collection: add to `types.ts`, `schema.ts` (headers + serializers),
  `db.ts` (object store + `ALL_COLLECTIONS`, bump `DB_VERSION`), a store, `bootstrap.ts`
  (load + seed), and `sync.ts` (tabValues + pull).
- Icons: import from `components/icons.tsx`. Pickable icons live in `NAMED_ICONS`.
- Money via `ui.ts` `money()`. Category colors via `categoryColor()`.
- **`.btn--stack` (`base.css`) is `margin-bottom: 10px` — put it on the button ABOVE the gap
  you want, never on the button below.** It creates space AFTER itself, not before. Putting
  it on the second/lower button (e.g. a "Delete" button under "Save changes") does nothing
  visible — the two buttons end up touching with no gap (confirmed in TrackerA
  2026-07-13). When stacking two full-width buttons in a `BottomSheet`, the class goes on
  the FIRST button.

## Commands
```
npm install
npm run dev        # dev server (this project runs on port 5510)
npm test           # vitest — keep green before finishing a phase
npm run build      # static output in dist/; gzip budget ≤ 250KB (currently ~88KB)
npx tsc --noEmit   # typecheck (must be clean)
```

## Quality gates before calling a phase done
1. `npm test` green (recurrence, budget, debt, schema). 2. `tsc --noEmit` clean.
3. `npm run build` succeeds, initial JS ≤ 250KB gz. 4. No emojis in UI, no SVG/library charts.

## Status / roadmap
See `TODO.md`. Google Sheets sync code is complete but the app is **not connected
yet** — `LOCAL_MODE=true` and no `VITE_GOOGLE_CLIENT_ID`. Connecting is the
top-priority open task (see "THE DATABASE IS THE USER'S GOOGLE SHEET" above + README).
