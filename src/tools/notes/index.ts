import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Config } from '../../config/index.js'
import * as notes from '../../main/notes/index.js'
import { DESTRUCTIVE, READ_ONLY, WRITE, WRITE_IDEMPOTENT } from '../../utils/annotations.js'

// Schema-level traversal rejection — defense-in-depth ahead of the main/ layer's
// two-layer guard (lexical + realpath). Rejects "..", absolute, and "~"-rooted
// inputs before they reach the filesystem; "/" separators (subfolders) stay valid.
const NO_TRAVERSAL_MSG = 'Path must be KB-relative: no ".." segments, leading "/", or "~" prefix'
const isKbRelative = (p: string): boolean => !p.split(/[\\/]/).includes('..') && !p.startsWith('/') && !p.startsWith('~') && !p.includes('\0')
const notePathArg = (describe: string) => z.string().min(1, 'Path must not be empty').max(4096).refine(isKbRelative, NO_TRAVERSAL_MSG).describe(describe)
const dirPathArg = (describe: string) => z.string().max(4096).refine(isKbRelative, NO_TRAVERSAL_MSG).default('').describe(describe)

export const registerNotesTools = (server: McpServer, cfg: Config): void => {
  server.registerTool(
    'kb_note_read',
    {
      title: 'Read KB Note',
      description: `Read the full markdown content of a Knowledge Base note by its KB-relative path.

Args:
  - path (string): KB-relative path to the note.
    Example: "CLAUDE.md"

Returns:
  The raw markdown text of the file.

Errors:
  - "File not found" when the path does not exist in the knowledge base.
  - "Path escapes root" when the path attempts directory traversal.`,
      inputSchema: z
        .object({
          path: notePathArg('KB-relative path to the note, e.g. "Pillars/Finance/Budget.md"')
        })
        .strict(),
      annotations: READ_ONLY
    },
    (args) => notes.readNote(cfg, args)
  )

  server.registerTool(
    'kb_notes_list',
    {
      title: 'List KB Notes',
      description: `List markdown notes (.md files) inside a knowledge base directory.

Args:
  - path (string): KB-relative directory path. Omit or pass "" for the knowledge base root.
  - recursive (boolean): When true, descends into all subdirectories. Default false.

Returns:
  Newline-separated list of KB-relative paths to .md files found.`,
      inputSchema: z
        .object({
          path: dirPathArg('KB-relative directory path. Empty string lists the knowledge base root.'),
          recursive: z.boolean().default(false).describe('Descend into subdirectories when true.')
        })
        .strict(),
      annotations: READ_ONLY
    },
    (args) => notes.listNotes(cfg, args)
  )

  server.registerTool(
    'kb_folders_list',
    {
      title: 'List KB Folders',
      description: `List subfolders inside a knowledge base directory.

Args:
  - path (string): KB-relative directory path. Omit or pass "" for the knowledge base root.
  - recursive (boolean): When true, descends into all subdirectories. Default false.

Returns:
  Newline-separated list of KB-relative folder paths found.`,
      inputSchema: z
        .object({
          path: dirPathArg('KB-relative directory path. Empty string lists the knowledge base root.'),
          recursive: z.boolean().default(false).describe('Descend into subdirectories when true.')
        })
        .strict(),
      annotations: READ_ONLY
    },
    (args) => notes.listFolders(cfg, args)
  )

  server.registerTool(
    'kb_note_write',
    {
      title: 'Write KB Note',
      description: `Write or overwrite a markdown note in the knowledge base.

Args:
  - path (string): KB-relative path to the note.
    Example: "CLAUDE.md"
  - content (string): Full markdown content to write to the file.
  - create_dirs (boolean): Create parent directories if they do not exist. Default true.
  - dry_run (boolean): When true (the default), validate inputs and report what would change without writing anything. Pass dry_run: false to actually write the file.

Returns:
  Confirmation message with the KB-relative path and byte count written, or a "[dry_run] would ..." preview.

Errors:
  - "Path escapes root" when the path attempts directory traversal.
  - "Directory not found" when create_dirs is false and the parent directory does not exist.`,
      inputSchema: z
        .object({
          path: notePathArg('KB-relative path to the note, e.g. "CLAUDE.md"'),
          content: z
            .string()
            .max(10 * 1024 * 1024)
            .describe('Full markdown content to write to the file.'),
          create_dirs: z.boolean().default(true).describe('Create parent directories if they do not exist. Default true.'),
          dry_run: z.boolean().default(true).describe('Preview only; do not write. Default true — pass false to actually write.')
        })
        .strict(),
      annotations: DESTRUCTIVE
    },
    (args) => notes.writeNote(cfg, args)
  )

  server.registerTool(
    'kb_note_rename',
    {
      title: 'Rename KB Note',
      description: `Rename or move a markdown note within the knowledge base. Non-destructive: refuses to overwrite an existing destination.

Args:
  - from (string): Current KB-relative path of the note.
    Example: "Inbox/draft.md"
  - to (string): New KB-relative path for the note.
    Example: "Pillars/Finance/Budget.md"
  - create_dirs (boolean): Create parent directories of the destination if they do not exist. Default true.

Returns:
  Confirmation message with both paths.

Errors:
  - "Destination already exists" — refuses to overwrite (use kb_note_delete + kb_note_write if you really want that).
  - "File not found" when the source does not exist.
  - "Path escapes root" / "Path is protected" — standard guards on both paths.`,
      inputSchema: z
        .object({
          from: notePathArg('Current KB-relative path of the note, e.g. "Inbox/draft.md"'),
          to: notePathArg('New KB-relative path for the note, e.g. "Pillars/Finance/Budget.md"'),
          create_dirs: z.boolean().default(true).describe('Create parent directories of the destination if they do not exist. Default true.')
        })
        .strict(),
      annotations: WRITE
    },
    (args) => notes.renameNote(cfg, args)
  )

  server.registerTool(
    'kb_folder_create',
    {
      title: 'Create KB Folder',
      description: `Create a folder in the knowledge base. Idempotent: succeeds even if the folder already exists. Parent directories are created as needed.

Args:
  - path (string): KB-relative folder path to create.
    Example: "Pillars/Finance/2026"

Returns:
  Confirmation message indicating whether the folder was created or already existed.

Errors:
  - "Path exists as a file, not a folder" when the path already exists as a regular file.
  - "Path escapes root" / "Path is protected" — standard guards.`,
      inputSchema: z
        .object({
          path: notePathArg('KB-relative folder path to create, e.g. "Pillars/Finance/2026"')
        })
        .strict(),
      annotations: WRITE_IDEMPOTENT
    },
    (args) => notes.createFolder(cfg, args)
  )

  server.registerTool(
    'kb_note_delete',
    {
      title: 'Delete KB Note',
      description: `Delete a markdown note from the knowledge base.

Args:
  - path (string): KB-relative path of the note to delete.
    Example: "Inbox/2026-04-30.md"
  - dry_run (boolean): When true (the default), report what would be deleted without removing anything. Pass dry_run: false to actually delete.

Returns:
  Confirmation message with the KB-relative path and byte count deleted, or a "[dry_run] would delete (N bytes)" preview.

Errors:
  - "File not found" when the path does not exist.
  - "Not a note file" when the path is not a regular file.
  - "Path escapes root" / "Path is protected" — standard guards.`,
      inputSchema: z
        .object({
          path: notePathArg('KB-relative path of the note to delete, e.g. "Inbox/2026-04-30.md"'),
          dry_run: z.boolean().default(true).describe('Preview only; do not delete. Default true — pass false to actually delete.')
        })
        .strict(),
      annotations: DESTRUCTIVE
    },
    (args) => notes.deleteNote(cfg, args)
  )
}
