import { useEffect } from "react";

const THEME_KEY = "kakei-theme";

export type ThemeMode = "light" | "dark" | "system";

export function getSavedTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);

  if (
    saved === "light" ||
    saved === "dark" ||
    saved === "system"
  ) {
    return saved;
  }

  return "system";
}

export function saveTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;

  if (theme === "system") {
    const dark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.themeMode = "system";
    return;
  }

  root.dataset.theme = theme;
  root.dataset.themeMode = theme;
}

export function ThemeManager() {
  useEffect(() => {
    const theme = getSavedTheme();
    applyTheme(theme);

    const media = window.matchMedia(
      "(prefers-color-scheme: dark)",
    );

    const listener = () => {
      if (getSavedTheme() === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", listener);

    return () => {
      media.removeEventListener("change", listener);
    };
  }, []);

  return null;
}

export function setTheme(theme: ThemeMode) {
  saveTheme(theme);
  applyTheme(theme);
}
