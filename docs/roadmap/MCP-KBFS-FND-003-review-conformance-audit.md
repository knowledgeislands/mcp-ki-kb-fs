---
id: MCP-KBFS-FND-003
title: Review conformance audit
area: FND
theme: foundation-tooling
horizon: future
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-04T08:54:13Z
updated_at: 2026-09-27T23:14:05Z
---

## Goal

Discuss the unresolved repository conformance findings before selecting remediation.

## Context

The estate audit reported Decision Records adoption, managed `.gitignore`, and GitHub metadata findings.

## Boundary

This is a discussion proposal only. It is not accepted, prioritised, or implementation authority.

## Shaping

Confirm the exact acceptance criteria, distinguish deterministic maintenance from design choices, and define focused verification.

## Discussion

Review the evidence before deciding whether to repair, defer, or document an exception.

### Pickup checkpoint — 2026-09-28

At local `main` `50018c422fe2e8e4f27d0270cdf153a7213b8db2`, `e627bebddcc5a98a801eac5915c8a81d5bf1bf30` adopted Decision Records in `docs/decisions/GDR-MCP-KBFS-001-adopting-decision-records.md` and indexed them in `docs/decisions/README.md`; `712f6540a5ae335ab63d815553af8e2ce80e6a69` revised `.gitignore` for repository metadata. A fresh `ki repo audit --repo .` passed all 21 selected skills, including `ki-decision-records` and `ki-repo`. These are current mechanical and historical delivery evidence for two cited concerns, not proof that the original estate findings or GitHub metadata judgment concern were fully resolved; their exact criteria were unavailable in this record.

Remaining: recover or restate the original finding identities, compare their Decision Record, ignore-file, and GitHub metadata criteria with current evidence, then seek the owner's repair, deferral, or exception decision. No executable suite was run for this documentation-only audit. Before implementation, reconcile destination `main`, linked tasks, and retained worktrees; only the primary worktree was visible locally, and remote task ownership was unavailable. Missing evidence does not release a claim or lift a hold. This checkpoint is pickup guidance, not execution block or resumption authority. Draft/Future state remains unchanged; eventual closure requires review and explicit owner acceptance, with any Done record retained until separately selected for pruning.
