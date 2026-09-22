# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- An audience-centric guide collection under `docs/guides/`, split into `user/` (installing, declaring knowledge bases, scoping one, reading and writing notes, choosing an access level, troubleshooting) and `developer/` (architecture, working on the code). There is deliberately no operator tier: this is a stdio process a client launches on demand, so whoever writes the declaration is the same person who then queries their own notes. `.ki.toml` now declares `[skills.ki-guides]`.

### Changed

- Migrated to the MCP 2026-07-28 server profile: `@modelcontextprotocol/server` 2.0.0 replaces `@modelcontextprotocol/sdk` ^1.30.0, and the entry point now hands `serveStdio` a `createServer` factory so each connection gets its own gated server instance instead of one built at import time. Discovery, protocol stamping, and cache defaults move to the SDK.
- Synchronous tool results now carry the `resultType: "complete"` discriminator the 2026-07-28 profile requires. The public tool surface — names, input schemas, `outputSchema`, `structuredContent` payloads, access levels, and audit-log events — is unchanged.
- Released the `zod` hold: `zod` moves from the pinned `4.4.3` to `^4.6.5`, the legacy SDK's schema types having been the hold's only cause.
- `bun run ki:test:smoke` now drives `@modelcontextprotocol/client` 2.0.0 (a devDependency) and asserts the negotiated era and revision, a complete discovery envelope, success and error round trips, and the retained legacy fallback.
- `README.md` is now orientation only — what this is, the tool inventory, the safety posture, and where each kind of answer lives. Its how-to material moved into the guides rather than being copied there.
- `CONTRIBUTING.md` keeps the contribution contract and routes the dev loop, conventions, and gates to the developer guides. Its setup commands, its pre-PR checklist, and the README's development block previously named `ki:lint:check`, `ki:lint:types`, `ki:lint:fix`, and `ki:lint:md` scripts that this repository does not declare; the documented commands are now the ones `package.json` and CI actually run. The clone URL and CI badge, which named `mcp-kb-fs` rather than `mcp-ki-kb-fs`, are corrected.

### Removed

- The README's six per-tool schema subsections and its hand-maintained directory tree are deleted rather than relocated. The subsections transcribed schemas the running server already publishes through its tool listing, and a second copy drifts from the code that serves it; the behavioural caveats they carried are kept, in the guides, where they belong. The npm version badge is removed: no package is published under either name.

### Compatibility

- Clients that open with the pre-2026 `initialize` handshake are still served, from the same factory and with an identical tool surface (`legacy: 'serve'`). This fallback is deliberate and covered by the smoke test.

## [1.0.0]

Initial release.
