---
id: ADR-MCP-KBFS-001
title: 'Process-local conditional writes'
date: 2026-10-04
status: current
decision_type: architecture
decision_type_url: https://knowledgeislands.info/specifications/decision-records/adr
---

# ADR-MCP-KBFS-001: Process-local conditional writes

## Context

`kb_write` replaces a file atomically by writing a sibling temporary file and renaming it into place. Callers that read a note, edit it, and write it back need to detect that the file changed in between, or they silently discard another actor's edit. An ordinary filesystem rename cannot compare the destination's bytes and swap them in one step, so no check performed before the rename can exclude a writer that bypasses this server. A cross-process lock protocol would need every editor, sync client, and server instance to participate.

## Decision

`kb_read` returns an opaque `etag` of `sha256:` plus the SHA-256 digest of the whole file's bytes, the same for every returned part. `kb_write` accepts an optional `if_match` that must equal the current file's `etag`; a mismatch or missing target fails with a precondition error before any directory, temporary file, or replacement is created, and dry-run applies the same check without reserving the result. Every write, rename, and delete issued through one server process runs through one process-wide FIFO mutation queue, so the comparison and replacement cannot interleave with another mutation from that process. The guarantee is process-local: the residual window in which another process or editor changes the file between the check and the rename is accepted and documented. Omitting `if_match` remains the explicit unconditional create-or-overwrite path.

## Consequences

Two callers of the same server cannot both succeed with one stale validator, and a stale or missing-target conditional write changes nothing on disk. Reads hash the whole file, which they already load completely. Mutations through one server process no longer run concurrently, which bounds their throughput but not their correctness. Separate server processes and external editors are not coordinated; a stronger guarantee would require a cross-process coordination service, which this decision does not adopt. Preconditions for `kb_delete` and `kb_rename` remain undecided.
