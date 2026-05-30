// Rule group management: create a group by name, delete an existing group.
//
// Deleting a group detaches its rules (the storage layer sets their groupId to
// undefined) rather than deleting them.

import { useState } from "react";
import { addGroup, deleteGroup } from "../storage/store";
import type { RuleGroup } from "../types/rules";

interface GroupManagerProps {
  groups: RuleGroup[];
  reload: () => Promise<void> | void;
}

export function GroupManager({ groups, reload }: GroupManagerProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await addGroup(trimmed);
      setName("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteGroup(id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Rule groups"
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-gray-900">Groups</h2>

      <div className="flex gap-2">
        <input
          type="text"
          aria-label="New group name"
          placeholder="New group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onAdd();
          }}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={busy || name.trim().length === 0}
          className="rounded bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          Add group
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-gray-400">No groups yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-gray-700">{g.name}</span>
              <button
                type="button"
                onClick={() => onDelete(g.id)}
                disabled={busy}
                aria-label={`Delete group ${g.name}`}
                className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
