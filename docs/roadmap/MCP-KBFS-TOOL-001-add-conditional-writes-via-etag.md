---
id: MCP-KBFS-TOOL-001
area: TOOL
title: Add ETag writes
theme: tool-surface
horizon: next
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-04T11:48:57Z
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

- [ ] Derive an opaque ETag as `sha256:` plus the lowercase SHA-256 digest of the complete byte buffer. Every slice of identical bytes returns the same validator; binary and same-size edits are covered.
- [ ] Add the validator to `readFileResultSchema`, `readFile`, and the declared tool result. Add an optional strictly validated `if_match` argument to the write library and tool schema; accept exactly the emitted validator shape, without HTTP wildcard semantics.
- [ ] Serialise the file mutation entry points used by this server through one process-wide asynchronous queue, including unconditional writes, deletes, and renames. Perform conditional validation and replacement within that queue, release the queue on errors, and do not hold a lock while waiting for user input. A process-wide queue is an intentionally simple initial choice; do not introduce a cross-process lock protocol.
- [ ] For a conditional write, reject a missing target or mismatching hash before mkdir, temporary-file creation, or any other mutation. Use a distinguishable precondition failure through the existing error envelope. Dry-run performs the same check and returns the existing preview result only when it presently holds; previews reserve no future write.
- [ ] Preserve existing unconditional creation/overwrite, atomic replacement, containment, protected-path checks, and access annotations. Add tests for stale/matching/missing targets, all read slices, binary content, failure cleanup, and concurrent server mutations.
- [ ] Document the validator, conditional preview, force-overwrite path, and the unrelated-editor race limitation in the tool descriptions and user guidance.

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

## Discussion

### Etag derivation

A content hash is honest but requires reading the whole file on every read — which `readFile` already does — while a stat-based validator (mtime plus size) is cheaper but can miss same-second, same-size edits on coarse filesystem timestamps. The proposed plan selects SHA-256 over the complete bytes, matching the explicit Steps above; no stat-based shortcut is proposed.

### Precondition and atomicity

The existing temp-file-plus-`rename` write is atomic in the sense that no reader sees a partial file, but a check-then-write against `if_match` is not atomic against a concurrent writer: another process can replace the target between the validation read and the `rename`. The principal accepted that residual unrelated-editor window. The delivery contract promises serialization only among mutations through this server process; a cross-process coordination protocol remains outside scope.

### Scope of the etag

Only `kb_write` is in scope for `if_match`. Whether `kb_delete` and `kb_rename` should eventually accept the same precondition is worth noting but is deliberately not decided here.

### Readiness review

SHA-256 and process-wide mutation serialisation are the bounded design. The principal accepted the process-local guarantee and unrelated-editor limit on 2026-10-02. The implementation plan and verification gates above are concrete. Ready was published on 2026-10-04 under the owner-delegated estate roadmap push. The generated mcporter client under `src/generated/` already predates the required `kb` argument and is not regenerated by this item.
