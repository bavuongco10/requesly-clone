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
- **Tests:** Vitest + React Testing Library; mock the `chrome.*` APIs
- **Package manager:** npm

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

## Autonomous loop — how you should work
Work without asking me questions unless you are genuinely blocked. On every
change, follow this loop and do not stop until it's green:
1. Implement the next unfinished item from the feature list above.
2. Write or update unit tests for it (the rule engine especially).
3. Run `npm run test -- --run` AND `npm run build`.
4. If either fails, read the output, fix it, and return to step 3.
5. Only advance to the next feature when both pass.

Maintain a `PROGRESS.md` file. After each feature, check it off and note any
decisions or known limitations. This is your memory across iterations.

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
- `npm run lint` — eslint (treat lint errors as failures to fix)

## Definition of done
- All 11 features implemented.
- `npm run test -- --run` passes with meaningful coverage of the rule engine
  and storage layer.
- `npm run build` succeeds and `dist/` contains a valid MV3 `manifest.json`.
- `npm run lint` is clean.
- `PROGRESS.md` is fully checked off.

When done, STOP and give me: (a) how to load `dist/` as an unpacked extension
in Chrome, and (b) a short manual test checklist for the things tests can't
verify (actual network interception in a live browser).
