---
id: '001'
title: Adopt uniform governance modes and bootstrap
status: open
roadmap: foundation-tooling/adopt-uniform-governance-modes-and-bootstrap
blocks: —
blocked-by: —
---

## Context

This MCP repository is the pilot for the harness's uniform-mode rollout. Its current test suite passes, but its aggregate audit delegates to removed project-local skill scripts. The coordinating `ki-agentic-harness` plan `foundation-tooling/004` governs the one-time roadmap adoption that created this plan; this plan governs the pilot's package, bootstrap, and generated-payload migration.

## Current state

On 2026-07-16, `bun run test` passed with 220 tests. `bun run ki:audit` failed because `ki:authoring:audit`, `ki:engineering:audit`, `ki:mcp:audit`, and `ki:repo:audit` each invoke absent `.claude/skills/*/scripts/audit-*.ts` files. The repository is clean on `main` and its `.ki-meta` payload comes from the older harness ref `8240bc5629d40ca33f08f20d8141973b6984f93e`.

## Steps

1. Add the `ki-project-roadmap` coverage declaration and re-bootstrap from the current harness, publishing only the declared generated runtime payloads.
2. Reconcile `package.json` to the current aggregate and scoped command surface, preserving MCP-specific server, generator, and smoke-test commands.
3. Run the focused bootstrap, project-roadmap, engineering, authoring, MCP, test, and aggregate gates; classify every failure as pilot drift or a harness defect.
4. Commit the pilot migration and report the validated recipe and any harness defect to the coordinating `foundation-tooling/004` plan.

## Files touched

`.ki-config.toml`, `.ki-meta/`, `.gitignore`, generated project-local runtime payloads, `package.json`, `ROADMAP.md`, `docs/roadmap/`, and only any source/config files a failing required gate proves are necessary.

## Verify

`bun run test`, the focused artifact audits, and `bun run ki:audit` pass; the thematic roadmap audit passes; the generated root roadmap and index are current; and no unrelated MCP source behaviour changes.

## Dependencies / blocks

This is the pilot under the harness plan `foundation-tooling/004`. It is unblocked by local state. A failure that shows the harness contract is incomplete returns to `ki-agentic-harness`; the pilot does not invent a consumer-side workaround.
