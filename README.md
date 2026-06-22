# mcp-kb-fs

[![CI](https://github.com/knowledgeislands/mcp-kb-fs/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgeislands/mcp-kb-fs/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@knowledgeislands/mcp-kb-fs.svg)](https://www.npmjs.com/package/@knowledgeislands/mcp-kb-fs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An MCP (Model Context Protocol) server that gives Claude read and write access to a local directory of markdown files as a knowledge base.
Every file path is validated against the configured root, so the server cannot read or write outside it — even if asked to.

## Features

- **Read-only-by-default tools** — list and read are flagged as read-only and idempotent via MCP tool annotations.
- **Path safety in two layers** — lexical normalisation (rejects `..` and absolute-style escapes) plus a `realpath` check (rejects symlinks
  pointing outside the root).
- **Protected paths** — dotfiles/dotdirs at any depth (`.git`, `.obsidian`, …) and root-level repo-meta (`README.md`, `CLAUDE.md`,
  `LICENSE`, …) are hidden from list tools and rejected by read/write.
- **Strict file types** — notes must end in `.md`; folder listings only return directories.
- **No network, no auth** — pure local filesystem over MCP stdio.

**Quality:** 153 tests at 100% coverage across statements, branches, functions, and lines.

## Available Tools

Tools follow the convention `<app>_<resource>_<action>`. Each tool declares an annotation preset (`READ_ONLY`, `WRITE`, `WRITE_IDEMPOTENT`,
`DESTRUCTIVE`) which determines its access level (`read`, `write`, or `destructive`) via the underlying MCP hints (`readOnlyHint` /
`destructiveHint`). The registered surface is controlled by the `MCP_KB_FS_ACCESS_LEVEL` env var (defaults to `read`; levels nest). Tools
above the configured level are silently skipped at registration.

| Tool               | Level         | Preset             | Description                                          |
| ------------------ | ------------- | ------------------ | ---------------------------------------------------- |
| `kb_note_read`     | `read`        | `READ_ONLY`        | Read the full markdown content of a note. †          |
| `kb_notes_list`    | `read`        | `READ_ONLY`        | List `.md` files in a directory; optional recursion. |
| `kb_folders_list`  | `read`        | `READ_ONLY`        | List subfolders in a directory; optional recursion.  |
| `kb_note_rename`   | `write`       | `WRITE`            | Rename/move a note. Refuses to overwrite. ‡          |
| `kb_folder_create` | `write`       | `WRITE_IDEMPOTENT` | Create a folder (`mkdir -p`); idempotent. §          |
| `kb_note_write`    | `destructive` | `DESTRUCTIVE`      | Write or overwrite a note. ¶                         |
| `kb_note_delete`   | `destructive` | `DESTRUCTIVE`      | Delete a note. `dry_run` defaults to `true`. ‖       |

† Paths must be KB-relative and end in `.md`. Protected and traversal paths are rejected. ‡ Non-idempotent: a second call with the same
`from` fails because the source has moved. § Idempotent: succeeds if the folder already exists. Fails if a regular file occupies the path. ¶
Optionally creates parent dirs (`create_dirs`, default `true`). `dry_run` defaults to `true`. ‖ Pass `dry_run: false` to actually unlink.
Refuses to delete directories or protected paths.

### `kb_note_read`

```json
{
  "name": "kb_note_read",
  "arguments": { "path": "Pillars/Finance/Budget.md" }
}
```

Returns the raw markdown text. Path must end in `.md`. Errors:

- `File not found: "<path>" (root: <root>)`
- `Notes must end in ".md": "<path>"`
- `Path is protected: "<path>"` (root-level meta or any dotfile)
- `Path escapes root: "<path>"` (lexical or symlink)

### `kb_notes_list`

```json
{
  "name": "kb_notes_list",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

`path` defaults to `""` (knowledge base root). `recursive` defaults to `false`. Returns a newline-separated list of KB-relative `.md` paths,
or `(no notes found)`.

### `kb_folders_list`

```json
{
  "name": "kb_folders_list",
  "arguments": { "path": "Pillars", "recursive": true }
}
```

Same input shape as `kb_notes_list`. Returns a newline-separated list of KB-relative folder paths, or `(no folders found)`.

### `kb_note_write`

```json
{
  "name": "kb_note_write",
  "arguments": {
    "path": "Inbox/2026-04-30.md",
    "content": "# Notes\n\n- ...",
    "create_dirs": true
  }
}
```

`create_dirs` defaults to `true`. Returns `Written: "<path>" (<n> bytes)`. With `create_dirs: false` and a missing parent, returns
`Directory not found for: "<path>" — set create_dirs: true to create it automatically`.

### `kb_note_rename`

```json
{
  "name": "kb_note_rename",
  "arguments": {
    "from": "Inbox/draft.md",
    "to": "Pillars/Finance/Budget.md",
    "create_dirs": true
  }
}
```

Non-destructive: refuses to overwrite an existing destination. Both paths must end in `.md`, pass the standard root/protected guards, and
resolve to different absolute paths. `create_dirs` defaults to `true` (creates parents of `to` as needed). Returns
`Renamed: "<from>" → "<to>"`. Errors: `Destination already exists: "<to>"`, `File not found: "<from>"`, the usual `Path escapes root` /
`Path is protected`.

### `kb_folder_create`

```json
{
  "name": "kb_folder_create",
  "arguments": { "path": "Pillars/Finance/2026" }
}
```

`mkdir -p` semantics: creates intermediate folders as needed and is idempotent (re-running succeeds with `Folder already exists: "<path>"`).
Fails with `Path exists as a file, not a folder` if a regular file already occupies the path. No `dry_run` — it's non-destructive.

### `kb_note_delete`

```json
{
  "name": "kb_note_delete",
  "arguments": { "path": "Inbox/2026-04-30.md", "dry_run": false }
}
```

`dry_run` defaults to `true` — the first call returns `[dry_run] would delete (<n> bytes): "<path>"` without touching the file. Pass
`dry_run: false` to actually unlink. Returns `Deleted: "<path>" (<n> bytes)`. Errors: `File not found`, `Not a note file` (for directories),
`Path escapes root`, `Path is protected`.

## Quick Start

1. **Install dependencies**: `bun install`
2. **Pick a knowledge base directory** — any folder of markdown files (can be empty).
3. **Build**: `bun run build`
4. **Configure Claude Desktop** with the path to `dist/mcp-server/index.js` and your `MCP_KB_FS_ROOT_PATH` (see
   [Configuration](#configuration)).
5. **Restart Claude Desktop** — the enabled `kb_*` tools should appear (defaults to read-only).

## Example Conversations

Concrete asks you might make of Claude with this server connected.

**Survey a section of the KB:**

> "List every note under `Pillars/Finance`, recursively."

Claude calls [`kb_notes_list`](#kb_notes_list) with `path: "Pillars/Finance", recursive: true` and returns the newline-separated list of
KB-relative `.md` paths. Folders are excluded; only `.md` files appear.

**Read a specific note:**

> "Show me my Budget.md note from `Pillars/Finance`."

Claude calls [`kb_note_read`](#kb_note_read) with the KB-relative path. If the path doesn't end in `.md`, escapes the root, or matches a
protected pattern (dotfile, root-level repo-meta), the tool returns a clear error string instead of silently failing.

**Capture meeting notes:**

> "Save these notes as today's daily under `Inbox/2026-05-13.md` — create the Inbox folder if it doesn't exist yet."

Claude calls [`kb_note_write`](#kb_note_write) with the markdown content and `create_dirs: true` (the default). The path goes through both
the lexical and `realpath` safety checks before any byte is written. `kb_note_write` is annotated `DESTRUCTIVE` (it can overwrite an
existing note), so `MCP_KB_FS_ACCESS_LEVEL=destructive` is required for it to register.

**Discover structure:**

> "What top-level folders exist in my knowledge base?"

Claude calls [`kb_folders_list`](#kb_folders_list) with `path: ""` (the root) and `recursive: false`. Same input shape as `kb_notes_list`;
returns directories only.

## Installation

### Prerequisites

- [Bun](https://bun.sh) 1.3+ for the dev loop
- Node.js 24.15.0 or higher to run the compiled `dist/` (see `mise.toml`)

### Install Dependencies

```bash
bun install
```

## Configuration

### Environment Variables

| Name                            | Required | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_KB_FS_ROOT_PATH`           | yes      | Absolute path or `~/...` to the knowledge base root. The server asserts on startup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `MCP_KB_FS_ACCESS_LEVEL`        | no       | Maximum tool access level to register. One of: `read` (default — read-only tools only, least privilege), `write` (adds non-destructive mutations: `kb_note_rename`, `kb_folder_create`), `destructive` (adds overwrite/delete: `kb_note_write`, `kb_note_delete`). Levels nest. Each tool's level is derived from its MCP annotations (`readOnlyHint: true` → `read`; `destructiveHint: true` → `destructive`; explicit `readOnlyHint: false` AND `destructiveHint: false` → `write`; missing annotations → `destructive` fail-safe); a tool registers when its derived level ≤ the configured level. The `dry_run: true` default on destructive tools controls _effect_; this gate controls _visibility_. An unknown value aborts startup. |
| `MCP_KB_FS_AUDIT_LOG`           | no       | Audit-log scope. One of `off`, `writes` (default — record only non-read tool calls), `all` (record every invocation).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `MCP_KB_FS_AUDIT_LOG_PATH`      | no       | Path to the JSONL audit log. Default `~/.local/state/mcp-kb-fs/audit.jsonl`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `MCP_KB_FS_AUDIT_LOG_MAX_BYTES` | no       | Size-based rotation threshold in bytes. Default `10485760` (10 MiB). Set to `0` to disable rotation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `MCP_KB_FS_AUDIT_LOG_KEEP`      | no       | Number of rotated audit-log files to retain. Default `5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `NODE_ENV`                      | no       | Dev convention. `loadConfig()` in [`src/config/index.ts`](./src/config/index.ts) hydrates `process.env`, from the package root and highest precedence first, from `.env.local`, then `.env.${NODE_ENV}` (when set), then `.env`; a var already in the environment (e.g. the MCP client's `env` block) always wins. `server:mcp:dev`/`server:mcp:inspect` set this to `development` so `.env.development` is picked up; under Claude Desktop it is unset, so only `.env.local`/`.env` would apply.                                                                                                                                                                                                                                           |

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

Alternatively, copy [`.env.example`](./.env.example) to `.env.development` (or `.env.local`) and set `MCP_KB_FS_ROOT_PATH` there. At startup
`loadConfig()` in [`src/config/index.ts`](./src/config/index.ts) hydrates `process.env` from the package root, highest precedence first:
`.env.local`, then `.env.${NODE_ENV}` (when set), then `.env`. The `server:mcp:dev`/`server:mcp:inspect` scripts run with
`NODE_ENV=development`, so `.env.development` is picked up; Claude Desktop does not set `NODE_ENV`, so only `.env.local`/`.env` would apply.
A var already present in the environment (e.g. the Desktop config `env` block) always beats any file.

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

- The root is resolved at startup from `MCP_KB_FS_ROOT_PATH` by `loadConfig()` into `config.rootPath`, then threaded into every tool. `~` is
  expanded to the user home directory.
- Every tool input goes through two checks before any FS access:
  1. **Lexical** — `resolveWithinRoot()` normalises separators, strips leading slashes, then asserts the resolved absolute path is strictly
     inside the root. Inputs that resolve outside via `..` or absolute-style paths are rejected with `Path escapes root: "<input>"`.
  2. **Physical** — `assertRealPathWithinRoot()` calls `fs.realpath` on both the root and the target (or its deepest existing ancestor for
     new-file writes) and verifies the realpath of the target lives inside the realpath of the root. This rejects symlink-based escapes that
     the lexical check cannot see.
- **Protected paths** are filtered out of list tools and rejected by read/write tools with `Path is protected: "<path>"`. Two rules:
  - any path segment beginning with `.` is protected at any depth (covers `.git`, `.obsidian`, `.env`, etc.);
  - root-level basenames `README`, `CLAUDE`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `AGENTS`
    (case-insensitive, with optional `.md`/`.txt`) are protected so the KB folder's own repo-meta isn't exposed. Nested files with the same
    names (e.g. `archive/README.md`) remain accessible.
- **File-type discipline** — `kb_note_read`/`kb_note_write` reject paths that don't end in `.md`; `kb_folders_list` only ever returns
  directories; `kb_notes_list` only ever returns `.md` files.
- The server has no network access and performs no authentication. Trust is delegated entirely to the local OS user running it.

## Directory Structure

```text
├── claude-config-sample.json   # Example Claude Desktop config
├── package.json
├── tsconfig.json               # Base TS config
├── tsconfig.build.json         # Build config (emits to dist/)
├── .env.example                # Env template (copy to .env.development or .env.local)
├── src/
│   ├── mcp-server/index.ts     # MCP server entry — loadConfig() + registers tools
│   ├── config/index.ts         # loadConfig(env?) → Config (no module-level singleton)
│   ├── tools/                  # MCP tool definitions (validate args, call main/, map to envelope)
│   │   └── notes/index.ts      # registerNotesTools(server, cfg)
│   ├── main/                   # Real implementation, usable outside the MCP server
│   │   └── notes/index.ts      # Tool handlers (read/list/write/rename/delete/create-folder)
│   └── utils/                  # Cross-MCP helpers
│       ├── utils.ts            # Path safety + result helpers
│       ├── protected.ts        # Protected-path predicate
│       ├── access-level.ts     # Annotation-driven access-level gate
│       ├── annotations.ts      # Annotation presets (READ_ONLY/WRITE/…)
│       └── audit-log.ts        # JSONL audit log + rotation
└── dist/                       # Build output (gitignored, created by `bun run build`)
    └── mcp-server/index.js     # Compiled entry point used by Claude Desktop
```

## Troubleshooting

**`MCP_KB_FS_ROOT_PATH environment variable must be set`**

The server aborts at startup if `MCP_KB_FS_ROOT_PATH` is missing. Set it in the Claude Desktop config `env` block, or as a shell variable
for `bun run server:mcp:dev`.

**`MCP_KB_FS_ROOT_PATH not accessible: <path>`**

`MCP_KB_FS_ROOT_PATH` was set but the path doesn't exist or isn't readable. Verify the path, and check that `~` was expanded as you expected
(the server expands a leading `~/` itself).

**Tool returns `Path escapes root`**

The requested path resolves outside the root, either lexically (`..`/absolute) or via a symlink whose target sits outside
`MCP_KB_FS_ROOT_PATH`. Use KB-relative paths and check any symlinks inside the KB.

**Tool returns `Path is protected`**

The path matches a protected pattern (a dotfile/dotdir at any depth, or a root-level repo-meta basename like `README.md`/`CLAUDE.md`). These
paths are intentionally not exposed by the MCP. If you need a meta-named note, place it below the root (e.g. `archive/README.md`).

**Tool returns `Notes must end in ".md"`**

`kb_note_read` and `kb_note_write` only operate on markdown files. Rename the path to end in `.md`.

**Cannot find module after pulling changes**

```bash
bun install
```

## Extending the Server

Add a new tool by registering it in [`src/tools/notes/index.ts`](./src/tools/notes/index.ts) (or a new group under `src/tools/`) via
`server.registerTool(...)`, and put the implementation in a matching `src/main/` module that takes `Config` as its first argument. Follow
the existing pattern:

1. Validate inputs with a strict zod schema (`.strict()` to reject extras).
2. Set MCP annotations honestly (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) — the access-level gate derives the
   tool's tier from these.
3. Run any path inputs through `resolveWithinRoot(cfg.rootPath, ...)` (and `assertRealPathWithinRoot` for FS-touching tools) before touching
   the filesystem.
4. Return errors via `errorResult(...)` so the client sees `isError: true`.

The tool layer stays thin — validate args, call a `src/main/` function with `cfg`, map the result to an MCP envelope. The real logic lives
in [`src/main/notes/index.ts`](./src/main/notes/index.ts) so it can be reused outside the MCP server.
