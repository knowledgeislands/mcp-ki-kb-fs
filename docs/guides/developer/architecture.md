# Architecture

How the server is put together, what each layer is allowed to know, and which invariants a change has to preserve. Read this before your first substantive change; it explains why several files look thinner than you would expect.

## The four layers

Dependencies point strictly downwards. Nothing in `src/main/` imports from `src/tools/`, and nothing in `src/utils/` imports from either.

**`src/mcp-server/index.ts` — the entry point.** It calls `loadConfig()` once at module scope, reports the resolved configuration to stderr, installs the access gate, and hands a server factory to `serveStdio`. It is the only file that reads the environment or writes to stderr.

**`src/tools/` — the wire surface.** One registration module per group (`kb/` for the six knowledge-base tools, `config/` for `kb_config`), aggregated by `src/tools/index.ts`. A registration declares a title, a description, an input schema, an output schema, and annotations, then calls into `src/main/` and wraps the result. `src/tools/shared.ts` holds `kbArg(cfg)`, the one argument every tool has in common, defined once so a second definition cannot drift into accepting an alias the declaration never authorised.

**`src/main/` — the behaviour.** `files/` and `notes/` hold the filesystem work; `config/` builds the orientation payload. These functions take an already-selected `KnowledgeBase` as their first argument, return plain data, and throw plain `Error`s. They know nothing about MCP.

**`src/utils/` — cross-cutting mechanics.** Path containment (`utils.ts`), protected paths (`protected.ts`), zone scoping (`zones.ts`), the access gate (`access-level.ts`), the audit wrapper (`audit-log.ts`), the result envelope (`results.ts`), and the annotation presets (`annotations.ts`).

`src/config/index.ts` sits beside these as the definition of `Config`, `KnowledgeBase`, and the loader that validates both. `src/generated/` holds an mcporter-emitted typed client and is excluded from linting, coverage, and knip.

## Configuration is injected, not ambient

`loadConfig(env = process.env)` is the only function that looks at environment variables, and it takes the environment as a parameter so a caller can supply one. It validates the whole declaration eagerly — aliases, paths, existence, directory-ness, each base's `.ki.toml` — and throws rather than returning a partial result.

Everything downstream receives what it needs. A `src/main/` function receives one `KnowledgeBase`, not the whole `Config`, which means it has no way to see a second base's root even accidentally.

Two consequences follow, and both are load-bearing.

Tests never mutate the environment. They construct a `Config` literal, or call `loadConfig` with an explicit object, and pass it in. `vitest.config.ts` therefore needs no env seeding, and test files do not interfere with each other through global state.

Configuration cannot be reloaded. There is no watcher and no lazy re-read, so every documented "restart the client" instruction is a property of this design rather than an omission.

## The access gate

`makeAccessGatedRegister` returns a `Proxy` over `server.registerTool`, and the entry point assigns it over the real method before any registration runs. On each call it derives the tool's level from its annotations and drops the registration entirely when that level outranks the configured one.

Derivation lives in `levelFromAnnotations`, and its ordering matters:

- `readOnlyHint: true` gives `read`.
- `destructiveHint: true` gives `destructive`.
- both explicitly `false` gives `write`.
- anything else — unannotated, or partially annotated — gives `destructive`.

That final clause is the fail-safe. Forgetting to annotate a new tool makes it _invisible_ at the default level rather than quietly available, so carelessness costs you a missing tool rather than an unguarded one. Use the presets in `src/utils/annotations.ts` rather than writing hint objects inline; a preset is what keeps the derivation predictable.

The same proxy wraps every surviving callback in `withAuditLog`, so audit coverage cannot be forgotten at an individual registration site — a tool that is registered is a tool that is logged, subject to the configured mode.

## Path containment

Every filesystem-touching path crosses four checks, and a change that introduces a new one has to cross all four in the same order.

1. **Schema refusal.** `filePathArg` refuses `..` segments, a leading `/`, a leading `~`, and null bytes at argument-validation time, before any handler runs.
2. **Lexical containment.** `resolveWithinRoot(root, rel)` normalises and asserts the result is strictly inside the root, throwing `Path escapes root`.
3. **Physical containment.** `assertRealPathWithinRoot` realpaths both the root and the target — or, when the target does not exist yet, its deepest existing ancestor — and compares. This is what catches a symlink inside a base pointing outside it, which the lexical check cannot see.
4. **Policy.** `isInScope` checks the first path segment against the base's resolved zones and staging areas; `isProtectedPath` refuses dot-prefixed segments at any depth and repository-meta basenames at the root only.

The root-file allow-list is the single documented exception, and it is deliberately narrow: exact-match paths, readable through `readFile` alone, never listable, validated at startup.

`src/main/files/cross-base.test.ts` asserts the property that matters most — that two bases side by side on disk cannot be arithmetic-ed into each other — and `repository-contract.test.ts` uses this repository as a live knowledge base to prove the allow-list opens exactly its three declared context files and nothing else.

## Schemas and the result envelope

A tool's `outputSchema` is the same zod object `src/main/` uses to describe its return value — `files.listContentResultSchema` and its siblings are exported from the behaviour layer and re-used at the registration site. Declared schema and emitted `structuredContent` therefore cannot drift apart, because there is only one of them.

Results go out through `jsonResult` or `errorResult` in `src/utils/results.ts`. Both stamp `resultType: 'complete'`, the discriminator the 2026-07-28 protocol profile requires so a synchronous result announces itself as the whole answer rather than a partial, task-backed one.

Because the schemas are published live on the wire, this repository keeps no hand-maintained copy of them. If you change an argument, its description, or a default, the change is already documented the moment it ships — and a guide that restated it would be the thing that went stale.

## Connection lifecycle

`serveStdio(createServer, { legacy: 'serve' })` takes a factory, not an instance, so each connection gets its own `McpServer` built from the same already-validated configuration. `legacy: 'serve'` keeps pre-2026 clients working by serving them from that same factory with the same tool surface; it can be dropped to `'reject'` once no client in the estate still opens that way.

Only `SIGINT` is handled, closing the handle before exit.

## Adding or changing a tool

A new tool touches, in order: a behaviour function and its result schema in `src/main/`; a registration in the relevant `src/tools/` module with an annotation preset chosen honestly; the `EXPECTED_TOOLS` list in `scripts/smoke.ts`; tests in the co-located `*.test.ts`; and the tool inventory in [the README](../../../README.md) and `CLAUDE.md`.

Be honest with the annotations. They are not documentation — they decide registration, the audit level, and therefore whether the tool exists at all for a given install.

## A note on the current surface

`src/main/notes/` exports Markdown-specific variants — note reading, listing, renaming, deleting, and writing — of which only `createFolder` is registered; the rest, and `files.listFiles`, are exercised by tests alone. The registered surface routes everything else through `src/main/files/`. Treat the unregistered exports as material awaiting a decision rather than as the live path, and check `src/tools/kb/index.ts` for what a given tool actually calls.
