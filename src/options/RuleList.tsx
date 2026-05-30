// Rule list grouped by rule group.
//
// Rules with a `groupId` are listed under their group's name; the rest fall
// under "Ungrouped". Each row shows the name, a type badge, an enabled toggle
// (persisted via toggleRule), and Edit / Delete actions. All user-authored
// strings render as plain React text — never via dangerouslySetInnerHTML.

import { useState } from "react";
import { deleteRule, toggleRule } from "../storage/store";
import type { Rule, RuleGroup } from "../types/rules";
import { TYPE_LABELS } from "./draft";

interface RuleListProps {
  rules: Rule[];
  groups: RuleGroup[];
  onEdit: (rule: Rule) => void;
  reload: () => Promise<void> | void;
}

function conditionSummary(rule: Rule): string {
  return rule.condition.urlFilter ?? rule.condition.regexFilter ?? "(any URL)";
}

function RuleRow({
  rule,
  onEdit,
  reload,
}: {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  reload: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  const onToggle = async () => {
    setBusy(true);
    try {
      await toggleRule(rule.id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteRule(rule.id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{rule.name}</p>
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
            {TYPE_LABELS[rule.type]}
          </span>
        </div>
        <p className="truncate text-xs text-gray-500">{conditionSummary(rule)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
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
        <button
          type="button"
          onClick={() => onEdit(rule)}
          aria-label={`Edit ${rule.name}`}
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${rule.name}`}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

export function RuleList({ rules, groups, onEdit, reload }: RuleListProps) {
  if (rules.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-gray-500">No rules match.</p>;
  }

  const groupName = new Map(groups.map((g) => [g.id, g.name] as const));
  // Buckets keyed by group id; "" is the Ungrouped bucket.
  const buckets = new Map<string, Rule[]>();
  for (const rule of rules) {
    const key = rule.groupId && groupName.has(rule.groupId) ? rule.groupId : "";
    const list = buckets.get(key);
    if (list) list.push(rule);
    else buckets.set(key, [rule]);
  }

  // Stable order: named groups first (in group order), then Ungrouped last.
  const sections: { key: string; label: string }[] = [];
  for (const g of groups) {
    if (buckets.has(g.id)) sections.push({ key: g.id, label: g.name });
  }
  if (buckets.has("")) sections.push({ key: "", label: "Ungrouped" });

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div
          key={section.key || "ungrouped"}
          className="rounded-lg border border-gray-200 bg-white"
        >
          <h3 className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {section.label}
          </h3>
          <ul className="divide-y divide-gray-100">
            {(buckets.get(section.key) ?? []).map((rule) => (
              <RuleRow key={rule.id} rule={rule} onEdit={onEdit} reload={reload} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
