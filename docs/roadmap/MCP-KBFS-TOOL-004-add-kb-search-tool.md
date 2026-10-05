---
id: MCP-KBFS-TOOL-004
area: TOOL
title: Add kb_search tool
theme: tool-surface
horizon: now
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-30T07:36:00Z
updated_at: 2026-10-05T12:20:14Z
---

# MCP-KBFS-TOOL-004: Add kb_search tool

## Goal

Agents search one explicitly declared KB through a read-only, strict and bounded `kb_search` surface, with source-authenticated local snippets and exactly-once privacy-preserving search audits through both supported SDK dispatchers. Optional unavailable search is an explicit tool error; QUERY owns literal grep and targeted-read fallback.

## Context

The [delivered qmd adoption](../../../ki-agentic-harness/docs/decisions/ADR-KI-HARNESS-TOOLCHAIN-006-qmd-derived-kb-search-index.md), [pinned search/mapping contract](../../../ki-agentic-harness/skills/repo-structure/ki-repo-kb/references/standards-search.md), [mirror standard](../../../ki-agentic-harness/skills/repo-structure/ki-repo-kb/references/standards-source-mirrors.md), and [synthetic pilot](../../../ki-agentic-harness/docs/decisions/references/qmd-synthetic-pilot.md) are delivered and accepted. The original sixteen tiny-corpus questions showed no quality/context/latency advantage; four predeclared paraphrases demonstrated limited semantic retrieval. Adoption is optional and explicitly provisioned, with no private-scale or efficiency claim.

Tools-ki publishes the concrete registry, mapping and protocol in [KB-SEARCH](../../../tools-ki/docs/specs/kb-search.md) and its [operator guide](../../../tools-ki/docs/guides/user/kb-search.md). The immutable interface receipt is `d6222b752d5f5ee3ef36c7bac55eec3f67629c87`; root and the independent reviewer approved that exact published receipt before this Ready boundary. Completed CLI full gates and acceptance remain mandatory before either delivery's final acceptance, while the verified published interface resolves this item's original implementation prerequisite.

## Boundary

Deliver `kb_search` with required declared `kb` and bounded `query`, optional canonical `zone`, snake_case `path_prefix`, `mode` (`query`, `search`, `vsearch`) and `limit`. Each alias binds explicitly to one `registry_id` and absolute owned `state_directory` via `MCP_KI_KB_FS_SEARCH_BINDINGS`; there is no alias/path/Agora inference. Main behavior receives one resolved KnowledgeBase and injectable fetch, never all bases.

Validate current registry identity/explicit boundary, physical KB root, canonical declaration, owned mapping/generation/config/projection and current source bytes before any HTTP query, then recheck before constructing output. Pinned loopback typed queries use exact collections and bounded candidates. Reject foreign/malformed/stale/escaped/private candidates and reconstruct every title/snippet/line range/label from authorised local Markdown; engine text and line numbering are hints only. Missing models, configuration or endpoint remain clear unavailable states.

Canonical zones come from `skills.ki-repo-kb.zones`, including quoted "+"/"-" staging keys. Keep explicit safe legacy `knowledgeislands-kb` compatibility for existing file readers and root-file allow-list, reject conflicting canonical/legacy zone declarations, and require canonical indexing authority for search. Reject symlinked declaration files before reading bytes or producing parse errors. Existing other-read audit semantics stay intact.

A narrow public SDK `tools/call` registration wrapper observes recognizable search dispatch outcomes, including tool input validation before callbacks; suppress the ordinary callback audit only for search. Modes `writes` and `all` log search successes and failures exactly once; `off` remains off. Whitelist configured alias, valid mode, outcome and query byte count/type only, never raw query/arguments, results, document IDs, private paths or backend error text. Malformed or undelivered protocol envelopes outside the SDK's public handler boundary cannot be represented as a completed search invocation; disclose that limit rather than claiming invisible audit coverage.

No install, model download, index creation/refresh, daemon startup, live client binding, provider mutation, private KB access, publication, push or self-acceptance. Search does not mutate canonical KB/registry authority; the operator daemon may maintain its own disposable derived retrieval cache. Root owns independent review, acceptance and pruning.

## Current state

The baseline source is `fa0135cee7a4905068e115d991902eb4b645c082`; the source remains unchanged after docs receipt `85cd6dc06bedeb49fcabd820ebb25d708bec6a01`. One draft item exists; no active source overlap or dirty paths. The server uses SDK 2.3.0, modern 2026-07-28 plus retained legacy factory, strict schemas, read-only annotation gates and Node22 compiled runtime. Existing zones read only retired knowledgeislands-kb configuration. Callback audit misses pre-callback SDK validation and excludes read search under writes. The author has sole MCP Git write ownership; all fixtures remain synthetic.

Harness accepted receipt `e093d3ad08f59376b22ce18c3c74b197fe85fb85` (and subsequent GOV pruning) retains unchanged canonical helper SHA-256 `427930c35888981bad777a3da9e7cc71023d145dc4fa8da8b3f0bc5caa99065d`. Tools portable contract at the published receipt has SHA-256 `9e343cc3293005106563f3eba812cf83928e7a0e6abbf64f4da73373a3a898b9`. Root approved the exact interface receipt, supported by independent native/pure assertions. The original published-contract wait is resolved; no live operator install is a readiness prerequisite.

## Steps

- [ ] Resolve the exact published interface approval, retain immutable upstream receipts and freeze this Ready plan plus a singleton outcome batch (`completion_target: done`, root acceptance authority) before source.
- [ ] Vendor the frozen portable contract and canonical helper under `src/generated/kb-search/`, record exact digests/receipts, and add a drift check. Only deterministic .ts-to-.js import adaptation is allowed. Add Node-compatible yaml as an explicit runtime parser dependency; no public package publication.
- [ ] Add strict optional search binding configuration, canonical/legacy zone resolution and conflict refusal, and confined regular declaration reads. Preserve previous valid file readers/root allow-list; document deliberate migration and startup failures.
- [ ] Add read-only main/search behavior and strict result schema. Validate registry/declaration/owner/mapping/generation/current-source boundaries, existing local mode-specific models, bounded typed HTTP protocol and local reconstruction. Never provision on reads.
- [ ] Register kb_search through the existing annotation/access gate, use required kb enum and strict bounded schema, then install the narrow public SDK search audit wrapper with exact-once redacted outcomes and off respected.
- [ ] Add isolated synthetic fixtures for hostile backend content/paths/docids, zones, registry/owner/declaration/generation/projection/current-source drift, changed nested/symlink boundaries, all unavailable/error paths, model and transport bounds, and strict public input/output. Exercise actual modern/legacy SDK dispatch validation/audit and compiled Node22 transport.
- [ ] Update the capability inventory, user/developer guides and accepted behavior spec, including optional provisioning, read/cache distinction, URI/line authority, non-exhaustive results and explicit QUERY-owned fallback.
- [ ] Run all required gates sequentially in the coordinator-assigned heavy window; prepare the six-heading Review immediately before final Discussion, transition only this record to Awaiting review, commit intended paths and return the exact clean candidate. Root/independent reviewer owns approval, Done and prune.

## Files touched

- `docs/roadmap/MCP-KBFS-TOOL-004-add-kb-search-tool.md`; `+/_BATCHES/MCP-KBFS-BATCH-001.md` (new authority envelope).
- `src/generated/kb-search/contract.ts`, `source-mirrors.ts`, `receipt.json` (new pinned vendor payload); `src/main/search/vendor.test.ts` (drift evidence).
- `src/config/index.ts`, `src/config/index.test.ts` (bindings, canonical/legacy zones, safe declaration).
- `src/main/search/index.ts`, `mapping.ts`, and co-located tests (new behavior and strict result schema).
- `src/tools/kb/index.ts`, `src/tools/kb/index.test.ts` (registration/public schema); `src/utils/access-level.ts` (search-only callback exception).
- `src/utils/search-audit.ts` and tests (new public dispatcher audit); `src/mcp-server/index.ts` (factory wiring).
- `scripts/smoke.ts` (compiled modern/legacy synthetic search and validation/audit/error evidence).
- `package.json`, `bun.lock` (explicit Node YAML dependency).
- `README.md`, `CLAUDE.md`, `docs/specs/kb-search.md`, `docs/specs/README.md`, `docs/guides/user/kb-search.md`, user/developer guide indexes, `scoping-a-knowledge-base.md`, `architecture.md` and `troubleshooting.md` (discoverability, behavior and migration).

## Verify

Every test uses new task-owned synthetic KBs and explicitly bound independent generations; no real KB/store/client config is opened. Public dispatcher fixtures must prove exactly one search failure event for invalid aliases/query/unknown keys/mode/limits and unavailable backend under writes/all, none under off, and no raw query/results/private path in logs. Both protocol eras and compiled Node are required, not merely callbacks. A custom Pillars folder and explicit "+"/"-" fixture prove canonical zone selection; valid legacy readers continue, conflicting migration aborts. Hostile candidate/projection/declaration/current-source/registry changes fail before expansion or exposure; source/helper bytes stay pinned.

```bash
bunx tsc --noEmit
bun run test
bun run test:coverage
bun run build
bun run ki:test:smoke
bunx biome check .
bunx knip
ki repo audit --skill ki-repo-mcp --progress never
ki repo audit --skill ki-engineering --progress never
ki repo audit --skill ki-authoring --progress never
ki repo audit --skill ki-work-roadmap --progress never
```

Required 100% coverage remains unchanged. Serialize full/coverage gates with the tools author; focused fixtures may run meanwhile. Final CLI gates/acceptance are an external consolidated acceptance condition, not a local dependency edge or verification bypass.

## Dependencies / blocks

No local edges. The already-approved principal outcome and explicit per-registered-KB boundary policy cover this selected item. Root approved the immutable published tools interface before this plan became Ready. No trade or provider operation is necessary under current direct receiver authority. Operator runtime provisioning and future large/private-scale benchmarking remain outside acceptance.

## Documentation impact

### Decision Records

No new architecture decision: implement the accepted upstream optional derived-search decision.

### Specifications

Add exact MCP input/output/configuration, boundary and audit behavior with executable evidence.

### Guides

Document explicit bindings, canonical-zone migration, operator provisioning and unavailable behavior; update tool inventory and developer ownership/wire/audit guidance.

### Roadmap

One selected item and exact singleton outcome envelope; no dynamically admitted work or fleet migration.

## Discussion

### Current authority and review

The principal approved the synthetic verified upstream/index/mirror contract and subsequent MCP search; root explicitly handed this repository's sole writer role to the author. Root and the independent reviewer will review the exact clean candidate. Historical route/private-corpus assumptions are superseded by this direct approved scope and synthetic verification. Source may start only after approved immutable interface and committed Ready/batch boundary.
