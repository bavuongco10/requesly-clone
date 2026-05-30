# PROGRESS — Requestly Clone

Source of truth across iterations. Update after every feature.

## Scaffolding
- [x] Install deps (npm install)
- [x] Config files: vite, tsconfig, tailwind, postcss, biome, vitest, playwright
- [x] Test setup with chrome.* API mocks (tests/setup.ts)
- [x] Empty build passes (`npm run build`) — dist/manifest.json valid MV3
- [x] Empty test run passes (`npm run test -- --run`)
- [x] Lint clean (`npm run lint` — Biome)
- [x] Typecheck clean (`npm run typecheck` — tsc)

## Foundation (DO YOURSELF, sequential)
- [x] Shared rule types in `src/types/rules.ts` (discriminated union + guards)
- [x] `chrome.storage.local` typed layer + tests (`src/storage/store.ts`, 15 tests)
- [x] id allocator for dNR rule ids (`allocateDnrId`, monotonic)

## Features (delegate after foundation green)
1. [x] Rule data model + storage layer
2. [x] Rule engine (UI rule -> dNR) + heavy tests (`src/engine/ruleEngine.ts`, 24 tests)
3. [x] Redirect rule — engine conversion + live dNR sync
4. [x] Header modification — engine conversion + live dNR sync
5. [x] Block/cancel rule — engine conversion + live dNR sync
6. [x] Replace rule — engine conversion + live dNR sync
7. [x] Mock response — engine conversion + live dNR sync (sanitized data: URL)
8. [x] Script/CSS injection (matcher + chrome.scripting via service worker)
9. [x] Popup UI (list, toggle, active count) — shared useRules hook + Popup
10. [x] Options/dashboard (CRUD, groups, search) — src/options/*
11. [x] Import/export JSON — validated import + Blob export in the dashboard

Legend: [x] done · [~] engine/logic done, wiring/UI pending · [ ] not started

## Decisions & known limitations
- **Mock statusCode is not enforceable.** MV3 dNR can't set a response body or
  status; we redirect to a `data:` URL. The browser serves 200 for a data:
  resource, so `mock.statusCode` is kept in the model for the UI but does not
  affect the served response.
- **Mock contentType is sanitized.** Active/markup types (text/html, svg+xml,
  xhtml+xml, xml) are downgraded to text/plain to prevent content injection via
  an imported malicious mock. `application/javascript`/`text/css` are allowed by
  design (mock/inject features serve user-authored code).
- **Replace rule = regex redirect.** A literal `from` is regex-escaped and
  wrapped in `^(.*)…(.*)$`; `to` has backslashes escaped so it can't inject
  backreferences. Substitution is `\1<to>\2`.
- **Import is validated.** `importAll` rejects unknown rule types and malformed
  shapes per item; only valid rules are persisted, with fresh ids.
- **Security gate scope.** `npm run security` audits production deps only
  (`--omit=dev`): the shipped `dist/` has 0 vulnerabilities. The 7 dev-only
  advisories (rollup/esbuild/vite/vitest/@crxjs) don't ship and their only fix
  is a breaking downgrade of the locked build tool.

## Definition of done
- All 11 features implemented
- Tests pass with meaningful engine + storage coverage
- `npm run build` succeeds; `dist/` has valid MV3 manifest
- `npm run lint` clean
- Security checkpoint PASSES for every feature: `npm run security` clean +
  `@security-reviewer` returns `SECURITY CHECKPOINT: PASS` on the diff
- PROGRESS.md fully checked off

## Security checkpoint (run per feature, before commit)
After a feature is green and before committing, run the checkpoint (loop step 5):
1. `npm run security` — `npm audit --audit-level=high`.
2. Invoke `@security-reviewer` on the diff — audits MV3 threat model
   (script/CSS injection, `data:` mock XSS, credential-header leakage, open
   redirects, untrusted import validation, manifest least-privilege).
3. Must end in `SECURITY CHECKPOINT: PASS`. A FAIL blocks the commit — fix and
   re-run. Record the verdict per feature below.

Verdicts log:
- Rule engine (dNR conversion) — PASS (mock contentType sanitized, replace `to`
  escaped, import validated)
- Service worker + injection — PASS (|| host-boundary hardened, injection runs
  in page MAIN world, http/https gated)
- Popup UI — PASS (no XSS sinks)
- Options dashboard + import/export — PASS (untrusted import validated, all
  content rendered as React text)
- E2E + resourceTypes fix — PASS (positive-constraint guard prevents match-all)
