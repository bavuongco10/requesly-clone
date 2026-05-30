// Pure URL matching for inject rules.
//
// declarativeNetRequest matches network rules itself, but script/CSS injection
// is driven by the service worker via chrome.scripting — so the worker needs to
// decide whether a tab's URL matches a rule's condition. This module implements
// that test: a pragmatic subset of dNR's urlFilter syntax plus regexFilter and
// domain include/exclude lists.

import type { RuleCondition } from "../types/rules";

/** Extract the hostname from a URL, or "" if it can't be parsed. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** True if `host` equals `domain` or is a subdomain of it (case-insensitive). */
function hostMatchesDomain(host: string, domain: string): boolean {
  const d = domain.toLowerCase();
  if (host === d) return true;
  return host.endsWith(`.${d}`);
}

/**
 * Convert a dNR-style urlFilter into a RegExp source. Supported tokens:
 *   `*` — wildcard (any sequence)
 *   `|` at start/end — anchor to start/end of URL
 *   `||` at start — anchor to the start of a (sub)domain
 *   `^` — separator: end of string or a non-alphanumeric, non-`.`/`-`/`%` char
 * All other characters are matched literally (regex-escaped).
 */
export function urlFilterToRegExpSource(filter: string): string {
  let src = "";
  let i = 0;
  const n = filter.length;

  if (filter.startsWith("||")) {
    // Domain anchor: start of host, after an optional scheme://(subdomains.)
    src += "^[a-z]+://([^/]*\\.)?";
    i = 2;
    // Consume the host segment literally and require a host boundary after it,
    // so `||example.com` can't also match `example.com.evil.com` or
    // `example.company.com`. The rest of the URL must begin at /, :, ?, #, or
    // end-of-string. (This source is only fed to JS RegExp in the worker for
    // inject matching, never to dNR, so the lookahead is safe.)
    let host = "";
    while (i < n && !"/^*|".includes(filter[i])) {
      host += filter[i];
      i++;
    }
    src += host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    src += "(?=[/:?#]|$)";
  } else if (filter.startsWith("|")) {
    src += "^";
    i = 1;
  }

  for (; i < n; i++) {
    const c = filter[i];
    if (c === "*") {
      src += ".*";
    } else if (c === "^") {
      src += "([^a-zA-Z0-9._%-]|$)";
    } else if (c === "|" && i === n - 1) {
      src += "$";
    } else {
      src += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return src;
}

/** True if the URL satisfies the condition's urlFilter/regexFilter (if any). */
function urlMatchesPattern(url: string, condition: RuleCondition): boolean {
  if (condition.regexFilter) {
    try {
      const flags = condition.isUrlFilterCaseSensitive ? "" : "i";
      return new RegExp(condition.regexFilter, flags).test(url);
    } catch {
      return false;
    }
  }
  if (condition.urlFilter) {
    try {
      const flags = condition.isUrlFilterCaseSensitive ? "" : "i";
      return new RegExp(urlFilterToRegExpSource(condition.urlFilter), flags).test(url);
    } catch {
      return false;
    }
  }
  // No URL pattern → matches any URL (domain filters may still apply).
  return true;
}

/**
 * Decide whether a URL matches a rule condition for injection purposes.
 * Applies, in order: excludedDomains (reject), domains (require), then the
 * urlFilter/regexFilter pattern.
 */
export function matchesCondition(url: string, condition: RuleCondition): boolean {
  const host = hostnameOf(url);
  if (!host) return false;

  if (condition.excludedDomains?.some((d) => hostMatchesDomain(host, d))) {
    return false;
  }
  if (condition.domains && condition.domains.length > 0) {
    if (!condition.domains.some((d) => hostMatchesDomain(host, d))) return false;
  }
  return urlMatchesPattern(url, condition);
}
