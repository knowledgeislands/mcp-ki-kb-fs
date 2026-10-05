---
id: MCP-KBFS-TOOL-004
area: TOOL
title: Add kb_search tool
theme: tool-surface
horizon: waiting-for
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-30T07:36:00Z
updated_at: 2026-10-05T07:36:16Z
---

# Add kb_search tool

## Goal

Agents search a Knowledge Base through a `kb_search` tool that applies the same base, zone and access-level scoping as the read tools and records every search in the audit log, so hybrid search is available to Claude Desktop, Codex and mcporter clients without exposing the search engine directly.

## Context

`KI-HARNESS-FND-028` adopts [tobi/qmd](https://github.com/tobi/qmd) as the search engine behind KI surfaces. qmd's own MCP server has no authentication and only collection-level scoping, and this server already owns the KB access model: aliases, zones, protected paths, read/write/destructive levels and the JSONL audit log. A search hit is a read and belongs behind the same gate. Today the server exposes `kb_config`, `kb_list`, read, rename, folder-create, write and delete tools but no search, so agents fall back to grep and whole-file reads.

## Boundary

In scope: a `kb_search` tool taking a base alias, query text, optional zone or path prefix, mode (`query`, `search`, `vsearch`) and result limit; calling the local qmd daemon over HTTP (`POST /query`) rather than embedding the SDK, so the roughly 2 GB of models load once for every client; filtering results to paths the caller may read; returning repository-relative path, snippet, score and docid; audit entries; a clear error when the daemon is unreachable. Excludes: index creation and refresh (`KI-TOOL-CLI-091`), the daemon's install and scheduling (chezmoi `DOTFILES-UE-063`), and any write path.

## Waiting for

The search tool needs the pilot evidence and authoritative trust-boundary mapping described in [the index work](../../../tools-ki/docs/roadmap/KI-TOOL-CLI-091-add-kb-search-index.md). That record is currently Waiting for because the registry has no trust-boundary field and the qmd pilot has not supplied the configuration and failure contract. A Knowledge Base alias, checkout path, or Agora membership must not be used to guess the boundary.

Return this item to Next when the qmd pilot in [the harness search proposal](../../../ki-agentic-harness/docs/roadmap/KI-HARNESS-FND-028-adopt-qmd-kb-search.md) is recorded and the index owner publishes a concrete mapping and daemon request/response contract. Confirm how query/search/vsearch modes, collection restrictions, unavailable indexes, daemon errors, and source-store mirror labels are represented. [The mirror-content proposal](../../../ki-agentic-harness/docs/roadmap/KI-HARNESS-GOV-121-require-substantive-store-mirrors.md) is also still Triage; its metadata contract must be agreed before the tool can implement the promised labels.

The implementation plan must prove that an untrusted daemon result cannot leak a snippet, title, docid, or other content from a different base, protected path, symlink escape, or undeclared zone. Validate scope before exposing any returned content, and keep index creation and daemon installation with their existing owners. These are external conditions, not local `blocked_by` edges.

## Current state

The 2026-10-04 delegated review re-read all three upstream records. `KI-TOOL-CLI-091` remains Waiting for / draft; `KI-HARNESS-FND-028` and `KI-HARNESS-GOV-121` remain Triage / draft. Their retained records contain no completed pilot evidence, accepted authoritative trust-boundary assignment, or settled source-store mirror labels. These external prerequisites remain unmet; no local dependency edge or fabricated trade wait is introduced.

## Verify

Before leaving Waiting for, re-read the upstream records and their named durable evidence. Require actual pilot results, an explicit mapping owner and contract, pinned daemon request/response evidence, and agreed mirror labels. A later plan must test hostile daemon results against base, zone, protected-path and symlink boundaries before returning any content. Do not inspect or search real private KB content as part of this roadmap review.

## Current delivery stop

The 2026-10-05 delivery review re-read the upstream canonical records: `KI-TOOL-CLI-091` remains Waiting for / draft (`updated_at: 2026-09-30T15:18:21Z`); `KI-HARNESS-FND-028` and `KI-HARNESS-GOV-121` remain Triage / draft (`updated_at: 2026-09-30T07:00:00Z`). The qmd pilot is still described as a first task, not evidenced as completed. No accepted registry trust-boundary assignment or mirror-label contract is present. General authority to finish MCP items cannot manufacture these inputs or authorise searching real upstream KB content.

Upstream work required: complete and record the direct-CLI pilot and its quality/context/failure results in `KI-HARNESS-FND-028`; settle the authoritative trust-boundary field and registry-derived index/daemon contract through `KI-TOOL-CLI-091`; settle source-store mirror labels through `KI-HARNESS-GOV-121`. Then shape this tool against those contracts, including hostile-daemon fixtures proving no cross-base or protected-content disclosure. Keep Waiting for / draft. Fresh selector and roadmap audits pass; this is a verified external delivery stop, not a test failure or completed search implementation.

## Discussion

### Index selection

The tool must choose the named index that matches the base's trust boundary; take that mapping from the registry-derived configuration `ki kb index` writes rather than duplicating it here.

### Result shaping

Mark hits that are source-store mirrors so the agent can tell an extract from a pointer, following `KI-HARNESS-GOV-121`.

### Readiness review

The capability is adopted for follow-up, but implementation is not Ready while the shared trust-boundary and index contract remains unsettled. Planning authority does not authorise changes in the upstream repositories.
