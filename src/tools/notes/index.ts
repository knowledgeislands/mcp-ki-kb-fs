import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as notes from '../../notes.js'
import { DESTRUCTIVE, READ_ONLY } from '../../utils/annotations.js'

export const registerNotesTools = (server: McpServer): void => {
  server.registerTool(
    'viewer_kb_read_note',
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
          path: z.string().min(1, 'Path must not be empty').describe('KB-relative path to the note, e.g. "Pillars/Finance/Budget.md"')
        })
        .strict(),
      annotations: READ_ONLY
    },
    notes.readNote
  )

  server.registerTool(
    'viewer_kb_list_notes',
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
          path: z.string().default('').describe('KB-relative directory path. Empty string lists the knowledge base root.'),
          recursive: z.boolean().default(false).describe('Descend into subdirectories when true.')
        })
        .strict(),
      annotations: READ_ONLY
    },
    notes.listNotes
  )

  server.registerTool(
    'viewer_kb_list_folders',
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
          path: z.string().default('').describe('KB-relative directory path. Empty string lists the knowledge base root.'),
          recursive: z.boolean().default(false).describe('Descend into subdirectories when true.')
        })
        .strict(),
      annotations: READ_ONLY
    },
    notes.listFolders
  )

  server.registerTool(
    'editor_kb_write_note',
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
          path: z.string().min(1, 'Path must not be empty').describe('KB-relative path to the note, e.g. "CLAUDE.md"'),
          content: z.string().describe('Full markdown content to write to the file.'),
          create_dirs: z.boolean().default(true).describe('Create parent directories if they do not exist. Default true.'),
          dry_run: z.boolean().default(true).describe('Preview only; do not write. Default true — pass false to actually write.')
        })
        .strict(),
      annotations: DESTRUCTIVE
    },
    notes.writeNote
  )
}
