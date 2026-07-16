# Foundation tooling roadmap

## Blocking

Actively broken, or blocking the `Next` horizon: takes priority over everything else and must clear before `Next` work proceeds. Empty means nothing is on fire.

## Next

Scoped and ready to start — the immediate queue, picked up before anything in **Soon** or **Future**.

## Soon

Understood and roughly scoped but not yet started — worth doing once the **Next** queue clears, ahead of anything still speculative.

### Close remaining coverage gap

Close remaining coverage gap to satisfy the 100% vitest threshold (currently 99.4% statements / 97.1% branches). Defensive `??` and rethrow arms in [src/main/notes/index.ts](../../../src/main/notes/index.ts) and [src/utils/audit-log.ts](../../../src/utils/audit-log.ts) need either tests or `/* v8 ignore */` markers — the same pattern m365 already documents.

### Add wire-level smoke test

Smoke test (`bun run ki:test:smoke`) — boot the built server and verify the wire-level tool surface matches in-process registration. mcp-gmail has the reference implementation (`scripts/smoke.ts` + CI step); kb-fs lacks both.

## Waiting for

Worth doing, but presently blocked on an external dependency or decision. Revisit when its named condition changes rather than treating it as dormant local work.

## Future

Speculative or not yet scoped — items marked _(candidate)_ need a scoping pass (or a decision to drop them) before they're actionable.
