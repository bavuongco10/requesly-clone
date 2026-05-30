import { describe, expect, it } from "vitest";

describe("scaffold smoke test", () => {
  it("has the chrome mock wired up", () => {
    expect(chrome).toBeDefined();
    expect(chrome.storage.local).toBeDefined();
    expect(chrome.declarativeNetRequest.updateDynamicRules).toBeTypeOf("function");
  });
});
