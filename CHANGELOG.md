# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) — entries below
are generated from [Conventional Commits](https://www.conventionalcommits.org/)
on `main`. Edit only when manually overriding release-please output.

## [1.0.0] - 2026-05-09

### Added

- Initial release.
- Three MCP tools: `kb_read_note`, `kb_list_notes`, `kb_write_note`.
- Path-traversal-safe `resolveWithinRoot` enforcing every input stays inside `ROOT_PATH`.
- `kb_write_note` creates parent directories on demand (`create_dirs`, default `true`).
