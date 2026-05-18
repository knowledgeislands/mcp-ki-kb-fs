# mcp-kb-fs

[![CI](https://github.com/knowledgeislands/mcp-kb-fs/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgeislands/mcp-kb-fs/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@knowledgeislands/mcp-kb-fs.svg)](https://www.npmjs.com/package/@knowledgeislands/mcp-kb-fs) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An MCP (Model Context Protocol) server that gives Claude read and write access to a local directory of markdown files as a knowledge base. Every file path is validated against the configured root, so the server cannot read or write outside it — even if asked to.

## Features

- **Read-only-by-default tools** — list and read are flagged as read-only and idempotent via MCP tool annotations.
- **Path safety in two layers** — lexical normalisation (rejects `..` and absolute-style escapes) plus a `realpath` check (rejects symlinks pointing outside the root).
- **Protected paths** — dotfiles/dotdirs at any depth (`.git`, `.obsidian`, …) and root-level repo-meta (`README.md`, `CLAUDE.md`, `LICENSE`, …) are hidden from list tools and rejected by read/write.
- **Strict file types** — notes must end in `.md`; folder listings only return directories.
- **No network, no auth** — pure local filesystem over MCP stdio.

**Quality:** 72 tests at 100% coverage across statements, branches, functions, and lines.

## Available Tools

Tools are grouped by **role**. Roles are toggled via the `MCP_KB_FS_ROLES` env var (comma-separated; defaults to `viewer` only when unset). Disabled-role tools are silently skipped at registration.

- **`viewer`** — read-only inventory and inspection (`viewer_*`).
- **`editor`** — destructive writes (`editor_*`).

| Tool                     | Role     | Description                                                                 |
| ------------------------ | -------- | --------------------------------------------------------------------------- |
| `viewer_kb_read_note`    | `viewer` | Read the full markdown content of a note by KB-relative path.               |
| `viewer_kb_list_notes`   | `viewer` | List `.md` files in a knowledge base directory; optional recursive descent. |
| `viewer_kb_list_folders` | `viewer` | List subfolders in a knowledge base directory; optional recursive descent.  |
| `editor_kb_write_note`   | `editor` | Write or overwrite a note. Optionally creates parent dirs (`create_dirs`).  |

### `viewer_kb_read_note`

```json
{
  "name": "viewer_kb_read_note",
  "arguments": { "path": "Pillars/Finance/Budget.md" }
}
```

Returns the raw markdown text. Path must end in `.md`. Errors:

- `File not found: "<path>" (root: <root>)`
- `Notes must end in ".md": "<path>"`
- `Path is protected: "<path>"` (root-level meta or any dotfile)
- `Path escapes root: "<path>"` (lexical or symlink)

### `viewer_kb_list_notes`

```json
{
  "name": "viewer_kb_list_notes",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

`path` defaults to `""` (knowledge base root). `recursive` defaults to `false`. Returns a newline-separated list of KB-relative `.md` paths, or `(no notes found)`.

### `viewer_kb_list_folders`

```json
{
  "name": "viewer_kb_list_folders",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

Same input shape as `viewer_kb_list_notes`. Returns a newline-separated list of KB-relative folder paths, or `(no folders found)`.

### `editor_kb_write_note`

```json
{
  "name": "editor_kb_write_note",
  "arguments": {
    "path": "Inbox/2026-04-30.md",
    "content": "# Notes\n\n- ...",
    "create_dirs": true
  }
}
```

`create_dirs` defaults to `true`. Returns `Written: "<path>" (<n> bytes)`. With `create_dirs: false` and a missing parent, returns `Directory not found for: "<path>" — set create_dirs: true to create it automatically`.

## Quick Start

1. **Install dependencies**: `bun install`
2. **Pick a knowledge base directory** — any folder of markdown files (can be empty).
3. **Build**: `bun run build`
4. **Configure Claude Desktop** with the path to `dist/mcp-server/index.js` and your `MCP_KB_FS_ROOT_PATH` (see [Configuration](#configuration)).
5. **Restart Claude Desktop** — the enabled `viewer_*` / `editor_*` tools should appear (defaults to viewer-only).

## Example Conversations

Concrete asks you might make of Claude with this server connected.

**Survey a section of the KB:**

> "List every note under `Pillars/Finance`, recursively."

Claude calls [`viewer_kb_list_notes`](#viewer_kb_list_notes) with `path: "Pillars/Finance", recursive: true` and returns the newline-separated list of KB-relative `.md` paths. Folders are excluded; only `.md` files appear.

**Read a specific note:**

> "Show me my Budget.md note from `Pillars/Finance`."

Claude calls [`viewer_kb_read_note`](#viewer_kb_read_note) with the KB-relative path. If the path doesn't end in `.md`, escapes the root, or matches a protected pattern (dotfile, root-level repo-meta), the tool returns a clear error string instead of silently failing.

**Capture meeting notes:**

> "Save these notes as today's daily under `Inbox/2026-05-13.md` — create the Inbox folder if it doesn't exist yet."

Claude calls [`editor_kb_write_note`](#editor_kb_write_note) with the markdown content and `create_dirs: true` (the default). The path goes through both the lexical and `realpath` safety checks before any byte is written. The `editor` role must be enabled via `MCP_KB_FS_ROLES=viewer,editor` for this tool to be available.

**Discover structure:**

> "What top-level folders exist in my knowledge base?"

Claude calls [`viewer_kb_list_folders`](#viewer_kb_list_folders) with `path: ""` (the root) and `recursive: false`. Same input shape as `viewer_kb_list_notes`; returns directories only.

## Installation

### Prerequisites

- [Bun](https://bun.sh) 1.3+ for the dev loop
- Node.js 22.0.0 or higher to run the compiled `dist/` (see `.node-version`)

### Install Dependencies

```bash
bun install
```

## Configuration

### Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `MCP_KB_FS_ROOT_PATH` | yes | Absolute path or `~/...` to the knowledge base root. The server asserts on startup. |
| `MCP_KB_FS_ROLES` | no | Comma-separated list of enabled roles. Allowed values: `viewer`, `editor`. Defaults to `viewer` only (least privilege) when unset or empty. Tool names are prefixed with `viewer_` or `editor_` and are only registered when the corresponding role is enabled; tools for disabled roles are silently skipped. An unknown value aborts startup. |
| `NODE_ENV` | no | Dev convention. `server:mcp:dev`/`server:mcp:inspect` set this to `development`, which makes [`src/config.ts`](./src/config.ts) load `.env.development` from the CWD. Unset under Claude Desktop, so `.env*` files are ignored in production. |

### Claude Desktop Configuration

Run `bun run build` first so `dist/mcp-server/index.js` exists, then add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "mcp-kb-fs": {
      "command": "node",
      "args": ["/path/to/mcp-kb-fs/dist/mcp-server/index.js"],
      "env": {
        "MCP_KB_FS_ROOT_PATH": "/path/to/your/kb"
      }
    }
  }
}
```

A starter is in [`claude-config-sample.json`](./claude-config-sample.json).

### Running From Source (Dev)

For fast iteration without rebuilding:

```bash
MCP_KB_FS_ROOT_PATH=~/notes bun run server:mcp:dev
```

This runs `src/mcp-server/index.ts` under `bun --watch`. Point Claude Desktop at this command during development if you want live reload.

Alternatively, copy [`.env.example`](./.env.example) to `.env.development` and set `MCP_KB_FS_ROOT_PATH` there. The `server:mcp:dev` and `server:mcp:inspect` scripts run with `NODE_ENV=development`, and [`src/config.ts`](./src/config.ts) calls `process.loadEnvFile('./.env.${NODE_ENV}')` at startup — so it picks up `.env.development` from the CWD automatically. Claude Desktop does not set `NODE_ENV`, so the file is ignored in production; env vars must come from the Desktop config `env` block there.

## Development

```bash
bun run server:mcp:dev      # bun --watch mode (NODE_ENV=development)
bun run server:mcp:start    # build then run from dist/ under node
bun run server:mcp:inspect  # MCP Inspector against TS source (NODE_ENV=development)
bun run test                # vitest (use `bun run test`, not `bun test`)
bun run lint:types          # tsc --noEmit
bun run lint:check          # Biome lint + format check
bun run lint:fix            # Biome auto-fix (uses --unsafe)
bun run lint:md             # prettier + markdownlint for *.md
```

## Security Model

- The root is resolved once at startup from `MCP_KB_FS_ROOT_PATH`. `~` is expanded to the user home directory.
- Every tool input goes through two checks before any FS access:
  1. **Lexical** — `resolveWithinRoot()` normalises separators, strips leading slashes, then asserts the resolved absolute path is strictly inside the root. Inputs that resolve outside via `..` or absolute-style paths are rejected with `Path escapes root: "<input>"`.
  2. **Physical** — `assertRealPathWithinRoot()` calls `fs.realpath` on both the root and the target (or its deepest existing ancestor for new-file writes) and verifies the realpath of the target lives inside the realpath of the root. This rejects symlink-based escapes that the lexical check cannot see.
- **Protected paths** are filtered out of list tools and rejected by read/write tools with `Path is protected: "<path>"`. Two rules:
  - any path segment beginning with `.` is protected at any depth (covers `.git`, `.obsidian`, `.env`, etc.);
  - root-level basenames `README`, `CLAUDE`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `AGENTS` (case-insensitive, with optional `.md`/`.txt`) are protected so the KB folder's own repo-meta isn't exposed. Nested files with the same names (e.g. `archive/README.md`) remain accessible.
- **File-type discipline** — `viewer_kb_read_note`/`editor_kb_write_note` reject paths that don't end in `.md`; `viewer_kb_list_folders` only ever returns directories; `viewer_kb_list_notes` only ever returns `.md` files.
- The server has no network access and performs no authentication. Trust is delegated entirely to the local OS user running it.

## Directory Structure

```text
├── claude-config-sample.json   # Example Claude Desktop config
├── package.json
├── tsconfig.json               # Base TS config
├── tsconfig.build.json         # Build config (emits to dist/)
├── .env.example                # Template for MCP_KB_FS_ROOT_PATH (copy to .env.development)
├── src/
│   ├── mcp-server/index.ts     # MCP server entry — boots and registers tools
│   ├── config.ts               # MCP_KB_FS_ROOT_PATH env var loading
│   ├── utils.ts                # Path safety + result helpers
│   ├── protected.ts            # Protected-path predicate
│   └── notes.ts                # Tool handlers (read/list/write)
└── dist/                       # Build output (gitignored, created by `bun run build`)
    └── mcp-server/index.js     # Compiled entry point used by Claude Desktop
```

## Troubleshooting

**`MCP_KB_FS_ROOT_PATH environment variable must be set`**

The server aborts at startup if `MCP_KB_FS_ROOT_PATH` is missing. Set it in the Claude Desktop config `env` block, or as a shell variable for `bun run server:mcp:dev`.

**`MCP_KB_FS_ROOT_PATH not accessible: <path>`**

`MCP_KB_FS_ROOT_PATH` was set but the path doesn't exist or isn't readable. Verify the path, and check that `~` was expanded as you expected (the server expands a leading `~/` itself).

**Tool returns `Path escapes root`**

The requested path resolves outside the root, either lexically (`..`/absolute) or via a symlink whose target sits outside `MCP_KB_FS_ROOT_PATH`. Use KB-relative paths and check any symlinks inside the KB.

**Tool returns `Path is protected`**

The path matches a protected pattern (a dotfile/dotdir at any depth, or a root-level repo-meta basename like `README.md`/`CLAUDE.md`). These paths are intentionally not exposed by the MCP. If you need a meta-named note, place it below the root (e.g. `archive/README.md`).

**Tool returns `Notes must end in ".md"`**

`viewer_kb_read_note` and `editor_kb_write_note` only operate on markdown files. Rename the path to end in `.md`.

**Cannot find module after pulling changes**

```bash
bun install
```

## Extending the Server

Add a new tool by registering it in [`src/mcp-server/index.ts`](./src/mcp-server/index.ts) via `server.registerTool(...)`. Follow the existing pattern:

1. Validate inputs with a strict zod schema (`.strict()` to reject extras).
2. Set MCP annotations honestly (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
3. Run any path inputs through `resolveWithinRoot(MCP_KB_FS_ROOT_PATH, ...)` (and `assertRealPathWithinRoot` for FS-touching tools) before touching the filesystem.
4. Return errors via `errorResult(...)` so the client sees `isError: true`.

If [`src/notes.ts`](./src/notes.ts) grows beyond a comfortable size, split handlers into additional modules under `src/` and re-import them from `src/mcp-server/index.ts`.
