# AGENTS.md

## Workspace

- **pnpm + moonrepo** monorepo. Tasks run via `moon <project>:<task>` or `moon :<task>` (all projects).
- Node 22, pnpm 10.30, TypeScript ~6.0.
- Workspace root: `/home/fahmi/Kode/Hackathon/Paperwish/apps`

## Projects

| ID | Path | Stack |
|---|---|---|
| `platform` | `apps/platform/` | React Router v7 SPA, Tailwind CSS v4, Vite |

- `ssr: false` in `react-router.config.ts` — purely client-side.
- `packages/` directory exists but is **empty** (no packages yet). `shared-ui` is referenced in configs but does not exist.
- `#/` path alias maps to `app/*`.

## Commands

Use `pnpm` directly or `moon` for cache-aware task orchestration.

| Action | Command |
|---|---|
| Dev server (platform) | `moon platform:dev` or `pnpm --filter platform dev` |
| Build | `moon platform:build` or `pnpm --filter platform build` |
| Typecheck | `moon platform:typecheck` or `pnpm --filter platform typecheck` |
| Lint | `moon :lint` (all projects) or `pnpm run lint` (root biome lint) |
| Check | `moon :check` (all projects) or `pnpm run check` (biome check) |
| Format | `pnpm run format` (biome format) |
| Unit tests | `moon platform:test` or `pnpm --filter platform test` |
| E2E tests | `pnpm --filter platform e2e` |
| Docker services | `pnpm run compose:up` / `compose:down` / `compose:cleanup` |
| Update deps | `pnpm run update-deps` (interactive via npm-check-updates) |

`moon platform:dev` and `platform:build` depend on `prebuild` which requires `shared-ui:build`. Since shared-ui does not exist, these tasks will fail — run `pnpm --filter platform dev` instead.

## Toolchain & Style

- **Biome** for lint, format, organize imports (auto-fix on save in VS Code).
- JS/TS: single quotes, semicolons `asNeeded`, trailing commas `es5`, indent 2.
- Non-JS files: indent 4 spaces.
- `verbatimModuleSyntax` enabled — use `import type` for type-only imports.
- Tailwind CSS v4 (`@import "tailwindcss"`, `@theme` directive, `@plugin "tailwindcss-motion"`).
- `useSortedClasses` rule in `nursery` (warn, not fix on save) — Tailwind class sorting not auto-applied.

## Testing

- **Vitest** with `happy-dom`, globals enabled, HTML reporter.
- Unit tests: `tests/**/*.{test,spec}.{ts,tsx}`, setup at `tests/setup-client.ts`.
- Coverage: v8 provider, output to `tests-results/coverage`.
- **Playwright** e2e: `tests-e2e/`, 4 projects (Chromium, Firefox, Safari, Mobile Chrome).
- E2E dev server: builds + previews on port 3001 by default.

## Docker

- Compose services: Postgres (5432), Mailpit (1025/8025), instrumentation (Jaeger etc). Uncomment for MinIO, ClickHouse, Redis.
- Production image: `joseluisq/static-web-server` serving `build/client` via SWS, distroless runtime.

## VCS

- GitLab, default branch `main`.
- Pre-commit hook (defined in `.moon/workspace.yml`): `moon run :format --affected --status=all` then `moon run :lint --affected --status=staged`.

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.

## Local Effect Source

The Effect v4 repository is cloned to `~/.local/share/effect-solutions/effect` for reference.
Use this to explore APIs, find usage examples, and understand implementation
details when the documentation isn't enough.
