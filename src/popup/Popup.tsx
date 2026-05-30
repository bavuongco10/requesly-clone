import { useState } from "react";
import { toggleRule } from "../storage/store";
import type { Rule, RuleType } from "../types/rules";
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
    <li className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{rule.name}</p>
        <p className="text-xs text-gray-500">{TYPE_LABELS[rule.type]}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={rule.enabled}
        aria-label={`Toggle ${rule.name}`}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          rule.enabled ? "bg-emerald-500" : "bg-gray-300"
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
    <div className="flex min-w-[340px] flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Requestly Clone</h1>
          <p className="text-xs text-gray-500">
            {activeCount} of {rules.length} rule{rules.length === 1 ? "" : "s"} active
          </p>
        </div>
        <button
          type="button"
          onClick={openDashboard}
          className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700"
        >
          Manage
        </button>
      </header>

      {loading ? (
        <p className="px-3 py-6 text-center text-sm text-gray-500">Loading…</p>
      ) : rules.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-gray-500">No rules yet.</p>
          <button
            type="button"
            onClick={openDashboard}
            className="mt-2 text-sm font-medium text-emerald-600 hover:underline"
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </ul>
      )}
    </div>
  );
}
