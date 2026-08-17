import { Monitor, Moon, Sun } from "lucide-react";
import {
  getSavedTheme,
  setTheme,
  type ThemeMode,
} from "../components/ThemeManager";
import { useState } from "react";
import "./ThemeSettings.css";

export function ThemeSettings() {
  const [theme, setThemeState] =
    useState<ThemeMode>(() => getSavedTheme());

  function changeTheme(next: ThemeMode) {
    setTheme(next);
    setThemeState(next);
  }

  return (
    <section className="theme-settings-card">
      <div className="theme-settings-heading">
        <strong>表示テーマ</strong>
        <small>
          アプリ全体の明るさを選択できます。
        </small>
      </div>

      <div className="theme-settings-options">
        <button
          type="button"
          className={
            theme === "light"
              ? "theme-option theme-option--active"
              : "theme-option"
          }
          onClick={() => changeTheme("light")}
        >
          <Sun size={19} />
          <span>ライト</span>
        </button>

        <button
          type="button"
          className={
            theme === "dark"
              ? "theme-option theme-option--active"
              : "theme-option"
          }
          onClick={() => changeTheme("dark")}
        >
          <Moon size={19} />
          <span>ダーク</span>
        </button>

        <button
          type="button"
          className={
            theme === "system"
              ? "theme-option theme-option--active"
              : "theme-option"
          }
          onClick={() => changeTheme("system")}
        >
          <Monitor size={19} />
          <span>システム</span>
        </button>
      </div>

      <p className="theme-settings-help">
        「システム」はiPhoneやPCのライト・ダーク設定に合わせて自動で切り替わります。
      </p>
    </section>
  );
}
