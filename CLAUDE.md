# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Two axes:

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

- `src/index.ts` - Entry point. Boots the MCP server and registers each tool; delegates implementation to `notes.ts`.
- `src/config.ts` - Loads and validates the `ROOT_PATH` env var; exports the resolved `ROOT_PATH` constant.
- `src/utils.ts` - Path-traversal-safe `resolveWithinRoot`, `errorResult`, `jsonResult` helpers, `isNodeError` type guard.
- `src/notes.ts` - Tool handlers: `readNote`, `listNotes`, `writeNote`.

### Tools Exposed

All three tools take KB-relative paths and reject any traversal outside `ROOT_PATH`.

- `kb_read_note` - Read full markdown content of a note. Read-only, idempotent.
- `kb_list_notes` - List `.md` files in a directory, optionally recursive. Read-only.
- `kb_write_note` - Write or overwrite a note. Optionally creates parent dirs (`create_dirs`, default `true`). Marked destructive in tool annotations.

### Key Components

- **Root**: `ROOT_PATH` is resolved once at startup in `config.ts` from `process.env.ROOT_PATH`. `~` is expanded to the user home dir.
- **Path safety**: `resolveWithinRoot()` in `src/utils.ts` normalises separators, strips leading slashes, then verifies the resolved absolute path is strictly inside the root (handles trailing-separator edge case). Throws `Path escapes root` on traversal attempts.
- **Error shape**: Tool errors return `{ isError: true, content: [{ type: 'text', text }] }` via the `errorResult()` helper. `ENOENT` is mapped to friendly messages ("File not found", "Directory not found").
- **Transport**: `StdioServerTransport` from `@modelcontextprotocol/sdk`. Logs go to stderr (`console.error`) so they don't pollute the stdio MCP channel.

## Configuration

### Environment Variables

- `ROOT_PATH` (**required**) - Absolute path or `~/...` to the knowledge base root. The server asserts this is set at startup; missing it causes a hard exit.

### Boot-time Checks

- The server verifies `ROOT_PATH` is accessible (`fs.access`) before connecting the transport. If not accessible, it logs a hint and returns without crashing.

## Common Setup Issues

1. **Missing dependencies**: Run `npm install` first.
2. **`ROOT_PATH` not set**: Server aborts at startup. Set it in the Claude Desktop config `env` block (see README) or in your shell when running `dev:mcp`.
3. **Root path doesn't exist**: Server logs `ROOT_PATH not accessible` and exits cleanly. Verify the path and that `~` was expanded as expected.

## Error Handling

- Path traversal: `Path escapes root: "<input>"`
- Missing file (read): `File not found: "<path>" (root: <root>)`
- Missing directory (list): `Directory not found: "<path>"`
- Missing parent on write: `Directory not found for: "<path>" — set create_dirs: true to create it automatically`
- All other errors are surfaced as `Error <action>: <message>` via `errorResult()`.
