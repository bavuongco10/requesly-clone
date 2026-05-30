// Dynamic editor for a list of HeaderOperation rows (request or response).
//
// Used by the modifyHeaders rule form. Each row binds header name, an operation
// (set/remove/append), and a value (disabled for "remove" since it's ignored).

import type { HeaderOperation } from "../../types/rules";

interface HeaderOpsEditorProps {
  label: string;
  ops: HeaderOperation[];
  onChange: (ops: HeaderOperation[]) => void;
}

const OPERATIONS: HeaderOperation["operation"][] = ["set", "append", "remove"];

export function HeaderOpsEditor({ label, ops, onChange }: HeaderOpsEditorProps) {
  const update = (index: number, patch: Partial<HeaderOperation>) => {
    onChange(ops.map((op, i) => (i === index ? { ...op, ...patch } : op)));
  };
  const remove = (index: number) => {
    onChange(ops.filter((_, i) => i !== index));
  };
  const add = () => {
    onChange([...ops, { header: "", operation: "set", value: "" }]);
  };

  return (
    <fieldset className="rounded border border-gray-200 p-3">
      <legend className="px-1 text-xs font-medium text-gray-600">{label}</legend>
      {ops.length === 0 ? (
        <p className="text-xs text-gray-400">No operations yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ops.map((op, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and reorderable only via add/remove
            <li key={index} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                aria-label={`${label} header name ${index + 1}`}
                placeholder="Header name"
                value={op.header}
                onChange={(e) => update(index, { header: e.target.value })}
                className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <select
                aria-label={`${label} operation ${index + 1}`}
                value={op.operation}
                onChange={(e) =>
                  update(index, { operation: e.target.value as HeaderOperation["operation"] })
                }
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {OPERATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <input
                type="text"
                aria-label={`${label} value ${index + 1}`}
                placeholder="Value"
                value={op.value ?? ""}
                disabled={op.operation === "remove"}
                onChange={(e) => update(index, { value: e.target.value })}
                className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${label} operation ${index + 1}`}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        Add {label.toLowerCase()}
      </button>
    </fieldset>
  );
}
