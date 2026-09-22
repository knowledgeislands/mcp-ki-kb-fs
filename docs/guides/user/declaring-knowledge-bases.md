# Declaring your knowledge bases

Every knowledge base this server can reach is named once, in one environment variable, before the server starts. This guide covers how to write that declaration, what the server checks before it agrees to run, and what changes about a call once several bases are in play.

Use it when setting up a new install, adding a base to an existing one, or working out why a base you expected is not there.

## The declaration

`MCP_KI_KB_FS_KNOWLEDGE_BASES` is a JSON object mapping a caller-facing **alias** to that base's **absolute path**:

```json
{ "kit-pkb": "~/kb/kit-pkb", "kit-legal": "/srv/kb/legal" }
```

In a client configuration file the whole object is itself a JSON string, so its quotes need escaping — see [Installing the server](installing-the-server.md) for the Claude Desktop form.

JSON rather than a separator-delimited list because it survives a single-line `env` value, needs no escaping rules of its own for paths containing spaces, and fails loudly rather than silently mis-splitting a path.

## Why this is the security boundary

This declaration is not a convenience index. It is the only thing that decides what the server can reach, and it works by removing paths from the conversation entirely.

Every tool takes a required `kb` argument whose value must be one of these aliases. The argument is advertised on the wire as an enum over exactly the declared aliases, so an undeclared alias is refused during argument validation — before any handler runs, and therefore before any filesystem call. There is no argument anywhere in the surface that accepts a filesystem location, so no prompt, however inventive, can introduce one.

Two consequences follow, and both are worth relying on.

Aliases keep a caller's contract stable. Because callers name a base rather than a location, you can move a base on disk by editing this one declaration, and nothing a caller sends has to change. The server also never returns a filesystem path — `kb_config` reports aliases, zone names, and staging names only — so paths stay off the wire in both directions.

Declaring a base is a confidentiality decision, not a convenience one. Several bases in one server process means several roots inside one process, and bases in a real estate often span personal, legal, and client material. The containment that keeps one base's paths out of another is asserted end to end by a test that puts two bases side by side on disk and tries to arithmetic its way from one into the other, but the cheaper safeguard is the declaration itself: a base you did not declare cannot be reached by any bug in any tool.

## What startup checks

The declaration is validated in full when the server boots, never lazily on first use. Each of these aborts startup with a message naming the offending alias:

- The value is missing, empty, not valid JSON, or not a JSON object.
- The object declares no bases at all.
- An alias maps to something that is not a string.
- An alias is declared more than once. `JSON.parse` silently keeps the last of two identical keys, so the raw text is re-scanned for this — a repeated alias would otherwise pick a winner you did not choose, possibly a different base entirely.
- An alias is not a safe identifier: it must start with a letter or digit, contain only letters, digits, dot, dash, or underscore, and be at most 64 characters. Aliases never take part in path resolution, but they appear in errors, audit records, and the advertised schema, so they are held to an identifier shape rather than accepted as free text.
- A path is empty, relative, or does not exist, or exists but is not a directory. A leading `~/` is expanded against your home directory first.

Relative paths are refused rather than resolved because the server has no meaningful working directory of its own — it is launched by your client from wherever that client happens to run. Resolving a relative path would make the authorisation boundary depend on ambient state, which is the one thing the declaration exists to pin down.

Failing at startup is the point. A declaration mistake becomes a server that will not start, which your client reports, rather than a base that quietly resolves somewhere else on the first call that touches it.

## What one call may reach

Three rules follow from the declaration, and they surprise people arriving from single-root servers.

**Every tool requires `kb`, and there is no default.** Omitting it is a validation error, never a silent choice. This matters most on a single-base install, where a default would feel harmless: the moment a second base is added, every call written without the argument would start acting on whichever base won the default, and at `destructive` access level that is a write to the wrong knowledge base.

**One call acts in exactly one base.** There are no cross-base operations — no reading from one base and writing to another, no moving a file between bases in a single call. Each handler turns its alias into a base once, and the implementation beneath it is handed that one base rather than the whole configuration, so it has no way to see a second base's root, let alone reach it.

**The access level is server-wide, not per base.** The declaration bounds _which_ bases the install may reach; `MCP_KI_KB_FS_ACCESS_LEVEL` bounds _what_ may be done in them, and it applies to all of them equally. If one base should be readable but never writable, that is two server registrations with different levels, not one registration with a per-base setting.

## Discovering what is declared

Call `kb_config` with any declared alias. It returns that base's zone and staging names, its root-file allow-list, and its raw `.ki.toml` — plus a roster of every base this server may reach, each with its own zone and staging names. So a client can learn the install's whole reach in one read-only call, without being told the environment and without any path being disclosed.

That makes `kb_config` the right first call in an unfamiliar base, and the right first call when a `kb` argument has just been rejected.

## Adding or moving a base later

Edit the declaration in your client's `env` block and restart the client. The server reads its environment once at startup and never re-reads it, so an edit without a restart changes nothing.

Renaming an alias is a caller-visible change: anything that referred to the old alias by name — a saved prompt, a project instruction — now names a base that does not exist and will be refused. Moving a base on disk is not, as long as the alias stays the same.
