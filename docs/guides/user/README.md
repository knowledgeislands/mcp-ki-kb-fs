# User guides

For anyone running this server against knowledge bases they own — installing it, telling it which bases exist and what they are called, deciding what is reachable inside each one, working with notes through a client, and deciding whether it may change anything.

Changing the server's code is a different job and lives in [the developer guides](../developer/README.md).

## Contents

- [Installing the server](installing-the-server.md) — prerequisites, building from source or installing the package, wiring it into Claude Desktop, Claude Code, or mcporter, and confirming the connection works.
- [Declaring your knowledge bases](declaring-knowledge-bases.md) — the declaration that is this install's authorisation boundary: alias grammar, what startup validates, why there is no default base, and what one call may reach.
- [Scoping a knowledge base](scoping-a-knowledge-base.md) — what is reachable inside a base once it is declared: zones and staging areas, the `.ki.toml` overrides, the read-only root-file allow-list, and protected paths.
- [Reading and writing notes](reading-and-writing-notes.md) — the working loop: orienting in an unfamiliar base, finding and reading notes, capturing new ones safely, and moving or removing them.
- [Choosing an access level](choosing-an-access-level.md) — what each level registers, why tool visibility is a different safeguard from `dry_run`, and what the audit log records.
- [Troubleshooting](troubleshooting.md) — the failures this server actually produces, what each one means, and how to recover.

## What you own

You own three decisions, and the server honours all three without arguing.

**Which knowledge bases exist, and what they are called.** `MCP_KI_KB_FS_KNOWLEDGE_BASES` is the authorisation boundary. An alias in it is reachable; anything else on your disk is not, and no argument can add one. Because callers name a base by alias rather than by path, you can move a base on disk by editing that one declaration without anything a caller sends having to change.

**What is reachable inside each base.** A base's own `.ki.toml` names its zones and its read-only root-file allow-list. Paths outside a declared zone are refused even though they sit inside the base, which is what keeps `.git`, `.obsidian`, and loose root files out of reach.

**How much may be done.** `MCP_KI_KB_FS_ACCESS_LEVEL` decides which tools exist in the session at all. A model cannot talk you into a tool that was never registered.

The server owns none of these at runtime. Both the environment and each base's `.ki.toml` are read once at startup and never re-read, so changing any of them means restarting the server through your client.
