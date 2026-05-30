// Theme (light/dark) management, shared by the popup and the dashboard.
//
// The chosen theme is persisted in chrome.storage.local under its own key
// (separate from the rule store) and applied by toggling the `dark` class on
// <html>, which drives Tailwind's class-based dark mode. "system" follows the
// OS preference live via matchMedia.

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "requestly_clone_theme";
const DEFAULT_THEME: ThemePreference = "system";

function prefersDark(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolve a preference to the concrete mode that should be shown right now. */
export function resolveDark(pref: ThemePreference): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return prefersDark();
}

/** Apply (or remove) the `dark` class on the document root. */
export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(pref));
}

/** Read the stored theme preference, defaulting to "system". */
export async function getTheme(): Promise<ThemePreference> {
  const result = await chrome.storage.local.get(THEME_KEY);
  const value = result[THEME_KEY];
  if (value === "light" || value === "dark" || value === "system") return value;
  return DEFAULT_THEME;
}

/** Persist a theme preference. */
export async function setTheme(pref: ThemePreference): Promise<void> {
  await chrome.storage.local.set({ [THEME_KEY]: pref });
}

/**
 * React hook: load the stored preference, apply it to <html>, keep it in sync
 * across surfaces (storage.onChanged) and with the OS when set to "system".
 * Returns the current preference and a setter that persists.
 */
export function useTheme(): {
  theme: ThemePreference;
  isDark: boolean;
  setTheme: (pref: ThemePreference) => Promise<void>;
} {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    let active = true;
    void getTheme().then((pref) => {
      if (!active) return;
      setThemeState(pref);
      applyTheme(pref);
    });

    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes[THEME_KEY]) return;
      const next = (changes[THEME_KEY].newValue as ThemePreference) ?? DEFAULT_THEME;
      setThemeState(next);
      applyTheme(next);
    };
    chrome.storage.onChanged.addListener(onStorage);

    const mql =
      typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
    const onSystem = () => {
      // Only react to OS changes while following the system preference.
      void getTheme().then((pref) => {
        if (pref === "system") applyTheme("system");
      });
    };
    mql?.addEventListener("change", onSystem);

    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onStorage);
      mql?.removeEventListener("change", onSystem);
    };
  }, []);

  const update = useCallback(async (pref: ThemePreference) => {
    setThemeState(pref);
    applyTheme(pref);
    await setTheme(pref);
  }, []);

  return { theme, isDark: resolveDark(theme), setTheme: update };
}
