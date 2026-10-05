---
id: MCP-KBFS-TOOL-004
area: TOOL
title: Add kb_search tool
theme: tool-surface
horizon: now
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: 27cdc7fab09b00a2e379b8c7209111e8e4934042
created_at: 2026-09-30T07:36:00Z
updated_at: 2026-10-05T13:10:20Z
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

A narrow public SDK `tools/call` registration wrapper observes recognizable search dispatch outcomes, including tool input validation before callbacks; suppress the ordinary callback audit only for search. Modes `writes` and `all` append search successes and failures exactly once when storage is available; `off` remains off. Enabled append failure returns a sanitized audit-unavailable error rather than an unaudited successful search; physical events cannot be promised when storage fails. Other audit behavior is unchanged. Whitelist configured alias, valid mode, outcome and query byte count/type only, never raw query/arguments, results, document IDs, private paths or backend error text. Malformed or undelivered protocol envelopes outside the SDK's public handler boundary cannot be represented as a completed search invocation; disclose that limit rather than claiming invisible audit coverage.

No install, model download, index creation/refresh, daemon startup, live client binding, provider mutation, private KB access, publication, push or self-acceptance. Search does not mutate canonical KB/registry authority; the operator daemon may maintain its own disposable derived retrieval cache. Root owns independent review, acceptance and pruning.

## Current state

At planning, the baseline source was `fa0135cee7a4905068e115d991902eb4b645c082`; the source remains unchanged after docs receipt `85cd6dc06bedeb49fcabd820ebb25d708bec6a01`. One selected item existed with no active source overlap or dirty paths. The server uses SDK 2.3.0, modern 2026-07-28 plus retained legacy factory, strict schemas, read-only annotation gates and Node22 compiled runtime. At baseline, zones read only retired knowledgeislands-kb configuration. Baseline callback audit misses pre-callback SDK validation and excludes read search under writes. The author has sole MCP Git write ownership; all fixtures remain synthetic.

Harness accepted receipt `e093d3ad08f59376b22ce18c3c74b197fe85fb85` (and subsequent GOV pruning) retains unchanged canonical helper SHA-256 `427930c35888981bad777a3da9e7cc71023d145dc4fa8da8b3f0bc5caa99065d`. Tools portable contract at the published receipt has SHA-256 `9e343cc3293005106563f3eba812cf83928e7a0e6abbf64f4da73373a3a898b9`. Root approved the exact interface receipt, supported by independent native/pure assertions. The original published-contract wait is resolved; no live operator install is a readiness prerequisite.

## Steps

- [x] Resolve the exact published interface approval, retain immutable upstream receipts and freeze this Ready plan plus a singleton outcome batch (`completion_target: done`, root acceptance authority) before source.
- [x] Vendor the frozen portable contract and canonical helper under `src/generated/kb-search/`, record exact digests/receipts, and add a drift check. Only deterministic .ts-to-.js import adaptation is allowed. Add Node-compatible yaml as an explicit runtime parser dependency; no public package publication.
- [x] Add strict optional search binding configuration, canonical/legacy zone resolution and conflict refusal, and confined regular declaration reads. Preserve previous valid file readers/root allow-list; document deliberate migration and startup failures.
- [x] Add read-only main/search behavior and strict result schema. Validate registry/declaration/owner/mapping/generation/current-source boundaries, existing local mode-specific models, bounded typed HTTP protocol and local reconstruction. Never provision on reads.
- [x] Register kb_search through the existing annotation/access gate, use required kb enum and strict bounded schema, then install the narrow public SDK search audit wrapper with exact-once redacted outcomes and off respected.
- [x] Add isolated synthetic fixtures for hostile backend content/paths/docids, zones, registry/owner/declaration/generation/projection/current-source drift, changed nested/symlink boundaries, all unavailable/error paths, model and transport bounds, and strict public input/output. Exercise actual modern/legacy SDK dispatch validation/audit and compiled Node22 transport.
- [x] Update the capability inventory, user/developer guides and accepted behavior spec, including optional provisioning, read/cache distinction, URI/line authority, non-exhaustive results and explicit QUERY-owned fallback.
- [x] Run all required gates sequentially in the coordinator-assigned heavy window; prepare the six-heading Review immediately before final Discussion, transition only this record to Awaiting review, commit intended paths and return the exact clean candidate. Root/independent reviewer owns approval, Done and prune.

## Files touched

- `docs/roadmap/MCP-KBFS-TOOL-004-add-kb-search-tool.md`; `+/_BATCHES/MCP-KBFS-BATCH-001.md` (new authority envelope).
- `src/generated/kb-search/contract.ts`, `source-mirrors.ts`, `receipt.json` (new pinned vendor payload); `src/main/search/index.test.ts` (drift evidence).
- `src/config/index.ts`, `src/config/search.test.ts` (bindings, canonical/legacy zones, safe declaration).
- `src/main/search/index.ts`, `mapping.ts`, and co-located tests (new behavior and strict result schema).
- `src/tools/kb/index.ts`, `src/tools/kb/index.test.ts` (registration/public schema); `src/utils/access-level.ts` (search-only callback exception).
- `src/utils/audit-log.ts` (awaited sanitized search append outcome); `src/utils/search-audit.ts` and tests (new public dispatcher audit); `src/mcp-server/index.ts` (factory wiring).
- `scripts/smoke.ts`, `scripts/search-smoke.ts` (compiled modern/legacy synthetic search and validation/audit/error evidence).
- `package.json`, `bun.lock` (explicit Node YAML dependency).
- `README.md`, `AGENTS.md`, `CHANGELOG.md`, `.ki.toml`, `docs/specs/kb-search.md`, `docs/specs/index.md`, `docs/guides/user/kb-search.md`, user/developer guide indexes, `scoping-a-knowledge-base.md`, `architecture.md` and `troubleshooting.md` (discoverability, behavior and migration).

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

## Delivery evidence

The source is implemented against the immutable Ready/batch baseline. Required gates pass: 346 tests and 100% statements/branches/functions/lines; tsc/build/Biome/Knip; compiled modern/legacy smoke; MCP, engineering, authoring, specs and roadmap audits. Runtime evidence is under `/tmp/mcp-roadmap-completion-20261005/mcp-kbfs-*-final.log`. The independent reviewer ran 149 public SDK assertions using both minimum Node22.16.0 and Node24.21.0, with each compiled child using the selected process executable. Exact terminal review binds the forthcoming clean packet commit.

Independent review identified and fixed a fresh canonical-zone revocation gap. The adapter now resolves current zones from the exact declaration snapshot and compares current, mapping and startup authority before and after retrieval; reblessed digest changes cannot retain revoked folder access. Required local lexical/physical/protected note-path filters are applied alongside unchanged pinned vendor guards. No private KB/store or global binding was read or changed.

## Review

### Delivered

Delivered the approved optional one-KB search boundary from immutable implementation baseline `27cdc7fab09b00a2e379b8c7209111e8e4934042`. Clean source commit `b1604776da73a300270be29f48bd7a5ae5df2012` contains exactly 35 intended files; the hook changed zero bytes and captured no unrelated work. The upstream pinned interface remains `d6222b752d5f5ee3ef36c7bac55eec3f67629c87`; parent accepted the completed CLI delivery independently. This is local source delivery with synthetic verification, no private KB/store/provider operation, package publication, push, live binding or read-time provisioning. Root owns acceptance/Done/prune.

### Change Summary

Added strict `kb_search` at the read annotation/access gate, normalized public `path_prefix` to strict main `pathPrefix`, and source-authenticated local snippets/citations/labels. Explicit aliases bind stable unique registry identities and trust boundaries; bounded state/owner/config/projection/declaration/source proofs are checked before and after typed loopback HTTP retrieval. Canonical current zones are derived from the exact fresh declaration snapshot and must agree with both the mapping and startup bundle, closing independently reproduced reblessed-digest revocation. Local lexical/physical/protected path helpers supplement unchanged portable guards.

Vendored the approved Node-neutral contract and canonical helper with exact digest receipt and normalized-byte drift tests; only the helper import suffix changes. Added explicit YAML runtime dependency, conservative canonical/legacy zone migration, symlink-safe declaration reads and privacy-preserving public SDK dispatch audit. Writes/all cover recognizable success, validation and output failures exactly once; off remains off and append failure refuses unaudited success. Other read semantics remain unchanged. Documentation, accepted numbered specification, developer/user guidance, capability inventory and changelog now describe optional provisioning, cache side effects, local line authority and explicit unavailable states.

Exact paths are recorded in Files touched and the coordinator's `/tmp/mcp-roadmap-completion-20261005/mcp-kbfs-owned.json`; actual baseline/source diff was checked against that 35-path ownership receipt. No unrelated paths were changed or staged.

### Verification

All checks passed sequentially on unchanged source with required coverage thresholds retained. Logs are `/tmp/mcp-roadmap-completion-20261005/mcp-kbfs-<gate>-final.log`:

- `tsc`: `bunx tsc --noEmit`; `test`: `bun run test`, 346 tests in 17 files, zero failures.
- `coverage`: `bun run test:coverage`, 100% statements (916/916), branches (637/637), functions (113/113) and lines (824/824).
- `build`: compiled Node build; `smoke`: ordinary modern 2026-07-28/legacy surface plus synthetic lexical/vector/hybrid/local-citation/privacy audits through real compiled Node SDK sessions.
- `biome` and `knip`: pass; Knip reports only six existing configuration hints, no errors.
- `mcp`, `engineering`, `authoring`, `specs`, `roadmap`: focused governance audits pass with no failures or warnings.

Independent public SDK verification is retained at `/tmp/mcp-roadmap-completion-20261005/search-sdk-independent.mjs`. Independent reviewer ran 149 assertions against clean source `b1604776da73a300270be29f48bd7a5ae5df2012` on both minimum Node22.16.0 and Node24.21.0, including malformed inputs, model refusal, unchanged bytes/modes, Alpha/Omega isolation, hostile backend text/docid, audit append failure and fresh zone revocation before/after retrieval. Both logs `search-sdk-independent-final-node22.log` and `search-sdk-independent-final-node24.log` record exit zero and 33 synthetic backend calls; child executable selection actually proves each version. The frozen independent script SHA-256 is `c0684679e7dc1909261d471f774d4991081763461924b35248f36df09277ef07`. Tools reviewer separately reproduced corrected pre-fetch revocation (zero daemon calls) and post-fetch refusal in `/tmp/ki-mcp-independent-revocation.ts`. Exact terminal reviewer approval binds the final clean packet commit separately.

### Outstanding concerns

No unresolved delivery or verification failure remains. Search remains explicitly optional and requires operator-provisioned current state/models/one-KB daemon. HTTP hybrid differs from CLI expansion; bounded results are non-exhaustive, loopback does not authenticate other local clients, and daemon health cannot attest index identity. A wrong explicitly assigned daemon can return ambiguous empty results. Disposable derived retrieval cache maintenance is permitted. Tiny synthetic evidence does not establish large/private-scale efficiency. Unrecognizable or SDK codec-rejected protocol envelopes outside the public handler cannot be promised search audit events, and unavailable storage cannot promise a physical append. These accepted limits are recorded in the specification and operator guidance.

### Post-change review

The author inspected exact baseline/source paths, schema/access-gate wiring, current-source/canonical-zone revocation, vendor digests, Node-neutral imports, local line reconstruction, logging privacy and no provisioning on reads. Independent reviewers performed production source review and synthetic public runtime assertions; they found and verified the correction of the fresh-zone gap. Final approval remains independent of this author and binds the clean handoff hash. Root will accept/Done and close the exact outcome batch; its run marker stays until that authority acts.

### Mini recap

Optional per-KB search is delivered with explicit index authority, current local citations, strict dispatch schemas and privacy-preserving audit outcomes. Required gates and synthetic modern/legacy verification pass. Durable behavior and operator procedures live in `docs/specs/kb-search.md` and `docs/guides/user/kb-search.md`; no additional backlog or learning promotion is needed. Awaiting independent exact-hash review and root acceptance.

## Discussion

### Current authority and review

The principal approved the synthetic verified upstream/index/mirror contract and subsequent MCP search; root explicitly handed this repository's sole writer role to the author. Root and the independent reviewer will review the exact clean candidate. Historical route/private-corpus assumptions are superseded by this direct approved scope and synthetic verification. Source may start only after approved immutable interface and committed Ready/batch boundary.
