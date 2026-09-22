# mcp-kb-fs

[![CI](https://github.com/knowledgeislands/mcp-ki-kb-fs/actions/workflows/ci.yml/badge.svg)](https://github.com/knowledgeislands/mcp-ki-kb-fs/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An MCP (Model Context Protocol) server that gives a model read and write access to one or more local knowledge-base directories. Each call names the knowledge base it acts in by alias, every file path is validated against that base's root, and the server cannot read or write outside it — even if asked to.

## Features

- **Many knowledge bases, one registration** — the environment declares alias → path pairs, and every tool takes a required `kb` alias. One server process replaces one registration per base, and one tool surface replaces one per base in the client's tool list.
- **Read-only by default** — the access level defaults to `read`, and a tool above the configured level is never registered, so a client cannot call what was never advertised.
- **Path safety in two layers** — lexical normalisation rejects `..` and absolute-style escapes; a `realpath` check rejects symlinks pointing outside the root. With several bases declared, it also stops a path under one alias reaching into a sibling base.
- **Zone scoping** — only content under a base's declared Knowledge Islands zones and staging areas is reachable. The base's root is neither listable nor writable.
- **Protected paths** — dotfiles and dot-directories at any depth, and root-level repository-meta names, stay hidden from ordinary tools. A separate exact allow-list permits read-only access to selected repository-context files.
- **One content surface** — the same read, list, write, rename, and delete tools handle Markdown notes and side files alike; Markdown frontmatter and body selection remains `.md`-only.
- **Audited** — `write` and `destructive` calls are recorded as local JSONL by default, with content replaced by a byte count and URL credentials redacted.

## Available Tools

Seven tools, gated by `MCP_KI_KB_FS_ACCESS_LEVEL`. The levels nest, and each tool's level is derived from its MCP annotations rather than its name.

| Tool               | Level         | Purpose                                              |
| ------------------ | ------------- | ---------------------------------------------------- |
| `kb_config`        | `read`        | Return resolved zones, the allow-list, and the base roster. |
| `kb_list`          | `read`        | List files, folders, or Markdown notes. †            |
| `kb_read`          | `read`        | Read text, binary, or a Markdown slice. ‡            |
| `kb_rename`        | `write`       | Rename or move a file. Refuses to overwrite. §       |
| `kb_folder_create` | `write`       | Create a folder. Idempotent, no preview mode.        |
| `kb_write`         | `destructive` | Write or overwrite text or binary content. ¶         |
| `kb_delete`        | `destructive` | Delete a file. Previews by default. ‖                |

† The KB root and the root-file allow-list are never listable. ‡ Zone and staging paths are readable, as are exact `root_file_allowlist` entries — which are never writable or listable. § Non-idempotent: a second identical call fails, because the source has already moved. ¶ Accepts UTF-8 or base64, creates parent directories by default, and previews by default. ‖ Allow-list entries are never deletable.

Each tool's arguments, defaults, enums, and descriptions are published by the running server from the schemas it validates against, and rendered by your MCP client. This repository keeps no second, hand-maintained copy of them — a transcribed schema drifts from the code that serves it. What is written down instead is behaviour a schema cannot state, and that lives in the guides.

## Getting started

1. `bun install`
2. `bun run build`
3. Declare your knowledge bases in `MCP_KI_KB_FS_KNOWLEDGE_BASES` and point your client at `dist/mcp-server/index.js` — [`claude-config-sample.json`](./claude-config-sample.json) is a working example.
4. Restart the client. Three read-only tools should appear.

[Installing the server](./docs/guides/user/installing-the-server.md) covers each step properly, including every environment variable and its default.

## Documentation

| Question                            | Where it is answered                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| How do I set it up and use it?      | [User guides](./docs/guides/user/README.md)                   |
| How do I change the code?           | [Developer guides](./docs/guides/developer/README.md)         |
| What exactly does each tool accept? | The running server, via your client's tool listing            |
| Why is it built this way?           | [Decision records](./docs/decisions/README.md)                |
| What is planned or in flight?       | [The roadmap](./docs/roadmap/)                                |
| How do I contribute?                | [CONTRIBUTING.md](./CONTRIBUTING.md)                          |
| How do I report a vulnerability?    | [SECURITY.md](./SECURITY.md)                                  |

## Security model

The declaration is the authorisation boundary. `MCP_KI_KB_FS_KNOWLEDGE_BASES` is resolved at startup into one closed bundle per alias — root, zone map, and root-file allow-list travelling together — and a path that is not a directory that exists aborts the server. A base that is not declared is unreachable, and no tool argument anywhere in the surface accepts a filesystem location, so no prompt can introduce one.

Beneath that, every path crosses four checks in order: argument validation refuses `..`, leading `/`, leading `~`, and null bytes; `resolveWithinRoot` asserts lexical containment; `assertRealPathWithinRoot` realpaths both ends to catch symlink escapes; and zone scoping plus the protected-path filter decide what policy allows. One call acts in exactly one base — there are no cross-base operations — and `kb_config` returns aliases and folder names but never a filesystem path.

The tool-visibility gate sits above all of it: an unannotated or partly annotated tool is treated as destructive, so forgetting to annotate a new tool hides it at the default level rather than exposing it.

[Scoping a knowledge base](./docs/guides/user/scoping-a-knowledge-base.md) and [Choosing an access level](./docs/guides/user/choosing-an-access-level.md) cover what this means in practice; [Architecture](./docs/guides/developer/architecture.md) covers how it is enforced.

## Licence

MIT — see [LICENSE](./LICENSE).
