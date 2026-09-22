# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Migrated to the MCP 2026-07-28 server profile: `@modelcontextprotocol/server` 2.0.0 replaces `@modelcontextprotocol/sdk` ^1.30.0, and the entry point now hands `serveStdio` a `createServer` factory so each connection gets its own gated server instance instead of one built at import time. Discovery, protocol stamping, and cache defaults move to the SDK.
- Synchronous tool results now carry the `resultType: "complete"` discriminator the 2026-07-28 profile requires. The public tool surface — names, input schemas, `outputSchema`, `structuredContent` payloads, access levels, and audit-log events — is unchanged.
- Released the `zod` hold: `zod` moves from the pinned `4.4.3` to `^4.6.5`, the legacy SDK's schema types having been the hold's only cause.
- `bun run ki:test:smoke` now drives `@modelcontextprotocol/client` 2.0.0 (a devDependency) and asserts the negotiated era and revision, a complete discovery envelope, success and error round trips, and the retained legacy fallback.

### Compatibility

- Clients that open with the pre-2026 `initialize` handshake are still served, from the same factory and with an identical tool surface (`legacy: 'serve'`). This fallback is deliberate and covered by the smoke test.

## [1.0.0]

Initial release.
