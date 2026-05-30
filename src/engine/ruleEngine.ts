// Rule engine: convert our UI Rule objects into chrome.declarativeNetRequest
// (dNR) dynamic rules.
//
// `buildDnrRule` is PURE — it takes a Rule plus a pre-allocated integer dNR id
// and returns a dNR rule (or null for non-network / invalid rules). It never
// touches chrome.* or storage. `buildAllDnrRules` is the impure orchestrator
// that allocates ids from the store and maps a rule list.

import { allocateDnrId } from "../storage/store";
import {
  type MockRule,
  type ModifyHeadersRule,
  type RedirectRule,
  type ReplaceRule,
  type Rule,
  type RuleCondition,
  isBlockRule,
  isInjectRule,
  isMockRule,
  isModifyHeadersRule,
  isNetworkRule,
  isRedirectRule,
  isReplaceRule,
} from "../types/rules";

type DnrRule = chrome.declarativeNetRequest.Rule;
type DnrCondition = chrome.declarativeNetRequest.RuleCondition;
type DnrAction = chrome.declarativeNetRequest.RuleAction;
type DnrHeaderInfo = chrome.declarativeNetRequest.ModifyHeaderInfo;

const DEFAULT_PRIORITY = 1;

/** Escape regex metacharacters so a literal substring can be used in a regexFilter. */
export function escapeRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Map our RuleCondition to a dNR condition. Our `domains`/`excludedDomains`
 * map to dNR `requestDomains`/`excludedRequestDomains` (match the request's
 * destination). Only defined fields are included.
 */
export function buildDnrCondition(condition: RuleCondition): DnrCondition {
  const out: DnrCondition = {};
  if (condition.urlFilter !== undefined) out.urlFilter = condition.urlFilter;
  if (condition.regexFilter !== undefined) out.regexFilter = condition.regexFilter;
  if (condition.isUrlFilterCaseSensitive !== undefined) {
    out.isUrlFilterCaseSensitive = condition.isUrlFilterCaseSensitive;
  }
  if (condition.resourceTypes && condition.resourceTypes.length > 0) {
    out.resourceTypes = condition.resourceTypes as DnrCondition["resourceTypes"];
  }
  if (condition.requestMethods && condition.requestMethods.length > 0) {
    out.requestMethods = condition.requestMethods as DnrCondition["requestMethods"];
  }
  if (condition.domains && condition.domains.length > 0) {
    out.requestDomains = condition.domains;
  }
  if (condition.excludedDomains && condition.excludedDomains.length > 0) {
    out.excludedRequestDomains = condition.excludedDomains;
  }
  return out;
}

function redirectAction(rule: RedirectRule): DnrAction | null {
  const { url, regexSubstitution } = rule.redirect;
  if (regexSubstitution !== undefined) {
    // Regex substitution requires a regexFilter to capture against.
    if (!rule.condition.regexFilter) return null;
    return {
      type: "redirect" as DnrAction["type"],
      redirect: { regexSubstitution },
    };
  }
  if (url) {
    return { type: "redirect" as DnrAction["type"], redirect: { url } };
  }
  return null;
}

function headerInfos(ops: ModifyHeadersRule["requestHeaders"]): DnrHeaderInfo[] | undefined {
  if (!ops || ops.length === 0) return undefined;
  return ops.map((op) => {
    const info: DnrHeaderInfo = {
      header: op.header,
      operation: op.operation as DnrHeaderInfo["operation"],
    };
    // "set"/"append" carry a value; "remove" must not.
    if (op.operation !== "remove" && op.value !== undefined) info.value = op.value;
    return info;
  });
}

function modifyHeadersAction(rule: ModifyHeadersRule): DnrAction | null {
  const requestHeaders = headerInfos(rule.requestHeaders);
  const responseHeaders = headerInfos(rule.responseHeaders);
  if (!requestHeaders && !responseHeaders) return null;
  const action: DnrAction = { type: "modifyHeaders" as DnrAction["type"] };
  if (requestHeaders) action.requestHeaders = requestHeaders;
  if (responseHeaders) action.responseHeaders = responseHeaders;
  return action;
}

/**
 * Replace rule: rewrite a literal substring in the URL. Implemented as a regex
 * redirect — we wrap the escaped `from` in two capture groups so everything
 * before and after the match is preserved:
 *   regexFilter        = ^(.*)<escaped from>(.*)$
 *   regexSubstitution  = \1<to>\2
 * If `from` is empty there is nothing to replace → invalid.
 */
function replaceCondition(rule: ReplaceRule): { regexFilter: string; substitution: string } | null {
  if (!rule.from) return null;
  const regexFilter = `^(.*)${escapeRegex(rule.from)}(.*)$`;
  // Escape backslashes in `to` so a crafted value can't inject extra
  // backreferences (e.g. \1, \0) into the substitution template.
  const safeTo = rule.to.replace(/\\/g, "\\\\");
  const substitution = `\\1${safeTo}\\2`;
  return { regexFilter, substitution };
}

/**
 * Content types that can execute script or be parsed as active markup when
 * loaded as a top-level/sub-resource document. A mock served with one of these
 * becomes a content-injection vector (the mock body is attacker-influenced via
 * import), so we never let them through — such mocks fall back to text/plain.
 */
const UNSAFE_MOCK_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/xml",
  "application/xml",
]);

const SAFE_DEFAULT_CONTENT_TYPE = "text/plain";

/**
 * Normalize a user-supplied mock content type into a single safe MIME token.
 * Strips everything after the first comma/semicolon (so it can't smuggle data
 * into the `data:` URL body section or add a `;base64` directive), lowercases,
 * and downgrades active/markup types to text/plain.
 */
export function sanitizeMockContentType(raw: string): string {
  const token = raw.split(/[,;]/)[0].trim().toLowerCase();
  if (!token || !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(token)) {
    return SAFE_DEFAULT_CONTENT_TYPE;
  }
  if (UNSAFE_MOCK_CONTENT_TYPES.has(token)) return SAFE_DEFAULT_CONTENT_TYPE;
  return token;
}

/**
 * Mock rule: MV3 dNR cannot set a response body, so we redirect to a `data:`
 * URL carrying the mock body and content type. The body is percent-encoded and
 * the content type is sanitized (see sanitizeMockContentType) so a crafted mock
 * cannot serve active markup (HTML/SVG/XML) or break out of the URL.
 * NOTE: statusCode is NOT enforceable via a data: redirect — the browser
 * serves a 200 for the data: resource. We keep statusCode in the model for the
 * UI, but it does not affect the served response. Documented limitation.
 */
export function buildMockDataUrl(rule: MockRule): string {
  const contentType = sanitizeMockContentType(rule.mock.contentType);
  return `data:${contentType},${encodeURIComponent(rule.mock.body)}`;
}

/**
 * Convert a single rule into a dNR dynamic rule, or null when the rule is not
 * a network rule (inject), is disabled, or is structurally invalid.
 */
export function buildDnrRule(rule: Rule, dnrId: number): DnrRule | null {
  if (!rule.enabled) return null;
  if (isInjectRule(rule) || !isNetworkRule(rule)) return null;

  let action: DnrAction | null = null;
  const condition = buildDnrCondition(rule.condition);

  if (isRedirectRule(rule)) {
    action = redirectAction(rule);
  } else if (isModifyHeadersRule(rule)) {
    action = modifyHeadersAction(rule);
  } else if (isBlockRule(rule)) {
    action = { type: "block" as DnrAction["type"] };
  } else if (isReplaceRule(rule)) {
    const built = replaceCondition(rule);
    if (!built) return null;
    condition.regexFilter = built.regexFilter;
    // A regex redirect doesn't use urlFilter; drop it to avoid conflicts.
    condition.urlFilter = undefined;
    action = {
      type: "redirect" as DnrAction["type"],
      redirect: { regexSubstitution: built.substitution },
    };
  } else if (isMockRule(rule)) {
    action = {
      type: "redirect" as DnrAction["type"],
      redirect: { url: buildMockDataUrl(rule) },
    };
  }

  if (!action) return null;

  // A dNR condition must constrain something; bail if it's entirely empty.
  if (Object.keys(condition).length === 0) return null;

  return {
    id: dnrId,
    priority: DEFAULT_PRIORITY,
    action,
    condition,
  };
}

/**
 * Build dNR rules for a list of UI rules: keep enabled network rules, allocate
 * a unique dNR integer id for each via the store, convert, and drop nulls.
 */
export async function buildAllDnrRules(rules: Rule[]): Promise<DnrRule[]> {
  const out: DnrRule[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !isNetworkRule(rule)) continue;
    const dnrId = await allocateDnrId();
    const built = buildDnrRule(rule, dnrId);
    if (built) out.push(built);
  }
  return out;
}
