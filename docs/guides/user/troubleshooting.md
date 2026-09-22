# Troubleshooting

The failures this server actually produces, what each one means, and how to get moving again. Most of them are a safeguard working as designed rather than a defect.

## The server does not appear at all

If the client lists no tools from `mcp-ki-kb-fs`, the process is failing to start, and the reason is almost always configuration. The server validates everything at startup and throws rather than falling back to a default, so a bad value stops the server instead of quietly changing its behaviour. Check your client's MCP log.

**The declaration is missing or malformed.** Any of `MCP_KI_KB_FS_KNOWLEDGE_BASES must be set to a JSON object …`, `… is not valid JSON: …`, `… must be a JSON object mapping knowledge-base alias to path.`, or `… must declare at least one knowledge base.` In a client configuration file the whole object is a JSON string inside JSON, so its inner quotes need escaping — this is the single most common cause, and [`claude-config-sample.json`](../../../claude-config-sample.json) has the escaped form.

**A specific alias is rejected.** `… alias "<alias>" must map to a path string.`, `… declares an empty path.`, `… is not a safe identifier — …` (start with a letter or digit; letters, digits, dot, dash, underscore; 64 characters maximum), or `… declares alias "<alias>" more than once.` That last one exists because `JSON.parse` silently keeps the last of two identical keys — rename or remove one rather than letting an arbitrary winner be picked for you.

**A path is rejected.** `… must declare an absolute path or one starting "~/", not "<path>"` means a relative path was supplied; the server has no meaningful working directory of its own, so it refuses rather than resolving against something arbitrary. `… points at a path that does not exist: <path>` and `… points at something that is not a directory: <path>` are checked at startup, not on first use, so a typo surfaces immediately. Check whether `~` expanded the way you expected — the server expands a leading `~/` itself.

**Another setting is rejected.** `Invalid MCP_KI_KB_FS_ACCESS_LEVEL="…". Allowed: read, write, destructive`, `Invalid MCP_KI_KB_FS_AUDIT_LOG="…" — expected one of: off, writes, all.`, or `Invalid MCP_KI_KB_FS_AUDIT_LOG_MAX_BYTES="…" — expected a non-negative integer.` The byte count is a number, not `10MB`.

**A base's `.ki.toml` is rejected.** `.ki.toml parse error: …` for invalid TOML, or `.ki.toml root_file_allowlist must be an array of exact, non-empty KB-relative paths without traversal or backslashes.` Note that a broken `.ki.toml` in any declared base stops the whole server, not just that base.

If none of those appear, the launch itself is failing. Confirm the path in `args` points at a `dist/mcp-server/index.js` that exists — a clone that was never built has no `dist/` — and that `node --version` reports 22 or later for the `node` your client actually invokes, which for a GUI client is not necessarily the one on your shell's `PATH`.

## The tools I need are not listed

You are at a lower access level than the tool requires. At `read` you get three tools, at `write` five, at `destructive` seven. This is not a permissions error at call time: the tool was never registered, so the client cannot show it. [Choosing an access level](choosing-an-access-level.md) covers raising the level, and the change needs a client restart because configuration is read once at startup.

If you changed the `env` block and nothing moved, the restart is the missing step. Note also that `.env` files are only loaded when `NODE_ENV=development`, which the development scripts set and your client does not — configuration for a client-launched server must come from the client's `env` block.

## The `kb` argument was rejected

An invalid-enum error on `kb`, or `Unknown knowledge base "<alias>". Declared aliases: …`, means the alias is not declared — or was omitted, which is never a silent choice of base because there is no default.

Call `kb_config` with any alias you do know to get the full roster back. If the alias you wanted genuinely should exist, it belongs in the declaration; see [Declaring your knowledge bases](declaring-knowledge-bases.md), and restart the client afterwards.

## A path was refused

Three messages come from the path rules, and they sit at different depths. Work down them in this order.

**`Path escapes root: "<input>"`** means the path resolved outside the selected base's root — either lexically, through `..` or an absolute-style input, or physically, through a symlink inside the base whose target sits outside it. This fires even when the target is another base you declared: crossing from one base into another is a confidentiality failure, not a convenience. Use KB-relative paths, check that the `kb` argument names the base you meant, and look for symlinks inside the base.

**`Path is outside KB zones. Accessible roots: …`** means the path stayed inside the base but is not under a declared zone or staging area — typically a file sitting directly at the KB root, or a folder this base does not declare. The message lists the names this base actually accepts, which may differ from the canonical ones if its `.ki.toml` renames them. If the folder genuinely is a zone of this base, declare it there and restart; see [Scoping a knowledge base](scoping-a-knowledge-base.md).

**`Path is protected: "<path>"`** means the path has a dot-prefixed segment at some depth (`.git`, `.obsidian`, `.env`) or is a root-level repository-meta name (`README.md`, `CLAUDE.md`, `LICENSE`, and similar). The root-level rule is root-only, so a note you deliberately filed at `Resources/archive/2020/README.md` is not affected. To make a specific root file readable, add its exact path to `root_file_allowlist` in the base's `.ki.toml` — that grants read access only, and never makes it listable or writable.

## A read did not return what I expected

**`part is only available for UTF-8 Markdown files: "<path>"`** — slicing frontmatter or body works only on Markdown that decodes as UTF-8. Ask for the whole file instead.

**`Malformed frontmatter in "<path>": opening "---" has no closing "---"`** — the note opens a frontmatter fence that never closes. Reading the whole file still works; fix the fence to slice it.

**Content came back base64 for a file you thought was text.** Encoding is decided by whether the bytes actually decode as UTF-8, not by the extension, so a `.md` file containing something else is reported honestly rather than mangled.

**`Not a file: "<path>"`** — the path is a directory. Use the listing tool for directories.

## A write, move, or delete did not happen

**Nothing changed and the result mentions a preview.** Both destructive tools default `dry_run` to `true`. The result says `would create (N bytes)` or `would overwrite (N → M bytes)`; the second is worth reading before agreeing, because an overwrite is how a mistyped path replaces an existing note.

**`Directory not found for: "<path>" — set create_dirs: true to create it automatically`** — the parent directory does not exist and directory creation was explicitly switched off.

**`Destination already exists: "<to>" (rename is non-destructive)`** — renaming will not overwrite. If you genuinely mean to replace the destination, that is a delete and a write, as two deliberate calls.

**A repeated move failed.** Expected: the source no longer exists because the first call moved it.

**`Source and destination are the same: "<from>"`** — the two paths resolve to one file.

**`Path exists as a file, not a folder: "<path>"`** — a regular file already occupies the folder path. Creating a folder that already exists is fine; this is a genuine conflict.

**`File not found: "<path>"`** — nothing is there. Confirm the path with a listing first; a note may have been moved rather than deleted.

## The audit log is empty or missing

`MCP_KI_KB_FS_AUDIT_LOG` defaults to `writes`, which records `write` and `destructive` calls only — so on a default read-only install there is nothing to record and the file is never created. Set it to `all` to record reads as well.

If it is still empty at `all`, remember that log-write failures are swallowed to stderr on purpose, so that a broken log can never prevent a tool call from completing. Check that the directory of `MCP_KI_KB_FS_AUDIT_LOG_PATH` is writable by the user your client runs as, and check the client's stderr log.

## A configuration change had no effect

Both the environment and every declared base's `.ki.toml` are read once, at startup, and never re-read. Restart the server through your client. This applies to adding a base, renaming a zone, extending the root-file allow-list, and changing the access level alike.

## Something else

If the behaviour you are seeing is not covered here and is not obviously one of these safeguards, it is worth raising — open an issue with the tool name, the arguments, and the error text. [`SECURITY.md`](../../../SECURITY.md) covers how to report anything with a security dimension privately instead.
