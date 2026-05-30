import { beforeEach, describe, expect, it } from "vitest";
import {
  addGroup,
  addRule,
  allocateDnrId,
  deleteGroup,
  deleteRule,
  exportAll,
  getGroups,
  getRules,
  getState,
  importAll,
  subscribe,
  toggleRule,
  updateRule,
} from "../../src/storage/store";
import type { BlockRule, RedirectRule, RuleExport } from "../../src/types/rules";

type RedirectInput = Omit<RedirectRule, "id" | "createdAt" | "updatedAt">;
type BlockInput = Omit<BlockRule, "id" | "createdAt" | "updatedAt">;

function redirectInput(name = "r1"): RedirectInput {
  return {
    name,
    type: "redirect",
    enabled: true,
    condition: { urlFilter: "||example.com" },
    redirect: { url: "https://b.test/" },
  };
}

function blockInput(name = "b1"): BlockInput {
  return {
    name,
    type: "block",
    enabled: true,
    condition: { urlFilter: "||ads.test" },
  };
}

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("storage: default state", () => {
  it("returns empty defaults when nothing is stored", async () => {
    const state = await getState();
    expect(state.rules).toEqual([]);
    expect(state.groups).toEqual([]);
    expect(state.nextDnrId).toBe(1);
  });
});

describe("storage: rules CRUD", () => {
  it("adds a rule with generated id and timestamps", async () => {
    const rule = await addRule(redirectInput());
    expect(rule.id).toBeTruthy();
    expect(rule.createdAt).toBeGreaterThan(0);
    expect(rule.updatedAt).toBe(rule.createdAt);
    const rules = await getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(rule.id);
  });

  it("updates a rule and refreshes updatedAt", async () => {
    const rule = await addRule(redirectInput());
    const updated = await updateRule(rule.id, { name: "renamed", enabled: false });
    expect(updated.name).toBe("renamed");
    expect(updated.enabled).toBe(false);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(rule.createdAt);
    expect(updated.type).toBe("redirect");
  });

  it("throws when updating an unknown id", async () => {
    await expect(updateRule("nope", { name: "x" })).rejects.toThrow(/unknown rule id/);
  });

  it("deletes a rule by id", async () => {
    const a = await addRule(redirectInput("a"));
    const b = await addRule(blockInput("b"));
    await deleteRule(a.id);
    const rules = await getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(b.id);
  });

  it("toggles a rule's enabled flag", async () => {
    const rule = await addRule(redirectInput());
    expect(rule.enabled).toBe(true);
    const next = await toggleRule(rule.id);
    expect(next).toBe(false);
    const rules = await getRules();
    expect(rules[0].enabled).toBe(false);
  });

  it("throws when toggling an unknown id", async () => {
    await expect(toggleRule("nope")).rejects.toThrow(/unknown rule id/);
  });
});

describe("storage: groups", () => {
  it("adds and lists groups", async () => {
    const g = await addGroup("My group");
    expect(g.id).toBeTruthy();
    expect(g.enabled).toBe(true);
    const groups = await getGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("My group");
  });

  it("detaches rules when their group is deleted", async () => {
    const group = await addGroup("g");
    const rule = await addRule({ ...redirectInput(), groupId: group.id });
    expect(rule.groupId).toBe(group.id);
    await deleteGroup(group.id);
    const rules = await getRules();
    expect(rules[0].groupId).toBeUndefined();
    expect(await getGroups()).toHaveLength(0);
  });
});

describe("storage: dNR id allocator", () => {
  it("allocates monotonic unique ids", async () => {
    const a = await allocateDnrId();
    const b = await allocateDnrId();
    const c = await allocateDnrId();
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("persists the counter across reads", async () => {
    await allocateDnrId();
    const state = await getState();
    expect(state.nextDnrId).toBe(2);
  });
});

describe("storage: import / export", () => {
  it("round-trips rules and groups", async () => {
    const group = await addGroup("g");
    await addRule({ ...redirectInput("keep"), groupId: group.id });
    const exported = await exportAll();
    expect(exported.version).toBe(1);
    expect(exported.rules).toHaveLength(1);
    expect(exported.groups).toHaveLength(1);
  });

  it("imports with fresh ids to avoid collisions", async () => {
    const existing = await addRule(redirectInput("existing"));
    const envelope: RuleExport = {
      version: 1,
      exportedAt: Date.now(),
      rules: [{ ...existing, name: "imported" }],
      groups: [],
    };
    const count = await importAll(envelope);
    expect(count).toBe(1);
    const rules = await getRules();
    expect(rules).toHaveLength(2);
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(2); // no id collision
  });

  it("rejects an unsupported export version", async () => {
    const bad = { version: 2, exportedAt: 0, rules: [], groups: [] } as unknown as RuleExport;
    await expect(importAll(bad)).rejects.toThrow(/unsupported export version/);
  });
});

describe("storage: change subscription", () => {
  it("notifies subscribers on state change and unsubscribes cleanly", async () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls += 1;
    });
    // Simulate chrome firing onChanged for our key.
    const evt = chrome.storage.onChanged as unknown as {
      _emit: (changes: unknown, area: string) => void;
    };
    evt._emit(
      { requestly_clone_state: { newValue: { rules: [], groups: [], nextDnrId: 1 } } },
      "local",
    );
    expect(calls).toBe(1);
    evt._emit({ other_key: { newValue: 1 } }, "local");
    expect(calls).toBe(1); // unrelated key ignored
    unsubscribe();
    evt._emit(
      { requestly_clone_state: { newValue: { rules: [], groups: [], nextDnrId: 1 } } },
      "local",
    );
    expect(calls).toBe(1); // no longer subscribed
  });
});
