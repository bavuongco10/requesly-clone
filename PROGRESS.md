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
1. [ ] Rule data model + storage layer
2. [ ] Rule engine (UI rule -> dNR) + heavy tests
3. [ ] Redirect rule (URL A -> B, regex substitution)
4. [ ] Header modification (request + response)
5. [ ] Block/cancel rule
6. [ ] Replace rule (find/replace in URL)
7. [ ] Mock response (redirect to data: URL)
8. [ ] Script/CSS injection (content script + chrome.scripting)
9. [ ] Popup UI (list, toggle, active count)
10. [ ] Options/dashboard (CRUD, groups, search)
11. [ ] Import/export JSON

## Decisions & known limitations
- (none yet)

## Definition of done
- All 11 features implemented
- Tests pass with meaningful engine + storage coverage
- `npm run build` succeeds; `dist/` has valid MV3 manifest
- `npm run lint` clean
- PROGRESS.md fully checked off
