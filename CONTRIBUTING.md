# Contributing

Thanks for your interest. This file is the contribution contract: what a change is expected to carry and how to describe it. The mechanics — toolchain, dev loop, tests, gates — live in [working on the code](./docs/guides/developer/working-on-the-code.md), and the layout the change has to fit is in [architecture](./docs/guides/developer/architecture.md).

## Setup

```bash
git clone https://github.com/knowledgeislands/mcp-ki-kb-fs.git
cd mcp-ki-kb-fs
bun install
```

`bun install` runs `prepare`, which installs the husky hooks — so every commit auto-formats staged files and checks the commit message.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) so version bumps are easy to derive when releasing by hand. There is no auto-release pipeline.

| Type        | What it means           | Bumps |
| ----------- | ----------------------- | ----- |
| `feat:`     | new feature             | minor |
| `fix:`      | bug fix                 | patch |
| `perf:`     | performance improvement | patch |
| `docs:`     | documentation only      | patch |
| `deps:`     | dependency change       | patch |
| `refactor:` | internal restructuring  | none  |
| `test:`     | test-only changes       | none  |
| `chore:`    | tooling, config         | none  |
| `build:`    | build pipeline          | none  |
| `ci:`       | CI changes              | none  |

Add `!` for breaking changes (`feat!:` / `fix!:`) — bumps major.

## What a change should carry

New code ships with tests. Coverage thresholds are 100% on everything that is not explicitly excluded, so a new branch needs its case in the same change; the exclusions and their reasons are in [working on the code](./docs/guides/developer/working-on-the-code.md).

Two kinds of change carry an extra obligation.

**Error messages are a contract.** The user guides quote several verbatim, so changing one means updating [the guides](./docs/guides/user/README.md) in the same change.

**Tool surface changes are wide.** Adding, removing, or renaming a tool touches `src/main/`, `src/tools/`, the `EXPECTED_TOOLS` list in `scripts/smoke.ts`, the inventory table in `README.md`, and `CLAUDE.md`.

## Before opening a PR

- [ ] `bun run test` passes
- [ ] `bun run test:coverage` passes (no threshold failures)
- [ ] `bun run ki:test:smoke` passes
- [ ] `ki repo audit --repo .` passes
- [ ] Commit messages follow Conventional Commits
- [ ] `CHANGELOG.md` has an `Unreleased` entry for anything user-visible

CI runs the first four on every push and pull request.
