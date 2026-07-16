# Tool surface roadmap

## Blocking

Actively broken, or blocking the `Next` horizon: takes priority over everything else and must clear before `Next` work proceeds. Empty means nothing is on fire.

## Next

Scoped and ready to start — the immediate queue, picked up before anything in **Soon** or **Future**.

### Add conditional writes via etag for `kb_note_write`

Today the tool is annotated `DESTRUCTIVE` because it can clobber an existing note unconditionally. Proposed redesign: `kb_note_read` returns an `etag` (e.g. truncated SHA-256 of file bytes) alongside content; `kb_note_write` accepts an optional `if_match` arg and refuses if the on-disk etag differs (optimistic locking). With `if_match` set, the tool becomes `write` tier; without it, force-overwrite stays `destructive`. Likely shape is a tool split — `kb_note_write_safe` (write) and `kb_note_write` (destructive force) — so the access-level gate accurately reflects which mode the caller asked for. See [src/tools/notes/index.ts](../../../src/tools/notes/index.ts) for the current single-tool surface.

## Soon

Understood and roughly scoped but not yet started — worth doing once the **Next** queue clears, ahead of anything still speculative.

## Waiting for

Worth doing, but presently blocked on an external dependency or decision. Revisit when its named condition changes rather than treating it as dormant local work.

## Future

Speculative or not yet scoped — items marked _(candidate)_ need a scoping pass (or a decision to drop them) before they're actionable.
