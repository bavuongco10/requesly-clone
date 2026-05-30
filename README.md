# Requestly Clone

A Chrome (Manifest V3) browser extension that intercepts and modifies network
requests via user-managed rules — a clone of Requestly's core features. Built
with Vite + `@crxjs/vite-plugin`, React 18, TypeScript (strict), Tailwind, and
`declarativeNetRequest` dynamic rules.

## Status

Foundation and rule engine are complete and tested. Service worker wiring and
the React UI are in progress. See `PROGRESS.md` for the detailed checklist.

Implemented so far:

- Typed rule data model (redirect, header-modify, block, replace, mock, inject)
- `chrome.storage.local` persistence layer with rule/group CRUD, a monotonic
  dNR id allocator, and validated JSON import/export
- Rule engine: pure conversion of UI rule objects into `declarativeNetRequest`
  dynamic rules (redirect with regex substitution, request/response header
  modification, block, URL find/replace, and `data:`-URL mock responses)

## Develop

```bash
npm install
npm run dev        # Vite dev build with HMR
npm run build      # production build to dist/ (the loadable unpacked extension)
```

## Quality gates

```bash
npm run lint       # Biome (lint + format check)
npm run typecheck  # tsc --noEmit (strict)
npm run test -- --run   # Vitest unit suite (chrome.* mocked)
npm run test:e2e   # Playwright: load dist/ in Chromium, assert rules fire
npm run security   # npm audit on production dependencies
```

## Load the extension (once built)

1. Run `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` directory.

## MV3 notes

- Response *bodies* can't be modified by dNR; "mock response" redirects to a
  `data:` URL carrying the mock body. Mock content types are sanitized so a
  crafted mock can't serve active markup.
- The mock `statusCode` is not enforceable via a `data:` redirect (the browser
  serves 200); it's retained in the model for the UI only.
