# AGENTS.md

Engineering follows `ki-engineering`, and the server's shape follows `ki-repo-mcp`: its layout, configuration injection, tool naming, annotation-driven access gate and security invariants, and where README and this file each hold what.

Repository-specific implementation guidance follows. User-facing setup and tool documentation live in [README.md](./README.md) and [docs/guides/](./docs/guides/_index.md).

## Knowledge-base safety

Constrain every filesystem operation to a configured knowledge-base root using symlink-aware containment. Preserve optimistic concurrency and atomic-write behaviour for mutations, validate user-controlled paths and identifiers tightly, and keep destructive or non-idempotent operations behind explicit safe defaults. Tests use isolated fixtures and never operate on real knowledge bases.

## Verification

`bun run ki:test:smoke` runs [scripts/smoke.ts](./scripts/smoke.ts), which asserts the wire-level tool surface against `EXPECTED_TOOLS` and the protocol profile against a live client, then [scripts/search-smoke.ts](./scripts/search-smoke.ts).

In production `MCP_KI_KB_FS_KNOWLEDGE_BASES` comes from the MCP client's `env` block or the package's `.env.local` or `.env`.

## Protocol profile

This server targets MCP spec revision **2026-07-28**, on the `@modelcontextprotocol/server` v2 package family (`@modelcontextprotocol/client` v2 drives the smoke harness only, as a devDependency). Three consequences before you touch the wire layer. [src/mcp-server/index.ts](./src/mcp-server/index.ts) hands `serveStdio` a `createServer` **factory**, so every connection gets its own gated `McpServer` instance rather than sharing one built at import time. The SDK owns `server/discover`, protocol stamping, and cache defaults — there is no local revision or capability literal to edit, which is why the profile is proven by `scripts/smoke.ts` against a live client rather than by a unit test. And every synchronous tool result carries the `resultType: 'complete'` discriminator, stamped in one place: `jsonResult` / `errorResult` in [src/utils/results.ts](./src/utils/results.ts).

The legacy `initialize` handshake is **deliberately still served** — `serveStdio(factory, { legacy: 'serve' })` — so pre-2026 clients keep working against the identical tool surface, from the same factory. The smoke test asserts both eras; moving to `'reject'` is a decision to take on purpose, with evidence that no client in the estate still opens that way, not a tidy-up.

## Architecture Invariants

### Configuration and layers

- **[src/config/index.ts](./src/config/index.ts)** — `Config` carries `knowledgeBases` (the declared alias → `KnowledgeBase` map) beside the standard fields. It also exports `selectKnowledgeBase(cfg, alias)` and `knowledgeBaseAliases(cfg)` — see [Multiple knowledge bases](#multiple-knowledge-bases).
- **[src/mcp-server/index.ts](./src/mcp-server/index.ts)** — the `createServer` factory installs the search audit (`installSearchAudit`) and the access gate, then registers the tools — once per connection, from the one already-validated `Config`, never re-reading the environment.
- **[src/tools/](./src/tools/)** — each handler resolves the `kb` alias and calls a `main/` function with the resolved base: `registerKbTools(server, cfg)`, `registerConfigTools(server, cfg)`. [src/tools/shared.ts](./src/tools/shared.ts) (the shared `kb` argument) is not coverage-excluded.
- **[src/main/](./src/main/)** — `main/files/index.ts` (read/list/write/rename/delete for any file type, what most `kb_*` tools call, with every mutation serialised through the process-local queue in `mutation-queue.ts`), `main/notes/index.ts` (the Markdown-specific variants plus `createFolder`, which `kb_folder_create` calls), `main/search/` (`searchKb`, behind `kb_search`) and `main/config/index.ts` (`readKbConfig`). Every `main` entry point takes one resolved `KnowledgeBase` as its **first argument** — `readFile(base, { path })`, `writeFile(base, args)` — never the whole `Config`. No ability to reach a base the caller didn't name.
- **[src/utils/](./src/utils/)** — `resolveWithinRoot(rootPath, …)` takes its primitive; `isProtectedPath(relPath)` ([src/utils/protected.ts](./src/utils/protected.ts)) is a pure relpath guard with no config dependency.

To use the code from a script: `const cfg = loadConfig(); const base = selectKnowledgeBase(cfg, 'personal-principal'); await writeFile(base, { path: 'Pillars/note.md', content, create_dirs: true, dry_run: false })`.

### Multiple knowledge bases

One server serves every base declared in `MCP_KI_KB_FS_KNOWLEDGE_BASES` — a JSON object mapping caller-facing alias to that base's absolute (or `~/…`) path. [Declaring your knowledge bases](./docs/guides/user/declaring-knowledge-bases.md) documents the grammar and every startup rejection; what matters when changing code:

- **The declaration is the authorisation boundary, validated at startup.** `loadConfig()` resolves each entry into a `KnowledgeBase` (`alias`, `rootPath`, `zones`, `rootFileAllowlist`, `kiConfigRaw`) and throws unless the alias is a safe identifier and the path is an existing directory. Nothing is resolved lazily, and there is **no `MCP_KI_KB_FS_ROOT_PATH` fallback** — do not add one.
- **`kb` is required on all eight tools.** It is declared once, as `kbArg(cfg)` in [src/tools/shared.ts](./src/tools/shared.ts), as a zod enum over the declared aliases — so an undeclared alias fails argument validation before a handler runs, and the wire schema advertises the roster. Never give it a default, and never accept a bare `z.string()`: a base-qualified path grammar or an optional override would both put base selection somewhere a mistake becomes a containment mistake.
- **Base resolution is single-sourced.** `selectKnowledgeBase(cfg, alias)` in [src/config/index.ts](./src/config/index.ts) is the only place an alias becomes a root. Every handler is `async ({ kb, ...args }) => … main(selectKnowledgeBase(cfg, kb), args)`; `grep -n 'selectKnowledgeBase' src/tools` should show exactly one call per tool and nothing outside `src/tools/`. Because `main/` takes `KnowledgeBase` and `Config` no longer has `rootPath`/`zones`, passing the wrong thing is a type error rather than a silent cross-base read.
- **Access level stays server-wide.** `makeAccessGatedRegister` returns before registering a gated tool, so one server publishes exactly one surface, decided at boot. Per-base access levels are not merely unimplemented, they are incoherent here — don't attempt them. Declaration bounds _which_ bases the install may reach; `MCP_KI_KB_FS_ACCESS_LEVEL` bounds _what_ may be done in them.
- **A base is a closed bundle.** Root, zone map and allow-list travel together on one object, so there is no way to pair one base's root with another's zone configuration. Keep it that way — don't thread `rootPath` and `zones` separately through new code.

### Tool surface and access levels

The `<app>` prefix is `kb`, and the file tools drop the resource segment: `kb_read`, `kb_list`, `kb_write`, `kb_rename`, `kb_delete` and `kb_search`, beside `kb_folder_create` and `kb_config`.

`MCP_KI_KB_FS_ACCESS_LEVEL` defaults to `read`. `write` adds `kb_rename` (`WRITE`) and `kb_folder_create` (`WRITE_IDEMPOTENT`); `destructive` adds `kb_write` and `kb_delete` (`DESTRUCTIVE`), since a write may overwrite.

## Security Requirements

This server reads and writes authorized content under declared knowledge-base roots. Optional search also reads explicitly bound owner-generated state and provisioned model metadata under its separate ownership contract. New tools and changes to existing tools MUST preserve every invariant below.

1. **Two-layer path containment, every call site.** For canonical KB content, run caller-relative paths through **both** `resolveWithinRoot()` and `assertRealPathWithinRoot()`, both in [src/utils/utils.ts](./src/utils/utils.ts), and the zone check `isInScope()`.
2. **Protected paths are non-negotiable.** Every read/write/list handler calls `isProtectedPath()` ([src/utils/protected.ts](./src/utils/protected.ts)). Dotfiles/dotdirs at any depth and root-level repo-meta names (README, CLAUDE, LICENSE, CHANGELOG, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, AGENTS — with optional `.md`/`.txt`) must remain unreachable, except that `kb_read` may read a file in the base's `root_file_allowlist` (default `README.md`, `AGENTS.md`, `CLAUDE.md`) by its exact path; nothing may write or delete one. New FS-touching tools must call this filter.
3. **File-type discipline.** `kb_read`'s `part` works only on UTF-8 Markdown, and `kb_list` returns files, folders or notes as `kind` asks, with `ext` valid only for files. New tools that walk the tree must filter by intended type, not return arbitrary files.
4. **Mutations default to a dry run and refuse stale writes.** `kb_write` and `kb_delete` default `dry_run` to `true` and mutate only when `dry_run: false` is explicit. `kb_write` takes `if_match` with the etag from `kb_read` and refuses to write a file that has changed since; `kb_rename` refuses to overwrite an existing destination.
5. **No shell-out.** This server doesn't spawn processes.
6. **Error messages must not leak the absolute root.** Surface what the caller asked for via `path.relative(base.rootPath, ...)`. The same rule applies to results: `kb_config` reports aliases and zone names, never paths.
7. **Cross-base containment is the new failure mode.** With one root, a traversal bug escaped into unaddressable territory; with several roots in one process it can land _inside a sibling declared base_ — a confidentiality boundary, since declared bases span personal, legal and client material. `resolveWithinRoot`, `assertRealPathWithinRoot` and `isInScope` already take the root/zones per call, so the risk is never in the helpers: it is in the wiring, passing one base's root with another base's path. Any change to that wiring must keep [src/main/files/cross-base.test.ts](./src/main/files/cross-base.test.ts) passing — it declares two bases as siblings on disk and asserts no input shape, including symlinks, crosses from one into the other.

Search uses the same local lexical/physical/protected note-path filters alongside frozen mapping/current-source guards and verifies ownership for derived state. It never opens source stores or provisions runtime assets on reads; see [the search contract](docs/specs/kb-search.md).

Traversal- and symlink-rejection tests live in [src/main/notes/index.test.ts](./src/main/notes/index.test.ts); their cross-base equivalents in [src/main/files/cross-base.test.ts](./src/main/files/cross-base.test.ts).

## Tool registration call sites

Tools are registered in [src/tools/config/index.ts](./src/tools/config/index.ts) (`kb_config`) and [src/tools/kb/index.ts](./src/tools/kb/index.ts) (the other seven). To survey the surface, `grep "registerTool" src/tools/*/index.ts`. README's [Available Tools](./README.md#available-tools) tabulates them with purposes.

Within each group file, `server.registerTool(...)` calls are kept in ascending alphabetical order by tool name — the `ki-repo-mcp` TOOL-1 check enforces it.

## Result envelopes and `outputSchema`

Every tool handler wraps its `main/` call in try/catch and returns `errorResult(<action>, err)`. Ordinary tools retain callback auditing; search alone uses the public SDK dispatch wrapper (`installSearchAudit` in [src/utils/search-audit.ts](./src/utils/search-audit.ts)) to cover recognizable validation/output failures exactly once, and enabled append failure refuses unaudited success.

The `kb_config` result carries the selected base's detail plus a `knowledgeBases` roster of every declared alias with its zone names — so a client can discover the install's reach in one read-only call, without any path being disclosed.

Each tool declares an `outputSchema`, and it is the **same zod schema** that types the `main/` function's return value via `z.infer`. The schemas live next to their implementation — `readFileResultSchema`, `listContentResultSchema`, `writeFileResultSchema`, `renameFileResultSchema`, `deleteFileResultSchema` in [src/main/files/index.ts](./src/main/files/index.ts), `createFolderResultSchema` in [src/main/notes/index.ts](./src/main/notes/index.ts), `searchResultSchema` in [src/main/search/index.ts](./src/main/search/index.ts), `kbConfigResultSchema` in [src/main/config/index.ts](./src/main/config/index.ts). One source means the advertised JSON Schema and the emitted `structuredContent` cannot drift. A new tool must add a schema the same way, not hand-write a second shape.
