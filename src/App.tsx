import { useEffect, useState } from "react";
import { useRoute, navigate } from "./router";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { Sidebar } from "./components/Sidebar";
import { DemoBanner } from "./components/DemoBanner";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { AnnualScreen } from "./features/annual/AnnualScreen";
import { CalendarScreen } from "./features/calendar/CalendarScreen";
import { FrameworkScreen } from "./features/framework/FrameworkScreen";
import { RecurringScreen } from "./features/recurring/RecurringScreen";
import { TransactionsScreen } from "./features/transactions/TransactionsScreen";
import { AccountsScreen } from "./features/accounts/AccountsScreen";
import { NetWorthScreen } from "./features/networth/NetWorthScreen";
import { DistributionScreen } from "./features/distribution/DistributionScreen";
import { BudgetScreen } from "./features/budget/BudgetScreen";
import { SavingsScreen } from "./features/savings/SavingsScreen";
import { DebtScreen } from "./features/debt/DebtScreen";
import { MoreScreen } from "./features/more/MoreScreen";
import { PrivacyScreen } from "./features/privacy/PrivacyScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { bootstrap } from "./stores/bootstrap";
import { preloadGis } from "./lib/google/auth";
import { CoachTour, hasSeenTour } from "./components/CoachTour";

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    bootstrap().then(() => {
      // Dev-only perf seed (`?seed=N`) — never runs in a production build.
      if (import.meta.env.DEV) void import("./lib/perfSeed").then((m) => m.devSeedFromUrl());
      setReady(true);
      if (!hasSeenTour()) setShowTour(true);
    });
    preloadGis();
  }, []);

  function replayTour() {
    setShowTour(true);
  }

  // "Replay the welcome tour" from Settings: jump to the Dashboard first, then
  // open the coach on the next frame (so it scopes to the Dashboard, not the
  // screen the button was tapped on).
  useEffect(() => {
    const replayWelcome = () => {
      navigate("dashboard");
      requestAnimationFrame(() => setShowTour(true));
    };
    window.addEventListener("coach:welcome", replayWelcome);
    return () => window.removeEventListener("coach:welcome", replayWelcome);
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className={`app${route === "dashboard" ? " app--dashboard" : ""}`}>
      <Sidebar active={route} onCoachTour={replayTour} />
      <div className="app__col">
        <Header onCoachTour={replayTour} />
        <DemoBanner />
        <main className={`app__main${route === "dashboard" ? " app__main--wide" : ""}`} key={route}>
          {route === "dashboard" && <DashboardScreen />}
          {route === "annual" && <AnnualScreen />}
          {route === "calendar" && <CalendarScreen />}
          {route === "fiftythirty" && <FrameworkScreen />}
          {route === "recurring" && <RecurringScreen />}
          {route === "transactions" && <TransactionsScreen />}
          {route === "accounts" && <AccountsScreen />}
          {route === "networth" && <NetWorthScreen />}
          {route === "distribution" && <DistributionScreen />}
          {route === "budget" && <BudgetScreen />}
          {route === "savings" && <SavingsScreen />}
          {route === "debt" && <DebtScreen />}
          {route === "more" && <MoreScreen />}
          {route === "privacy" && <PrivacyScreen />}
          {route === "settings" && <SettingsScreen />}
        </main>
      </div>
      <TabBar active={route} />
      <UpdatePrompt />
      {showTour && <CoachTour onDone={() => setShowTour(false)} />}
    </div>
  );
}
