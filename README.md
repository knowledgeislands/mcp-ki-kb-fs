# mcp-kb

[![CI](https://github.com/knowledgeislands/mcp-kb/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgeislands/mcp-kb/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@knowledgeislands/mcp-kb.svg)](https://www.npmjs.com/package/@knowledgeislands/mcp-kb) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An MCP (Model Context Protocol) server that gives Claude read and write access to a local directory of markdown files as a knowledge base. Every file path is validated against the configured root, so the server cannot read or write outside it — even if asked to.

## Features

- **Read-only-by-default tools** — list and read are flagged as read-only and idempotent via MCP tool annotations.
- **Path safety in two layers** — lexical normalisation (rejects `..` and absolute-style escapes) plus a `realpath` check (rejects symlinks pointing outside the root).
- **Protected paths** — dotfiles/dotdirs at any depth (`.git`, `.obsidian`, …) and root-level repo-meta (`README.md`, `CLAUDE.md`, `LICENSE`, …) are hidden from list tools and rejected by read/write.
- **Strict file types** — notes must end in `.md`; folder listings only return directories.
- **No network, no auth** — pure local filesystem over MCP stdio.

**Quality:** 72 tests at 100% coverage across statements, branches, functions, and lines.

## Available Tools

| Tool | Description |
| --- | --- |
| `kb_read_note` | Read the full markdown content of a note by KB-relative path. |
| `kb_list_notes` | List `.md` files in a knowledge base directory; optional recursive descent. |
| `kb_list_folders` | List subfolders in a knowledge base directory; optional recursive descent. |
| `kb_write_note` | Write or overwrite a note. Optionally creates parent dirs (`create_dirs`). |

### `kb_read_note`

```json
{
  "name": "kb_read_note",
  "arguments": { "path": "Pillars/Finance/Budget.md" }
}
```

Returns the raw markdown text. Path must end in `.md`. Errors:

- `File not found: "<path>" (root: <root>)`
- `Notes must end in ".md": "<path>"`
- `Path is protected: "<path>"` (root-level meta or any dotfile)
- `Path escapes root: "<path>"` (lexical or symlink)

### `kb_list_notes`

```json
{
  "name": "kb_list_notes",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

`path` defaults to `""` (knowledge base root). `recursive` defaults to `false`. Returns a newline-separated list of KB-relative `.md` paths, or `(no notes found)`.

### `kb_list_folders`

```json
{
  "name": "kb_list_folders",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

Same input shape as `kb_list_notes`. Returns a newline-separated list of KB-relative folder paths, or `(no folders found)`.

### `kb_write_note`

```json
{
  "name": "kb_write_note",
  "arguments": {
    "path": "Inbox/2026-04-30.md",
    "content": "# Notes\n\n- ...",
    "create_dirs": true
  }
}
```

`create_dirs` defaults to `true`. Returns `Written: "<path>" (<n> bytes)`. With `create_dirs: false` and a missing parent, returns `Directory not found for: "<path>" — set create_dirs: true to create it automatically`.

## Quick Start

1. **Install dependencies**: `npm install`
2. **Pick a knowledge base directory** — any folder of markdown files (can be empty).
3. **Build**: `npm run build`
4. **Configure Claude Desktop** with the path to `dist/mcp-server/index.js` and your `ROOT_PATH` (see [Configuration](#configuration)).
5. **Restart Claude Desktop** — the four `kb_*` tools should appear.

## Example Conversations

Concrete asks you might make of Claude with this server connected.

**Survey a section of the KB:**

> "List every note under `Pillars/Finance`, recursively."

Claude calls [`kb_list_notes`](#kb_list_notes) with `path: "Pillars/Finance", recursive: true` and returns the newline-separated list of KB-relative `.md` paths. Folders are excluded; only `.md` files appear.

**Read a specific note:**

> "Show me my Budget.md note from `Pillars/Finance`."

Claude calls [`kb_read_note`](#kb_read_note) with the KB-relative path. If the path doesn't end in `.md`, escapes the root, or matches a protected pattern (dotfile, root-level repo-meta), the tool returns a clear error string instead of silently failing.

**Capture meeting notes:**

> "Save these notes as today's daily under `Inbox/2026-05-13.md` — create the Inbox folder if it doesn't exist yet."

Claude calls [`kb_write_note`](#kb_write_note) with the markdown content and `create_dirs: true` (the default). The path goes through both the lexical and `realpath` safety checks before any byte is written.

**Discover structure:**

> "What top-level folders exist in my knowledge base?"

Claude calls [`kb_list_folders`](#kb_list_folders) with `path: ""` (the root) and `recursive: false`. Same input shape as `kb_list_notes`; returns directories only.

## Installation

### Prerequisites

- Node.js 22.0.0 or higher (see `.node-version`)
- npm

### Install Dependencies

```bash
npm install
```

## Configuration

### Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `ROOT_PATH` | yes | Absolute path or `~/...` to the knowledge base root. The server asserts on startup. |
| `NODE_ENV` | no | Dev convention. `dev:mcp`/`inspect` set this to `development`, which makes [`src/config.ts`](./src/config.ts) load `.env.development` from the CWD. Unset under Claude Desktop, so `.env*` files are ignored in production. |

### Claude Desktop Configuration

Run `npm run build` first so `dist/mcp-server/index.js` exists, then add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "mcp-kb": {
      "command": "node",
      "args": ["/path/to/mcp-kb/dist/mcp-server/index.js"],
      "env": {
        "ROOT_PATH": "/path/to/your/kb"
      }
    }
  }
}
```

A starter is in [`claude-config-sample.json`](./claude-config-sample.json).

### Running From Source (Dev)

For fast iteration without rebuilding:

```bash
ROOT_PATH=~/notes npm run dev:mcp
```

This runs `src/mcp-server/index.ts` under `tsx watch`. Point Claude Desktop at this command during development if you want live reload.

Alternatively, copy [`.env.example`](./.env.example) to `.env.development` and set `ROOT_PATH` there. The `dev:mcp` and `inspect` scripts run with `NODE_ENV=development`, and [`src/config.ts`](./src/config.ts) calls `process.loadEnvFile('./.env.${NODE_ENV}')` at startup — so it picks up `.env.development` from the CWD automatically. Claude Desktop does not set `NODE_ENV`, so the file is ignored in production; env vars must come from the Desktop config `env` block there.

## Development

```bash
npm run dev:mcp        # tsx watch mode (NODE_ENV=development)
npm run start:mcp      # build then run from dist/
npm run inspect        # MCP Inspector against TS source (NODE_ENV=development)
npm test               # vitest
npm run typecheck      # tsc --noEmit
npm run lint:check     # Biome lint + format check
npm run lint:fix       # Biome auto-fix (uses --unsafe)
npm run lint:md        # prettier + markdownlint for *.md
```

## Security Model

- The root is resolved once at startup from `ROOT_PATH`. `~` is expanded to the user home directory.
- Every tool input goes through two checks before any FS access:
  1. **Lexical** — `resolveWithinRoot()` normalises separators, strips leading slashes, then asserts the resolved absolute path is strictly inside the root. Inputs that resolve outside via `..` or absolute-style paths are rejected with `Path escapes root: "<input>"`.
  2. **Physical** — `assertRealPathWithinRoot()` calls `fs.realpath` on both the root and the target (or its deepest existing ancestor for new-file writes) and verifies the realpath of the target lives inside the realpath of the root. This rejects symlink-based escapes that the lexical check cannot see.
- **Protected paths** are filtered out of list tools and rejected by read/write tools with `Path is protected: "<path>"`. Two rules:
  - any path segment beginning with `.` is protected at any depth (covers `.git`, `.obsidian`, `.env`, etc.);
  - root-level basenames `README`, `CLAUDE`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `AGENTS` (case-insensitive, with optional `.md`/`.txt`) are protected so the KB folder's own repo-meta isn't exposed. Nested files with the same names (e.g. `archive/README.md`) remain accessible.
- **File-type discipline** — `kb_read_note`/`kb_write_note` reject paths that don't end in `.md`; `kb_list_folders` only ever returns directories; `kb_list_notes` only ever returns `.md` files.
- The server has no network access and performs no authentication. Trust is delegated entirely to the local OS user running it.

## Directory Structure

```text
├── claude-config-sample.json   # Example Claude Desktop config
├── package.json
├── tsconfig.json               # Base TS config
├── tsconfig.build.json         # Build config (emits to dist/)
├── .env.example                # Template for ROOT_PATH (copy to .env.development)
├── src/
│   ├── mcp-server/index.ts     # MCP server entry — boots and registers tools
│   ├── config.ts               # ROOT_PATH env var loading
│   ├── utils.ts                # Path safety + result helpers
│   ├── protected.ts            # Protected-path predicate
│   └── notes.ts                # Tool handlers (read/list/write)
└── dist/                       # Build output (gitignored, created by `npm run build`)
    └── mcp-server/index.js     # Compiled entry point used by Claude Desktop
```

## Troubleshooting

**`ROOT_PATH environment variable must be set`**

The server aborts at startup if `ROOT_PATH` is missing. Set it in the Claude Desktop config `env` block, or as a shell variable for `dev:mcp`.

**`ROOT_PATH not accessible: <path>`**

`ROOT_PATH` was set but the path doesn't exist or isn't readable. Verify the path, and check that `~` was expanded as you expected (the server expands a leading `~/` itself).

**Tool returns `Path escapes root`**

The requested path resolves outside the root, either lexically (`..`/absolute) or via a symlink whose target sits outside `ROOT_PATH`. Use KB-relative paths and check any symlinks inside the KB.

**Tool returns `Path is protected`**

The path matches a protected pattern (a dotfile/dotdir at any depth, or a root-level repo-meta basename like `README.md`/`CLAUDE.md`). These paths are intentionally not exposed by the MCP. If you need a meta-named note, place it below the root (e.g. `archive/README.md`).

**Tool returns `Notes must end in ".md"`**

`kb_read_note` and `kb_write_note` only operate on markdown files. Rename the path to end in `.md`.

**Cannot find module after pulling changes**

```bash
npm install
```

## Extending the Server

Add a new tool by registering it in [`src/mcp-server/index.ts`](./src/mcp-server/index.ts) via `server.registerTool(...)`. Follow the existing pattern:

1. Validate inputs with a strict zod schema (`.strict()` to reject extras).
2. Set MCP annotations honestly (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
3. Run any path inputs through `resolveWithinRoot(ROOT_PATH, ...)` (and `assertRealPathWithinRoot` for FS-touching tools) before touching the filesystem.
4. Return errors via `errorResult(...)` so the client sees `isError: true`.

If [`src/notes.ts`](./src/notes.ts) grows beyond a comfortable size, split handlers into additional modules under `src/` and re-import them from `src/mcp-server/index.ts`.
