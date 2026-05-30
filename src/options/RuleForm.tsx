// Create / edit form for a single rule.
//
// Holds a flat `RuleDraft` in state, renders the type picker, name/enabled,
// group assignment, the shared ConditionFields, and the per-type TypeFields.
// On save it validates via `draftToRuleInput`, then persists through the
// storage layer (addRule for new, updateRule for edit) and asks the parent to
// reload + close.

import { useState } from "react";
import { addRule, updateRule } from "../storage/store";
import type { Rule, RuleGroup, RuleType } from "../types/rules";
import { RULE_TYPES, TYPE_LABELS, draftToRuleInput, emptyDraft, ruleToDraft } from "./draft";
import type { RuleDraft } from "./draft";
import { ConditionFields } from "./forms/ConditionFields";
import { TypeFields } from "./forms/TypeFields";

interface RuleFormProps {
  /** The rule being edited, or null when creating a new one. */
  editing: Rule | null;
  groups: RuleGroup[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

export function RuleForm({ editing, groups, onSaved, onCancel }: RuleFormProps) {
  const [draft, setDraft] = useState<RuleDraft>(() =>
    editing ? ruleToDraft(editing) : emptyDraft("redirect"),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (p: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...p }));

  const onSave = async () => {
    const result = draftToRuleInput(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        // `type` is immutable on update; the storage patch type omits it.
        const { type: _type, ...patchInput } = result.input;
        await updateRule(editing.id, patchInput);
      } else {
        await addRule(result.input);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={editing ? "Edit rule" : "Create rule"}
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {editing ? "Edit rule" : "New rule"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Name</span>
          <input
            type="text"
            aria-label="Rule name"
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Type</span>
          <select
            aria-label="Rule type"
            value={draft.type}
            disabled={editing !== null}
            onChange={(e) => {
              // Switching type resets type-specific fields but keeps name/condition.
              const next = e.target.value as RuleType;
              setDraft((d) => ({ ...emptyDraft(next), ...carryOver(d) }));
            }}
            className="rounded border border-gray-300 px-2 py-1 disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700"
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          Enabled
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Group</span>
          <select
            aria-label="Rule group"
            value={draft.groupId}
            onChange={(e) => patch({ groupId: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ConditionFields draft={draft} onChange={patch} />
      <TypeFields draft={draft} onChange={patch} />

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {editing ? "Save changes" : "Create rule"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}

/** Fields preserved when the user switches rule type mid-create. */
function carryOver(d: RuleDraft): Partial<RuleDraft> {
  return {
    name: d.name,
    enabled: d.enabled,
    groupId: d.groupId,
    matchKind: d.matchKind,
    urlFilter: d.urlFilter,
    regexFilter: d.regexFilter,
    caseSensitive: d.caseSensitive,
    domains: d.domains,
    excludedDomains: d.excludedDomains,
    resourceTypes: d.resourceTypes,
    requestMethods: d.requestMethods,
  };
}
