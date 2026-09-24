---
id: MCP-KBFS-FND-002
area: FND
title: Migrate MCP protocol profile
theme: foundation-tooling
horizon: next
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: beb0c6af0dfac988072e0a51fa448ee4a2d24bb3
created_at: 2026-09-02T01:12:46Z
updated_at: 2026-09-24T09:18:00Z
---

## Goal

Move mcp-ki-kb-fs to the supported MCP 2026-07-28 server profile without breaking its existing tool surface or legacy clients.

## Context

The Harness KI-HARNESS-GOV-006 rollout now derives protocol applicability from the runtime dependency. This repository still declares @modelcontextprotocol/sdk major 1 and remains conformant to the legacy 2025-11-25 profile. The accepted mcp-git-audit pilot proves the modern package family, per-connection stdio factory, SDK-owned discovery, complete result envelopes, smoke boundary, and deliberate compatibility fallback.

## Boundary

Do not change the public tool contract, remove legacy compatibility without evidence, or treat the Harness rollout as receiver acceptance. This record captures receiver-owned migration work only; prioritisation, implementation, verification, acceptance, release, and publication remain in this repository.

## Shaping

Adopt the accepted pilot as the first comparison baseline: move to the v2 server package family, replace the legacy stdio transport with a per-connection serveStdio factory, add resultType: "complete" to synchronous result helpers, retain deliberate legacy fallback, and prove SDK-owned discovery through the repository smoke boundary.

Promote to Next when the exact dependency delta, entry-point change, compatibility boundary, and receiver-specific smoke assertions are reviewed against this repository's current source.

## Current state

`package.json` declares `@modelcontextprotocol/sdk` `^1.30.0` as a runtime dependency, so `ki-repo-mcp` PROTO-1 currently reports the conformant legacy 2025-11-25 profile and the modern-only checks do not apply. Six source files carry the legacy import: `src/mcp-server/index.ts` (value imports of `McpServer` and `StdioServerTransport`), `src/tools/kb/index.ts`, `src/tools/kb/index.test.ts`, `src/tools/config/index.ts` (type-only `McpServer`), and `src/utils/access-level.ts` (type-only `McpServer` and `ToolAnnotations`). `scripts/smoke.ts` drives the legacy `Client` and `StdioClientTransport` from the same package.

The entry point builds one `McpServer` at module scope and connects a single `StdioServerTransport`, so there is no per-connection factory and no era decision: one instance serves whatever the one client sends. `src/utils/results.ts` returns envelopes without the `resultType` discriminator the modern profile requires on every synchronous result.

Nothing else blocks the move. The access gate, annotation presets, audit-log wrapper, `outputSchema`/`structuredContent` pairing, and the seven-tool surface are all profile-independent and stay exactly as they are. `zod` is pinned at exactly `4.4.3` with a `.ki.toml` `dependency_holds` entry whose stated cause is the legacy SDK's schema types; `bun outdated` reports `4.6.5` as latest, which is the version the accepted pilot runs against `@modelcontextprotocol/server` 2.0.0.

## Steps

- [x] Swap the server package family in `package.json`: remove `@modelcontextprotocol/sdk` from `dependencies`, add `@modelcontextprotocol/server` `2.0.0`, and add `@modelcontextprotocol/client` `2.0.0` as a devDependency for the smoke harness only.
- [x] Release the zod hold in the same change: move `zod` to `^4.6.5` and delete the now-causeless `dependency_holds` entry from `[skills.ki-engineering]` in `.ki.toml`.
- [x] Repoint the type-only imports in `src/tools/kb/index.ts`, `src/tools/kb/index.test.ts`, `src/tools/config/index.ts`, and `src/utils/access-level.ts` at `@modelcontextprotocol/server`, leaving every registration call site unchanged.
- [x] Replace the single-instance entry point in `src/mcp-server/index.ts` with a `createServer` factory handed to `serveStdio(factory, { legacy: 'serve', onerror })`, keeping `loadConfig()` at module scope, the startup stderr diagnostics, and the gated `registerTool` assignment inside the factory so every connection gets its own gated instance; add SIGINT teardown through the returned handle.
- [x] Add `resultType: 'complete'` to both helpers in `src/utils/results.ts` and pin it in `src/utils/results.test.ts`, updating the helper's doc comment to cite the 2026-07-28 profile.
- [x] Rewrite `scripts/smoke.ts` onto `@modelcontextprotocol/client`, retaining every existing assertion (tool surface, `inputSchema` presence, required `kb` enum over the declared aliases) and adding: modern era and negotiated `2026-07-28`, a `resultType: "complete"` discovery result carrying this server's `serverInfo`, a successful and a malformed `kb_list` round trip, and a second connection from a legacy-handshake client proving the retained fallback serves the identical surface.
- [x] Update `CLAUDE.md` to state the 2026-07-28 revision, the per-connection factory, and the deliberate legacy fallback; add a CHANGELOG entry.
- [x] Run every gate below, including `ki repo audit`, and record the outcomes in the review packet.

## Files touched

`package.json`, `bun.lock`, `.ki.toml`, `src/mcp-server/index.ts`, `src/tools/kb/index.ts`, `src/tools/kb/index.test.ts`, `src/tools/config/index.ts`, `src/utils/access-level.ts`, `src/utils/results.ts`, `src/utils/results.test.ts`, `scripts/smoke.ts`, `CLAUDE.md`, `CHANGELOG.md`, and this record.

Explicitly not touched: `src/main/**` (no implementation change), `src/config/**`, `src/utils/annotations.ts`, `src/utils/audit-log.ts`, `src/generated/**` (the emitted client is transport-agnostic mcporter output and is regenerated on its own schedule), `README.md` tool catalogue, and `docs/roadmap/MCP-KBFS-FND-004-*` which another thread owns.

## Verify

- `bun run build` — TypeScript emits with no error under the v2 type surface.
- `bun run test` — full vitest suite passes, including the tool-layer contract tests and the updated result-helper assertions.
- `bun run test:coverage` — 100% lines, functions, branches, and statements, unchanged thresholds.
- `bunx @biomejs/biome check .` — no lint or format findings.
- `bun run ki:test:smoke` — the built server reports the modern era, negotiates `2026-07-28`, returns a complete discovery envelope, serves all seven tools with the required `kb` enum, returns a complete success envelope and an `isError` envelope for malformed arguments, and still serves the identical surface to a legacy-handshake client.
- `ki repo audit --concise --progress never` — PASS across all 15 skills, with `ki-repo-mcp` PROTO-1 now reporting the modern 2026-07-28 profile rather than the legacy one.

## Dependencies / blocks

No work-item dependency: `blocks` and `blocked_by` stay empty. The `mcp-git-audit` pilot is already accepted and merged, so nothing is pending on another record's lifecycle.

`MCP-KBFS-FND-004` (audience-centric guides) is live in another thread and touches `README.md`, `docs/guides/`, and `.ki.toml`. The overlap is `.ki.toml` only, in a different table (`[skills.ki-engineering]` here, `[skills.ki-guides]` there), and this item deliberately leaves `README.md` alone, so the two can land in either order.

`MCP-KBFS-FND-003` (conformance audit review) is unaffected: its findings concern Decision Records, managed ignores, and GitHub metadata, none of which this change touches.

## Documentation impact

### Decision Records

None. The protocol profile itself is decided upstream — `ki-repo-mcp` §12 states the two supported profiles and the Harness KI-HARNESS-GOV-006 rollout derives applicability from the runtime dependency. Adopting an already-decided standard in a receiver repository is delivery, not a new local decision, and `GDR-MCP-KBFS-001` (adopting decision records) is the only DR this repository holds. The one genuinely local choice — retaining legacy-client fallback rather than rejecting pre-2026 handshakes — is a documented option within that standard and is recorded in this item and in `CLAUDE.md`, not as a separate DR.

### Specifications

No behaviour-level contract changes. Tool names, input schemas, `outputSchema` declarations, `structuredContent` payloads, annotation-derived access levels, and audit-log events are all unchanged; the delta is confined to the wire envelope discriminator and the handshake era, both owned by the SDK. The smoke harness is extended so the unchanged contract is proven on the new wire rather than assumed.

### Guides

`CLAUDE.md` currently asserts "This server targets MCP spec revision 2025-11-25" and describes the entry point as connecting a stdio transport; both become false on delivery and are corrected, along with a short note on the per-connection factory and the retained legacy fallback. `README.md` makes no protocol claim and needs no change. `MCP-KBFS-FND-004` owns any later move of this material into `docs/guides/`.

### Roadmap

No follow-on record needed. This item completes the receiver-owned migration in full; the release and publication of the resulting version stay outside it, as the Boundary already states.

## Review

### Delivered

The approved boundary in full: the receiver-owned migration of this repository to the MCP 2026-07-28 server profile, with the public tool contract unchanged and legacy-client compatibility deliberately retained. Baseline `beb0c6af0dfac988072e0a51fa448ee4a2d24bb3` (the planning commit that shaped this record); the resulting evidence is the working tree recorded in the delivery commit that carries this packet.

Excluded as planned and confirmed untouched: `src/main/**`, `src/config/**`, `src/utils/annotations.ts`, `src/utils/audit-log.ts`, `src/generated/**`, the `README.md` tool catalogue, and `docs/roadmap/MCP-KBFS-FND-004-*`. Prioritisation beyond this item, acceptance, release, and publication remain outside it.

### Change Summary

`package.json` — `@modelcontextprotocol/sdk` `^1.30.0` removed from `dependencies`; `@modelcontextprotocol/server` `2.0.0` added; `@modelcontextprotocol/client` `2.0.0` added as a devDependency for the smoke harness only; `zod` moved from the pinned `4.4.3` to `^4.6.5`. `bun.lock` regenerated. `.ki.toml` — the now-causeless `dependency_holds` entry deleted from `[skills.ki-engineering]`, leaving the table empty.

`src/mcp-server/index.ts` — the module-scope single instance and `StdioServerTransport` connection are replaced by a `createServer` factory handed to `serveStdio(createServer, { legacy: 'serve', onerror })`, with SIGINT teardown through the returned handle. `loadConfig()` and the startup stderr diagnostics stay at module scope; the gated `registerTool` assignment and both registration calls moved inside the factory, so each connection gets its own gated instance built from the one already-validated `Config`.

`src/utils/results.ts` — both helpers stamp `resultType: 'complete'`; the doc comment now cites the 2026-07-28 profile and explains why the discriminator is invisible to callers. `src/utils/results.test.ts` pins it in both helper assertions.

Type-only import repointing at `@modelcontextprotocol/server`, with no call-site change, in `src/tools/kb/index.ts`, `src/tools/kb/index.test.ts`, `src/tools/config/index.ts`, and `src/utils/access-level.ts` (two legacy imports collapsed into one).

`scripts/smoke.ts` — rewritten onto `@modelcontextprotocol/client`. Every prior assertion is retained, now factored into `assertToolSurface(tools, era)` so it can be run against both eras: the seven-tool surface diff, `inputSchema` presence, and every tool requiring `kb` as an enum exactly equal to the declared aliases. Added: `versionNegotiation: { mode: 'auto' }`, modern era, negotiated `2026-07-28`, a `resultType: 'complete'` discovery result carrying this server's `serverInfo`, a successful `kb_list` round trip asserting `structuredContent`, an undeclared-alias call asserting an `isError` envelope rather than a protocol error, and a second legacy-handshake client proving the retained fallback serves the identical surface.

`CLAUDE.md` — the protocol section now states the 2026-07-28 revision, the v2 package family, the per-connection factory, SDK-owned discovery, the single place the discriminator is stamped, and the deliberate `legacy: 'serve'` fallback; the `src/mcp-server/index.ts` layout bullet is corrected to describe the factory. `CHANGELOG.md` — an `Unreleased` entry with `Changed` and `Compatibility` subsections.

Material decisions. The zod hold was released in this change rather than left behind: `.ki.toml` named `@modelcontextprotocol/sdk` 1.30.0 schema types as the hold's only cause, so removing the SDK removed the constraint, and `ki-engineering` DEPS-1 flags a hold once its package is current. The legacy fallback is retained rather than rejected, per the Boundary's evidence requirement — no client in the estate has been shown to have moved. One deviation from the plan, immaterial to scope: the smoke harness now creates a `Pillars` directory under each throwaway temp root, because the added successful round trip needs a real zone directory to list.

### Verification

- `bun run build` — PASS. `tsc -p tsconfig.build.json` emits with no diagnostic under the v2 type surface.
- `npx tsc -p tsconfig.json --noEmit` — PASS (exit 0). Covers the test and script sources the build config excludes, so the rewritten smoke harness is typechecked too.
- `bun run test` — PASS. `Test Files 12 passed (12)`, `Tests 289 passed (289)`.
- `bun run test:coverage` — PASS. Statements 100% (687/687), Branches 100% (440/440), Functions 100% (79/79), Lines 100% (631/631); thresholds unchanged.
- `bunx @biomejs/biome check .` — PASS. `Checked 37 files… No fixes applied. Found 1 info.` The single info is the pre-existing `biome.json` `$schema` pin (2.5.12) trailing the installed CLI (2.5.14); it predates this change and is out of scope.
- `bun run ki:test:smoke` — PASS. `✓ smoke passed: modern 2026-07-28 discovery, legacy fallback, 7 tools listed, all requiring kb ∈ {smoke-alpha, smoke-beta}, complete result envelope`.
- `ki repo audit --concise --progress never` — PASS · 15 skills, including `ki-repo-mcp`. The modern-profile conditions are directly observable: `grep -rn '@modelcontextprotocol/sdk\|StdioServerTransport' src/ scripts/ package.json` returns nothing, `serveStdio(` appears in `src/mcp-server/index.ts`, and `resultType: 'complete'` covers both result helpers.

### Outstanding concerns

None blocking. Three observations for the reviewer, none of which this item owns.

The `biome.json` schema-pin info predates this change. `@modelcontextprotocol/sdk` remains in `node_modules` as a transitive dependency of `mcporter` (a devDependency used by `ki:generate:client`); it is no longer declared by this repository and no source file imports it, so the profile classification is unaffected. `CHANGELOG.md` records the migration under `Unreleased` because `package.json` still reads `0.9.0` while the changelog's newest released heading is `1.0.0` — that pre-existing mismatch is a release-time decision, and the Boundary keeps release and publication outside this record.

### Post-change review

Goal met: the repository now runs the supported 2026-07-28 profile, and the tool surface a client sees is byte-identical to the one it saw before — proven, not assumed, because the smoke harness asserts the same surface over both the modern and legacy handshakes. Scope held to the Files touched list; nothing in `src/main/`, `src/config/`, or the generated client changed.

Regression risk is low and concentrated in the two places a reviewer should look. First, the per-connection factory: a second connection now builds a second gated `McpServer`, so any future state cached at module scope beside `config` would be shared where it previously could not be — the invariant to keep is that only the validated `Config` lives out there. Second, the result envelope: the discriminator is stamped in exactly one file, and the v2 client rejects a complete result without it, so the smoke test is what stops a hand-rolled envelope elsewhere from regressing silently.

Acceptance readiness: every gate in Verify has been run on the finished tree and passes. The one judgement call a human may wish to overturn is retaining `legacy: 'serve'`; flipping it to `'reject'` is a one-line change plus the corresponding smoke assertion, and is deliberately left as a separate, evidence-led decision.

### Mini recap

Delivered the MCP 2026-07-28 migration for `mcp-ki-kb-fs`: v2 server package family, per-connection `serveStdio` factory, `resultType: 'complete'` on both result helpers, a v2-client smoke harness asserting both protocol eras, the zod hold released, and `CLAUDE.md`/`CHANGELOG.md` brought into line. Verified by build, strict typecheck, 289 tests, 100% coverage, Biome, the live smoke boundary, and a full `ki repo audit` PASS across 15 skills. No blocking concerns; the retained legacy fallback and the `0.9.0`/`1.0.0` version-versus-changelog mismatch are the two items a reviewer may wish to rule on.

Learning routes, proposed only: the per-connection factory invariant (nothing but validated config at module scope) is the kind of thing worth stating once in the shared MCP layout guidance rather than rediscovering per repository; and the smoke harness is now the only place the protocol profile is provable, which is worth naming explicitly wherever the sibling MCPs copy this layout. Neither is promoted here.

## Discussion

### Source evidence

The portable profile and rubric live in ki-repo-mcp; the accepted mcp-git-audit migration is implementation evidence, not a patch to copy mechanically. Receiver-specific authentication, configuration, generated client, and tool-envelope differences remain local design inputs.

### Acceptance boundary

The modern profile is not claimed until this repository's package, result helpers, stdio entry point, focused tests, live smoke, and ki-repo-mcp audit agree. A passing legacy audit before migration remains expected.

### Promotion into Next

The Shaping condition for leaving Soon was that the exact dependency delta, entry-point change, compatibility boundary, and receiver-specific smoke assertions be reviewed against this repository's current source. That review was carried out against `package.json`, `src/mcp-server/index.ts`, `src/tools/`, `src/utils/access-level.ts`, `src/utils/results.ts`, and `scripts/smoke.ts`, with the accepted `mcp-git-audit` migration (`1016e15`) read as comparison evidence rather than a patch to copy. The delta is small, wholly local, and independently executable, so the record moves to Next and is shaped for delivery in the same pass.

The zod pin is part of the delta rather than an adjacent tidy-up: `.ki.toml` records `dependency_holds = ["zod — 4.5.4 and later are incompatible with @modelcontextprotocol/sdk 1.30.0 schema types"]`, and commit `47d6585` rolled zod back from 4.6.5 to 4.4.3 for exactly that reason. Removing the legacy SDK removes the hold's only cause; leaving the hold in place afterwards would assert a constraint that no longer exists.
