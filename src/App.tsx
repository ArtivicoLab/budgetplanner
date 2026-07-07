import { useEffect, useState } from "react";
import { useRoute } from "./router";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { Sidebar } from "./components/Sidebar";
import { DemoBanner } from "./components/DemoBanner";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { DashboardScreen } from "./features/dashboard/DashboardScreen";
import { AnnualScreen } from "./features/annual/AnnualScreen";
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
      setReady(true);
      if (!hasSeenTour()) setShowTour(true);
    });
    preloadGis();
  }, []);

  function replayTour() {
    setShowTour(true);
  }

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
