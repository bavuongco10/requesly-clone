# CLAUDE.md — Requestly Clone (React MV3 Extension)

## What we're building
A Chrome (Manifest V3) browser extension that clones Requestly's core
features: intercept and modify network requests via rules the user manages
in a React UI.

Core features (build in this order):
1. **Rule data model + storage layer** — typed rule objects persisted in
   `chrome.storage.local`. Build and TEST this first; everything depends on it.
2. **Rule engine** — pure functions converting a UI rule object into a
   `declarativeNetRequest` (dNR) dynamic rule. This is the heart of the app
   and must have heavy unit test coverage.
3. **Redirect rule** — redirect URL A → URL B (support regex substitution).
4. **Header modification** — add/modify/remove request AND response headers.
5. **Block/cancel rule** — cancel matching requests.
6. **Replace rule** — find/replace a string in the URL.
7. **Mock response** — return a custom body/status by redirecting to a
   `data:` URL (see gotcha below).
8. **Script/CSS injection** — inject JS or CSS into matching pages via a
   content script.
9. **Popup UI** — list rules, toggle each on/off, show active-rule count.
10. **Options/dashboard page** — full CRUD for rules, rule groups, search.
11. **Import/export** — export all rules to JSON, import from JSON.

## Locked tech stack — do NOT substitute without asking
- **Build:** Vite + `@crxjs/vite-plugin` (handles MV3 manifest + HMR)
- **UI:** React 18 + TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **State/persistence:** `chrome.storage.local` wrapped in a typed module
- **Network engine:** `declarativeNetRequest` dynamic rules
- **Lint + format:** Biome (Rust) — one tool replacing ESLint + Prettier,
  config in `biome.json`. Fast enough to run on every commit.
- **Type-check:** `tsc --noEmit` (TypeScript strict). Biome does NOT type-check;
  tsc is the source of truth for types. Never skip it.
- **Unit tests:** Vitest + React Testing Library; mock the `chrome.*` APIs
- **E2E tests:** Playwright — loads the built `dist/` extension in a real
  Chromium and asserts that rules actually fire (redirects happen, headers
  change, requests get blocked). This is the only check that proves
  interception works; unit tests only prove the rule-conversion logic.
- **Package manager:** npm
- **Version control:** git, remote `origin` is already configured on GitHub.

## MV3 gotchas — follow these or the extension won't work
- MV3 cannot modify response *bodies* directly with dNR. For "mock response,"
  redirect the request to a `data:` URL containing the mock body/status, or to
  a bundled extension resource. Do NOT attempt `webRequest` blocking listeners
  — they're MV2 and won't work.
- dNR dynamic rules each need a unique integer `id`. Keep an id allocator.
- `declarativeNetRequest` permission + `host_permissions` must be in the
  manifest. Header modification needs the rule `action.type` of
  `modifyHeaders`.
- The service worker is the background context — no DOM, ephemeral. Keep all
  durable state in `chrome.storage.local`, not in module variables.
- Content scripts (for JS/CSS injection) run in an isolated world; use
  `chrome.scripting` from the worker for dynamic injection.
- Loading an unpacked extension in Playwright requires a persistent context
  with `--disable-extensions-except=<dist>` and `--load-extension=<dist>`, and
  it will NOT work in old headless mode — use `channel: 'chromium'` with
  `--headless=new` (or run headed). Read the extension's MV3 service-worker
  registration before asserting against it.

## Autonomous loop — how you should work
Work without asking me questions unless you are genuinely blocked. On every
change, follow this loop and do not stop until it's green:
1. Implement the next unfinished item from the feature list above.
2. Write or update unit tests for it (the rule engine especially). For any
   feature that affects network behavior (redirect, headers, block, replace,
   mock), also add or update a Playwright e2e test that loads `dist/` and
   asserts the rule actually fires.
3. Run `npm run lint`, `npm run typecheck`, `npm run test -- --run`,
   `npm run build`, and — for network-affecting features — `npm run test:e2e`.
4. If anything fails, read the output, fix it, and return to step 3.
5. When all checks pass, commit and push (see Git workflow below), update
   `PROGRESS.md` AND `README.md`, then advance to the next feature.

Maintain a `PROGRESS.md` file. After each feature, check it off and note any
decisions or known limitations. This is your memory across iterations.

Keep `README.md` current too: after each feature lands, update it to reflect
what the extension now does — the feature list, how to build/load it, and how
to run the tests. `PROGRESS.md` is your internal log; `README.md` is the
user-facing description of the project's current state.

## Git workflow — commit and push automatically
The GitHub remote `origin` is already configured. You do NOT need to ask before
committing or pushing — do it as part of the loop:
- After a feature passes all its checks, stage everything, write a commit
  message that follows the Conventional Commits spec (see below), then
  `git push`.
- One logical change per commit; keep the subject focused and descriptive.
- NEVER commit while lint, type-check, tests, or build are failing — only green
  work gets committed and pushed. Every commit MUST pass `npm run lint` AND
  `npm run typecheck`; a pre-commit hook enforces this and will reject the
  commit otherwise, so run both before committing.
- If a push fails (e.g. auth or non-fast-forward), do `git pull --rebase` once
  and retry; if it still fails, note it in `PROGRESS.md` and keep working
  locally rather than blocking on it.
- Do not commit `node_modules/` or `dist/`; ensure `.gitignore` covers them
  during scaffolding.

### Commit messages MUST be semantic (Conventional Commits)
Format: `type(scope): subject`
- **type** is required, lowercase, one of:
  - `feat` — a new feature/rule type
  - `fix` — a bug fix
  - `test` — adding or fixing tests (unit or e2e)
  - `refactor` — code change that neither fixes a bug nor adds a feature
  - `build` — build system, Vite/crxjs config, dependencies
  - `chore` — scaffolding, tooling, housekeeping
  - `docs` — documentation only (incl. PROGRESS.md)
  - `style` — formatting/lint only, no logic change
  - `perf` — performance improvement
  - `ci` — CI configuration
- **scope** is optional but preferred — the area touched, e.g. `engine`,
  `redirect`, `headers`, `storage`, `popup`, `options`, `e2e`, `types`.
- **subject** is imperative, lowercase, no trailing period, ≤ 72 chars.
- Use the body (after a blank line) for the why when it isn't obvious.
- Use `feat!:` or a `BREAKING CHANGE:` footer for breaking changes.

Examples:
- `feat(redirect): add URL redirect rule with regex substitution`
- `feat(engine): convert UI rule objects to dNR dynamic rules`
- `test(e2e): assert header-modify rule fires in loaded extension`
- `fix(storage): allocate unique dNR ids on rule import`
- `chore: scaffold vite + crxjs + react + tailwind`

Do NOT write non-semantic messages like `update`, `wip`, `fixes`, or
`changes`. Every commit subject must start with a valid type.

## Agent delegation
You have subagents in `.claude/agents/`. Use them like this:

**Build the foundation YOURSELF first, sequentially — do not parallelize it:**
the shared rule types (`src/types/`), the `chrome.storage.local` layer, and the
scaffolding. Everything depends on these, so parallel work here just causes
merge conflicts.

**Once the shared types + storage layer exist and pass tests, fan out:**
- Delegate engine work (service worker, dNR rule engine, mocking) to
  `@extension-engine`.
- Delegate all React popup/options/component work to `@ui-builder`.
  These two touch different directories, so they can run concurrently.
- After ANY feature lands, invoke `@test-runner` to verify green before moving on.
- For features that affect network behavior, invoke `@browser-verify` to write
  and run the Playwright e2e test that loads `dist/` and confirms the rule
  actually fires in a real browser.
- After a feature is green, optionally invoke `@code-reviewer` for a read-only pass.

**Do NOT delegate** quick single-file fixes, changes to the shared types
(do those yourself so both agents stay in sync), or anything needing tight
back-and-forth — handle those directly.

Subagents return only a summary and don't share your context, so when you
delegate, give the agent everything it needs in the dispatch (the relevant
type definitions, the feature spec, the file paths). Keep `PROGRESS.md` as the
shared source of truth across all agents.

## Commands
- `npm run dev` — Vite dev build with HMR
- `npm run build` — production build to `dist/` (the loadable unpacked extension)
- `npm run test -- --run` — run the full Vitest suite once (no watch)
- `npm run test:e2e` — Playwright e2e: build, load `dist/` in Chromium, assert rules fire
- `npm run lint` — `biome check .` (lint + format check); use `biome check --write .` to fix
- `npm run typecheck` — `tsc --noEmit` (strict type-check; treat any error as a failure)

Set these up in `package.json` during scaffolding. Add Biome as the only
linter/formatter (no ESLint, no Prettier).

## Definition of done
- All 11 features implemented.
- `npm run test -- --run` passes with meaningful coverage of the rule engine
  and storage layer.
- `npm run test:e2e` passes: every network-affecting rule type is proven to
  fire in a real Chromium with the extension loaded.
- `npm run build` succeeds and `dist/` contains a valid MV3 `manifest.json`.
- `npm run lint` (Biome) is clean and `npm run typecheck` (tsc) reports no errors.
- `PROGRESS.md` is fully checked off.
- All work is committed and pushed to `origin`.

When done, STOP and give me: (a) how to load `dist/` as an unpacked extension
in Chrome, and (b) a short manual test checklist for the things tests can't
verify (actual network interception in a live browser).
