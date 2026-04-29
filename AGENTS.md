# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

This is a Nuxt application with Nitro server routes under `server/api`.

Server-side persistence currently uses NeDB via `@seald-io/nedb`. The database is configured in `server/utils/db.ts` and stores the user collection in `config/database/users.db` by default. Tests override `DATABASE_DIR` so they do not touch local development data.

## Local Commands

- Run unit tests: `pnpm vitest run --project unit`
- Run a focused unit test: `pnpm vitest run --project unit path/to/file.test.ts`
- Run typecheck: `pnpm typecheck`
- Run lint: `pnpm lint`
- Start dev server: `pnpm dev`

Prefer running the focused test first after a small change, then the full unit project before finishing.

## Server Route Conventions

- Use Nitro file routes in `server/api`.
- Keep route handlers thin. Validation, logging, and response shaping can live in the route; database interactions should go through repositories.
- Existing route files use direct default exports with `defineEventHandler`.
- Import explicit helpers such as `readBody` and `createError` from `h3` when needed.
- For expected API error responses (for example validation errors or conflict states), prefer `setResponseStatus(event, <status>)` and return a JSON payload with this shape:
    - `code`: stable machine-readable identifier
    - `message`: human-readable summary
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
- Repository method names should be contextual and avoid repeating the entity name. For example, use `create`, `findAll`, and `count` inside `user-repository.ts`, not `createUser`.
- Repositories should wait for datastore autoload before querying or writing:

```ts
await userCollection.autoloadPromise
```

- Keep raw datastore exports in `server/utils/db.ts`; application code should usually use repositories instead of importing collections directly.

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

For browser assertions in e2e page tests:

- Prefer selector-based checks such as `waitForSelector`, `getByRole`, `getByPlaceholder`, and `locator`.
- Avoid broad assertions against `page.textContent('body')`; assert targeted UI content via selectors instead.
- For repeated input scenarios, prefer parameterized tests with `it.each(...)` over manual `for` loops inside a single test.

Unit tests should cover non-route modules (for example repositories and utilities) under `test/unit/server`.

Examples:

- `server/api/setup/status.get.ts` -> `test/e2e/server/api/setup/status.get.test.ts`
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

- For newly added or modified runtime code, add or update tests so touched files keep 100% line, statement, and branch coverage.
- If a file is intentionally excluded from coverage (for example model/type-only files), document the reason in configuration comments.

## Editing Notes

- Keep changes small and aligned with existing patterns.
- Avoid unrelated refactors while implementing a feature.
- Keep persisted filenames stable unless a migration is intended. For example, `userCollection` still writes to `users.db`.
- Use ASCII text unless the surrounding file already uses non-ASCII.
