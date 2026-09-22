# Scoping a knowledge base

Declaring a base says the server may reach it. This guide covers the second boundary: which paths _inside_ a declared base are actually reachable, how a base's own `.ki.toml` changes that, and why perfectly ordinary files are sometimes refused.

Read it when a path you expected to work comes back rejected, or before pointing the server at a base whose layout is not the canonical one.

## Only zone contents are reachable

A declared base is not reachable wholesale. Every path is checked against the base's **zones** and **staging areas**, and the check is on the first path segment only:

- `Pillars/Finance/Budget.md` — reachable, because `Pillars` is a zone.
- `+/inbox-capture.md` — reachable, because `+` is a staging area.
- `Budget.md` — refused. A file sitting at the KB root is in no zone.
- `scratch/notes.md` — refused, unless `scratch` is one of this base's declared zone folder names.

The canonical zones are `Calendar`, `Pillars`, `Resources`, `Streams`, and `Admin`, with `+` for inbound staging and `-` for outbound. A base with no `.ki.toml` gets exactly those names.

A refusal reads `Path is outside KB zones. Accessible roots: …` and lists the names this base actually accepts, so the message tells you what the base is configured with rather than what the defaults are.

The rule is deliberately coarse. It means the KB root itself is never listable and never writable, which keeps `.git`, `.obsidian`, editor state, and loose working files out of reach without anyone having to enumerate them.

## Changing the zone names

If a base uses different folder names, declare them in a `.ki.toml` at the base's root:

```toml
[knowledgeislands-kb]
zones = { Pillars = "Knowledge", Resources = "Reference" }
```

Any zone you do not name keeps its canonical default, so partial declarations are fine. The mapping is from the canonical zone to the local folder name: after the example above, `Knowledge/Finance/Budget.md` is reachable and `Pillars/…` is not.

The file is read once, at server startup, at the same moment the base is resolved — so a base's root, zone map, and allow-list travel together as one bundle and there is no way to pair one base's folders with another's configuration. Editing `.ki.toml` needs a client restart, exactly like editing the declaration.

`kb_config` returns the resolved names along with the raw file, which is the quickest way to see what a base actually resolved to rather than what you meant it to.

## The root-file allow-list

Repository context is the one exception to the zone rule. `kb_read` will read an exact list of KB-relative paths that sit outside any zone, so a model can pick up the base's own orientation material:

```toml
[knowledgeislands-kb]
root_file_allowlist = ["README.md", "AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"]
```

The default, if you declare nothing, is `README.md`, `AGENTS.md`, and `CLAUDE.md`.

Four properties make this narrow enough to be safe, and all four are worth knowing before you extend it.

**Entries match exactly.** The path you declare is the path that is readable. There is no prefix or glob behaviour, so `docs` does not open `docs/`.

**It is read-only.** Allow-listed paths are readable through `kb_read` and nothing else. They cannot be written, renamed, or deleted at any access level.

**It is never listable.** `kb_list` will not return allow-listed paths and will not list the KB root, so the allow-list discloses only what someone already knows to ask for by name.

**It is validated at startup.** Every entry must be a non-empty KB-relative path with forward slashes. An absolute path, a leading `~`, a backslash, a null byte, an empty segment, or a `.`/`..` segment aborts the server rather than being silently dropped.

Note that the allow-list overrides the protected-path rule below for the exact paths it names — that is the whole point of it — which is why `.github/copilot-instructions.md` is expressible there and why extending it deserves the same thought as extending the declaration.

## Protected paths

Independently of zones, two families of path are hidden from every tool. They are filtered out of listings and refused by read and write tools with `Path is protected: "<path>"`.

**Anything with a dot-prefixed segment, at any depth.** `.git`, `.obsidian`, `.env`, `.DS_Store`, and everything beneath them. This is the universal dotfile convention rather than a list of known offenders, so a tool that appears tomorrow is covered today.

**Repository-meta filenames, at the KB root only.** `README`, `CLAUDE`, `LICENSE`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, and `AGENTS`, case-insensitively, with an optional `.md` or `.txt`. The root-only qualification is deliberate: a note you genuinely filed at `Resources/archive/2020/README.md` is ordinary content and stays reachable.

## Containment underneath all of this

Zone scoping and protected paths are policy. Underneath them sit two checks that are not negotiable and run on every call before any filesystem access.

The first is lexical: the supplied path is normalised and asserted to resolve strictly inside the base's root. A `..` sequence or an absolute-style input is refused with `Path escapes root: "<input>"`.

The second is physical: the real paths of both the root and the target — or, for a new file, its deepest existing ancestor — are compared. This catches what the lexical check cannot see, which is a symlink inside the base pointing somewhere outside it.

Both apply even when the symlink's target is another base you declared. Bases in a real estate span personal, legal, and client material, so crossing from one into another is a confidentiality failure rather than a convenience, and it is refused in the same words as any other escape.

## When a path is refused

Work down in this order. `Path escapes root` means the path left the base, lexically or through a symlink. `Path is outside KB zones` means it stayed inside the base but landed at the root or in a folder that is not a declared zone — the message lists what is accepted. `Path is protected` means it hit a dotfile or a root-level meta name. [Troubleshooting](troubleshooting.md) covers each in more detail, including the cases where the right answer is to change your `.ki.toml` rather than your path.
