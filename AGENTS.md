# AGENTS.md

## Runtime

Use Bun (>= 1.3) for installation, development, and tests; use `bun run test`, never `bun test`. The published `dist/` MCP runs under Node (>= 22). Keep `NODE_ENV=development` confined to development and inspector commands; production configuration comes from the host environment.

## MCP architecture

Keep configuration injectable: no module-level environment reads or configuration singleton. The server loads configuration once and passes the smallest required slice into registration or implementation functions. Tool modules validate and adapt MCP envelopes only; implementation belongs in `src/main/`. Register every tool through the annotation-driven access gate with an explicit annotation preset.

## Knowledge-base safety

Constrain every filesystem operation to a configured knowledge-base root using symlink-aware containment. Preserve optimistic concurrency and atomic-write behaviour for mutations, validate user-controlled paths and identifiers tightly, and keep destructive or non-idempotent operations behind explicit safe defaults. Tests use isolated fixtures and never operate on real knowledge bases.

## Verification

Run `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage`, `bun run build`, `bun run ki:test:smoke`, and the relevant focused `ki repo audit` commands.
