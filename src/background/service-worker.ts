// MV3 background service worker. Ephemeral — no durable module state; all
// durable state lives in chrome.storage.local. This file only wires browser
// events to the engine's sync/inject helpers.

import { injectForTab, syncDynamicRules } from "../engine/sync";

/** Recompute dNR dynamic rules from storage; log (don't throw) on failure. */
function resync(): void {
  syncDynamicRules().catch((err) => {
    console.error("[requestly-clone] dNR sync failed:", err);
  });
}

// Sync on install/update and on every browser startup.
chrome.runtime.onInstalled.addListener(resync);
chrome.runtime.onStartup.addListener(resync);

// Re-sync whenever the rule store changes (UI edits, imports, toggles).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.requestly_clone_state) resync();
});

// Apply JS/CSS injection rules when a tab finishes loading a page.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!/^https?:/.test(tab.url)) return; // skip chrome://, about:, etc.
  injectForTab(tabId, tab.url).catch((err) => {
    console.error("[requestly-clone] injection failed:", err);
  });
});
