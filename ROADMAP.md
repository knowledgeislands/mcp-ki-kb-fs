# Roadmap

Forward-looking plans only. Shipped features live in [README.md](./README.md); release history lives in the git log.

## Next Up

- Conditional writes via etag for `kb_note_write`. Today the tool is annotated `DESTRUCTIVE` because it can clobber an existing note unconditionally. Proposed redesign: `kb_note_read` returns an `etag` (e.g. truncated SHA-256 of file bytes) alongside content; `kb_note_write` accepts an optional `if_match` arg and refuses if the on-disk etag differs (optimistic locking). With `if_match` set, the tool becomes `write` tier; without it, force-overwrite stays `destructive`. Likely shape is a tool split — `kb_note_write_safe` (write) and `kb_note_write` (destructive force) — so the access-level gate accurately reflects which mode the caller asked for. See [src/tools/notes/index.ts](./src/tools/notes/index.ts) for the current single-tool surface.

## Future Advanced Capabilities

## Tooling
