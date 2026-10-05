# Security Policy

## Reporting a Vulnerability

If you find a security issue in `@knowledgeislands/mcp-ki-kb-fs`, **please do not file a public GitHub issue.** Instead, email the maintainer directly:

- **<kris@kris.me.uk>** — subject: `mcp-ki-kb-fs security`

Include:

- A description of the issue and the impact (e.g. "path traversal", "arbitrary file write outside root").
- Steps to reproduce, ideally with a minimal proof-of-concept.
- The version of the package (`npm ls @knowledgeislands/mcp-ki-kb-fs`) and Node version.

You should expect an acknowledgement within 72 hours. We aim to triage, investigate, and ship a fix within 14 days for high-severity issues.

## Scope

`mcp-ki-kb-fs` is a stdio MCP server that gives an agent read and write access to the local Markdown knowledge bases declared in `MCP_KI_KB_FS_KNOWLEDGE_BASES`. It runs locally with the privileges of the user who launched it. That declaration, validated in full at startup, is the authorisation boundary: every tool call names one declared `kb`, and nothing outside its declared roots is reachable.

In scope:

- Path containment in `src/utils/utils.ts` (`resolveWithinRoot` and `assertRealPathWithinRoot`) — any input that resolves outside a declared knowledge base root (traversal, symlink escape, encoded separators, edge cases around trailing slashes).
- Access control within a knowledge base — the protected-path rules in `src/utils/protected.ts`, the zone scope in `src/utils/zones.ts`, and the root-file allowlist resolved in `src/config/index.ts`.
- Access-level gating in `src/utils/access-level.ts` — any tool registered above the configured `MCP_KI_KB_FS_ACCESS_LEVEL` (`read`, `write`, or `destructive`).
- File and note operations in `src/main/files/` and `src/main/notes/` behind `kb_read`, `kb_list`, `kb_write`, `kb_folder_create`, `kb_rename`, and `kb_delete`, including conditional-write (`etag`) and `dry_run` behaviour.
- Search in `src/main/search/` behind `kb_search` — validation of `MCP_KI_KB_FS_SEARCH_BINDINGS` and derived state, and results that cite content outside the selected knowledge base.
- Audit logging in `src/utils/audit-log.ts` and `src/utils/search-audit.ts` — recording search query text, snippets, or document paths, or reporting unaudited search success while logging is enabled.
- Configuration and boot-time validation in `src/config/index.ts` (`loadConfig`).

Out of scope:

- Issues only reproducible against a forked or modified version.
- Vulnerabilities in upstream dependencies (please report those upstream; report them here only if `mcp-ki-kb-fs` exposes the flaw in a way that the upstream project does not).
- Issues that require local OS-level access already higher-privileged than the user running the MCP server (e.g. an attacker who can already write files inside a declared knowledge base or replace the binary).
- Misconfiguration of `MCP_KI_KB_FS_KNOWLEDGE_BASES` to declare a directory the user did not intend to expose.
- The operator-owned search daemon and its derived caches, which `tools-ki` provisions; report those against that project.

## Supported Versions

Only the latest published `0.x` release receives security fixes. Older releases are not supported.

| Version          | Supported          |
| ---------------- | ------------------ |
| latest `0.x`     | :white_check_mark: |
| earlier releases | :x:                |
