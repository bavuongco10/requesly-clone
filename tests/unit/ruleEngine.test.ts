import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAllDnrRules,
  buildDnrCondition,
  buildDnrRule,
  buildMockDataUrl,
  escapeRegex,
  sanitizeMockContentType,
} from "../../src/engine/ruleEngine";
import type {
  BlockRule,
  InjectRule,
  MockRule,
  ModifyHeadersRule,
  RedirectRule,
  ReplaceRule,
  Rule,
} from "../../src/types/rules";

let seq = 0;
function base<T extends Rule["type"]>(type: T, over: Partial<Rule> = {}) {
  seq += 1;
  return {
    id: `id-${seq}`,
    name: `rule-${seq}`,
    type,
    enabled: true,
    condition: { urlFilter: "||example.com" },
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

beforeEach(async () => {
  await chrome.storage.local.clear();
  seq = 0;
});

describe("escapeRegex", () => {
  it("escapes regex metacharacters", () => {
    expect(escapeRegex("/api/v1?x=.")).toBe("/api/v1\\?x=\\.");
    expect(escapeRegex("a+b(c)")).toBe("a\\+b\\(c\\)");
  });
});

describe("buildDnrCondition", () => {
  it("maps domains to requestDomains and excludedDomains to excludedRequestDomains", () => {
    const c = buildDnrCondition({
      urlFilter: "||x.com",
      domains: ["a.com"],
      excludedDomains: ["b.com"],
      resourceTypes: ["xmlhttprequest"],
      requestMethods: ["get", "post"],
    });
    expect(c.urlFilter).toBe("||x.com");
    expect(c.requestDomains).toEqual(["a.com"]);
    expect(c.excludedRequestDomains).toEqual(["b.com"]);
    expect(c.resourceTypes).toEqual(["xmlhttprequest"]);
    expect(c.requestMethods).toEqual(["get", "post"]);
  });

  it("defaults resourceTypes (incl. main_frame) when none are given, omits empty domain arrays", () => {
    const c = buildDnrCondition({ urlFilter: "||x.com", domains: [], resourceTypes: [] });
    expect(c.requestDomains).toBeUndefined();
    // No resourceTypes provided → full default set so page navigations match too.
    expect(c.resourceTypes).toContain("main_frame");
    expect(c.resourceTypes).toContain("xmlhttprequest");
    expect("regexFilter" in c).toBe(false);
  });
});

describe("buildDnrRule: redirect", () => {
  it("builds a static url redirect", () => {
    const rule = base("redirect", {
      redirect: { url: "https://b.test/" },
    }) as RedirectRule;
    const dnr = buildDnrRule(rule, 10);
    expect(dnr).not.toBeNull();
    expect(dnr?.id).toBe(10);
    expect(dnr?.priority).toBe(1);
    expect(dnr?.action.type).toBe("redirect");
    expect(dnr?.action.redirect?.url).toBe("https://b.test/");
  });

  it("builds a regexSubstitution redirect when regexFilter is present", () => {
    const rule = base("redirect", {
      condition: { regexFilter: "^https://a\\.test/(.*)$" },
      redirect: { regexSubstitution: "https://b.test/\\1" },
    }) as RedirectRule;
    const dnr = buildDnrRule(rule, 11);
    expect(dnr?.action.redirect?.regexSubstitution).toBe("https://b.test/\\1");
  });

  it("returns null for regexSubstitution without a regexFilter", () => {
    const rule = base("redirect", {
      condition: { urlFilter: "||a.test" },
      redirect: { regexSubstitution: "https://b.test/\\1" },
    }) as RedirectRule;
    expect(buildDnrRule(rule, 12)).toBeNull();
  });

  it("returns null for an empty redirect", () => {
    const rule = base("redirect", { redirect: {} }) as RedirectRule;
    expect(buildDnrRule(rule, 13)).toBeNull();
  });
});

describe("buildDnrRule: modifyHeaders", () => {
  it("builds request-only headers", () => {
    const rule = base("modifyHeaders", {
      requestHeaders: [{ header: "X-Test", operation: "set", value: "1" }],
    }) as ModifyHeadersRule;
    const dnr = buildDnrRule(rule, 20);
    expect(dnr?.action.type).toBe("modifyHeaders");
    expect(dnr?.action.requestHeaders).toEqual([
      { header: "X-Test", operation: "set", value: "1" },
    ]);
    expect(dnr?.action.responseHeaders).toBeUndefined();
  });

  it("builds response-only headers and omits value on remove", () => {
    const rule = base("modifyHeaders", {
      responseHeaders: [{ header: "Set-Cookie", operation: "remove" }],
    }) as ModifyHeadersRule;
    const dnr = buildDnrRule(rule, 21);
    expect(dnr?.action.requestHeaders).toBeUndefined();
    expect(dnr?.action.responseHeaders).toEqual([{ header: "Set-Cookie", operation: "remove" }]);
    expect(dnr?.action.responseHeaders?.[0]).not.toHaveProperty("value");
  });

  it("builds both request and response headers (append carries value)", () => {
    const rule = base("modifyHeaders", {
      requestHeaders: [{ header: "A", operation: "append", value: "x" }],
      responseHeaders: [{ header: "B", operation: "set", value: "y" }],
    }) as ModifyHeadersRule;
    const dnr = buildDnrRule(rule, 22);
    expect(dnr?.action.requestHeaders?.[0]).toEqual({
      header: "A",
      operation: "append",
      value: "x",
    });
    expect(dnr?.action.responseHeaders?.[0].value).toBe("y");
  });

  it("returns null when no header operations are present", () => {
    const rule = base("modifyHeaders", {}) as ModifyHeadersRule;
    expect(buildDnrRule(rule, 23)).toBeNull();
  });
});

describe("buildDnrRule: block", () => {
  it("builds a block action", () => {
    const rule = base("block") as BlockRule;
    const dnr = buildDnrRule(rule, 30);
    expect(dnr?.action.type).toBe("block");
  });
});

describe("buildDnrRule: replace", () => {
  it("escapes metacharacters in `from` and preserves surrounding URL", () => {
    const rule = base("replace", { from: "/api/v1?x=.", to: "/api/v2" }) as ReplaceRule;
    const dnr = buildDnrRule(rule, 40);
    expect(dnr?.condition.regexFilter).toBe("^(.*)/api/v1\\?x=\\.(.*)$");
    expect(dnr?.action.redirect?.regexSubstitution).toBe("\\1/api/v2\\2");
    // urlFilter is dropped in favor of regexFilter for a regex redirect.
    expect(dnr?.condition.urlFilter).toBeUndefined();
  });

  it("returns null for an empty `from`", () => {
    const rule = base("replace", { from: "", to: "x" }) as ReplaceRule;
    expect(buildDnrRule(rule, 41)).toBeNull();
  });
});

describe("buildDnrRule: mock", () => {
  it("encodes the body into a data: URL with the content type", () => {
    const rule = base("mock", {
      mock: { statusCode: 200, body: '{"a": "b c"}', contentType: "application/json" },
    }) as MockRule;
    const url = buildMockDataUrl(rule);
    expect(url).toBe(`data:application/json,${encodeURIComponent('{"a": "b c"}')}`);
    const dnr = buildDnrRule(rule, 50);
    expect(dnr?.action.type).toBe("redirect");
    expect(dnr?.action.redirect?.url).toBe(url);
  });
});

describe("sanitizeMockContentType", () => {
  it("passes through a safe mime type", () => {
    expect(sanitizeMockContentType("application/json")).toBe("application/json");
    expect(sanitizeMockContentType("TEXT/Plain")).toBe("text/plain");
  });

  it("downgrades active/markup types to text/plain", () => {
    expect(sanitizeMockContentType("text/html")).toBe("text/plain");
    expect(sanitizeMockContentType("image/svg+xml")).toBe("text/plain");
    expect(sanitizeMockContentType("application/xhtml+xml")).toBe("text/plain");
  });

  it("strips smuggled comma/semicolon segments and base64 directives", () => {
    expect(sanitizeMockContentType("application/json,<script>")).toBe("application/json");
    expect(sanitizeMockContentType("text/plain;base64")).toBe("text/plain");
    // A type that becomes text/html after stripping is still downgraded.
    expect(sanitizeMockContentType("text/html;charset=utf-8")).toBe("text/plain");
  });

  it("falls back to text/plain for malformed input", () => {
    expect(sanitizeMockContentType("")).toBe("text/plain");
    expect(sanitizeMockContentType("notamime")).toBe("text/plain");
  });
});

describe("buildDnrRule: replace escapes `to`", () => {
  it("escapes backslashes in `to` so it can't inject backreferences", () => {
    const rule = base("replace", { from: "/a", to: "/b\\1evil" }) as ReplaceRule;
    const dnr = buildDnrRule(rule, 70);
    // The user's backslash is escaped; only our own \1/\2 remain as backrefs.
    expect(dnr?.action.redirect?.regexSubstitution).toBe("\\1/b\\\\1evil\\2");
  });
});

describe("buildDnrRule: exclusions", () => {
  it("returns null for inject rules", () => {
    const rule = base("inject", {
      injection: { language: "js", code: "console.log(1)" },
    }) as InjectRule;
    expect(buildDnrRule(rule, 60)).toBeNull();
  });

  it("returns null for a disabled rule", () => {
    const rule = base("block", { enabled: false }) as BlockRule;
    expect(buildDnrRule(rule, 61)).toBeNull();
  });

  it("returns null when the condition is empty", () => {
    const rule = base("block", { condition: {} }) as BlockRule;
    expect(buildDnrRule(rule, 62)).toBeNull();
  });
});

describe("buildAllDnrRules", () => {
  it("assigns unique ids and skips disabled + inject rules", async () => {
    const rules: Rule[] = [
      base("block", { id: "a" }) as BlockRule,
      base("redirect", { id: "b", redirect: { url: "https://b.test/" } }) as RedirectRule,
      base("block", { id: "c", enabled: false }) as BlockRule,
      base("inject", { id: "d", injection: { language: "css", code: "body{}" } }) as InjectRule,
    ];
    const dnr = await buildAllDnrRules(rules);
    expect(dnr).toHaveLength(2);
    const ids = dnr.map((r) => r.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toEqual([1, 2]);
  });
});
