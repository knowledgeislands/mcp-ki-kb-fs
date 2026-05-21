# CLAUDE.md

Guidance for Claude Code when working in this repo. The user-facing tool surface, install/config, and Claude Desktop setup live in [README.md](./README.md); this file covers what Claude needs that isn't in README and isn't derivable from one grep.

## Bun vs Node

This project uses Bun (≥ 1.3) for install and dev scripts, but the compiled `dist/` runs under Node (≥ 22) — that's what Claude Desktop launches.

- `bun run test` (NOT `bun test` — the latter invokes Bun's own runner instead of vitest).
- Bun auto-loads `.env.${NODE_ENV}` from the CWD; Node needs the explicit `process.loadEnvFile()` call in [src/config.ts](./src/config.ts). The try/catch swallows the `TypeError` Bun raises (no `process.loadEnvFile`), so the same code works under both.
- `NODE_ENV` is set to `development` only by `server:mcp:dev` and `server:mcp:inspect`. Claude Desktop doesn't set it, so `.env.*` is ignored in production — `MCP_KB_FS_ROOT_PATH` must come from the Claude Desktop config `env` block.

Run `bun run` with no args for the full script list.

## Architecture Invariants

### Naming convention

Tool names follow `<app>_<resource>_<action>` (snake_case) with `<app>` = `kb`. Plural resource for collection ops, singular for single-item ops (`kb_notes_list`, `kb_folders_list`, `kb_note_read`, `kb_note_write`).

### Access-level gate — driven by annotations, not names

[src/utils/access-level.ts](./src/utils/access-level.ts) `makeAccessGatedRegister()` decides at startup whether to register each tool, based on `config.annotations`:

- `readOnlyHint: true` → `read`
- `destructiveHint: true` → `destructive`
- explicit `readOnlyHint: false` AND `destructiveHint: false` → `write` (non-destructive mutation)
- anything else (unannotated / partially annotated) → `destructive` (fail-safe)

A tool registers when its derived level is at or below `MCP_KB_FS_ACCESS_LEVEL` (default: `read`). Levels nest: `read` registers only readers; `write` adds non-destructive mutations (rename, mkdir); `destructive` adds the rest (overwrite, delete). New tools MUST set `annotations` to one of the presets in [src/utils/annotations.ts](./src/utils/annotations.ts): `READ_ONLY`, `WRITE`/`WRITE_IDEMPOTENT` (write tier — non-idempotent vs. retry-safe), or `DESTRUCTIVE`. Do not bypass the proxy.

## Security Requirements

This server reads and writes files anywhere under `MCP_KB_FS_ROOT_PATH`. New tools and changes to existing tools MUST preserve every invariant below.

1. **Two-layer path containment, every call site.** Before any `fs.*` call, run user input through **both** `resolveWithinRoot()` (lexical guard — rejects `..`, absolute-style inputs, Windows separators) AND `assertRealPathWithinRoot()` (realpath guard — rejects symlink escapes). For new-file writes the realpath guard checks the deepest existing ancestor. Both live in [src/utils/utils.ts](./src/utils/utils.ts).
2. **Protected paths are non-negotiable.** Every read/write/list handler calls `isProtectedPath()` ([src/protected.ts](./src/protected.ts)). Dotfiles/dotdirs at any depth and root-level repo-meta names (README, CLAUDE, LICENSE, CHANGELOG, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, AGENTS — with optional `.md`/`.txt`) must remain unreachable. New FS-touching tools must call this filter.
3. **File-type discipline.** Note tools only accept `.md` paths and reject directories. New tools that walk the tree must filter by intended type, not return arbitrary files.
4. **Destructive tools require `dry_run` default `true`.** `kb_note_write` defaults to a `[dry_run] would create/overwrite (N bytes)` preview; only mutates when `dry_run: false` is explicit. New `DESTRUCTIVE`-annotated tools must follow this.
5. **Zod schemas are `.strict()`.** Already true everywhere; new schemas must continue this.
6. **No shell-string interpolation.** This server doesn't shell out today. If a future tool needs to, use `execFile` with an argv array.
7. **Error messages must not leak the absolute root.** Surface what the caller asked for via `path.relative(MCP_KB_FS_ROOT_PATH, ...)`.

Traversal- and symlink-rejection tests live in [src/notes.test.ts](./src/notes.test.ts).

## Tool registration call sites

Tools are registered in [src/tools/notes/index.ts](./src/tools/notes/index.ts). To survey the surface, `grep "registerTool" src/tools/*/index.ts`. README's [Available Tools](./README.md#available-tools) tabulates them with purposes.
