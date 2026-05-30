// Typed persistence layer over chrome.storage.local.
//
// This is the SINGLE source of truth for durable state. The service worker is
// ephemeral, so nothing durable lives in module variables — everything goes
// through here. Both the engine and the UI read/write rules via this module.

import type { Rule, RuleExport, RuleGroup, RuleStoreState } from "../types/rules";

const STORAGE_KEY = "requestly_clone_state";

/** dNR dynamic-rule ids must be unique positive integers; start the allocator here. */
const FIRST_DNR_ID = 1;

export const DEFAULT_STATE: RuleStoreState = {
  rules: [],
  groups: [],
  nextDnrId: FIRST_DNR_ID,
};

function now(): number {
  return Date.now();
}

function newId(): string {
  // crypto.randomUUID is available in MV3 service workers and modern DOM.
  return crypto.randomUUID();
}

/** Read the entire persisted state, falling back to defaults. */
export async function getState(): Promise<RuleStoreState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<RuleStoreState> | undefined;
  if (!stored) {
    // Fresh arrays each call — never alias the shared DEFAULT_STATE arrays.
    return { rules: [], groups: [], nextDnrId: FIRST_DNR_ID };
  }
  return {
    rules: stored.rules ?? [],
    groups: stored.groups ?? [],
    nextDnrId: stored.nextDnrId ?? FIRST_DNR_ID,
  };
}

/** Overwrite the entire persisted state. */
export async function setState(state: RuleStoreState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// ---- Rules CRUD ---------------------------------------------------------

export async function getRules(): Promise<Rule[]> {
  return (await getState()).rules;
}

/**
 * Add a rule. Caller supplies everything except id/timestamps, which are
 * generated here. Returns the created rule.
 */
export async function addRule(input: Omit<Rule, "id" | "createdAt" | "updatedAt">): Promise<Rule> {
  const state = await getState();
  const ts = now();
  const rule = {
    ...input,
    id: newId(),
    createdAt: ts,
    updatedAt: ts,
  } as Rule;
  state.rules.push(rule);
  await setState(state);
  return rule;
}

/**
 * Patch an existing rule by id. `updatedAt` is refreshed automatically.
 * Throws if the id is unknown. Returns the updated rule.
 */
export async function updateRule(
  id: string,
  patch: Partial<Omit<Rule, "id" | "type" | "createdAt">>,
): Promise<Rule> {
  const state = await getState();
  const idx = state.rules.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`updateRule: unknown rule id "${id}"`);
  const merged = {
    ...state.rules[idx],
    ...patch,
    id,
    type: state.rules[idx].type,
    updatedAt: now(),
  } as Rule;
  state.rules[idx] = merged;
  await setState(state);
  return merged;
}

/** Delete a rule by id. No-op if it doesn't exist. */
export async function deleteRule(id: string): Promise<void> {
  const state = await getState();
  state.rules = state.rules.filter((r) => r.id !== id);
  await setState(state);
}

/** Flip a rule's enabled flag. Returns the new enabled value. */
export async function toggleRule(id: string): Promise<boolean> {
  const state = await getState();
  const rule = state.rules.find((r) => r.id === id);
  if (!rule) throw new Error(`toggleRule: unknown rule id "${id}"`);
  rule.enabled = !rule.enabled;
  rule.updatedAt = now();
  await setState(state);
  return rule.enabled;
}

// ---- Groups CRUD --------------------------------------------------------

export async function getGroups(): Promise<RuleGroup[]> {
  return (await getState()).groups;
}

export async function addGroup(name: string): Promise<RuleGroup> {
  const state = await getState();
  const ts = now();
  const group: RuleGroup = {
    id: newId(),
    name,
    enabled: true,
    createdAt: ts,
    updatedAt: ts,
  };
  state.groups.push(group);
  await setState(state);
  return group;
}

export async function deleteGroup(id: string): Promise<void> {
  const state = await getState();
  state.groups = state.groups.filter((g) => g.id !== id);
  // Detach rules that belonged to the deleted group.
  for (const r of state.rules) {
    if (r.groupId === id) r.groupId = undefined;
  }
  await setState(state);
}

// ---- dNR id allocator ---------------------------------------------------

/**
 * Allocate the next unique dNR integer id, persisting the bumped counter.
 * The counter is monotonic and never reused within a store's lifetime.
 */
export async function allocateDnrId(): Promise<number> {
  const state = await getState();
  const id = state.nextDnrId;
  state.nextDnrId = id + 1;
  await setState(state);
  return id;
}

// ---- Import / export ----------------------------------------------------

const VALID_RULE_TYPES: ReadonlySet<string> = new Set<string>([
  "redirect",
  "modifyHeaders",
  "block",
  "replace",
  "mock",
  "inject",
]);

/**
 * Validate one untrusted imported object as a Rule. Imported JSON is fully
 * untrusted, so we reject anything whose `type` is unknown or whose required
 * shape per type is missing/malformed before it can reach storage or the dNR
 * engine. Returns true only for a structurally sound rule.
 */
function isValidImportedRule(value: unknown): value is Rule {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.type !== "string" || !VALID_RULE_TYPES.has(r.type)) return false;
  if (typeof r.name !== "string") return false;
  if (typeof r.enabled !== "boolean") return false;
  if (typeof r.condition !== "object" || r.condition === null) return false;

  switch (r.type) {
    case "redirect":
      return typeof r.redirect === "object" && r.redirect !== null;
    case "replace":
      return typeof r.from === "string" && typeof r.to === "string";
    case "mock": {
      const m = r.mock as Record<string, unknown> | undefined;
      return (
        typeof m === "object" &&
        m !== null &&
        typeof m.body === "string" &&
        typeof m.contentType === "string" &&
        typeof m.statusCode === "number"
      );
    }
    case "inject": {
      const inj = r.injection as Record<string, unknown> | undefined;
      return (
        typeof inj === "object" &&
        inj !== null &&
        (inj.language === "js" || inj.language === "css") &&
        typeof inj.code === "string"
      );
    }
    case "modifyHeaders":
    case "block":
      return true;
    default:
      return false;
  }
}

function isValidImportedGroup(value: unknown): value is RuleGroup {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return typeof g.name === "string" && typeof g.enabled === "boolean";
}

/** Build a JSON-serializable export envelope of all rules + groups. */
export async function exportAll(): Promise<RuleExport> {
  const state = await getState();
  return {
    version: 1,
    exportedAt: now(),
    rules: state.rules,
    groups: state.groups,
  };
}

/**
 * Import rules/groups from an export envelope. Untrusted input is validated
 * per item — unknown rule types and malformed shapes are dropped, not
 * persisted. Fresh UI ids are assigned to avoid collisions and timestamps are
 * refreshed. Returns the number of rules actually imported.
 */
export async function importAll(data: RuleExport): Promise<number> {
  if (!data || data.version !== 1) {
    throw new Error(`importAll: unsupported export version ${data?.version}`);
  }
  if (!Array.isArray(data.rules) || !Array.isArray(data.groups)) {
    throw new Error("importAll: malformed envelope (rules/groups must be arrays)");
  }
  const state = await getState();
  const ts = now();
  for (const g of data.groups) {
    if (!isValidImportedGroup(g)) continue;
    state.groups.push({ ...g, id: newId(), createdAt: ts, updatedAt: ts });
  }
  let imported = 0;
  for (const r of data.rules) {
    if (!isValidImportedRule(r)) continue;
    state.rules.push({ ...r, id: newId(), createdAt: ts, updatedAt: ts });
    imported += 1;
  }
  await setState(state);
  return imported;
}

// ---- Change subscription ------------------------------------------------

export type StateListener = (state: RuleStoreState) => void;

/**
 * Subscribe to state changes. Fires whenever the store key changes in
 * chrome.storage.local. Returns an unsubscribe function.
 */
export function subscribe(listener: StateListener): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "local") return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    listener((change.newValue as RuleStoreState) ?? { ...DEFAULT_STATE });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
