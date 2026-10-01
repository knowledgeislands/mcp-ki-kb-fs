---
id: MCP-KBFS-FND-003
title: Review conformance audit
area: FND
theme: foundation-tooling
horizon: next
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-04T08:54:13Z
updated_at: 2026-10-01T19:27:46Z
---

## Goal

Give the owner a traceable disposition recommendation for the historical conformance findings, with current evidence and an explicit account of anything that cannot be established.

## Context

The estate audit raised Decision Records adoption, managed `.gitignore`, and GitHub metadata. Later delivery and mechanical audits addressed some of these concerns, but the record does not preserve every original finding identifier or judgment criterion.

## Boundary

This is a bounded evidence-reconciliation review. Deliver a finding-by-finding evidence table and recommendations in this record. Do not change repository settings, implement repairs, accept historical work, or infer that a passing current audit resolves an unidentified historical finding.

## Current state

The reviewed source is local `main` at `e1f99bb347e43fb770f9b46fd2d7b3d50ecfb23a`. [The adoption decision](../decisions/GDR-MCP-KBFS-001-adopting-decision-records.md) and its index already exist. On 2026-10-01, focused `ki-repo` and `ki-decision-records` audits passed; the work-selector and roadmap audits also passed. The earlier pickup checkpoint below records the relevant historical delivery evidence.

## Steps

- [ ] Recover original finding identities and acceptance criteria from retained repository records and available estate-audit evidence. Where recovery is impossible, record the precise evidence gap; do not manufacture an identifier or substitute a new criterion silently.
- [ ] Compare each recovered concern with the current tracked configuration, Decision Records, relevant history, and read-only repository metadata. Record source path or command, revision, result, and whether the evidence is mechanical or judgment-based.
- [ ] Classify each concern as demonstrated resolved, still reproducible, superseded with evidence, or unresolved because evidence is missing. Give one concrete repair, deferral, or exception recommendation for each unresolved concern, including the decision owner.
- [ ] Record the matrix and recommendations in this item for owner review. Treat earlier delivered changes as evidence rather than duplicate implementation. Route any newly discovered substantive repair through its own planning decision.

## Files touched

- This work item: the evidence matrix, verification record, and disposition recommendations.
- [Decision Records](../decisions/README.md), repository configuration, `.gitignore`, root guidance, and Git history are read-only evidence. No settings or product-source writes are authorised by this review.

## Verify

1. Run `ki repo audit --skill ki-repo --repo .`, then `ki repo audit --skill ki-decision-records --repo .`, then `ki repo audit --skill ki-work --repo .`, then `ki repo audit --skill ki-work-roadmap --repo .`; retain each exit status and relevant finding identities.
2. Every originally named concern has an evidence-backed disposition or an explicitly identified missing-evidence row. A current pass alone is insufficient to classify an unknown historical judgment as resolved.
3. The proposed diff contains only the governing work record. No executable test suite is required for this evidence-only delivery; record that distinction honestly.

## Dependencies / blocks

No build dependency. Missing historical evidence is a valid, explicit review output, not a reason to invent repairs or block the entire evidence-reconciliation task. Any subsequent settings change or remediation requires its own approved scope.

## Documentation impact

### Decision Records

Read the existing adoption decision as evidence; this review does not change governance policy.

### Specifications

No new externally visible behaviour is introduced.

### Guides

No operating instructions change.

### Roadmap

Recommend subsequent action without closing this item or creating duplicate remediation for work already delivered.

## Discussion

Review the evidence before deciding whether to repair, defer, or document an exception.

### Pickup checkpoint — 2026-09-28

At local `main` `50018c422fe2e8e4f27d0270cdf153a7213b8db2`, `e627bebddcc5a98a801eac5915c8a81d5bf1bf30` adopted Decision Records in `docs/decisions/GDR-MCP-KBFS-001-adopting-decision-records.md` and indexed them in `docs/decisions/README.md`; `712f6540a5ae335ab63d815553af8e2ce80e6a69` revised `.gitignore` for repository metadata. A fresh `ki repo audit --repo .` passed all 21 selected skills, including `ki-decision-records` and `ki-repo`. These are current mechanical and historical delivery evidence for two cited concerns, not proof that the original estate findings or GitHub metadata judgment concern were fully resolved; their exact criteria were unavailable in this record.

Remaining: recover or restate the original finding identities, compare their Decision Record, ignore-file, and GitHub metadata criteria with current evidence, then seek the owner's repair, deferral, or exception decision. No executable suite was run for this documentation-only audit. Before implementation, reconcile destination `main`, linked tasks, and retained worktrees; only the primary worktree was visible locally, and remote task ownership was unavailable. Missing evidence does not release a claim or lift a hold. This checkpoint is pickup guidance, not execution block or resumption authority. Draft/Future state remains unchanged; eventual closure requires review and explicit owner acceptance, with any Done record retained until separately selected for pruning.
