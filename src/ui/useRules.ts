// Shared React hook for reading rules from storage and staying in sync.
//
// Both the popup and the options dashboard use this so they never reimplement
// persistence. It loads the current rules/groups once, then subscribes to
// storage changes so the UI updates live when rules are edited anywhere
// (including from the other surface or an import).

import { useCallback, useEffect, useState } from "react";
import { getGroups, getRules, subscribe } from "../storage/store";
import type { Rule, RuleGroup } from "../types/rules";

export interface UseRulesResult {
  rules: Rule[];
  groups: RuleGroup[];
  loading: boolean;
  /** Count of enabled rules — handy for the popup's active-rule badge. */
  activeCount: number;
  /** Force a reload from storage (e.g. after a mutation in the same view). */
  reload: () => Promise<void>;
}

export function useRules(): UseRulesResult {
  const [rules, setRules] = useState<Rule[]>([]);
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [r, g] = await Promise.all([getRules(), getGroups()]);
    setRules(r);
    setGroups(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    // Live updates: re-read whenever the store changes.
    const unsubscribe = subscribe((state) => {
      setRules(state.rules);
      setGroups(state.groups);
    });
    return unsubscribe;
  }, [reload]);

  const activeCount = rules.reduce((n, r) => (r.enabled ? n + 1 : n), 0);

  return { rules, groups, loading, activeCount, reload };
}
