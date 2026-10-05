# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Declared filesystem knowledge bases with listing and per-base configuration.
- Note read, write, add, and delete within a scoped base.
- Folder creation, rename, and deletion.
- Read, write, list, and delete across a declared base, gated by access level.

### Added

- Optional `kb_search` with explicit per-KB registry binding, canonical custom zones, current local citations, strict bounded retrieval and privacy-preserving search audits in modern/legacy sessions. Reads never provision models, indexes or daemons.

### Changed

- `kb_search` results label source mirrors from `mirrors`, `mirror_type` and `mirror_sha256`, which replace the `source_path` and `source_sha256` result fields; that provenance no longer makes a note a mirror.
