# KB search — KB-SEARCH

This area specifies optional source-authenticated search; [the registry](index.md) owns IDs and conformance. The accepted upstream [adoption decision](../../../ki-agentic-harness/docs/decisions/ADR-KI-HARNESS-TOOLCHAIN-006-qmd-derived-kb-search-index.md) governs its optional scope.

## User-observable behaviours

### KB-SEARCH-001 — Strict bounded selection

`kb_search` MUST search one explicitly declared KB at the read access level. The running tool's strict schemas own exact arguments and response fields: required `kb` and bounded UTF-8 `query`; optional canonical `zone`, relative `path_prefix`, `mode` and `limit`. Main uses the equivalent strict camelCase `pathPrefix` schema. Defaults are hybrid `query` and five results, maximum fifty. Queries contain at most 1,024 UTF-8 bytes, with no control characters. Results are bounded candidates, never an exhaustive corpus inventory.

_Conformance:_ conforming

_Verify:_ inspect public input/output schemas and strict main request validation.

_Evidence:_ `src/tools/kb/index.test.ts`, `src/main/search/index.test.ts` and compiled `scripts/search-smoke.ts` pass strict selection/bounds assertions.

### KB-SEARCH-002 — Explicit registry binding

An optional search binding MUST select an already declared alias and one independent registered KB identity. `MCP_KI_KB_FS_SEARCH_BINDINGS` is an optional alias-keyed JSON object. Each value contains exactly `registry_id` and an absolute normalized `state_directory`; aliases must already occur in `MCP_KI_KB_FS_KNOWLEDGE_BASES`. Duplicate state/registry bindings are refused. Missing binding leaves the advertised tool unavailable for that KB; it does not provision anything.

_Conformance:_ conforming

_Verify:_ reject invalid, unknown and duplicate bindings.

_Evidence:_ `src/config/search.test.ts` passes explicit binding assertions.

## Quality properties

### KB-SEARCH-003 — Fresh authority and confinement

The current registry MUST assign one unique explicit search boundary to that stable ID, with the physical selected KB root and declared repository identity. Before HTTP retrieval, bounded reads validate private `.owner` state, the pinned mapping schema/generation, canonical KB declaration and digest, purpose/zones/source-store metadata, generated local-model configuration, database, exact projection inventory/digests and every current source digest. Nested repositories, protected paths, symlinks, foreign or undeclared zones are rejected before expansion. Source stores are never opened; only explicit declared/bound metadata is inspected. All mapping/state and source proofs are rechecked after retrieval.

_Conformance:_ conforming

_Verify:_ corrupt/revoke current state and source authority before and during retrieval.

_Evidence:_ `src/main/search/index.test.ts` passes reblessed zone revocation, owner/projection/registry/source drift and hostile boundary assertions.

### KB-SEARCH-004 — Canonical zone migration

Canonical `skills.ki-repo-kb.zones` MUST own the five zones and quoted `"+"`/`"-"` staging keys. Ordinary file readers retain safe explicit legacy zones and allow-list compatibility, reject conflicts and overlap, and refuse symlinked or oversized declaration files before reading them. Search refuses any retired `knowledgeislands-kb.zones` declaration, including one equal to canonical values. Migration is an explicit owner edit, never an automatic read operation.

_Conformance:_ conforming

_Verify:_ exercise custom staging/zone names, safe legacy readers, conflicts and search refusal of retired zones.

_Evidence:_ `src/config/search.test.ts`, `src/main/search/index.test.ts` and compiled smoke pass migration/custom-zone fixtures.

### KB-SEARCH-005 — Pinned bounded protocol

Retrieval MUST use the pinned typed, bounded one-KB protocol and already provisioned mode-specific models. The upstream [search standard](../../../ki-agentic-harness/skills/repo-structure/ki-repo-kb/references/standards-search.md) and [tools mapping specification](../../../tools-ki/docs/specs/kb-search.md) own the wire schemas. The portable Node contract is vendored from tools commit `2f37fb0e94953ee9911cdf4f262f40176523d03c`, contract SHA-256 `5197d9b37a99784c7134966d32d37eb6d6700fc09663438b135307bf657b6100`. The canonical mirror helper SHA-256 is `aeb36ba9e9840989b38f87ff81360c29239fe530ac0aed8fb43e2a0d4f134128`. Only its contract import suffix changes from `.ts` to `.js`; a pinned digest/normalized-byte test detects drift.

The explicit loopback endpoint is operator-owned and serves one KB/index. Pinned qmd 2.8.3 revision `facd35e01359e59d938bc9418e93fb9318addee3` accepts typed `searches[]` and exact `collections[]`, with 200 bounded candidates. HTTP hybrid uses lexical plus vector retrieval and reranking; lexical/vector modes disable reranking. HTTP hybrid does not claim the CLI's native query expansion. Existing local mode-specific models must already be provisioned. Redirects, oversized responses, bad JSON, unavailable transport and invalid candidates fail closed.

Loopback is a transport restriction, not authentication against other local clients. Health cannot attest index identity; the explicit trusted operator endpoint assignment can yield ambiguous empty results when pointed at the wrong daemon. Raw daemon binding is not the agent access surface. Current gateway authority and candidate/source proofs govern exposure.

_Conformance:_ conforming

_Verify:_ inspect vendor receipts and synthetic HTTP request/response bounds under both SDK eras.

_Evidence:_ pinned-byte tests and `scripts/search-smoke.ts` pass lexical/vector/hybrid protocol and unavailable/foreign response fixtures.

### KB-SEARCH-006 — Local citation authority

Backend URI/docid/score MUST be checked against the current manifest; short docids only corroborate local full hashes. Backend titles, snippets, context and line numbers never authorize citations. The server reconstructs title, bounded snippet, original line window and mirror labels from authorized current local Markdown, then applies zone/prefix/result limits. Mirror `extract` is a conservative mechanical provenance/substantive-text diagnostic, not source existence, fidelity or freshness verification. Ambiguous metadata remains unknown.

_Conformance:_ conforming

_Verify:_ inject hostile backend text/offsets and compare current local original lines and provenance.

_Evidence:_ `src/main/search/index.test.ts` and compiled smoke return local title/snippet/line windows and exclude hostile content.

### KB-SEARCH-007 — No provisioning on reads

Search MUST NOT install/download models, creates/refreshes an index, starts a daemon, changes client bindings or mutates canonical KB/registry files. The operator daemon may maintain disposable derived retrieval caches; read-only annotations describe canonical KB authority, not zero daemon-cache I/O. Missing, stale or invalid state returns a sanitized unavailable tool error. There is no implicit search fallback; the calling QUERY workflow owns literal grep and targeted reads. Optional adoption has no measured tiny-corpus efficiency advantage; see the [accepted decision](../../../ki-agentic-harness/docs/decisions/ADR-KI-HARNESS-TOOLCHAIN-006-qmd-derived-kb-search-index.md).

_Conformance:_ conforming

_Verify:_ call search with unavailable assets and compare canonical/derived asset bytes.

_Evidence:_ missing-model/pre-fetch failure fixtures and compiled unchanged-canonical-byte smoke pass.

### KB-SEARCH-008 — Recognizable private dispatch audit

Enabled search auditing MUST append exactly one privacy-preserving outcome for each recognizable public dispatch when storage is available. A scoped public `setRequestHandler` registration wrapper observes recognizable `kb_search` `tools/call` dispatches in both modern and retained legacy sessions. `writes` and `all` append one search event for success, strict tool validation, callback failure and SDK output-schema rejection; `off` appends none. The ordinary callback logger is suppressed only for search, preserving other tools' behavior.

Search event arguments contain only configured alias, validated mode or `invalid`, outcome, query type and UTF-8 byte count. Envelope fields include tool/level/time/duration/outcome and a fixed sanitized failure string. No raw query, unknown arguments, results, document IDs, paths or backend errors enter events. Enabled append failure returns a sanitized audit-unavailable error and cannot promise a physical log event. Rotation remains best effort and uses sanitized search diagnostics.

Unrecognizable, undelivered or SDK codec-rejected protocol envelopes may fail before the public handler; they cannot be honestly recorded as completed recognizable search invocations. This is the documented public-dispatch boundary, not a claim of transport-wide logging.

_Conformance:_ conforming

_Verify:_ dispatch valid/invalid inputs, callback/output failures, append failure and all audit modes using the public SDK.

_Evidence:_ `src/utils/search-audit.test.ts` and compiled modern/legacy smoke pass exact-once/privacy/off/append-unavailable assertions.

## Conformance evidence

Synthetic fixtures in `src/main/search/index.test.ts`, `src/config/search.test.ts` and `src/utils/search-audit.test.ts` cover confinement, live drift, canonical custom zones, legacy conflicts, local reconstruction, bounded failures, exact vendor receipts and actual SDK-supplied handler validation. `scripts/search-smoke.ts` boots compiled Node modern/legacy clients against a synthetic local HTTP endpoint and provisioned fixture state, exercises all three modes, strict failures, hostile foreign candidates, audit modes and unchanged canonical bytes. The upstream real-engine two-KB eight-operation evidence remains in the pinned tools receipt; these adapter fixtures never access private KBs or download models.
