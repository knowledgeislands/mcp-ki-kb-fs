---
id: MCP-KBFS-FND-004
title: Establish audience-centric guides
area: FND
theme: foundation-tooling
horizon: now
status: ready
blocks: []
blocked_by: []
transferred_from: ki-website
baseline_ref: null
created_at: 2026-09-21T15:44:00Z
updated_at: 2026-09-22T07:20:00Z
---

## Goal

A reader can find practical instructions for this server grouped by the audience that needs them, and the repository declares `ki-guides` so that grouping is gated rather than conventional.

## Context

`mcp-ki-kb-fs` has no `docs/guides/` and does not declare `ki-guides`. Its 355-line README carries Quick Start, Installation, Configuration, Development, Security Model, Directory Structure, Troubleshooting, and Extending the Server — at least three distinct audiences in one document.

KI Website now declares, for every page it publishes under `apps/site/src/guidance/`, the exact upstream document and pinned ref that page was written from, and a `verify:guidance --network` sweep reports the pages whose source has moved. The site intends to derive public guidance for this project from this repository's own guides and cite them at a pinned ref, so the quality and stability of `docs/guides/` here directly determines the quality of what the site can publish.

That is a pull, not an obligation: KI Website derives, it does not own. This repository decides what its guides say and when they change.

Separately, `ki-guides` is being asked to require audience directories under `docs/guides/` rather than permitting a flat collection (`ki-agentic-harness` `KI-HARNESS-GOV-083`). If that lands, this repository's collection has to satisfy it.

## Boundary

Adopted into `Now` by explicit approval, so this is prioritised work rather than intake. It remains `status: draft`: `ki-plan` shapes it to `Ready` before any implementation, and this repository still owns its plan and sequencing.

KI Website derives and cites; it does not own this collection and must not be given approval rights over it. Nothing here requires a guide to be written for the website's benefit — if a guide would not serve this repository's own readers, it should not exist.

## Shaping

**Two audiences: `user/` and `developer/`.** A user is someone pointing this server at knowledge bases they own, through an MCP client. A developer is someone changing its code.

**No `operator/` tier.** This is a stdio process the client launches on demand: no daemon, no account, no network call, no credential to rotate, no state between calls beyond an optional local JSONL audit log. The person who writes `MCP_KI_KB_FS_KNOWLEDGE_BASES` into a client `env` block is the same person who then asks a question about their own notes, so an operator directory would hold either nothing or a copy of the user guides. The audit log is the only operator-flavoured surface here, and it is one file under `~/.local/state` configured by that same block and read by that same person — not a separate job. It lives with the access level, which is the decision that determines whether it ever has anything to record.

**The per-tool schema reference is deleted, not relocated.** The README's six `### kb_*` subsections transcribe Zod input schemas — argument names, enums, defaults, and a JSON call example each — that the running server already publishes through `tools/list` and every client already renders. A guide that restates a normative contract is what `ki-guides` forbids, and a hand-copied schema is the drift failure the Shaping question anticipated. What survives is the inventory table in the README (tool, access level, one-line purpose), because a reader deciding whether to install needs the surface at a glance, and every caveat that is _behaviour rather than schema_: the absence of a default base, one base per call with no cross-base operation, the zone-scope rule, the read-only and never-listable root-file allow-list, `dry_run` as an effect control distinct from access-level visibility, and configuration being read once at startup. Those move into the guides that own them.

**The README `## Directory Structure` tree is deleted too**, for the same reason in a different key: a hand-maintained file-by-file tree with inline comments drifts against the source it describes. `developer/architecture.md` carries the layering in prose — five directories, which way dependencies point, and what each layer may not do — which is the durable part.

**No specification gap is routed.** This repository holds no `docs/specs/` corpus, and the deleted material was schema transcription that the server publishes live rather than a contract with no home. The three behaviour-level contracts a specification would own — the declaration's startup validation, the access-gate derivation, and the audit-log event shape — are each pinned by tests and by `CLAUDE.md`. Manufacturing a specification corpus to make the guides look complete is exactly what the standard warns against.

**`CONTRIBUTING.md` is corrected in the same pass.** Its dev-loop block lists four scripts that do not exist in `package.json` (`ki:lint:types`, `ki:lint:check`, `ki:lint:fix`, `ki:lint:md`), as does the README's `## Development` block. Leaving them would put a contradiction between `CONTRIBUTING.md` and the new developer guide on day one. `CONTRIBUTING.md` keeps the contribution contract — commit conventions, the PR checklist, what CI runs — and routes mechanics to the guide.

## Current state

There is no `docs/guides/` directory and `.ki.toml` declares no `[skills.ki-guides]` block, so nothing gates whether the collection exists or what shape it takes. `docs/` holds only `roadmap/` and `decisions/`. `ki repo audit --concise --progress never` currently reports PASS across 15 skills, so the collection is being added to a clean tree.

The practical material catalogued in Context sits in the 355-line `README.md`, where a reader arriving with a task has to reconstruct that task out of reference prose. Roughly 180 of those lines are the six `### kb_*` subsections plus the directory tree — the two blocks this item deletes rather than relocates.

Two factual errors ride along in the current documents and are corrected in passing. The README badge URLs and the `CONTRIBUTING.md` clone URL name `knowledgeislands/mcp-kb-fs`; `.ki.toml` and `package.json` both give the repository as `knowledgeislands/mcp-ki-kb-fs`. And the `ki:lint:*` scripts quoted in both documents are absent from `package.json` — `bun run ki:lint:check` answers `error: Script not found`. The real gates are the four CI steps (`ki repo audit --repo .`, `bun run test`, `bun run test:coverage`, `bun run ki:test:smoke`), `bun run build` for typechecking, and the pre-commit hooks (`lint-staged` running Biome over code and rumdl over Markdown, plus `syncpack format --check`).

## Steps

- [ ] Declare `[skills.ki-guides]` in `.ki.toml`.
- [ ] Create `docs/guides/README.md` as the collection index: what the collection covers, the two audience routes, and why there is no third.
- [ ] Create `docs/guides/user/README.md` and `docs/guides/developer/README.md` as audience indexes, each stating who it is for and pointing at the other.
- [ ] Write `user/installing-the-server.md` from the README's Quick Start, Prerequisites, Installation, and Claude Desktop Configuration sections, extended to Claude Code and mcporter and to confirming the connection works.
- [ ] Write `user/declaring-knowledge-bases.md` from the `MCP_KI_KB_FS_KNOWLEDGE_BASES` environment-variable prose and the `### The kb argument` section: the declaration as authorisation boundary, alias rules, every startup rejection, no default base, one base per call.
- [ ] Write `user/scoping-a-knowledge-base.md` from the zone and allow-list material: what `.ki.toml` `[knowledgeislands-kb]` declares, why paths at the KB root are out of scope, the read-only never-listable root-file allow-list, and protected paths.
- [ ] Write `user/reading-and-writing-notes.md` from the Example Conversations section: orienting with `kb_config`, listing, reading with `part`, capturing with `dry_run`, renaming, deleting.
- [ ] Write `user/choosing-an-access-level.md` from the `MCP_KI_KB_FS_ACCESS_LEVEL` and audit-log prose: what each level registers, why visibility differs from `dry_run`, and what the log records.
- [ ] Write `user/troubleshooting.md` from the README's Troubleshooting section, extended to cover the zone-scope and access-level failures it currently omits.
- [ ] Write `developer/architecture.md` from the Security Model and Directory Structure sections: the five directories and their direction, the closed `KnowledgeBase` bundle, the annotation-driven access gate, the result-envelope boundary, and the safety invariants.
- [ ] Write `developer/working-on-the-code.md` from the Development and Extending the Server sections, with the script names corrected to those `package.json` actually declares and the gates corrected to those CI actually runs.
- [ ] Reduce `README.md` to orientation: what the server is, the tool inventory table, the safety posture, a short getting-started pointer, and a documentation index. Delete the six `### kb_*` subsections and the directory tree; fix the badge URLs.
- [ ] Trim the `CONTRIBUTING.md` dev-loop block to route at the developer guide, keep the contribution contract, and fix the clone URL.
- [ ] Add a `CHANGELOG.md` entry under `Unreleased`.
- [ ] Run the guides and authoring audits, then the full audit, and repair what they report.

## Files touched

`docs/guides/README.md`, `docs/guides/user/README.md`, `docs/guides/user/installing-the-server.md`, `docs/guides/user/declaring-knowledge-bases.md`, `docs/guides/user/scoping-a-knowledge-base.md`, `docs/guides/user/reading-and-writing-notes.md`, `docs/guides/user/choosing-an-access-level.md`, `docs/guides/user/troubleshooting.md`, `docs/guides/developer/README.md`, `docs/guides/developer/architecture.md`, `docs/guides/developer/working-on-the-code.md` (all new), `.ki.toml`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and this record.

Explicitly not touched: all of `src/`, `scripts/`, `package.json`, `vitest.config.ts`, `biome.json`, `.env.example`, `claude-config-sample.json`, `CLAUDE.md` (the protocol migration `MCP-KBFS-FND-002` rewrote it hours ago and it is agent instruction, not a guide), `SECURITY.md`, and `docs/roadmap/MCP-KBFS-FND-002-*`, which is `awaiting-review` under another thread.

## Verify

- `ki repo audit --skill ki-guides --concise --progress never` — PASS, with the collection root, its index, and the one-H1 rule satisfied by every new guide, and no retired parallel root present.
- `ki repo audit --skill ki-authoring --concise --progress never` — PASS over the new and rewritten Markdown.
- `ki repo audit --concise --progress never` — PASS, rising from 15 skills to 16 as `ki-guides` becomes declared.
- No code gate is expected to move, because no file under `src/` or `scripts/` is touched; `bun run test` is run once as a control that the tree is otherwise as `MCP-KBFS-FND-002` left it.
- Read-through check that the deletions lost nothing: every behavioural caveat in the removed README sections appears in a guide, and nothing that only restates a published Zod schema does.

## Dependencies / blocks

Nothing blocks this. `KI-HARNESS-GOV-083` in `ki-agentic-harness` proposes making audience directories a `ki-guides` requirement: if it lands first this collection satisfies it by construction, and if it lands later this collection already conforms. KI Website intends to derive public guidance from these guides and cite them at a pinned ref, but it derives rather than owns and its schedule does not gate this work.

`MCP-KBFS-FND-002` (protocol migration) is `awaiting-review` on the same branch and shares one file, `.ki.toml`, in a different table (`[skills.ki-engineering]` there, `[skills.ki-guides]` here). It deliberately left `README.md` alone and owns `CLAUDE.md`, which this item does not touch. The two are independent; this one builds on the tree it left, and neither its record nor its work is altered here.

## Documentation impact

### Decision Records

No decision record is needed. Audience-centric grouping is the house arrangement `ki-guides` already encodes, so adopting it here is conformance rather than a new decision. One becomes owed only if this repository concludes it needs an exception.

### Specifications

No behaviour-level contract changes, and no `ki-specs` gap routed. The server's tool surface is untouched; this item changes only where its instructions live and who they are written for. The per-tool material being deleted is schema the running server publishes through `tools/list`, not an unowned contract — see Shaping for why no specification corpus is manufactured to receive it.

### Guides

This item is entirely guide impact. It creates the collection, its two audience directories, and their indexes; it moves the README's how-to material into the guide that owns it; and it deletes the per-tool schema transcription and the directory tree outright. `CONTRIBUTING.md` becomes the contribution contract and stops duplicating the dev loop.

### Roadmap

No further roadmap change is expected. If writing the guides exposes behaviour that cannot honestly be explained — an unclear failure mode, a configuration step with no recovery — that is a separate item raised at the time.

## Discussion

Shaping settles how far the restructure goes, not whether it happens. The prompting question is whether a reader who has never opened this repository can install it, run it, and recover from its common failures without reading source.
