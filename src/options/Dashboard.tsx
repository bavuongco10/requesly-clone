// Top-level options dashboard.
//
// Composes the search box, import/export, group manager, the rule list, and the
// create/edit form. Reads live rules+groups via the shared `useRules` hook and
// threads `reload` into children so the UI refreshes immediately after a
// mutation (the storage subscription also fires in a real browser; reload keeps
// tests deterministic where the mock doesn't emit change events).

import { useMemo, useState } from "react";
import type { Rule } from "../types/rules";
import { useRules } from "../ui/useRules";
import { GroupManager } from "./GroupManager";
import { ImportExport } from "./ImportExport";
import { RuleForm } from "./RuleForm";
import { RuleList } from "./RuleList";

type Editing = { mode: "create" } | { mode: "edit"; rule: Rule } | null;

function matchesQuery(rule: Rule, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (rule.name.toLowerCase().includes(q)) return true;
  const url = rule.condition.urlFilter?.toLowerCase() ?? "";
  const regex = rule.condition.regexFilter?.toLowerCase() ?? "";
  return url.includes(q) || regex.includes(q);
}

export function Dashboard() {
  const { rules, groups, loading, activeCount, reload } = useRules();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const filtered = useMemo(() => rules.filter((r) => matchesQuery(r, query)), [rules, query]);

  const onSaved = async () => {
    await reload();
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Requestly Clone</h1>
            <p className="text-sm text-gray-500">
              {activeCount} of {rules.length} rule{rules.length === 1 ? "" : "s"} active
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({ mode: "create" })}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            New rule
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-6">
        {editing ? (
          <RuleForm
            editing={editing.mode === "edit" ? editing.rule : null}
            groups={groups}
            onSaved={onSaved}
            onCancel={() => setEditing(null)}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ImportExport reload={reload} />
          <GroupManager groups={groups} reload={reload} />
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="search"
            aria-label="Search rules"
            placeholder="Search by name or URL filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">Loading…</p>
          ) : rules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-10 text-center">
              <p className="text-sm text-gray-500">No rules yet.</p>
              <button
                type="button"
                onClick={() => setEditing({ mode: "create" })}
                className="mt-2 text-sm font-medium text-emerald-600 hover:underline"
              >
                Create your first rule
              </button>
            </div>
          ) : (
            <RuleList
              rules={filtered}
              groups={groups}
              onEdit={(rule) => setEditing({ mode: "edit", rule })}
              reload={reload}
            />
          )}
        </div>
      </main>
    </div>
  );
}
