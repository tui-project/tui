# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

This is a Nuxt application with Nitro server routes under `server/api`.

Server-side persistence currently uses NeDB via `@seald-io/nedb`. The database is configured in `server/utils/db.ts` and stores the user collection in `config/database/users.db` by default. Tests override `DATABASE_DIR` so they do not touch local development data.

## Local Commands

- Run unit tests: `pnpm vitest run --project unit`
- Run a focused unit test: `pnpm vitest run --project unit path/to/file.test.ts`
- Run nuxt component tests: `pnpm vitest run --project nuxt`
- Run all tests: `pnpm test`
- Run typecheck: `pnpm typecheck`
- Run lint: `pnpm lint`
- Start dev server: `pnpm dev`

Before finishing any change, always run both:

```bash
pnpm test        # all test projects must pass
pnpm typecheck   # must produce no errors
```

Prefer running the focused test first after a small change, then the full test suite, then typecheck.

## Server Route Conventions

- Use Nitro file routes in `server/api`.
- Keep route handlers thin. Validation, logging, and response shaping can live in the route; database interactions should go through repositories.
- Existing route files use direct default exports with `defineEventHandler`.
- Import explicit helpers such as `readBody` and `createError` from `h3` when needed.
- For expected API error responses (for example validation errors or conflict states), prefer `createError` with:
    - `statusCode`: HTTP status code
    - `message`: stable machine-readable identifier
- When returning expected API error responses, add a `warn` log with useful non-sensitive context.

Example route pattern:

```ts
export default defineEventHandler(async () => {
    return {
        ok: true,
    }
})
```

## Repository Conventions

- Put database interaction modules in `server/repositories`.
- Repository method names should be contextual and use clear verb-first names. Include the entity in the method name when it improves readability across imports/call sites. For example, use `createUser`, `findAllUsers`, `userCount`, `createSession`, and `getSettings`.
- Datastore readiness is handled during app bootstrap; repository methods should not add per-method `autoloadPromise` waits.
- Keep raw datastore exports in `server/utils/db.ts`; application code should usually use repositories instead of importing collections directly.
- Avoid passing broad configuration objects such as `settings` through multiple method parameters when the callee can resolve what it needs internally. Prefer keeping configuration lookup close to the service that owns that behavior, and pass only the specific values required when lookup cannot be done locally.

## Logging

- Use `logger` from `server/utils/logger.ts`.
- Log request receipt at `debug` when useful.
- Use `info` for meaningful state transitions or actions, not every successful read.
- Do not log passwords, password hashes, tokens, or secrets.

For setup status specifically:

- Log debug when a setup status request is received.
- Log info only when setup is required.

## Tests

API route tests should live under `test/e2e/server/api`.

Nuxt browser e2e page tests should use `@nuxt/test-utils/e2e` with `vitest` (not `@playwright/test` runner). Use Playwright page APIs for interactions and selectors.

Nuxt component/page tests under `test/nuxt` should prefer Testing Library patterns:

- Use `renderSuspended` from `@nuxt/test-utils/runtime`.
- Use queries from `@testing-library/vue` (`screen.getByRole`, `getByText`, `getByPlaceholderText`, etc.).
- Use `@testing-library/user-event` for realistic user interactions. Always pass `{ delay: null }` to `userEvent.setup()` — the default keystroke delay adds significant wall-clock time. Exception: `test/nuxt/components/upload/StepSelectMedia.test.ts` relies on the default delay so open-dropdown DOM is cleaned up between renders.
- Avoid broad assertions on wrapper text; prefer targeted selector-based assertions.
- Prefer selector-based element targeting over index-based access. Avoid patterns like `findAll(...)[0]` when a stable selector (`getByRole`, `getByLabelText`, `get`, `locator`, etc.) can be used.
- Prefer `renderSuspended` + selector-driven interactions over Vue Test Utils component-instance access (`findComponent`, `vm.$emit`) for `test/nuxt` tests.
- If a third-party component abstracts form submission in a way that is not reliably triggered by DOM events in tests, use the smallest possible fallback while keeping render/assertion flow in Testing Library style.

For browser assertions in e2e page tests:

- Prefer selector-based checks such as `waitForSelector`, `getByRole`, `getByPlaceholder`, and `locator`.
- Avoid broad assertions against `page.textContent('body')`; assert targeted UI content via selectors instead.

When multiple test cases share the same logic and differ only in input/output values, use `it.each(...)` instead of repeating the test body. This applies across all test types — unit, nuxt, and e2e. Examples where `it.each` is appropriate: validating every enum value produces the correct output, checking a flag is set correctly for each member of a set, or asserting a rule fires for each banned item in a list.

Unit tests should cover non-route modules (for example repositories and utilities) under `test/unit/server`.

Examples:

- `server/api/tracker/requests/index.post.ts` -> `test/e2e/server/api/tracker/requests.test.ts`
- `server/repositories/user-repository.ts` -> `test/unit/server/repositories/user-repository.test.ts`
- `server/utils/db.ts` -> `test/unit/server/utils/db.test.ts`

The unit test glob in `vitest.config.ts` is recursive:

```ts
include: ['test/unit/**/*.{test,spec}.ts']
```

When testing modules that initialize the database:

- Call `vi.resetModules()` before importing the module under test.
- Set `process.env.DATABASE_DIR` to a temp directory before import.
- Remove the temp directory and delete env vars in `afterEach`.

Do not add unit tests that import Nitro route handlers directly.

Coverage expectations:

- For every change — new code or modified existing code — add or update tests so all touched files have 100% line, statement, and branch coverage, including error paths and null guards.
- Run `pnpm test:coverage` after every change and verify coverage before reporting the task as complete.
- If a file is intentionally excluded from coverage (for example model/type-only files), document the reason in configuration comments.

## Shared Types

Types exported from `shared/types/` are auto-imported by Nuxt 4 and available globally in both the app (`app/`) and server (`server/`) layers. Do not add explicit import statements for them — no `import type { TrackerRequest } from '../../shared/types/tracker-request'` or similar.

## Frontend Composables

Composables under `app/composables/` wrap `useFetch` with `immediate: false, watch: false` and return `{ pending, error, data, execute }`. Name them with a verb prefix matching the HTTP method: `useGet*` for GET requests, `usePost*` for POST requests. Do not expose a manual `loading` ref — use `pending` from `useFetch`.

## HTTP Clients

- Use `$fetch` (Nitro global, ofetch under the hood) for all server-side HTTP requests. Do not use the native `fetch` API. `$fetch` is available globally in Nitro without imports and automatically throws on non-2xx responses.

## Commit Messages

Use the conventional commits format: `type: short summary` (under 72 chars).

Follow the subject line with 1–2 sentences explaining what changed and why — enough context to understand the fix without reading the diff. No bullet points, no lengthy descriptions.

Example:

```
fix: use episode number as primary key for TVDb special matching

Resolves incorrect special episode resolution (e.g. S00E08 matching E07)
by trusting the parsed episode number first and only overriding it when
another special scores strictly higher on title matching.
```

## Tracker Duplicate Detection Pattern

When implementing `findDuplicates` for a tracker service, always follow this structure:

1. **`TorrentContext`** — a plain object capturing the properties relevant to slot and trump evaluation for one release (slot string, revision, sourceRank, hasOriginalAudio, etc.). No raw `TorrentResult` fields should appear inside the rule functions.

2. **`DUPLICATE_RULES`** — an array of `(upload: TorrentContext, existing: TorrentContext) => boolean` functions. A candidate is a duplicate when **any** rule returns `true`. Each rule expresses one coexistence boundary (e.g. same slot).

3. **`TRUMP_RULES`** — an array of the same signature. A duplicate is trumpable when **any** rule returns `true`. Each rule expresses one trump condition (e.g. higher revision, higher source rank, original audio over dubbed-only).

4. **`findDuplicates`** — builds an `uploadContext`, maps candidates to `existingContext` objects, then delegates entirely to `DUPLICATE_RULES` and `TRUMP_RULES`:

```ts
const duplicates = existingContexts
    .filter(({ context }) => DUPLICATE_RULES.some((rule) => rule(uploadContext, context)))
    .map(({ torrent, context }) => ({ name: torrent.name, url: torrent.url, trumpable: TRUMP_RULES.some((rule) => rule(uploadContext, context)) }))
```

Do not inline duplicate or trump logic inside the loop — all conditions belong in the rule arrays. See `server/services/tracker/trackers/ath.ts` and `ulcx.ts` for reference implementations.

## Editing Notes

- Keep changes small and aligned with existing patterns.
- Prefer single-responsibility methods: each method should do one clear job, and complex flows should be split into focused helper methods.
- Avoid unrelated refactors while implementing a feature.
- Keep persisted filenames stable unless a migration is intended. For example, `userCollection` still writes to `users.db`.
- Use ASCII text unless the surrounding file already uses non-ASCII.
- Do not add defensive checks for conditions that cannot realistically occur given the inputs the code receives. Only validate at genuine system boundaries (user input, external APIs). Unreachable branches hurt coverage and signal false uncertainty about invariants.
- Define helper/dependent functions after the function that uses them, in order of first usage. The public or top-level entry point comes first; its helpers follow.
- Prefer `switch` over multiple `if`/`else if` chains when branching on a single value.
