// Global build flags.
// LOCAL_MODE = true → the whole app runs on-device (IndexedDB) with no Google.
// Flip to false once the Sheets sync layer (lib/google/*) is wired in.
export const LOCAL_MODE = false;

export const APP_NAME = "Budget Planner";
// New app, its own IndexedDB — deliberately distinct from the Life Planner DB
// so the two never collide when both are served from localhost during dev.
export const DB_NAME = "ultimatebudget";
export const DB_VERSION = 5; // 2: Transactions · 3: Accounts · 4: NetWorth · 5: Recurring

// Public source repository — the Privacy screen's "check the source" link.
export const GITHUB_URL = "https://github.com/ArtivicoLab/ultimatebudget";

// Copyright holder shown in Privacy / footers.
export const COPYRIGHT_HOLDER = "Budget Planner";

// Version stamp shown in page footers — package.json version plus the short
// commit SHA, so a live site's (or local dev server's) freshness can be
// checked at a glance instead of guessing whether a deploy/rebuild actually
// landed. CI's VITE_COMMIT_SHA takes precedence when set (real deploys);
// __LOCAL_COMMIT_SHA__ (git HEAD at build time) covers local dev, where
// VITE_COMMIT_SHA is never set and APP_VERSION alone never changes.
export const APP_VERSION = __APP_VERSION__;
export const BUILD_SHA = (import.meta.env.VITE_COMMIT_SHA || __LOCAL_COMMIT_SHA__ || "").slice(0, 7);
