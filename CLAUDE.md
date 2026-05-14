# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Two ways to run the server:

- **From source (fast iteration, tsx watch)**: `dev:mcp`
- **From compiled `dist/` (what Claude Desktop runs)**: `start:mcp` (auto-rebuilds via `prestart:mcp`)

Scripts:

- `npm install` - **ALWAYS run first** to install dependencies
- `npm run dev:mcp` - Run the MCP server from TS source in tsx watch mode
- `npm run start:mcp` - Build and run the MCP server from compiled `dist/`
- `npm run build` - Compile TS to JS in `dist/` (uses `tsconfig.build.json`, excludes tests)
- `npm run typecheck` - Type-check without emitting (`tsc --noEmit`)
- `npm run inspect` - Use MCP Inspector to test the server interactively (runs TS via tsx)
- `npm test` - Run vitest tests (use `npm run test:watch` for watch mode)
- `npm run lint:check` - Lint and format-check TS/JS/JSON with Biome
- `npm run lint:fix` - Auto-fix Biome lint findings (with `--unsafe`) and apply formatting
- `npm run format` - Apply Biome formatting only (no lint)
- `npm run lint:md` - Format and lint markdown files (prettier + markdownlint; Biome doesn't format markdown yet)
- `npm run lint:package` - Format `package.json` with syncpack
- `npm run lint:deps:missing` - Add missing dependencies detected by depcheck
- `npm run lint:deps:unused` - Remove unused devDependencies detected by depcheck
- `npm run update:libs` - Check for outdated packages with npm-check-updates
- `npm run clean` - Remove `dist/` and `node_modules/`

## Architecture Overview

`mcp-kb` is a stdio MCP (Model Context Protocol) server that exposes read/write access to a local directory of markdown files as a knowledge base. All paths are validated against the configured root to prevent directory traversal.

### Source Layout

The codebase is TypeScript with ES modules (`"type": "module"` in `package.json`). Source lives under `src/`; compiled JS is emitted to `dist/` by `npm run build` (via `tsconfig.build.json`).

- `src/mcp-server/index.ts` - Entry point. Boots the MCP server and registers each tool; delegates implementation to `notes.ts`.
- `src/config.ts` - Loads and validates the `MCP_KB_ROOT_PATH` env var; exports the resolved `ROOT_PATH` constant.
- `src/shared/annotations.ts` - MCP tool annotation presets (`READ_ONLY`, `DESTRUCTIVE`).
- `src/utils.ts` - Lexical guard `resolveWithinRoot`, async realpath guard `assertRealPathWithinRoot`, plus `errorResult`/`jsonResult` helpers and the `isNodeError` type guard.
- `src/protected.ts` - `isProtectedPath` predicate: hides dotfiles/dotdirs at any depth and root-level repo-meta basenames.
- `src/notes.ts` - Tool handlers: `readNote`, `listNotes`, `listFolders`, `writeNote`.

### Tools Exposed

All tools take KB-relative paths and reject any traversal outside `MCP_KB_ROOT_PATH`.

- `kb_read_note` - Read full markdown content of a note. Read-only, idempotent.
- `kb_list_notes` - List `.md` files in a directory, optionally recursive. Read-only.
- `kb_list_folders` - List subfolders in a directory, optionally recursive. Read-only. Same input schema as `kb_list_notes`.
- `kb_write_note` - Write or overwrite a note. Optionally creates parent dirs (`create_dirs`, default `true`). Marked destructive in tool annotations.

### Key Components

- **Root**: `ROOT_PATH` (TS const) is resolved once at startup in `config.ts` from `process.env.MCP_KB_ROOT_PATH`. `~` is expanded to the user home dir.
- **Path safety (two layers)**:
  1. `resolveWithinRoot()` in `src/utils.ts` normalises separators, strips leading slashes, then verifies the resolved absolute path is strictly inside the root (handles trailing-separator edge case). Throws `Path escapes root` on traversal attempts.
  2. `assertRealPathWithinRoot()` (also in `src/utils.ts`) calls `fs.realpath` on both the root and the target — or, for new-file writes, the deepest existing ancestor — and rejects symlink-based escapes that the lexical check cannot see. Handlers call this after `resolveWithinRoot` and before any FS access.
- **Protected paths**: `isProtectedPath()` in `src/protected.ts` is the single source of truth. Two rules:
  - any path segment starting with `.` is protected at any depth (dotfile/dotdir convention);
  - root-level basenames `README`, `CLAUDE`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `AGENTS` (case-insensitive, with optional `.md`/`.txt`) are protected. Nested files with the same names remain accessible.
  - `kb_read_note`/`kb_write_note` reject protected paths with `Path is protected`. `kb_list_notes`/`kb_list_folders` silently filter protected entries and reject a protected `path` argument.
- **File-type discipline**: `kb_read_note`/`kb_write_note` reject paths that don't end in `.md` (`Notes must end in ".md"`); `kb_read_note` also stats the target and rejects directories (`Not a note file`); `kb_list_folders` only emits directories; `kb_list_notes` only emits `.md` files.
- **Error shape**: Tool errors return `{ isError: true, content: [{ type: 'text', text }] }` via the `errorResult()` helper. `ENOENT` is mapped to friendly messages ("File not found", "Directory not found").
- **Transport**: `StdioServerTransport` from `@modelcontextprotocol/sdk`. Logs go to stderr (`console.error`) so they don't pollute the stdio MCP channel.

## Configuration

### Environment Variables

- `MCP_KB_ROOT_PATH` (**required**) - Absolute path or `~/...` to the knowledge base root. The server asserts this is set at startup; missing it causes a hard exit.
- `MCP_KB_AUDIT_LOG_PATH` (optional) - JSONL audit log path. Defaults to `~/.local/state/mcp-kb/audit.jsonl`. Every destructive tool invocation (those with `destructiveHint: true`) appends one event with `{ts, server, tool, role, ok, duration_ms, error?, args}` (the `content` arg of `kb_write_note` is redacted). Write failures go to stderr only and never block the tool call. See [src/shared/audit-log.ts](./src/shared/audit-log.ts).
- `MCP_KB_AUDIT_LOG_ALL` (optional, `1` to enable) - Also log read-only tools (`kb_read_note`, `kb_list_notes`, `kb_list_folders`).

### Boot-time Checks

- The server verifies `MCP_KB_ROOT_PATH` is accessible (`fs.access`) before connecting the transport. If not accessible, it logs a hint and returns without crashing.

## Security Requirements

Invariants every tool that touches the filesystem must uphold. New tools and changes to existing tools must preserve all of these.

1. **Two-layer path containment, every call site.** Before any `fs.*` call, run user input through **both** `resolveWithinRoot()` (lexical) and `assertRealPathWithinRoot()` (realpath). The lexical guard catches `..`, absolute-style inputs, and Windows separators; the realpath guard catches symlink escapes that the lexical check cannot see. Both live in [src/utils.ts](./src/utils.ts).
2. **Protected paths are non-negotiable.** Every read/write/list handler calls `isProtectedPath()` on the resolved path. Dotfiles/dotdirs at any depth and root-level repo-meta names (README, CLAUDE, LICENSE, etc.) must remain unreachable. New tools that touch the FS must call this filter — see existing handlers in [src/notes.ts](./src/notes.ts) for the pattern.
3. **File-type discipline.** Note tools only accept `.md` paths and reject non-files. New tools that walk the tree must filter by intended type, not return arbitrary files.
4. **Zod schemas are `.strict()`.** All tool input schemas reject unknown fields. Numeric inputs are bounded.
5. **No shell-string interpolation.** This server does not shell out today. If a future tool needs to, use `execFile` with an argv array — never `exec` or string concatenation.
6. **Error messages must not leak the absolute root.** Error text uses relative paths (`path.relative(MCP_KB_ROOT_PATH, ...)`) when surfacing what the caller asked for.

Tests covering these invariants live in [src/notes.test.ts](./src/notes.test.ts): `rejects path traversal` (per tool), `rejects deeply nested traversal that escapes root`, `rejects symlink escape via realpath check`, `rejects writeNote into a symlinked-out directory`. Any new tool that touches the FS gets parallel coverage.

## Common Setup Issues

1. **Missing dependencies**: Run `npm install` first.
2. **`MCP_KB_ROOT_PATH` not set**: Server aborts at startup. Set it in the Claude Desktop config `env` block (see README) or in your shell when running `dev:mcp`.
3. **Root path doesn't exist**: Server logs `MCP_KB_ROOT_PATH not accessible` and exits cleanly. Verify the path and that `~` was expanded as expected.

## Error Handling

- Path traversal: `Path escapes root: "<input>"`
- Missing file (read): `File not found: "<path>" (root: <root>)`
- Missing directory (list): `Directory not found: "<path>"`
- Missing parent on write: `Directory not found for: "<path>" — set create_dirs: true to create it automatically`
- All other errors are surfaced as `Error <action>: <message>` via `errorResult()`.
