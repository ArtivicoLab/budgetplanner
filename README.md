# Ultimate Budget

A static, phone-first PWA — an "Ultimate Annual Budget" money manager. Built with
Vite + React + TypeScript. No backend of ours — runs entirely on-device (IndexedDB),
with the user's own Google Sheet as the optional database/sync target.

This app was converted from a broad life planner into a **finance-only** tool. The
non-finance modules (tasks, habits, goals, meals, grocery, fitness, weight, hydration,
time blocking, calendar, recurring tasks) were removed. **Kept modules:** Dashboard,
Budget, Savings / Sinking Funds, Debt Payoff, Settings.

## Run

```bash
npm install
npm run dev        # http://localhost:5510
npm test           # budget + debt + schema unit tests
npm run build      # static output in dist/
```

## Status

**Built (local build):**
- Design system — Alpine (light) + Timberline (dark) themes, iOS-native shell
- Hash router, bottom tab bar, sync status pill
- IndexedDB persistence with `LOCAL_MODE` flag + sample data seeding
- Zustand stores: budget, debt, funds, settings
- Screens: Dashboard, Budget, Savings / Sinking Funds, Debt Payoff, Settings
- Progress rings + CSS charts (conic-gradient / flex — no SVG, no chart library)
- PWA: manifest + service worker (app shell precache)

**Finance roadmap (to build):** Recurring & Variable Transactions, Monthly + Annual
dashboards, Smart (bill) Calendar, 50/30/20, Net Worth, Bank Accounts, Spender
Distribution, Paycheck Dashboard.

**Next phase (needs your Google Cloud OAuth client):**
- `src/lib/google/{auth,sheets,calendar}.ts` — GIS token client + Sheets REST + Calendar
- Sync queue flush to Sheets (offline queue already modeled)
- Onboarding sign-in flow

## Connect Google Sheets (optional)

The app runs 100% on-device by default. To back up / sync to a spreadsheet in the
user's own Google Drive, add an OAuth client ID — a one-time, **free** Google Cloud
setup (~5 min). Then the **Settings → Google Sheets → Connect** button lights up.

### One-time Google Cloud setup
1. Go to <https://console.cloud.google.com/> and create a project (any name).
2. **APIs & Services → Library** → enable **Google Sheets API** (and **Google
   Calendar API** later, for reminders).
3. **APIs & Services → OAuth consent screen** → User type **External** → fill app
   name + your email → add yourself under **Test users** (while unverified, only
   test users can sign in).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   Application type **Web application**. Under **Authorized JavaScript origins** add:
   - `http://localhost:5510` (dev — the port this project runs on)
   - your production origin (e.g. `https://yourdomain.com`) when you deploy
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).

### Wire it in
```bash
cp .env.example .env
# edit .env and paste the client ID:
# VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
npm run dev
```
Restart the dev server after editing `.env`. Open **Settings → Google Sheets →
Connect Google Sheets**. The app creates a spreadsheet titled *"Ultimate Budget Data
(app-managed)"* in your Drive, seeds it with your current data, and mirrors changes
on every edit (debounced). "Open my sheet" links straight to it.

**Scope:** only `drive.file` — the app can touch *only the sheet it creates*, nothing
else in your Drive. Going live for all users (not just test users) later needs Google's
consent-screen verification; not required to build or self-use.
