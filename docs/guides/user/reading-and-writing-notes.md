# Reading and writing notes

The working loop once the server is connected: finding your way around a base, reading what is there, capturing something new, and moving or removing it afterwards. The examples are phrased as asks, because that is how the tools are actually reached — you talk to the client, and it chooses the call.

Everything here assumes the base is declared ([Declaring your knowledge bases](declaring-knowledge-bases.md)) and the path is in a zone ([Scoping a knowledge base](scoping-a-knowledge-base.md)). Anything that changes a file also needs the access level to permit it ([Choosing an access level](choosing-an-access-level.md)).

## Start by orienting

> "Call `kb_config` for `kit-pkb` and tell me what its zones are."

Worth doing first in any base you have not worked in recently, and worth doing again whenever a path is refused. It returns the resolved zone and staging names for that base, its root-file read allow-list, and its raw `.ki.toml` — plus the roster of every base this server may reach.

That roster is the answer to "which aliases exist", so you never have to remember what you put in the declaration. What it deliberately does not return is any filesystem path.

## Survey a section

> "List every note under `Pillars/Finance`, recursively."

`kb_list` distinguishes three kinds of entry: files, folders, and Markdown notes. Asking for notes gets you the Markdown and nothing else; asking for files and naming an extension gets you side files such as `.png` or `.pdf`. Folders come back as folders, never mixed in with files.

The directory you name has to be a zone or staging root, or something beneath one. The KB root is not listable, and allow-listed root files never appear in a listing however you ask.

## Read a note

> "Show me `Pillars/Finance/Budget.md`."

You get the path, its MIME type, its encoding, its size on disk, and its content. Text comes back as UTF-8 and binary comes back as base64, decided by whether the bytes actually decode rather than by the extension — so a `.md` file containing something other than text is handled honestly instead of being mangled.

For a Markdown file you can ask for a slice instead of the whole thing:

> "Just the frontmatter of `Pillars/Finance/Budget.md`."

Slicing is available only for UTF-8 Markdown; asking for part of a PNG is an error rather than a guess. A note that opens a `---` fence and never closes it is reported as malformed rather than being sliced at some arbitrary point.

The same call also reaches the base's own orientation files — `README.md`, `AGENTS.md`, `CLAUDE.md`, or whatever the base's allow-list names — which is often the fastest way to have a model understand the base's conventions before it writes anything.

## Capture something new

> "Save these notes to `+/2026-05-13.md`, creating the folder if it isn't there."

Two defaults shape what happens next, and they pull in opposite directions on purpose.

Missing parent directories are created for you by default, so capture does not fail on a folder that does not exist yet.

Nothing is written by default. Writes preview unless the call explicitly asks for the real thing, and the preview tells you which of the two outcomes you were about to get — `would create (N bytes)` for a new file, or `would overwrite (N → M bytes)` for one that already exists. That second message is the one to read: this server has no separate create-versus-update distinction, so an overwrite is how a mistyped path destroys an existing note, and the preview is where you catch it.

When the write does happen it is atomic — content goes to a sibling temporary file and is renamed into place — so an interrupted write leaves either the old file or the new one, never a half-written note.

Binary content works the same way with base64 encoding, which is how images and attachments get into a base alongside the notes that reference them.

## Make a folder ahead of time

> "Create `Pillars/Finance/2026`."

Useful when you want the structure before the content. It behaves like `mkdir -p`: intermediate folders are created, and running it again on a folder that already exists succeeds rather than erroring. It has no preview mode, because creating a folder destroys nothing.

It does fail if an ordinary file already occupies that path, which is a real conflict rather than a repeat.

## Move or rename

> "Move `+/draft.md` to `Pillars/Finance/Budget.md`."

Renaming is non-destructive and stays that way: if the destination already exists, the call is refused rather than overwriting it. If you genuinely mean to replace the destination, that is a delete and a write, made of two deliberate calls rather than one ambiguous one.

Both paths have to satisfy the zone and protected-path rules independently, so you cannot use a move to smuggle content to a place a write could not have reached.

One consequence of being non-destructive is that a repeat is an error: the second identical call fails because the source has already moved. That is the tool working, not a fault.

## Remove something

> "Delete `+/2026-05-13.md` for real."

Deletion previews by default, exactly like writing, and the word doing the work in that ask is _for real_ — without it you get a preview and no deletion. Allow-listed root files are never deletable at any level.

## When something is refused

Most refusals here are a safeguard rather than a defect. `Path is outside KB zones` means the path is inside the base but not inside a zone; `Path is protected` means it is a dotfile or a root-level meta name; `Path escapes root` means it left the base entirely. A tool that is simply absent from the client's list is an access-level question, not a path one. [Troubleshooting](troubleshooting.md) works through each.
