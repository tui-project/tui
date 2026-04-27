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

Unit tests mirror the source tree under `test/unit/server`.

Examples:

- `server/api/setup/status.get.ts` -> `test/unit/server/api/setup/status.get.test.ts`
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

When testing Nitro route handlers directly in unit tests, stub `defineEventHandler` before importing the route:

```ts
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
```

## Editing Notes

- Keep changes small and aligned with existing patterns.
- Avoid unrelated refactors while implementing a feature.
- Keep persisted filenames stable unless a migration is intended. For example, `userCollection` still writes to `users.db`.
- Use ASCII text unless the surrounding file already uses non-ASCII.
