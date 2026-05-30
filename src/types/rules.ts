// Shared rule data model for the Requestly clone.
//
// Mental model (Requestly-style): every rule has a TYPE, a CONDITION (when it
// matches), a type-specific ACTION payload, and an ENABLED flag. The engine
// (src/background) converts these into declarativeNetRequest dynamic rules; the
// UI (src/popup, src/options) reads/writes them through the storage layer.
//
// This file is the single source of truth for both sides — do NOT redefine
// these shapes elsewhere.

/** Network resource types a rule can match. Mirrors chrome.declarativeNetRequest. */
export type ResourceType =
  | "main_frame"
  | "sub_frame"
  | "stylesheet"
  | "script"
  | "image"
  | "font"
  | "object"
  | "xmlhttprequest"
  | "ping"
  | "csp_report"
  | "media"
  | "websocket"
  | "other";

/** HTTP request methods a rule can match. */
export type RequestMethod =
  | "connect"
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put";

/**
 * When a rule applies. Either `urlFilter` (substring/wildcard, dNR syntax) OR
 * `regexFilter` (regular expression) should be set — `regexFilter` is required
 * for redirect rules that use regex substitution.
 */
export interface RuleCondition {
  /** dNR url filter, e.g. "||example.com/api" or "*://*.example.com/*". */
  urlFilter?: string;
  /** Regular expression matched against the URL. */
  regexFilter?: string;
  /** If true, the match is case-sensitive (default false). */
  isUrlFilterCaseSensitive?: boolean;
  /** Restrict to these resource types; omit to match all. */
  resourceTypes?: ResourceType[];
  /** Restrict to these HTTP methods; omit to match all. */
  requestMethods?: RequestMethod[];
  /** Only match when the request is to one of these domains. */
  domains?: string[];
  /** Never match when the request is to one of these domains. */
  excludedDomains?: string[];
}

/** All supported rule type discriminators. */
export type RuleType = "redirect" | "modifyHeaders" | "block" | "replace" | "mock" | "inject";

/** A single header add/modify/remove operation. */
export interface HeaderOperation {
  header: string;
  operation: "set" | "remove" | "append";
  /** Required for "set"/"append"; ignored for "remove". */
  value?: string;
}

/** Fields shared by every rule. */
export interface BaseRule {
  /** Stable UI-level id (uuid). NOT the dNR integer id — that's allocated by the engine. */
  id: string;
  name: string;
  type: RuleType;
  enabled: boolean;
  condition: RuleCondition;
  /** Optional rule-group membership (for the dashboard). */
  groupId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Redirect URL A -> URL B. Use `regexSubstitution` with a `regexFilter` condition. */
export interface RedirectRule extends BaseRule {
  type: "redirect";
  redirect: {
    /** Static destination URL. */
    url?: string;
    /** Regex substitution string (e.g. "https://b.test\\1"); needs condition.regexFilter. */
    regexSubstitution?: string;
  };
}

/** Add/modify/remove request and/or response headers. */
export interface ModifyHeadersRule extends BaseRule {
  type: "modifyHeaders";
  requestHeaders?: HeaderOperation[];
  responseHeaders?: HeaderOperation[];
}

/** Cancel/block matching requests. */
export interface BlockRule extends BaseRule {
  type: "block";
}

/** Find/replace a substring in the URL (engine implements via regex redirect). */
export interface ReplaceRule extends BaseRule {
  type: "replace";
  /** Substring (or pattern) to find in the URL. */
  from: string;
  /** Replacement text. */
  to: string;
}

/** Return a custom body/status by redirecting to a data: URL (MV3-safe mocking). */
export interface MockRule extends BaseRule {
  type: "mock";
  mock: {
    statusCode: number;
    /** Raw response body. */
    body: string;
    /** Content-Type for the data: URL, e.g. "application/json". */
    contentType: string;
  };
}

/** Inject JS or CSS into matching pages (via content script / chrome.scripting). */
export interface InjectRule extends BaseRule {
  type: "inject";
  injection: {
    language: "js" | "css";
    code: string;
    /** When to inject (defaults to document_idle). */
    runAt?: "document_start" | "document_end" | "document_idle";
  };
}

/** Discriminated union of every rule type. */
export type Rule =
  | RedirectRule
  | ModifyHeadersRule
  | BlockRule
  | ReplaceRule
  | MockRule
  | InjectRule;

/** A named group of rules (for the dashboard). */
export interface RuleGroup {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** The full persisted shape in chrome.storage.local. */
export interface RuleStoreState {
  rules: Rule[];
  groups: RuleGroup[];
  /** Monotonic counter backing the dNR integer-id allocator. */
  nextDnrId: number;
}

/** Export/import envelope for JSON round-tripping. */
export interface RuleExport {
  version: 1;
  exportedAt: number;
  rules: Rule[];
  groups: RuleGroup[];
}

// ---- Type guards (handy for both engine and UI) -------------------------

export function isRedirectRule(r: Rule): r is RedirectRule {
  return r.type === "redirect";
}
export function isModifyHeadersRule(r: Rule): r is ModifyHeadersRule {
  return r.type === "modifyHeaders";
}
export function isBlockRule(r: Rule): r is BlockRule {
  return r.type === "block";
}
export function isReplaceRule(r: Rule): r is ReplaceRule {
  return r.type === "replace";
}
export function isMockRule(r: Rule): r is MockRule {
  return r.type === "mock";
}
export function isInjectRule(r: Rule): r is InjectRule {
  return r.type === "inject";
}

/** Rule types that map to declarativeNetRequest (vs. inject, which uses scripting). */
export const NETWORK_RULE_TYPES: ReadonlySet<RuleType> = new Set<RuleType>([
  "redirect",
  "modifyHeaders",
  "block",
  "replace",
  "mock",
]);

/** True if the rule is handled by the dNR engine (not content-script injection). */
export function isNetworkRule(r: Rule): boolean {
  return NETWORK_RULE_TYPES.has(r.type);
}
