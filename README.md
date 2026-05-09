# mcp-kb

[![CI](https://github.com/knowledgeislands/mcp-kb/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgeislands/mcp-kb/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A small MCP (Model Context Protocol) server that gives Claude read and write access to a local directory of markdown files as a knowledge base.

All file paths are validated against the configured root, so the server cannot read or write outside it — even if asked to.

## Features

- **Read-only-by-default tools**: list and read notes are flagged as read-only and idempotent in their MCP tool annotations.
- **Path safety**: resolves and verifies every input path against the root; rejects `..` traversal and absolute paths that escape the root.
- **No network, no auth**: pure local filesystem over MCP stdio.
- **Single env var to configure**: `ROOT_PATH`.

## Available Tools

| Tool            | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `kb_read_note`  | Read the full markdown content of a note by KB-relative path.               |
| `kb_list_notes` | List `.md` files in a knowledge base directory; optional recursive descent. |
| `kb_write_note` | Write or overwrite a note. Optionally creates parent dirs (`create_dirs`).  |

### `kb_read_note`

```json
{
  "name": "kb_read_note",
  "arguments": { "path": "Pillars/Finance/Budget.md" }
}
```

Returns the raw markdown text. Errors:

- `File not found: "<path>" (root: <root>)`
- `Path escapes root: "<path>"`

### `kb_list_notes`

```json
{
  "name": "kb_list_notes",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

`path` defaults to `""` (knowledge base root). `recursive` defaults to `false`. Returns a newline-separated list of KB-relative `.md` paths, or `(no notes found)`.

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

## Directory Structure

```text
├── claude-config-sample.json   # Example Claude Desktop config
├── package.json
├── tsconfig.json               # Base TS config
├── tsconfig.build.json         # Build config (emits to dist/)
├── src/
│   ├── index.ts                # MCP server entry — boots and registers tools
│   ├── config.ts               # ROOT_PATH env var loading
│   ├── utils.ts                # Path safety + result helpers
│   └── notes.ts                # Tool handlers (read/list/write)
└── dist/                       # Build output (gitignored, created by `npm run build`)
    └── index.js                # Compiled entry point used by Claude Desktop
```

## Quick Start

1. **Install dependencies**: `npm install`
2. **Pick a knowledge base directory** (any folder containing markdown files; can be empty).
3. **Configure Claude Desktop** with the path to `dist/index.js` and your `ROOT_PATH` (see below).
4. **Build**: `npm run build`
5. **Restart Claude Desktop** — the three `kb_*` tools should appear.

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

| Name        | Required | Description                                                                         |
| ----------- | -------- | ----------------------------------------------------------------------------------- |
| `ROOT_PATH` | yes      | Absolute path or `~/...` to the knowledge base root. The server asserts on startup. |

### Claude Desktop Configuration

Run `npm run build` first so `dist/index.js` exists, then add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "mcp-kb": {
      "command": "node",
      "args": ["/path/to/mcp-kb/dist/index.js"],
      "env": {
        "ROOT_PATH": "/path/to/your/kb"
      }
    }
  }
}
```

A starter version is in [`claude-config-sample.json`](./claude-config-sample.json).

### Running From Source (Dev)

For fast iteration without rebuilding:

```bash
ROOT_PATH=~/notes npm run dev:mcp
```

This runs `src/index.ts` under `tsx watch`. Point Claude Desktop at this command during development if you want live reload.

## Development

```bash
npm run dev:mcp        # tsx watch mode
npm run start:mcp      # build then run from dist/
npm run inspect        # MCP Inspector against TS source
npm test               # vitest
npm run typecheck      # tsc --noEmit
npm run lint:check     # Biome lint + format check
npm run lint:fix       # Biome auto-fix (uses --unsafe)
npm run lint:md        # prettier + markdownlint for *.md
```

## Security Model

- The root is resolved once at startup from `ROOT_PATH`. `~` is expanded to the user home directory.
- Every tool input goes through `resolveWithinRoot()`, which normalises separators, strips leading slashes, then asserts the resolved absolute path is strictly inside the root. Inputs that resolve outside the root (via `..`, absolute paths, etc.) are rejected with `Path escapes root: "<input>"`.
- The server has no network access and performs no authentication. Trust is delegated entirely to the local OS user running it.

## Troubleshooting

**`ROOT_PATH environment variable must be set`**

The server aborts at startup if `ROOT_PATH` is missing. Set it in the Claude Desktop config `env` block, or as a shell variable for `dev:mcp`.

**`ROOT_PATH not accessible: <path>`**

`ROOT_PATH` was set but the path doesn't exist or isn't readable. Verify the path, and check that `~` was expanded as you expected (the server expands a leading `~/` itself).

**Tool returns `Path escapes root`**

The requested path resolves outside the root. Use KB-relative paths without leading `..` or absolute paths.

**Cannot find module after pulling changes**

```bash
npm install
```

## Extending the Server

Add a new tool by registering it in [`src/index.ts`](./src/index.ts) via `server.registerTool(...)`. Follow the existing pattern:

1. Validate inputs with a strict zod schema (`.strict()` to reject extras).
2. Set MCP annotations honestly (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
3. Run any path inputs through `resolveWithinRoot(ROOT_PATH, ...)` before touching the FS.
4. Return errors via `errorResult(...)` so the client sees `isError: true`.

If `src/notes.ts` grows beyond a comfortable size, split handlers into additional modules under `src/` and re-import them from `src/index.ts`.
