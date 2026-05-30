import { describe, expect, it } from "vitest";
import { matchesCondition, urlFilterToRegExpSource } from "../../src/engine/matcher";

describe("urlFilterToRegExpSource", () => {
  it("treats * as a wildcard", () => {
    const re = new RegExp(urlFilterToRegExpSource("*://example.com/*"));
    expect(re.test("https://example.com/path")).toBe(true);
    expect(re.test("http://example.com/")).toBe(true);
  });

  it("anchors a domain with ||", () => {
    const re = new RegExp(urlFilterToRegExpSource("||example.com"));
    expect(re.test("https://example.com/x")).toBe(true);
    expect(re.test("https://sub.example.com/x")).toBe(true);
    expect(re.test("https://notexample.com/x")).toBe(false);
  });

  it("requires a host boundary after a || domain (no confusable-host match)", () => {
    const re = new RegExp(urlFilterToRegExpSource("||example.com"));
    // Must NOT match a different registrable domain that merely contains it.
    expect(re.test("https://example.com.evil.com/x")).toBe(false);
    expect(re.test("https://example.company.com/x")).toBe(false);
    // Still matches with a port, path, query, or fragment after the host.
    expect(re.test("https://example.com:8443/x")).toBe(true);
    expect(re.test("https://example.com?a=1")).toBe(true);
  });

  it("escapes literal regex metacharacters", () => {
    const re = new RegExp(urlFilterToRegExpSource("example.com/a.b"));
    expect(re.test("example.com/a.b")).toBe(true);
    expect(re.test("exampleXcom/aXb")).toBe(false);
  });
});

describe("matchesCondition", () => {
  it("matches when urlFilter matches", () => {
    expect(matchesCondition("https://example.com/api", { urlFilter: "||example.com" })).toBe(true);
  });

  it("rejects when urlFilter does not match", () => {
    expect(matchesCondition("https://other.com/", { urlFilter: "||example.com" })).toBe(false);
  });

  it("honors a regexFilter", () => {
    expect(matchesCondition("https://a.test/v1/x", { regexFilter: "/v1/" })).toBe(true);
    expect(matchesCondition("https://a.test/v2/x", { regexFilter: "/v1/" })).toBe(false);
  });

  it("requires an included domain", () => {
    expect(matchesCondition("https://example.com/", { domains: ["example.com"] })).toBe(true);
    expect(matchesCondition("https://other.com/", { domains: ["example.com"] })).toBe(false);
  });

  it("rejects an excluded domain even if the pattern matches", () => {
    expect(
      matchesCondition("https://sub.example.com/", {
        urlFilter: "||example.com",
        excludedDomains: ["example.com"],
      }),
    ).toBe(false);
  });

  it("matches subdomains for domain filters", () => {
    expect(matchesCondition("https://a.b.example.com/", { domains: ["example.com"] })).toBe(true);
  });

  it("returns false for an unparseable URL", () => {
    expect(matchesCondition("not a url", { urlFilter: "||example.com" })).toBe(false);
  });

  it("matches any URL when no pattern or domain is set", () => {
    expect(matchesCondition("https://anything.test/", {})).toBe(true);
  });
});
