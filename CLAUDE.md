# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This project uses [Bun](https://bun.sh) (≥ 1.3) for dependency install and dev scripts. The published `dist/` bundle still runs under Node.js (≥ 22) — that's what Claude Desktop launches.

Two ways to run the server:

- **From source (fast iteration, `bun --watch`)**: `bun run server:mcp:dev`
- **From compiled `dist/` (what Claude Desktop runs, under node)**: `bun run server:mcp:start` (builds first, then runs)

Scripts use a `<group>:<sub>:<action>` convention: `server:<type>:<action>` for runnable servers (generalizes to other server types in sibling repos), `lint:*` for code checks/formatting, `deps:*` for dependency management, `test:*` for vitest.

- `bun install` - **ALWAYS run first** to install dependencies
- `bun run server:mcp:dev` - Run the MCP server from TS source under `bun --watch`
- `bun run server:mcp:start` - Build and run the MCP server from compiled `dist/` under node
- `bun run server:mcp:inspect` - Use MCP Inspector to test the server interactively (runs TS via bun)
- `bun run build` - Compile TS to JS in `dist/` via `tsc` (uses `tsconfig.build.json`, excludes tests)
- `bun run lint:types` - Type-check without emitting (`tsc --noEmit`)
- `bun run test` - Run vitest tests (note: `bun run test`, not `bun test` — `bun test` invokes Bun's own runner). Use `bun run test:watch` for watch mode
- `bun run lint:check` - Lint and format-check TS/JS/JSON with Biome
- `bun run lint:fix` - Auto-fix Biome lint findings (with `--unsafe`) and apply formatting
- `bun run lint:format` - Apply Biome formatting only (no lint)
- `bun run lint:md` - Format and lint markdown files (prettier + markdownlint; Biome doesn't format markdown yet)
- `bun run lint:package` - Format `package.json` with syncpack
- `bun run deps:missing` - Add missing dependencies detected by depcheck
- `bun run deps:unused` - Remove unused devDependencies detected by depcheck
- `bun run deps:update` - Update all dependencies via `bun update`
- `bun run clean` - Remove `dist/` and `node_modules/`

## Architecture Overview

`mcp-kb-fs` is a stdio MCP (Model Context Protocol) server that exposes read/write access to a local directory of markdown files as a knowledge base. All paths are validated against the configured root to prevent directory traversal.

### Source Layout

The codebase is TypeScript with ES modules (`"type": "module"` in `package.json`). Source lives under `src/`; compiled JS is emitted to `dist/` by `bun run build` (via `tsconfig.build.json`).

- `src/mcp-server/index.ts` - Entry point. Boots the MCP server and registers each tool; delegates implementation to `notes.ts`.
- `src/config.ts` - Loads and validates the `MCP_KB_FS_ROOT_PATH` env var; exports the resolved `ROOT_PATH` constant.
- `src/utils/annotations.ts` - MCP tool annotation presets (`READ_ONLY`, `DESTRUCTIVE`).
- `src/utils/utils.ts` - Lexical guard `resolveWithinRoot`, async realpath guard `assertRealPathWithinRoot`, plus `errorResult`/`jsonResult` helpers and the `isNodeError` type guard.
- `src/protected.ts` - `isProtectedPath` predicate: hides dotfiles/dotdirs at any depth and root-level repo-meta basenames.
- `src/notes.ts` - Tool handlers: `readNote`, `listNotes`, `listFolders`, `writeNote`.

### Tools Exposed

Tools are grouped by **role**, encoded as a `viewer_` (read-only) or `editor_` (destructive) prefix in the tool name. Role gating is enforced at registration via `MCP_KB_FS_ROLES` (default `viewer` only — see [Environment Variables](#environment-variables)). All tools take KB-relative paths and reject any traversal outside `MCP_KB_FS_ROOT_PATH`.

- `viewer_kb_read_note` - Read full markdown content of a note. Read-only, idempotent.
- `viewer_kb_list_notes` - List `.md` files in a directory, optionally recursive. Read-only.
- `viewer_kb_list_folders` - List subfolders in a directory, optionally recursive. Read-only. Same input schema as `viewer_kb_list_notes`.
- `editor_kb_write_note` - Write or overwrite a note. Optionally creates parent dirs (`create_dirs`, default `true`). Marked destructive in tool annotations. `dry_run` defaults to `true` — callers must pass `dry_run: false` to actually write; dry-run returns a `[dry_run] would create (N bytes)` or `[dry_run] would overwrite (M → N bytes)` preview without touching disk.

### Key Components

- **Root**: `ROOT_PATH` (TS const) is resolved once at startup in `config.ts` from `process.env.MCP_KB_FS_ROOT_PATH`. `~` is expanded to the user home dir.
- **Path safety (two layers)**:
  1. `resolveWithinRoot()` in `src/utils/utils.ts` normalises separators, strips leading slashes, then verifies the resolved absolute path is strictly inside the root (handles trailing-separator edge case). Throws `Path escapes root` on traversal attempts.
  2. `assertRealPathWithinRoot()` (also in `src/utils/utils.ts`) calls `fs.realpath` on both the root and the target — or, for new-file writes, the deepest existing ancestor — and rejects symlink-based escapes that the lexical check cannot see. Handlers call this after `resolveWithinRoot` and before any FS access.
- **Protected paths**: `isProtectedPath()` in `src/protected.ts` is the single source of truth. Two rules:
  - any path segment starting with `.` is protected at any depth (dotfile/dotdir convention);
  - root-level basenames `README`, `CLAUDE`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `AGENTS` (case-insensitive, with optional `.md`/`.txt`) are protected. Nested files with the same names remain accessible.
  - `viewer_kb_read_note`/`editor_kb_write_note` reject protected paths with `Path is protected`. `viewer_kb_list_notes`/`viewer_kb_list_folders` silently filter protected entries and reject a protected `path` argument.
- **File-type discipline**: `viewer_kb_read_note`/`editor_kb_write_note` reject paths that don't end in `.md` (`Notes must end in ".md"`); `viewer_kb_read_note` also stats the target and rejects directories (`Not a note file`); `viewer_kb_list_folders` only emits directories; `viewer_kb_list_notes` only emits `.md` files.
- **Error shape**: Tool errors return `{ isError: true, content: [{ type: 'text', text }] }` via the `errorResult()` helper. `ENOENT` is mapped to friendly messages ("File not found", "Directory not found").
- **Transport**: `StdioServerTransport` from `@modelcontextprotocol/sdk`. Logs go to stderr (`console.error`) so they don't pollute the stdio MCP channel.

## Configuration

### Environment Variables

- `MCP_KB_FS_ROOT_PATH` (**required**) - Absolute path or `~/...` to the knowledge base root. The server asserts this is set at startup; missing it causes a hard exit.
- `MCP_KB_FS_ROLES` (optional) - comma-separated list of enabled roles. Allowed values: `viewer`, `editor`. Defaults to `viewer` only (least privilege) when unset or empty. Tool names are prefixed with `viewer_` or `editor_` and are only registered when the corresponding role is enabled; tools for disabled roles are silently skipped at registration via the proxy in [src/utils/roles.ts](./src/utils/roles.ts). An unknown value aborts startup with `Invalid MCP_KB_FS_ROLES entries: ...`.
- `MCP_KB_FS_AUDIT_LOG` (optional, default `writes`) - scope of the JSONL audit log. `off` disables logging entirely; `writes` records only `editor_*` tools; `all` records every tool. Each event has `{ts, server, tool, role, ok, duration_ms, error?, args}` (the `content` arg of `editor_kb_write_note` is redacted). Write failures go to stderr only and never block the tool call. Unknown values abort startup. See [src/utils/audit-log.ts](./src/utils/audit-log.ts).
- `MCP_KB_FS_AUDIT_LOG_PATH` (optional) - audit log path. Defaults to `~/.local/state/mcp-kb-fs/audit.jsonl`. Created with mode `0o600` and chmodded down once per process if it already exists with looser permissions.
- `MCP_KB_FS_AUDIT_LOG_MAX_BYTES` (optional, default `10485760` = 10 MiB) - size threshold for rotation. When the live `audit.jsonl` exceeds this after an append, it's renamed to `audit.jsonl.1` and older rotations shift up. `0` disables rotation.
- `MCP_KB_FS_AUDIT_LOG_KEEP` (optional, default `5`) - number of rotated files to retain. The oldest beyond this count is dropped. `0` truncates without preserving history.

### Boot-time Checks

- The server verifies `MCP_KB_FS_ROOT_PATH` is accessible (`fs.access`) before connecting the transport. If not accessible, it logs a hint and returns without crashing.

## Security Requirements

Invariants every tool that touches the filesystem must uphold. New tools and changes to existing tools must preserve all of these.

1. **Two-layer path containment, every call site.** Before any `fs.*` call, run user input through **both** `resolveWithinRoot()` (lexical) and `assertRealPathWithinRoot()` (realpath). The lexical guard catches `..`, absolute-style inputs, and Windows separators; the realpath guard catches symlink escapes that the lexical check cannot see. Both live in [src/utils/utils.ts](./src/utils/utils.ts).
2. **Protected paths are non-negotiable.** Every read/write/list handler calls `isProtectedPath()` on the resolved path. Dotfiles/dotdirs at any depth and root-level repo-meta names (README, CLAUDE, LICENSE, etc.) must remain unreachable. New tools that touch the FS must call this filter — see existing handlers in [src/notes.ts](./src/notes.ts) for the pattern.
3. **File-type discipline.** Note tools only accept `.md` paths and reject non-files. New tools that walk the tree must filter by intended type, not return arbitrary files.
4. **Zod schemas are `.strict()`.** All tool input schemas reject unknown fields. Numeric inputs are bounded.
5. **No shell-string interpolation.** This server does not shell out today. If a future tool needs to, use `execFile` with an argv array — never `exec` or string concatenation.
6. **Error messages must not leak the absolute root.** Error text uses relative paths (`path.relative(MCP_KB_FS_ROOT_PATH, ...)`) when surfacing what the caller asked for.

Tests covering these invariants live in [src/notes.test.ts](./src/notes.test.ts): `rejects path traversal` (per tool), `rejects deeply nested traversal that escapes root`, `rejects symlink escape via realpath check`, `rejects writeNote into a symlinked-out directory`. Any new tool that touches the FS gets parallel coverage.

## Common Setup Issues

1. **Missing dependencies**: Run `bun install` first.
2. **`MCP_KB_FS_ROOT_PATH` not set**: Server aborts at startup. Set it in the Claude Desktop config `env` block (see README) or in your shell when running `bun run server:mcp:dev`.
3. **Root path doesn't exist**: Server logs `MCP_KB_FS_ROOT_PATH not accessible` and exits cleanly. Verify the path and that `~` was expanded as expected.

## Error Handling

- Path traversal: `Path escapes root: "<input>"`
- Missing file (read): `File not found: "<path>" (root: <root>)`
- Missing directory (list): `Directory not found: "<path>"`
- Missing parent on write: `Directory not found for: "<path>" — set create_dirs: true to create it automatically`
- All other errors are surfaced as `Error <action>: <message>` via `errorResult()`.
