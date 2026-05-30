import { beforeEach, describe, expect, it, type vi } from "vitest";
import { applyInjection, injectRulesForUrl, syncDynamicRules } from "../../src/engine/sync";
import { addRule } from "../../src/storage/store";
import type { BlockRule, InjectRule, RedirectRule } from "../../src/types/rules";

beforeEach(async () => {
  await chrome.storage.local.clear();
});

describe("syncDynamicRules", () => {
  it("removes existing dynamic rules and adds freshly built ones", async () => {
    await addRule({
      name: "block ads",
      type: "block",
      enabled: true,
      condition: { urlFilter: "||ads.test" },
    } as Omit<BlockRule, "id" | "createdAt" | "updatedAt">);
    await addRule({
      name: "redirect",
      type: "redirect",
      enabled: true,
      condition: { urlFilter: "||a.test" },
      redirect: { url: "https://b.test/" },
    } as Omit<RedirectRule, "id" | "createdAt" | "updatedAt">);

    // Pretend two stale dynamic rules already exist.
    (
      chrome.declarativeNetRequest.getDynamicRules as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce([{ id: 100 }, { id: 101 }]);

    await syncDynamicRules();

    const update = chrome.declarativeNetRequest.updateDynamicRules as ReturnType<typeof vi.fn>;
    expect(update).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0];
    expect(arg.removeRuleIds).toEqual([100, 101]);
    expect(arg.addRules).toHaveLength(2);
    expect(new Set(arg.addRules.map((r: { id: number }) => r.id)).size).toBe(2);
  });

  it("excludes inject rules from the dNR set", async () => {
    await addRule({
      name: "inject",
      type: "inject",
      enabled: true,
      condition: { urlFilter: "||a.test" },
      injection: { language: "js", code: "console.log(1)" },
    } as Omit<InjectRule, "id" | "createdAt" | "updatedAt">);

    await syncDynamicRules();
    const update = chrome.declarativeNetRequest.updateDynamicRules as ReturnType<typeof vi.fn>;
    expect(update.mock.calls[0][0].addRules).toHaveLength(0);
  });
});

describe("injectRulesForUrl", () => {
  it("returns only enabled inject rules whose condition matches", async () => {
    await addRule({
      name: "match",
      type: "inject",
      enabled: true,
      condition: { urlFilter: "||example.com" },
      injection: { language: "css", code: "body{}" },
    } as Omit<InjectRule, "id" | "createdAt" | "updatedAt">);
    await addRule({
      name: "disabled",
      type: "inject",
      enabled: false,
      condition: { urlFilter: "||example.com" },
      injection: { language: "css", code: "body{}" },
    } as Omit<InjectRule, "id" | "createdAt" | "updatedAt">);
    await addRule({
      name: "other-host",
      type: "inject",
      enabled: true,
      condition: { urlFilter: "||other.com" },
      injection: { language: "css", code: "body{}" },
    } as Omit<InjectRule, "id" | "createdAt" | "updatedAt">);

    const matches = await injectRulesForUrl("https://example.com/page");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("match");
  });
});

describe("applyInjection", () => {
  it("uses insertCSS for css rules", async () => {
    const rule = {
      id: "x",
      name: "css",
      type: "inject",
      enabled: true,
      condition: {},
      injection: { language: "css", code: "body{color:red}" },
      createdAt: 1,
      updatedAt: 1,
    } as InjectRule;
    await applyInjection(5, rule);
    const insertCSS = chrome.scripting.insertCSS as ReturnType<typeof vi.fn>;
    expect(insertCSS).toHaveBeenCalledWith({ target: { tabId: 5 }, css: "body{color:red}" });
  });

  it("uses executeScript for js rules and passes code as an arg (no eval/innerHTML)", async () => {
    const rule = {
      id: "y",
      name: "js",
      type: "inject",
      enabled: true,
      condition: {},
      injection: { language: "js", code: "console.log(42)" },
      createdAt: 1,
      updatedAt: 1,
    } as InjectRule;
    await applyInjection(7, rule);
    const exec = chrome.scripting.executeScript as ReturnType<typeof vi.fn>;
    const arg = exec.mock.calls[0][0];
    expect(arg.target).toEqual({ tabId: 7 });
    expect(arg.args).toEqual(["console.log(42)"]);
    expect(typeof arg.func).toBe("function");
    // The injected function must not use eval or innerHTML.
    const src = arg.func.toString();
    expect(src).not.toMatch(/eval|innerHTML/);
    expect(src).toMatch(/textContent/);
  });
});
