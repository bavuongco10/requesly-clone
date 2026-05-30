// MV3 background service worker. Ephemeral — no durable module state.
// Feature wiring (dNR sync, injection) is added by @extension-engine.

chrome.runtime.onInstalled.addListener(() => {
  // Scaffold: engine sync hooks are attached in a later feature.
});

export {};
