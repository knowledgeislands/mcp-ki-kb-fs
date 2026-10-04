---
id: MCP-KBFS-TOOL-001
area: TOOL
title: Add ETag writes
theme: tool-surface
horizon: next
status: done
blocks: []
blocked_by: []
baseline_ref: c15c32d0e27b09a27249ca4a00b460ff02f50627
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-04T12:11:13Z
---

## Goal

Callers can detect stale Knowledge Base writes using the ETag returned by a read, while retaining an explicit destructive overwrite operation.

## Context

`kb_read` returns whole files or slices and supports binary content. `kb_write` currently atomically replaces a file through a sibling temporary file, but it never checks whether the previously read content has changed. The seven-tool wire surface and the destructive write access gate already exist.

## Boundary

Add `etag` to reads and optional `if_match` to `kb_write`. Keep `kb_write` destructive and dry-run by default. The guarantee covers mutations through this server process; another process or unrelated editor may change a file between validation and replacement. Do not claim cross-process compare-and-swap or add preconditions to delete or rename in this item.

## Current state

[src/main/files/index.ts](../../src/main/files/index.ts) owns read, write, rename, and delete operations and the strict result schemas. `readFile` already obtains the complete byte buffer before slicing or base64 encoding. `writeFile` performs its dry-run before writing and has no mutation serialisation. The read/write MCP boundary is [src/tools/kb/index.ts](../../src/tools/kb/index.ts).

## Steps

- [x] Derive an opaque ETag as `sha256:` plus the lowercase SHA-256 digest of the complete byte buffer. Every slice of identical bytes returns the same validator; binary and same-size edits are covered.
- [x] Add the validator to `readFileResultSchema`, `readFile`, and the declared tool result. Add an optional strictly validated `if_match` argument to the write library and tool schema; accept exactly the emitted validator shape, without HTTP wildcard semantics.
- [x] Serialise the file mutation entry points used by this server through one process-wide asynchronous queue, including unconditional writes, deletes, and renames. Perform conditional validation and replacement within that queue, release the queue on errors, and do not hold a lock while waiting for user input. A process-wide queue is an intentionally simple initial choice; do not introduce a cross-process lock protocol.
- [x] For a conditional write, reject a missing target or mismatching hash before mkdir, temporary-file creation, or any other mutation. Use a distinguishable precondition failure through the existing error envelope. Dry-run performs the same check and returns the existing preview result only when it presently holds; previews reserve no future write.
- [x] Preserve existing unconditional creation/overwrite, atomic replacement, containment, protected-path checks, and access annotations. Add tests for stale/matching/missing targets, all read slices, binary content, failure cleanup, and concurrent server mutations.
- [x] Document the validator, conditional preview, force-overwrite path, and the unrelated-editor race limitation in the tool descriptions and user guidance.

## Files touched

- [src/main/files/index.ts](../../src/main/files/index.ts) and its co-located tests: validators, serialised mutations, precondition checks, and result contract.
- [src/tools/kb/index.ts](../../src/tools/kb/index.ts) and its co-located registration tests: argument and result schemas, descriptions, and unchanged annotation checks.
- A small helper under `src/main/files/` only if needed to isolate the mutation queue or digest logic, with co-located tests.
- The repository decision-record area: record the accepted process-local guarantee and unrelated-editor limitation.
- [README.md](../../README.md) and the existing filesystem user guide that owns read/write procedures: concurrency contract and examples.

## Verify

1. Run `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage`, `bun run build`, and `bun run ki:test:smoke` sequentially. Preserve the 100% coverage thresholds and seven-tool modern/legacy wire surface.
2. Two concurrent writes with one original ETag have exactly one winner through the same server process; the loser reports a precondition failure. Unconditional writes, renames, and deletes cannot interleave the conditional validation and replacement in that process.
3. A stale or missing-target precondition changes no files or directories. Dry-run changes no bytes, creates no temporary files, and does not reserve a future result. A failed operation does not strand the mutation queue.
4. Slice and binary reads derive the same validator from the same whole-file bytes; same-size byte changes alter it. Existing cross-base and symlink rejection tests remain green.
5. Run focused `ki-repo-mcp`, `ki-engineering`, and `ki-work-roadmap` audits, recording unrelated fleet findings separately.

## Dependencies / blocks

No build dependency. The principal explicitly approved the server-process guarantee and residual unrelated-editor race in the MCP roadmap review on 2026-10-02. That approval resolves the concurrency scope decision. On 2026-10-04 the owner-delegated estate roadmap push approved the Ready transition and implementation of exactly these Steps and this Boundary.

## Documentation impact

### Decision Records

Record the accepted concurrency guarantee and why ordinary filesystem replacement cannot promise atomic comparison against unrelated writers in a repository decision record when implementing.

### Specifications

Tool input/output schemas and their contract tests gain the ETag and precondition semantics; there is no standalone specification area to create speculatively.

### Guides

Update the existing user documentation and tool descriptions with the guarantee and its limit.

### Roadmap

Do not fold delete/rename preconditions or a cross-process coordination service into this item.

## Review

### Delivered

Approved boundary: whole-file SHA-256 `etag` on `kb_read`, optional strict `if_match` on `kb_write`, one process-wide mutation queue for server-exposed writes, renames, and deletes, precondition checks before any mutation, dry-run parity, and documentation of the process-local guarantee. Excluded as planned: preconditions on `kb_delete` and `kb_rename`, cross-process coordination, and regeneration of the already-stale mcporter client under `src/generated/`. Baseline `c15c32d0e27b09a27249ca4a00b460ff02f50627`; delivery is the commit that sets this record to `awaiting-review`.

### Change Summary

- `src/main/files/etag.ts` (new): `computeEtag`, strict `etagSchema` (`sha256:` plus 64 lowercase hex digits, no wildcard or quoted forms), and `PreconditionFailedError` whose message starts `Precondition failed:`.
- `src/main/files/mutation-queue.ts` (new): `serialiseMutation`, a FIFO promise chain that survives failures.
- `src/main/files/index.ts`: `readFileResultSchema` gains `etag`; `readFile` hashes the full buffer it already loads and reports `size` from that buffer; `writeFile`, `renameFile`, and `deleteFile` run through the queue; `writeFile` accepts `if_match` and validates it before dry-run preview, `mkdir`, or the temporary file. Missing, directory, or mismatching targets fail the precondition; other read errors propagate.
- `src/tools/kb/index.ts`: `kb_write` input gains optional `if_match`; `kb_read` and `kb_write` descriptions state the validator, preview, force-overwrite path, and process-local limit. Annotations unchanged (`kb_write` stays `DESTRUCTIVE`, dry-run default true).
- Tests: `etag.test.ts`, `mutation-queue.test.ts`, new `readFile — etag` and `writeFile — if_match` suites, and tool-boundary round-trip and schema tests.
- Docs: `docs/decisions/ADR-MCP-KBFS-001-process-local-conditional-writes.md` and index entry; README footnote; user guide section "Edit without overwriting someone else's change".

### Verification

- `bunx tsc --noEmit`: pass.
- `bun run test`: 14 files, 316 tests pass.
- `bun run test:coverage`: 100% statements, branches, functions, and lines.
- `bun run build`: pass. `bun run ki:test:smoke`: pass (modern and legacy discovery, seven tools, `kb` required).
- `bunx biome check .`: clean. `bunx knip`: no findings beyond pre-existing configuration hints. `bunx rumdl check docs README.md`: clean.
- `ki repo audit --repo .`: PASS across 20 skills.
- Behavioural evidence: concurrent writes with one validator yield exactly one winner; stale and missing-target preconditions leave bytes, directories, and temporary files unchanged; dry-run checks without writing; a failed mutation does not strand the queue; all read parts and binary reads share one validator; same-size edits change it.

### Outstanding concerns

None blocking. The interleaving test for unconditional write, rename, and delete exercises ordering through the public functions; strict serialisation itself is proven by the queue unit test. The generated mcporter client remains stale (predates the required `kb` argument) and is outside this item.

### Post-change review

The goal is met within the approved boundary: callers can detect stale writes and still overwrite explicitly. No tool was added or removed, access tiers and annotations are unchanged, and containment and protected-path checks run before the precondition. Regression risk is low: unconditional behaviour is preserved and covered, and mutation throughput within one process is now serial by design. Ready for acceptance review.

### Mini recap

Delivered ETag-validated conditional writes with a process-local serialisation guarantee, verified at the library and MCP boundaries with full gates green. Learning route: if delete or rename preconditions are wanted, capture a new item through `ki-next` rather than extending this one.

## Done

Accepted 2026-10-04 on the review packet above, under the owner's delegated estate-push authority following an independent Fable review, which returned ACCEPT: strict `sha256:` ETags over the full buffer on every read mode, `if_match` checked after containment and before dry-run or any filesystem effect, all tool mutations serialised through one FIFO queue, the ADR indexed, and typecheck, 316 tests and 100% coverage passing. Advisory notes retained for follow-up: `src/main/notes` write/rename/delete helpers are not routed through the queue (they are not registered as tools); `CHANGELOG.md` has no entry; the `EACCES` test relies on `chmod 000` and would not fail as root; the queue serialises mutations across unrelated bases.

## Discussion

### Etag derivation

A content hash is honest but requires reading the whole file on every read — which `readFile` already does — while a stat-based validator (mtime plus size) is cheaper but can miss same-second, same-size edits on coarse filesystem timestamps. The proposed plan selects SHA-256 over the complete bytes, matching the explicit Steps above; no stat-based shortcut is proposed.

### Precondition and atomicity

The existing temp-file-plus-`rename` write is atomic in the sense that no reader sees a partial file, but a check-then-write against `if_match` is not atomic against a concurrent writer: another process can replace the target between the validation read and the `rename`. The principal accepted that residual unrelated-editor window. The delivery contract promises serialization only among mutations through this server process; a cross-process coordination protocol remains outside scope.

### Scope of the etag

Only `kb_write` is in scope for `if_match`. Whether `kb_delete` and `kb_rename` should eventually accept the same precondition is worth noting but is deliberately not decided here.

### Readiness review

SHA-256 and process-wide mutation serialisation are the bounded design. The principal accepted the process-local guarantee and unrelated-editor limit on 2026-10-02. The implementation plan and verification gates above are concrete. Ready was published on 2026-10-04 under the owner-delegated estate roadmap push. The generated mcporter client under `src/generated/` already predates the required `kb` argument and is not regenerated by this item.
