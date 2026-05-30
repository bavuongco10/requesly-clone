// Flat, editable representation of a Rule for the dashboard form.
//
// A `Rule` is a discriminated union with nested shapes; that's awkward to bind
// directly to form inputs. `RuleDraft` flattens every possible field into a
// single editable object. We convert Rule <-> draft at the form boundary and
// validate the draft before it becomes a storage input.

import { isInjectRule, isModifyHeadersRule, isRedirectRule, isReplaceRule } from "../types/rules";
import type {
  BlockRule,
  HeaderOperation,
  InjectRule,
  MockRule,
  RedirectRule,
  ReplaceRule,
  RequestMethod,
  ResourceType,
  Rule,
  RuleType,
} from "../types/rules";

/** A rule shaped for the storage layer's add/update inputs (no id/timestamps). */
type RuleInput<T extends Rule> = Omit<T, "id" | "createdAt" | "updatedAt">;

export const TYPE_LABELS: Record<RuleType, string> = {
  redirect: "Redirect",
  modifyHeaders: "Modify Headers",
  block: "Block",
  replace: "Replace",
  mock: "Mock",
  inject: "Inject",
};

export const RULE_TYPES: RuleType[] = [
  "redirect",
  "modifyHeaders",
  "block",
  "replace",
  "mock",
  "inject",
];

export const RESOURCE_TYPES: ResourceType[] = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "other",
];

export const REQUEST_METHODS: RequestMethod[] = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
];

export type MatchKind = "url" | "regex";

/** Flat shape bound to the form inputs. Strings everywhere bindable to inputs. */
export interface RuleDraft {
  name: string;
  type: RuleType;
  enabled: boolean;
  groupId: string;
  // condition
  matchKind: MatchKind;
  urlFilter: string;
  regexFilter: string;
  caseSensitive: boolean;
  domains: string;
  excludedDomains: string;
  resourceTypes: ResourceType[];
  requestMethods: RequestMethod[];
  // redirect
  redirectUrl: string;
  regexSubstitution: string;
  // replace
  from: string;
  to: string;
  // mock
  statusCode: string;
  contentType: string;
  body: string;
  // inject
  language: "js" | "css";
  code: string;
  runAt: "document_start" | "document_end" | "document_idle";
  // modifyHeaders
  requestHeaders: HeaderOperation[];
  responseHeaders: HeaderOperation[];
}

/** Split a comma-separated input into a trimmed, non-empty string array. */
export function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Join a string array back into a comma-separated input value. */
export function joinCsv(values: string[] | undefined): string {
  return (values ?? []).join(", ");
}

/** A blank draft for creating a new rule of the given type. */
export function emptyDraft(type: RuleType): RuleDraft {
  return {
    name: "",
    type,
    enabled: true,
    groupId: "",
    matchKind: "url",
    urlFilter: "",
    regexFilter: "",
    caseSensitive: false,
    domains: "",
    excludedDomains: "",
    resourceTypes: [],
    requestMethods: [],
    redirectUrl: "",
    regexSubstitution: "",
    from: "",
    to: "",
    statusCode: "200",
    contentType: "application/json",
    body: "",
    language: "js",
    code: "",
    runAt: "document_idle",
    requestHeaders: [],
    responseHeaders: [],
  };
}

/** Build an editable draft from an existing rule. */
export function ruleToDraft(rule: Rule): RuleDraft {
  const d = emptyDraft(rule.type);
  d.name = rule.name;
  d.enabled = rule.enabled;
  d.groupId = rule.groupId ?? "";
  d.matchKind = rule.condition.regexFilter ? "regex" : "url";
  d.urlFilter = rule.condition.urlFilter ?? "";
  d.regexFilter = rule.condition.regexFilter ?? "";
  d.caseSensitive = rule.condition.isUrlFilterCaseSensitive ?? false;
  d.domains = joinCsv(rule.condition.domains);
  d.excludedDomains = joinCsv(rule.condition.excludedDomains);
  d.resourceTypes = rule.condition.resourceTypes ?? [];
  d.requestMethods = rule.condition.requestMethods ?? [];

  if (isRedirectRule(rule)) {
    d.redirectUrl = rule.redirect.url ?? "";
    d.regexSubstitution = rule.redirect.regexSubstitution ?? "";
  } else if (isReplaceRule(rule)) {
    d.from = rule.from;
    d.to = rule.to;
  } else if (isModifyHeadersRule(rule)) {
    d.requestHeaders = rule.requestHeaders ? [...rule.requestHeaders] : [];
    d.responseHeaders = rule.responseHeaders ? [...rule.responseHeaders] : [];
  } else if (rule.type === "mock") {
    d.statusCode = String(rule.mock.statusCode);
    d.contentType = rule.mock.contentType;
    d.body = rule.mock.body;
  } else if (isInjectRule(rule)) {
    d.language = rule.injection.language;
    d.code = rule.injection.code;
    d.runAt = rule.injection.runAt ?? "document_idle";
  }
  return d;
}

export type DraftResult =
  | { ok: true; input: Omit<Rule, "id" | "createdAt" | "updatedAt"> }
  | { ok: false; error: string };

/** Build a RuleCondition from the draft, dropping empty optionals. */
function buildCondition(draft: RuleDraft): Rule["condition"] {
  const condition: Rule["condition"] = {};
  if (draft.matchKind === "regex") {
    condition.regexFilter = draft.regexFilter.trim();
  } else {
    condition.urlFilter = draft.urlFilter.trim();
  }
  if (draft.caseSensitive) condition.isUrlFilterCaseSensitive = true;
  const domains = splitCsv(draft.domains);
  if (domains.length > 0) condition.domains = domains;
  const excluded = splitCsv(draft.excludedDomains);
  if (excluded.length > 0) condition.excludedDomains = excluded;
  if (draft.resourceTypes.length > 0) condition.resourceTypes = [...draft.resourceTypes];
  if (draft.requestMethods.length > 0) condition.requestMethods = [...draft.requestMethods];
  return condition;
}

/** Keep only header ops that name a header; drop blank rows the user left empty. */
function cleanHeaderOps(ops: HeaderOperation[]): HeaderOperation[] {
  return ops
    .filter((op) => op.header.trim().length > 0)
    .map((op) =>
      op.operation === "remove"
        ? { header: op.header.trim(), operation: op.operation }
        : { header: op.header.trim(), operation: op.operation, value: op.value ?? "" },
    );
}

/**
 * Validate the draft and convert it to a storage `addRule`/`updateRule` input.
 * Returns a discriminated result so the form can show a precise error message.
 */
export function draftToRuleInput(draft: RuleDraft): DraftResult {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: "Name is required." };

  const matchValue =
    draft.matchKind === "regex" ? draft.regexFilter.trim() : draft.urlFilter.trim();
  if (!matchValue) {
    return {
      ok: false,
      error:
        draft.matchKind === "regex" ? "A regex filter is required." : "A URL filter is required.",
    };
  }

  const condition = buildCondition(draft);
  const base = { name, enabled: draft.enabled, condition } as const;
  const groupId = draft.groupId ? { groupId: draft.groupId } : {};

  switch (draft.type) {
    case "redirect": {
      const url = draft.redirectUrl.trim();
      const sub = draft.regexSubstitution.trim();
      if (!url && !sub) {
        return { ok: false, error: "Redirect needs a destination URL or a regex substitution." };
      }
      if (sub && draft.matchKind !== "regex") {
        return { ok: false, error: "Regex substitution requires a regex filter condition." };
      }
      const redirect: { url?: string; regexSubstitution?: string } = {};
      if (url) redirect.url = url;
      if (sub) redirect.regexSubstitution = sub;
      const input: RuleInput<RedirectRule> = { ...base, ...groupId, type: "redirect", redirect };
      return { ok: true, input };
    }
    case "modifyHeaders": {
      const requestHeaders = cleanHeaderOps(draft.requestHeaders);
      const responseHeaders = cleanHeaderOps(draft.responseHeaders);
      if (requestHeaders.length === 0 && responseHeaders.length === 0) {
        return { ok: false, error: "Add at least one request or response header operation." };
      }
      return {
        ok: true,
        input: {
          ...base,
          ...groupId,
          type: "modifyHeaders",
          ...(requestHeaders.length ? { requestHeaders } : {}),
          ...(responseHeaders.length ? { responseHeaders } : {}),
        },
      };
    }
    case "block": {
      const input: RuleInput<BlockRule> = { ...base, ...groupId, type: "block" };
      return { ok: true, input };
    }
    case "replace": {
      const from = draft.from;
      if (!from) return { ok: false, error: "Replace needs a 'from' value." };
      const input: RuleInput<ReplaceRule> = {
        ...base,
        ...groupId,
        type: "replace",
        from,
        to: draft.to,
      };
      return { ok: true, input };
    }
    case "mock": {
      const statusCode = Number.parseInt(draft.statusCode, 10);
      if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
        return { ok: false, error: "Status code must be an integer between 100 and 599." };
      }
      const contentType = draft.contentType.trim();
      if (!contentType) return { ok: false, error: "Content-Type is required for a mock." };
      const input: RuleInput<MockRule> = {
        ...base,
        ...groupId,
        type: "mock",
        mock: { statusCode, contentType, body: draft.body },
      };
      return { ok: true, input };
    }
    case "inject": {
      const code = draft.code;
      if (!code.trim()) return { ok: false, error: "Injection code cannot be empty." };
      const input: RuleInput<InjectRule> = {
        ...base,
        ...groupId,
        type: "inject",
        injection: { language: draft.language, code, runAt: draft.runAt },
      };
      return { ok: true, input };
    }
    default:
      return { ok: false, error: "Unknown rule type." };
  }
}
