import { useState } from "react";
import { BottomNav, type MainTab } from "./components/BottomNav";
import { CalendarPage } from "./pages/CalendarPage";
import { CategoryPage } from "./pages/CategoryPage";
import { GraphPage } from "./pages/GraphPage";
import { InputPage } from "./pages/InputPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("input");

  return (
    <div className="app-shell">
      <main className="app-content">
        {activeTab === "input" && <InputPage />}
        {activeTab === "calendar" && <CalendarPage />}
        {activeTab === "graph" && <GraphPage />}
        {activeTab === "category" && <CategoryPage />}
        {activeTab === "settings" && <SettingsPage />}
      </main>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

export default App;
