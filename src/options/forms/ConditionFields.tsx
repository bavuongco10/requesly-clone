// Shared condition editor: when does this rule match?
//
// Every rule type has a RuleCondition. The user picks URL-filter vs regex
// matching, optionally narrows by domains and (in a collapsible) by resource
// types / HTTP methods.

import type { RequestMethod, ResourceType } from "../../types/rules";
import { REQUEST_METHODS, RESOURCE_TYPES } from "../draft";
import type { RuleDraft } from "../draft";

interface ConditionFieldsProps {
  draft: RuleDraft;
  onChange: (patch: Partial<RuleDraft>) => void;
}

export function ConditionFields({ draft, onChange }: ConditionFieldsProps) {
  const toggleResource = (rt: ResourceType) => {
    const has = draft.resourceTypes.includes(rt);
    onChange({
      resourceTypes: has
        ? draft.resourceTypes.filter((x) => x !== rt)
        : [...draft.resourceTypes, rt],
    });
  };
  const toggleMethod = (m: RequestMethod) => {
    const has = draft.requestMethods.includes(m);
    onChange({
      requestMethods: has
        ? draft.requestMethods.filter((x) => x !== m)
        : [...draft.requestMethods, m],
    });
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-700">Condition</legend>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="matchKind"
            checked={draft.matchKind === "url"}
            onChange={() => onChange({ matchKind: "url" })}
          />
          URL filter
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="matchKind"
            checked={draft.matchKind === "regex"}
            onChange={() => onChange({ matchKind: "regex" })}
          />
          Regex filter
        </label>
      </div>

      {draft.matchKind === "url" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">URL filter</span>
          <input
            type="text"
            aria-label="URL filter"
            placeholder="||example.com/api"
            value={draft.urlFilter}
            onChange={(e) => onChange({ urlFilter: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Regex filter</span>
          <input
            type="text"
            aria-label="Regex filter"
            placeholder="^https://example\\.com/(.*)$"
            value={draft.regexFilter}
            onChange={(e) => onChange({ regexFilter: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 font-mono"
          />
        </label>
      )}

      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={draft.caseSensitive}
          onChange={(e) => onChange({ caseSensitive: e.target.checked })}
        />
        Case sensitive
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Domains (comma-separated)</span>
          <input
            type="text"
            aria-label="Domains"
            placeholder="example.com, api.example.com"
            value={draft.domains}
            onChange={(e) => onChange({ domains: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-600">Excluded domains</span>
          <input
            type="text"
            aria-label="Excluded domains"
            placeholder="ads.example.com"
            value={draft.excludedDomains}
            onChange={(e) => onChange({ excludedDomains: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-600">
          Resource types &amp; request methods (optional)
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Resource types</p>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map((rt) => (
                <label key={rt} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.resourceTypes.includes(rt)}
                    onChange={() => toggleResource(rt)}
                  />
                  {rt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Request methods</p>
            <div className="flex flex-wrap gap-2">
              {REQUEST_METHODS.map((m) => (
                <label key={m} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.requestMethods.includes(m)}
                    onChange={() => toggleMethod(m)}
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
      </details>
    </fieldset>
  );
}
