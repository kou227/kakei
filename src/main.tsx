import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";
import "./theme.css";
import { initializeDatabase } from "./db";
import { OnboardingGate } from "./components/OnboardingGate";
import { ThemeManager } from "./components/ThemeManager";

async function start() {
  await initializeDatabase();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeManager />
      <OnboardingGate>
        <App />
      </OnboardingGate>
    </StrictMode>,
  );
}

start();