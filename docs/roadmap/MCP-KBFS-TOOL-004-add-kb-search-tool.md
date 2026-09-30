---
id: MCP-KBFS-TOOL-004
area: TOOL
title: Add kb_search tool
theme: tool-surface
horizon: triage
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-30T07:36:00Z
updated_at: 2026-09-30T07:36:00Z
---

# Add kb_search tool

## Goal

Agents search a Knowledge Base through a `kb_search` tool that applies the same base, zone and access-level scoping as the read tools and records every search in the audit log, so hybrid search is available to Claude Desktop, Codex and mcporter clients without exposing the search engine directly.

## Context

`KI-HARNESS-FND-028` adopts [tobi/qmd](https://github.com/tobi/qmd) as the search engine behind KI surfaces. qmd's own MCP server has no authentication and only collection-level scoping, and this server already owns the KB access model: aliases, zones, protected paths, read/write/destructive levels and the JSONL audit log. A search hit is a read and belongs behind the same gate. Today the server exposes `kb_config`, `kb_list`, read, rename, folder-create, write and delete tools but no search, so agents fall back to grep and whole-file reads.

## Boundary

In scope: a `kb_search` tool taking a base alias, query text, optional zone or path prefix, mode (`query`, `search`, `vsearch`) and result limit; calling the local qmd daemon over HTTP (`POST /query`) rather than embedding the SDK, so the roughly 2 GB of models load once for every client; filtering results to paths the caller may read; returning repository-relative path, snippet, score and docid; audit entries; a clear error when the daemon is unreachable. Excludes: index creation and refresh (`KI-TOOL-CLI-091`), the daemon's install and scheduling (chezmoi `DOTFILES-UE-063`), and any write path.

## Discussion

### Index selection

The tool must choose the named index that matches the base's trust boundary; take that mapping from the registry-derived configuration `ki kb index` writes rather than duplicating it here.

### Result shaping

Mark hits that are source-store mirrors so the agent can tell an extract from a pointer, following `KI-HARNESS-GOV-121`.
