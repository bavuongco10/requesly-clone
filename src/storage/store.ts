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
 * Import rules/groups from an export envelope. Fresh UI ids are assigned to
 * avoid collisions with existing rules, and timestamps are refreshed.
 * Returns the number of rules imported.
 */
export async function importAll(data: RuleExport): Promise<number> {
  if (data.version !== 1) {
    throw new Error(`importAll: unsupported export version ${data.version}`);
  }
  const state = await getState();
  const ts = now();
  for (const g of data.groups) {
    state.groups.push({ ...g, id: newId(), createdAt: ts, updatedAt: ts });
  }
  for (const r of data.rules) {
    state.rules.push({ ...r, id: newId(), createdAt: ts, updatedAt: ts });
  }
  await setState(state);
  return data.rules.length;
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
