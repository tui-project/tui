# Contributing to tui

Thank you for considering a contribution. This document covers the conventions used across the codebase so your changes fit naturally with what's already there.

## Table of Contents

- [Development Setup](#development-setup)
- [Commit Messages](#commit-messages)
- [Server Route Conventions](#server-route-conventions)
- [Repository Conventions](#repository-conventions)
- [Shared Types](#shared-types)
- [Frontend Composables](#frontend-composables)
- [HTTP Clients](#http-clients)
- [Logging](#logging)
- [Tests](#tests)
- [General Coding Notes](#general-coding-notes)

---

## Development Setup

```bash
pnpm install        # install dependencies
pnpm dev            # start dev server at http://localhost:3000
pnpm typecheck      # TypeScript check
pnpm lint           # ESLint
pnpm lint:fix       # ESLint with auto-fix
pnpm test           # unit + Nuxt component tests
pnpm test:unit      # unit tests only (fastest feedback loop)
pnpm test:coverage  # full coverage report
```

Before finishing any change, both of these must pass cleanly:

```bash
pnpm test
pnpm typecheck
```

Prefer running the focused test for the file you changed first, then the full suite, then typecheck.

---

## Commit Messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format: `type: short summary` (under 72 chars).

Follow the subject line with 1–2 sentences explaining what changed and why — enough context to understand the fix without reading the diff. No bullet points, no lengthy descriptions.

```
feat: add language cache refresh on TMDB fetch

Stores fetched languages in NeDB and refreshes automatically after 30 days.
Falling back to cached data when the TMDB request fails avoids breaking metadata lookups.
```

---

## Server Route Conventions

- Route handlers live in `server/api/` using Nitro file-based routing.
- Keep handlers thin — validation, logging, and response shaping belong in the route; all database work goes through repositories.
- Use `defineEventHandler` as the default export.
- Import helpers like `readBody` and `createError` explicitly from `h3`.
- Validate every request body with Zod.
- For expected API error responses (validation failures, conflict states), use `createError` with a numeric `statusCode` and a stable machine-readable `message` string.
- Log a `warn` alongside any expected API error response, including useful non-sensitive context.

```ts
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    // validate, call repository, return result
})
```

---

## Repository Conventions

- All database interaction lives in `server/repositories/`.
- Method names use clear verb-first naming: `createUser`, `findAllUsers`, `userCount`, `createSession`, `getSettings`.
- Include the entity in the method name when it improves readability at the call site.
- Datastores are loaded at app startup; do not add per-method `autoloadPromise` waits.
- Raw datastore exports live in `server/utils/db.ts`. Application code should always go through repositories, never import collections directly.
- Pass only the specific values a callee needs — avoid threading broad objects like a full `settings` record through multiple layers when the callee can resolve what it needs internally.

---

## Shared Types

Types exported from `shared/types/` are auto-imported by Nuxt 4 and available globally in both `app/` and `server/` layers. Do not add explicit import statements for them.

---

## Frontend Composables

Composables under `app/composables/` wrap `useFetch` with `immediate: false, watch: false` and expose `{ pending, error, data, execute }`.

Name them with a verb prefix matching the HTTP method:

| Prefix | Method |
|---|---|
| `useGet*` | GET |
| `usePost*` | POST |
| `usePatch*` | PATCH |

Do not expose a manual `loading` ref — use `pending` from `useFetch`.

Non-HTTP utility composables (e.g. `useBbcodeRender`, `useDescriptionFooter`, `useTrackerRequestStatus`) do not wrap `useFetch` and are named descriptively without a method prefix.

---

## HTTP Clients

Use `$fetch` (Nitro global, ofetch under the hood) for all server-side HTTP requests. Do not use the native `fetch` API. `$fetch` is available globally in Nitro without imports and automatically throws on non-2xx responses.

---

## Logging

Use `logger` from `server/utils/logger.ts`.

- `trace` / `debug` — high-frequency or low-value events (e.g. request received)
- `info` — meaningful state transitions or actions (e.g. upload succeeded, torrent created)
- `warn` — expected error responses returned to the client
- `error` — unexpected failures

Never log passwords, password hashes, tokens, or any secrets.

---

## Tests

### File placement

Test files mirror the source tree:

| Source | Test |
|---|---|
| `server/api/...` | `test/e2e/server/api/...` |
| `server/repositories/...` | `test/unit/server/repositories/...` |
| `server/utils/...` | `test/unit/server/utils/...` |
| `app/composables/...` | `test/unit/app/composables/...` |
| `app/components/...` or `app/pages/...` | `test/nuxt/...` |

### Unit tests

- Cover non-route modules (repositories, utilities, services) under `test/unit/`.
- Do not import Nitro route handlers directly in unit tests.
- When testing modules that initialize the database:
  1. Call `vi.resetModules()` before importing the module under test.
  2. Set `process.env.DATABASE_DIR` to a temp directory before import.
  3. Remove the temp directory and delete env vars in `afterEach`.

### Nuxt component tests

- Use `renderSuspended` from `@nuxt/test-utils/runtime`.
- Use queries from `@testing-library/vue` (`screen.getByRole`, `getByText`, `getByPlaceholderText`, etc.).
- Use `@testing-library/user-event` for interactions. Always pass `{ delay: null }` to `userEvent.setup()`.
- Prefer selector-based assertions over broad text checks or index-based access (`findAll(...)[0]`).
- Prefer `renderSuspended` + selector-driven interactions over Vue Test Utils component-instance access (`findComponent`, `vm.$emit`).

### Parameterised tests

When multiple test cases share the same logic and differ only in input/output values, use `it.each(...)` instead of repeating the test body. This applies to all test types — unit, nuxt, and e2e.

### Coverage

Every changed or added file must have 100% line, statement, and branch coverage — including error paths and null guards. Run `pnpm test:coverage` and verify before opening a PR.

---

## General Coding Notes

- Keep changes small and aligned with existing patterns. Avoid unrelated refactors while implementing a feature.
- Prefer single-responsibility methods. Complex flows should be split into focused helpers.
- Define helper functions after the function that uses them, in order of first usage.
- Prefer `switch` over chains of `if`/`else if` when branching on a single value.
- Do not add defensive checks for conditions that cannot realistically occur given the inputs the code receives. Only validate at genuine system boundaries (user input, external APIs).
- Keep persisted filenames stable unless a migration is intentional.
- Use ASCII text unless the surrounding file already uses non-ASCII characters.
