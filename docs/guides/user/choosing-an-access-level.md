# Choosing an access level

The declaration decides which knowledge bases this install can reach. The access level decides what may be done in them. This guide covers what each level unlocks, why tool visibility is a stronger safeguard than a confirmation prompt, and what ends up in the audit log.

## The three levels

`MCP_KI_KB_FS_ACCESS_LEVEL` takes one of three values, and they nest — each includes everything below it.

**`read`** is the default. Three tools are registered: `kb_config`, `kb_list`, and `kb_read`. Nothing on disk can change.

**`write`** adds two non-destructive mutations: `kb_rename` and `kb_folder_create`. Neither can destroy existing content — renaming refuses to overwrite an existing destination, and creating a folder that already exists simply succeeds.

**`destructive`** adds the two that can: `kb_write`, which overwrites an existing file at the same path, and `kb_delete`.

The level is server-wide. It applies equally to every declared base, so "this base is read-only but that one is writable" is two server registrations with different levels and different declarations, not one registration with a per-base setting.

Set it in the same `env` block as the declaration, and restart the client afterwards — configuration is read once at startup.

## Why a tool you cannot see is safer than a tool you must confirm

A tool above the configured level is not registered at all. It is not hidden in the client, not refused at call time, not guarded by a confirmation — it was never advertised, so there is nothing in the session for a model to call and nothing for a persuasive prompt to talk its way past. A default install genuinely cannot delete a note, in the sense that no mechanism for doing so exists in the running process.

The level is derived from each tool's MCP annotations rather than from its name: a tool that declares itself read-only lands at `read`, one that declares itself destructive lands at `destructive`, and one that explicitly declares neither lands at `write`. A tool that is unannotated or only partly annotated is treated as destructive. That last rule is the interesting one — forgetting to annotate a new tool makes it invisible at the default level rather than quietly available, so the failure mode of carelessness is a missing tool rather than an unguarded one.

## `dry_run` is a different safeguard

The two destructive tools default `dry_run` to `true`, and it is worth being clear that this is not a second copy of the access level.

The access level controls **visibility**: whether the tool exists in the session at all. It is decided once, by you, at startup.

`dry_run` controls **effect**: whether a tool that does exist actually changes anything. It is decided per call, and a model can set it to `false`.

So `dry_run` is the safety net for a tool you have already decided to allow — it turns the first attempt into a preview you can read before agreeing, which is where a mistyped path gets caught. It is not a substitute for choosing the level: if you do not want deletion to be possible, the answer is `write` rather than trusting every future call to preview first.

`kb_folder_create` has no `dry_run`, because creating a folder destroys nothing.

## Picking one

Start at `read`. A great deal of what this server is for — surveying a base, reading notes, understanding a base's conventions from its own `README` and `CLAUDE.md` — needs nothing more, and a read-only install is a genuinely different risk proposition from a writable one.

Raise to `write` when you want a model filing and organising: moving a capture out of `+/` into a zone, creating the folder it belongs in. Nothing at this level can lose content.

Raise to `destructive` when you want it capturing and editing notes, which is most of the value of the write side. Understand what you are accepting: `kb_write` overwrites, so a wrong path at this level replaces an existing note rather than refusing. The preview default is the mitigation, and the audit log is the record.

An unrecognised value aborts startup rather than falling back to `read`, so a typo shows up as a server that will not start rather than as a quietly wrong setting.

## The audit log

`MCP_KI_KB_FS_AUDIT_LOG` decides what is recorded as JSONL, one line per invocation:

- **`writes`** (the default) records calls whose derived level is `write` or `destructive`. On a default `read` install that means it records nothing and the file is never created, which is the usual reason someone finds it missing.
- **`all`** adds reads.
- **`off`** disables it entirely; the wrapper short-circuits and never opens the file.

Each line carries the timestamp, the server name, the tool name, its access level, whether it succeeded, how long it took, the error message if it failed, and the call's arguments.

Three things are true of those arguments, and the first two matter if you are deciding whether the log is safe to keep. Written content is never recorded verbatim — it is replaced with its byte count. Credentials embedded in any URL-shaped string are redacted. And an argument object that exceeds 4 KiB is truncated to a preview rather than written whole.

The file lives at `~/.local/state/mcp-ki-kb-fs/audit.jsonl` unless `MCP_KI_KB_FS_AUDIT_LOG_PATH` says otherwise, and is chmod-ed to owner-only. It rotates once it passes `MCP_KI_KB_FS_AUDIT_LOG_MAX_BYTES` (10 MiB by default; `0` disables rotation), keeping `MCP_KI_KB_FS_AUDIT_LOG_KEEP` rotations (five by default).

A failure to write the log is swallowed to stderr on purpose: a broken log must never stop a tool call from completing. That is the right trade for a local convenience record, and the wrong one for a compliance control — so if you need the log to be authoritative, watch the file rather than assume its silence means nothing happened.
