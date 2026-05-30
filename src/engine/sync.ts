// Sync layer: bridge stored rules to the live browser engines.
//
// - Network rules (redirect/headers/block/replace/mock) are pushed to
//   declarativeNetRequest as DYNAMIC rules. We replace the whole set on every
//   sync: read all existing dynamic rule ids, remove them, add the freshly
//   built ones. This keeps the live engine a pure function of stored state.
// - Inject rules (JS/CSS) are applied per navigation via chrome.scripting in
//   the service worker; this module exposes the matching + injection helper.

import { getRules } from "../storage/store";
import { type InjectRule, isInjectRule } from "../types/rules";
import { matchesCondition } from "./matcher";
import { buildAllDnrRules } from "./ruleEngine";

/**
 * Recompute dNR dynamic rules from stored rules and apply them, atomically
 * removing all previously-installed dynamic rules first. Safe to call on every
 * storage change.
 */
export async function syncDynamicRules(): Promise<void> {
  const rules = await getRules();
  const addRules = await buildAllDnrRules(rules);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

/** Enabled inject rules whose condition matches the given URL. */
export async function injectRulesForUrl(url: string): Promise<InjectRule[]> {
  const rules = await getRules();
  return rules.filter(
    (r): r is InjectRule => isInjectRule(r) && r.enabled && matchesCondition(url, r.condition),
  );
}

/**
 * Inject the JS or CSS of a single inject rule into a tab. CSS uses
 * chrome.scripting.insertCSS; JS is injected as a function that appends a
 * <script> with the user's code as a text node (never via innerHTML / eval),
 * so the code runs in the page without an HTML-injection sink.
 */
export async function applyInjection(tabId: number, rule: InjectRule): Promise<void> {
  const { language, code } = rule.injection;
  if (language === "css") {
    await chrome.scripting.insertCSS({ target: { tabId }, css: code });
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (source: string) => {
      const el = document.createElement("script");
      el.textContent = source;
      (document.head || document.documentElement).appendChild(el);
      el.remove();
    },
    args: [code],
  });
}

/** Apply every matching inject rule to a freshly-loaded tab. */
export async function injectForTab(tabId: number, url: string): Promise<void> {
  const rules = await injectRulesForUrl(url);
  for (const rule of rules) {
    try {
      await applyInjection(tabId, rule);
    } catch {
      // A tab can navigate away or be a restricted page (chrome://, store);
      // skip injection failures rather than crash the worker.
    }
  }
}
