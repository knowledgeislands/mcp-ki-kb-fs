---
id: MCP-KBFS-FND-004
title: Establish audience-centric guides
area: FND
theme: foundation-tooling
horizon: now
status: awaiting-review
blocks: []
blocked_by: []
transferred_from: ki-website
baseline_ref: ed14908d898a98785382238a79ed4893547554ff
created_at: 2026-09-21T15:44:00Z
updated_at: 2026-09-24T09:14:00Z
---

## Goal

A reader can find practical instructions for this server grouped by the audience that needs them, and the repository declares `ki-guides` so that grouping is gated rather than conventional.

## Context

`mcp-ki-kb-fs` has no `docs/guides/` and does not declare `ki-guides`. Its 355-line README carries Quick Start, Installation, Configuration, Development, Security Model, Directory Structure, Troubleshooting, and Extending the Server — at least three distinct audiences in one document.

KI Website now declares, for every page it publishes under `apps/site/src/guidance/`, the exact upstream document and pinned ref that page was written from, and a `verify:guidance --network` sweep reports the pages whose source has moved. The site intends to derive public guidance for this project from this repository's own guides and cite them at a pinned ref, so the quality and stability of `docs/guides/` here directly determines the quality of what the site can publish.

That is a pull, not an obligation: KI Website derives, it does not own. This repository decides what its guides say and when they change.

Separately, `KI-HARNESS-GOV-083` has clarified `ki-guides`: audience directories are recommended when stable reader groups make a collection easier to navigate, while flat and mixed collections remain valid. This item therefore stands on this repository's own readers and routing needs, not a universal Harness requirement.

## Boundary

Adopted into `Now` by explicit approval, so this is prioritised work rather than intake. It was captured as `status: draft` and shaped to `ready` through `ki-plan` before any implementation; this repository owns its plan and sequencing throughout.

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

- [x] Declare `[skills.ki-guides]` in `.ki.toml`.
- [x] Create `docs/guides/README.md` as the collection index: what the collection covers, the two audience routes, and why there is no third.
- [x] Create `docs/guides/user/README.md` and `docs/guides/developer/README.md` as audience indexes, each stating who it is for and pointing at the other.
- [x] Write `user/installing-the-server.md` from the README's Quick Start, Prerequisites, Installation, and Claude Desktop Configuration sections, extended to Claude Code and mcporter and to confirming the connection works.
- [x] Write `user/declaring-knowledge-bases.md` from the `MCP_KI_KB_FS_KNOWLEDGE_BASES` environment-variable prose and the `### The kb argument` section: the declaration as authorisation boundary, alias rules, every startup rejection, no default base, one base per call.
- [x] Write `user/scoping-a-knowledge-base.md` from the zone and allow-list material: what `.ki.toml` `[knowledgeislands-kb]` declares, why paths at the KB root are out of scope, the read-only never-listable root-file allow-list, and protected paths.
- [x] Write `user/reading-and-writing-notes.md` from the Example Conversations section: orienting with `kb_config`, listing, reading with `part`, capturing with `dry_run`, renaming, deleting.
- [x] Write `user/choosing-an-access-level.md` from the `MCP_KI_KB_FS_ACCESS_LEVEL` and audit-log prose: what each level registers, why visibility differs from `dry_run`, and what the log records.
- [x] Write `user/troubleshooting.md` from the README's Troubleshooting section, extended to cover the zone-scope and access-level failures it currently omits.
- [x] Write `developer/architecture.md` from the Security Model and Directory Structure sections: the five directories and their direction, the closed `KnowledgeBase` bundle, the annotation-driven access gate, the result-envelope boundary, and the safety invariants.
- [x] Write `developer/working-on-the-code.md` from the Development and Extending the Server sections, with the script names corrected to those `package.json` actually declares and the gates corrected to those CI actually runs.
- [x] Reduce `README.md` to orientation: what the server is, the tool inventory table, the safety posture, a short getting-started pointer, and a documentation index. Delete the six `### kb_*` subsections and the directory tree; fix the badge URLs.
- [x] Trim the `CONTRIBUTING.md` dev-loop block to route at the developer guide, keep the contribution contract, and fix the clone URL.
- [x] Add a `CHANGELOG.md` entry under `Unreleased`.
- [x] Run the guides and authoring audits, then the full audit, and repair what they report.

## Files touched

`docs/guides/README.md`, `docs/guides/user/README.md`, `docs/guides/user/installing-the-server.md`, `docs/guides/user/declaring-knowledge-bases.md`, `docs/guides/user/scoping-a-knowledge-base.md`, `docs/guides/user/reading-and-writing-notes.md`, `docs/guides/user/choosing-an-access-level.md`, `docs/guides/user/troubleshooting.md`, `docs/guides/developer/README.md`, `docs/guides/developer/architecture.md`, `docs/guides/developer/working-on-the-code.md` (all new), `.ki.toml`, `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and this record.

Explicitly not touched: all of `src/`, `scripts/`, `package.json`, `vitest.config.ts`, `biome.json`, `.env.example`, `claude-config-sample.json`, `SECURITY.md`, and `docs/roadmap/MCP-KBFS-FND-002-*`, which is `awaiting-review` under another thread.

One line of `CLAUDE.md` was touched after all, against the plan's intent to leave it alone. It linked `./README.md#environment-variables`, an anchor this item deletes; the link now points at `docs/guides/user/declaring-knowledge-bases.md`. Its other README link, `#available-tools`, still resolves because the inventory table and its heading are retained. Nothing else in that file changed and none of `MCP-KBFS-FND-002`'s rewrite is undone. Leaving a link dangling to honour a boundary would have been the worse outcome.

## Verify

- `ki repo audit --skill ki-guides --concise --progress never` — PASS, with the collection root, its index, and the one-H1 rule satisfied by every new guide, and no retired parallel root present.
- `ki repo audit --skill ki-authoring --concise --progress never` — PASS over the new and rewritten Markdown.
- `ki repo audit --concise --progress never` — PASS, rising from 15 skills to 16 as `ki-guides` becomes declared.
- No code gate is expected to move, because no file under `src/` or `scripts/` is touched; `bun run test` is run once as a control that the tree is otherwise as `MCP-KBFS-FND-002` left it.
- Read-through check that the deletions lost nothing: every behavioural caveat in the removed README sections appears in a guide, and nothing that only restates a published Zod schema does.

## Dependencies / blocks

Nothing blocks this. `KI-HARNESS-GOV-083` is advisory rather than a universal migration requirement; this item's audience grouping remains justified by the repository-local reader distinctions described above. KI Website intends to derive public guidance from these guides and cite them at a pinned ref, but it derives rather than owns and its schedule does not gate this work.

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

## Review

### Delivered

An eleven-file audience-centric guide collection under `docs/guides/`, gated by a newly declared `[skills.ki-guides]` in `.ki.toml`. `README.md` is reduced from 356 lines to orientation; the how-to material it carried was moved into the guide that owns it, and the per-tool schema transcription and directory tree were deleted rather than relocated. `CONTRIBUTING.md` now holds the contribution contract alone and routes mechanics at the developer guides.

### Change Summary

New, under `docs/guides/`:

- `README.md` — collection index, the two audience routes, the paragraph explaining why there is no third, and a "where the answers live" table whose schema row points at the running server rather than at a document.
- `user/README.md` — audience index framed as the three decisions a user owns: which bases exist, what is reachable inside each, and how much may be done.
- `user/installing-the-server.md` — prerequisites, building from source, the declaration, Claude Desktop, Claude Code and mcporter, confirming three read-only tools appear, and every environment variable with its default.
- `user/declaring-knowledge-bases.md` — the declaration as authorisation boundary, alias rules, every startup rejection quoted, no default base, one base per call, and the access level being server-wide.
- `user/scoping-a-knowledge-base.md` — the first-segment zone check, renaming zones through `.ki.toml`, the four properties of the root-file allow-list, protected paths, and the two containment layers underneath.
- `user/reading-and-writing-notes.md` — the working loop, phrased as asks: orient, survey, read with `part`, capture under the preview default, create folders, move, delete.
- `user/choosing-an-access-level.md` — what each level registers, why an unregistered tool beats a confirmation prompt, the annotation derivation and its fail-safe, `dry_run` as effect versus access level as visibility, and the audit log's fields, redaction, rotation, and swallowed write failures.
- `user/troubleshooting.md` — symptom-led, built from the verbatim error strings in `src/`, and extended to the zone-scope, allow-list, and access-level failures the README's section omitted.
- `developer/README.md` — audience index and the three things that explain otherwise-odd choices.
- `developer/architecture.md` — the four layers and their direction, injected configuration, the access-gate proxy and its derivation, the four-stage path containment, schema and envelope reuse, connection lifecycle, and what adding a tool touches.
- `developer/working-on-the-code.md` — toolchain, dev loop, the test and coverage contract including the three invariant-carrying tests, the real gates, and what CI runs.

Changed:

- `.ki.toml` — `[skills.ki-guides]` declared.
- `README.md` — reduced to features, the tool inventory table, a short getting-started pointer, a documentation index, a condensed safety posture, and a licence line. The CI badge now names `mcp-ki-kb-fs`; the npm badge is gone.
- `CONTRIBUTING.md` — setup, the Conventional Commits table, what a change should carry, and a pre-PR checklist naming commands that exist.
- `CHANGELOG.md` — `Added`, `Changed`, and `Removed` entries under `Unreleased`, appended beside `MCP-KBFS-FND-002`'s entries without disturbing them.
- `CLAUDE.md` — one link retargeted, as recorded under Files touched.

Moved out of the README, not copied: Quick Start detail and Installation into `installing-the-server.md`; the environment-variable table and `### The kb argument` into `installing-the-server.md` and `declaring-knowledge-bases.md`; Example Conversations into `reading-and-writing-notes.md`; Security Model into `architecture.md` with a condensed posture retained in the README; Development and Extending the Server into `working-on-the-code.md` and `architecture.md`; Troubleshooting into `troubleshooting.md`.

Deleted, not moved: the six `### kb_*` subsections (argument lists, enums, defaults, and a JSON call example each) and `## Directory Structure`. Both transcribe something the repository already publishes — the first from schemas the server serves through `tools/list`, the second from the source tree itself. Every behavioural caveat they carried survives: no default base, one base per call, the zone rule, the read-only never-listable allow-list, `mkdir -p` idempotence, rename's refusal to overwrite and its non-idempotence, `dry_run` defaulting true on both destructive tools, `part` being UTF-8 Markdown only, and base64 for non-UTF-8 content.

### Verification

Gates, verbatim:

- `ki repo audit --skill ki-guides --concise --progress never` → `summary: KI REPO AUDIT on mcp-ki-kb-fs PASS · 1 skill`
- `ki repo audit --skill ki-authoring --concise --progress never` → `summary: KI REPO AUDIT on mcp-ki-kb-fs PASS · 1 skill`
- `ki repo audit --concise --progress never` → `summary: KI REPO AUDIT on mcp-ki-kb-fs PASS · 16 skills`
- `bun run test` → `Test Files  12 passed (12)` / `Tests  289 passed (289)`
- `bun run test:coverage` → `Statements : 100% ( 687/687 )`, `Branches : 100% ( 440/440 )`, `Functions : 100% ( 79/79 )`, `Lines : 100% ( 631/631 )`
- `bun run ki:test:smoke` → passed; negotiated `2026-07-28`, seven tools, both declared aliases on the wire.

One failure occurred and was repaired: the first `ki-authoring` run reported `CHANGELOG.md:19:1: [MD076] Unexpected blank line between list items [*]`, caused by the new `### Removed` heading being inserted between `MCP-KBFS-FND-002`'s bullets and their `### Changed` heading. The changelog was restructured so those four bullets stay under `Changed` with the two new ones appended, and the re-run passed.

The code gates were run because two tests read documents this item rewrote: `src/main/files/repository-contract.test.ts` asserts `README.md` contains `# mcp-kb-fs` and `CLAUDE.md` contains `Guidance for Claude Code`. Both strings are retained deliberately — see Outstanding concerns.

Read-through check: every behavioural caveat listed above was located in its new home before the source section was deleted, and no guide restates an argument name, enum, or default that the server publishes.

### Outstanding concerns

None blocks review. Four are worth a human decision.

**The README H1 is pinned by a test.** It reads `# mcp-kb-fs` while the repository, the package, and the CI badge all say `mcp-ki-kb-fs`. `repository-contract.test.ts` asserts that exact string, so correcting the heading is a code change and outside this item's boundary. It deserves its own item rather than a silent fix.

**Dead behaviour in `src/main/notes/`.** Only `createFolder` is registered; `readNote`, `listNotes`, `listFolders`, `renameNote`, `deleteNote`, `writeNote`, and `files.listFiles` are reachable from tests alone. They are held at 100% coverage by tests that no tool path exercises. `developer/architecture.md` says so plainly rather than implying a live path, but whether they are retained, registered, or removed is a decision this item cannot take.

**The CI coverage artefact uploads nothing.** `vitest.config.ts` writes to `reports/coverage`; `.github/workflows/ci.yml` uploads `coverage/`. Out of boundary here — `.github/` is untouched — and a one-line fix elsewhere.

**Node version claims disagreed.** The old README said Node 24.15.0, `package.json` `engines` says `>=22`, and `mise.toml` pins `node = "lts"`. The guides state Node 22+, following `engines`, which is the constraint a consumer's client actually enforces. If the intended floor is higher, `engines` is the place to say so.

Also worth noting: no package is published under either name, and the install guide says so in a note rather than implying a registry install exists.

### Post-change review

The audience question was decided on this server's own facts rather than by copying a sibling. The case against an operator tier here is stronger than in `mcp-git-audit`, not weaker: there is no daemon, no account, no network call, and no credential, and the single operator-flavoured surface — the audit log — is one file configured in the same `env` block by the same person, so it belongs with the access-level decision that determines whether it ever records anything. An `operator/` directory would have held a copy of `choosing-an-access-level.md` and nothing else.

The deletion decision held up better than expected. Writing `troubleshooting.md` from the source's verbatim error strings made the distinction concrete: what a reader needs is not the shape of `dry_run` but the knowledge that a rename refuses to overwrite and that a repeat is therefore an error. Those are behaviour; a schema cannot state them and a transcription buries them. Roughly 180 lines went, and the caveats that mattered came out at greater length than they went in.

The `ki:lint:*` defect is the argument for the whole exercise. Four script names appeared in two documents, in a PR checklist a contributor is told to run, and none of them existed — because reference prose is not the kind of thing anyone executes. Writing the same material as a procedure surfaced it immediately.

What was harder than expected: keeping `CLAUDE.md` untouched. A document that links into another document's anchors is coupled to it, and moving content out of the README broke one of those links. The one-line retarget is recorded as a deviation rather than hidden.

### Mini recap

`mcp-ki-kb-fs` now has a gated, audience-split guide collection: six user guides and two developer guides under `docs/guides/`, with `[skills.ki-guides]` declared. The README's how-to material moved rather than being copied; the per-tool schema tables and the directory tree were deleted on the grounds that the server and the source already publish them. All three audits pass — the full audit at 16 skills, up from 15 — and the four code gates are green.

## Discussion

Shaping settles how far the restructure goes, not whether it happens. The prompting question is whether a reader who has never opened this repository can install it, run it, and recover from its common failures without reading source.
