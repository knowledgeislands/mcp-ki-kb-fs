# Installing the server

Get `mcp-ki-kb-fs` built, connected to an MCP client, and answering a first question about a real knowledge base. Expect ten minutes.

## Before you start

You need [Bun](https://bun.sh) 1.3 or later to install dependencies and build, and Node.js 22 or later to run the built server — that is what your MCP client will actually launch. The repository pins both in `mise.toml`, so `mise install` gets you the right versions if you use it.

You also need at least one knowledge base: a directory holding notes and side files. It can be empty, and it does not need a `.ki.toml` — without one, the server assumes the canonical Knowledge Islands zone names. [Scoping a knowledge base](scoping-a-knowledge-base.md) covers what that means for which paths are reachable.

> [!NOTE] There is no published package. `@knowledgeislands/mcp-ki-kb-fs` is not on the npm registry, so `npx` will not work — install from source.

## Build it

```bash
git clone https://github.com/knowledgeislands/mcp-ki-kb-fs.git
cd mcp-ki-kb-fs
bun install
bun run build
```

`bun run build` emits `dist/`, and `dist/mcp-server/index.js` is the entry point your client runs. Note its absolute path — you need it in the next step.

## Decide which knowledge bases it may reach

`MCP_KI_KB_FS_KNOWLEDGE_BASES` is a JSON object mapping a caller-facing alias to each base's absolute path:

```json
{ "kit-pkb": "~/kb/kit-pkb", "kit-legal": "/srv/kb/legal" }
```

It is required, and it is the install's entire authorisation boundary: an alias that is not a key here is unreachable, and no tool argument can introduce a path. Name the bases you actually want a model working in, and nothing else — [Declaring your knowledge bases](declaring-knowledge-bases.md) covers the grammar, every startup rejection, and why there is no default base.

## Connect it to a client

Configuration reaches the server through the client's `env` block, not through a `.env` file. The server reads `.env.*` files only when `NODE_ENV` is set to `development`, which the development scripts do and your client does not.

For Claude Desktop, add the server to `claude_desktop_config.json`. The declaration is a JSON object inside a JSON string, so its inner quotes need escaping:

```json
{
  "mcpServers": {
    "mcp-ki-kb-fs": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ki-kb-fs/dist/mcp-server/index.js"],
      "env": {
        "MCP_KI_KB_FS_KNOWLEDGE_BASES": "{\"kit-pkb\":\"/path/to/your/kb\",\"kit-legal\":\"/path/to/another/kb\"}"
      }
    }
  }
}
```

A copyable version of that block is in [`claude-config-sample.json`](../../../claude-config-sample.json).

Claude Code takes the same command, arguments, and environment through `claude mcp add`, and any other MCP client that launches a stdio server — mcporter included — needs exactly those three pieces: the `node` command, the absolute path to `dist/mcp-server/index.js`, and the environment block.

Then restart the client. Both the environment and each base's `.ki.toml` are read once at startup and never re-read, so every configuration change from here on needs a restart to take effect.

## Confirm it works

Ask the client to list its tools. On a default install you should see three, all read-only: `kb_config`, `kb_list`, and `kb_read`. If you see five or seven, the access level is not at its default — see [Choosing an access level](choosing-an-access-level.md). If you see none, see [Troubleshooting](troubleshooting.md).

Then ask for something real: _call `kb_config` for `kit-pkb` and tell me which zones it has_. A first answer naming the top-level folders you recognise confirms the whole path — client launch, declaration parsing, startup validation, and `.ki.toml` resolution. [Reading and writing notes](reading-and-writing-notes.md) takes it from there.

## Changing the configuration later

Every setting other than the declaration is optional:

- **`MCP_KI_KB_FS_KNOWLEDGE_BASES`** — the alias-to-path object above. Required; the server will not start without it.
- **`MCP_KI_KB_FS_ACCESS_LEVEL`** — `read`, `write`, or `destructive`. Defaults to `read`. See [Choosing an access level](choosing-an-access-level.md).
- **`MCP_KI_KB_FS_AUDIT_LOG`** — `off`, `writes`, or `all`. Defaults to `writes`.
- **`MCP_KI_KB_FS_AUDIT_LOG_PATH`** — where the JSONL log is written. Defaults to `~/.local/state/mcp-ki-kb-fs/audit.jsonl`.
- **`MCP_KI_KB_FS_AUDIT_LOG_MAX_BYTES`** — rotate once the log passes this size. Defaults to `10485760` (10 MiB); `0` disables rotation.
- **`MCP_KI_KB_FS_AUDIT_LOG_KEEP`** — how many rotated logs to retain. Defaults to `5`.

An unrecognised value for the access level or the log mode aborts startup rather than falling back to a default, so a typo shows up as a server that will not start rather than as a quietly wrong setting. [`.env.example`](../../../.env.example) documents the same set with inline commentary.

There is deliberately no single-base shortcut: a one-base install declares one alias in the same object. An `MCP_KI_KB_FS_ROOT_PATH`-style fallback would put base selection somewhere other than the declaration, which is the one thing the declaration exists to prevent.
