# Guides

Practical instructions for `mcp-ki-kb-fs` — an MCP server that gives a model read and write access to one or more Knowledge Islands knowledge bases on the local filesystem. Guides answer **how**: what someone does, in what order, and how they know it worked. The reasoning behind the design lives in [the decision records](../decisions/README.md), and planned work in [the roadmap](../roadmap/).

## Contents

Guides are grouped by the job of the person reading them.

- [User guides](user/README.md) — for anyone pointing this server at knowledge bases they own: installing it, declaring which bases it may reach, scoping what is reachable inside each one, reading and writing notes through a client, choosing how much it may change, and getting unstuck.
- [Developer guides](developer/README.md) — for anyone changing the code: how the layers fit together, the containment invariants every change has to preserve, and the local loop and its gates.

There is no separate operator audience, and that is deliberate. This server is a stdio process the client launches on demand: no daemon, no account, no network call, no credential to rotate, and no state between calls beyond an optional local audit log. The person who writes the knowledge-base declaration into a client configuration file is the same person who then asks a question about their own notes, so an operator tier would hold either nothing or a second copy of the user guides. The audit log is the only operator-shaped surface here, and it is one file under `~/.local/state` configured by that same block — so it lives with [Choosing an access level](user/choosing-an-access-level.md), which is the decision that determines whether it ever has anything to record.

## Before you point it at anything

Two things are worth knowing before the first run.

The declaration is the whole authorisation boundary. `MCP_KI_KB_FS_KNOWLEDGE_BASES` maps a caller-facing alias to each base's absolute path, and a base that is not in it is unreachable — no tool argument can introduce a path, because every tool takes an alias rather than a location. The declaration is validated in full at startup, so a mistake in it stops the server rather than surfacing on some later call. [Declaring your knowledge bases](user/declaring-knowledge-bases.md) covers the grammar and every rejection.

The server is read-only until you say otherwise. `MCP_KI_KB_FS_ACCESS_LEVEL` defaults to `read`, and a tool above the configured level is never registered at all — a client cannot call what was never advertised. [Choosing an access level](user/choosing-an-access-level.md) covers what each level unlocks, and why that is a different safeguard from the `dry_run` flag.

## Where the answers live

| Question                            | Where it is answered                                   |
| ----------------------------------- | ------------------------------------------------------ |
| What is this and what can it do?    | [The README](../../README.md)                          |
| What exactly does each tool accept? | The running server, via your MCP client's tool listing† |
| How do I do a given piece of work?  | These guides                                            |
| Why is it built this way?           | [Decision records](../decisions/README.md)             |
| What is planned or in flight?       | [The roadmap](../roadmap/)                             |

† Each tool's parameters, defaults, enums, and descriptions are published by the server itself from the Zod schemas it validates against, and rendered live by your client. This repository deliberately keeps no second, hand-maintained copy of them, because a transcribed schema drifts from the code that serves it. What the guides carry instead is behaviour a schema cannot state: what a rejection means, which safeguard is doing the rejecting, and what to do next.
