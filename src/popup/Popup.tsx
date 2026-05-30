import { useState } from "react";
import { toggleRule } from "../storage/store";
import type { Rule, RuleType } from "../types/rules";
import { type ThemePreference, useTheme } from "../ui/theme";
import { useRules } from "../ui/useRules";

const TYPE_LABELS: Record<RuleType, string> = {
  redirect: "Redirect",
  modifyHeaders: "Headers",
  block: "Block",
  replace: "Replace",
  mock: "Mock",
  inject: "Inject",
};

function openDashboard(): void {
  if (chrome.runtime?.openOptionsPage) chrome.runtime.openOptionsPage();
}

const THEME_ORDER: ThemePreference[] = ["light", "dark", "system"];
const THEME_ICON: Record<ThemePreference, string> = {
  light: "☀️",
  dark: "🌙",
  system: "🖥️",
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme} (click for ${next})`}
      className="rounded px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {THEME_ICON[theme]}
    </button>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  const [busy, setBusy] = useState(false);
  const onToggle = async () => {
    setBusy(true);
    try {
      await toggleRule(rule.id);
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{rule.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{TYPE_LABELS[rule.type]}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={rule.enabled}
        aria-label={`Toggle ${rule.name}`}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          rule.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
        } ${busy ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            rule.enabled ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </li>
  );
}

export function Popup() {
  const { rules, loading, activeCount } = useRules();

  return (
    <div className="flex min-w-[340px] flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <div>
          <h1 className="text-base font-semibold">Requestly Clone</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {activeCount} of {rules.length} rule{rules.length === 1 ? "" : "s"} active
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={openDashboard}
            className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Manage
          </button>
        </div>
      </header>

      {loading ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : rules.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No rules yet.</p>
          <button
            type="button"
            onClick={openDashboard}
            className="mt-2 text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </ul>
      )}
    </div>
  );
}
