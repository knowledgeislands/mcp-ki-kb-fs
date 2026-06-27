import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Config } from '../../config/index.js'
import * as files from '../../main/files/index.js'
import { DESTRUCTIVE, READ_ONLY, WRITE } from '../../utils/annotations.js'

const NO_TRAVERSAL_MSG = 'Must be a KB-relative path: no ".." segments, no leading "/", no leading "~", no null bytes'

const isKbRelative = (p: string): boolean =>
  !p.split(/[\\/]/).includes('..') && !p.startsWith('/') && !p.startsWith('~') && !p.includes('\0')

const filePathArg = (describe: string) =>
  z.string().min(1, 'Path must not be empty').max(4096).refine(isKbRelative, NO_TRAVERSAL_MSG).describe(describe)

const dirPathArg = (describe: string) => z.string().max(4096).refine(isKbRelative, NO_TRAVERSAL_MSG).default('').describe(describe)

export const registerFilesTools = (server: McpServer, cfg: Config): void => {
  server.registerTool(
    'kb_file_read',
    {
      title: 'Read KB File',
      description: `Read a side file (image, PDF, attachment, etc.) from the knowledge base.

Returns the file content together with its detected encoding and MIME type:
- \`encoding: "utf-8"\`  — content is a UTF-8 string
- \`encoding: "base64"\` — content is base64-encoded (use for binary assets)

Zone restriction: the path must start with a declared zone or staging root
(e.g. "Pillars/", "Calendar/", "+/", "-/"). Files at the KB root are not accessible.

Errors:
- "File not found" — path does not exist.
- "Path is outside KB zones" — first segment is not a zone or staging root.
- "Path is protected" — dotfiles and root-level meta files.
- "Not a file" — path is a directory.`,
      inputSchema: z.object({ path: filePathArg('KB-relative path to the file, e.g. "Pillars/images/diagram.png"') }).strict(),
      annotations: READ_ONLY
    },
    (args) => files.readFile(cfg, args)
  )

  server.registerTool(
    'kb_files_list',
    {
      title: 'List KB Files',
      description: `List files in a knowledge-base directory (any type; optionally filtered by extension).

Returns a JSON object with \`files\` (array of KB-relative paths) and \`count\`.

Parameters:
- path (string): KB-relative directory to list. Omit or pass "" for a zone root.
- recursive (boolean): Descend into sub-directories. Default false.
- ext (string, optional): Filter by extension including the dot, e.g. ".png", ".pdf".

Zone restriction: the path must start with a declared zone or staging root.`,
      inputSchema: z
        .object({
          path: dirPathArg('KB-relative directory, e.g. "Pillars/images"'),
          recursive: z.boolean().default(false).describe('Descend into sub-directories. Default false.'),
          ext: z
            .string()
            .regex(/^\.[a-zA-Z0-9]+$/, 'Extension must start with a dot, e.g. ".png"')
            .optional()
            .describe('Filter by file extension including the dot, e.g. ".png". Omit to list all files.')
        })
        .strict(),
      annotations: READ_ONLY
    },
    (args) => files.listFiles(cfg, args)
  )

  server.registerTool(
    'kb_file_write',
    {
      title: 'Write KB File',
      description: `Write (create or overwrite) a side file in the knowledge base.

For binary files (images, PDFs), base64-encode the content and set encoding: "base64".
For text files, pass the raw string with encoding: "utf-8" (default).

Atomic write: a sibling temp file is written then renamed, so a crash mid-write
cannot produce a half-written file.

Parameters:
- path (string): KB-relative path to write, e.g. "Pillars/images/diagram.png".
- content (string): UTF-8 text or base64-encoded bytes depending on encoding.
- encoding ("utf-8" | "base64"): Default "utf-8".
- create_dirs (boolean): Create parent directories if they don't exist. Default true.
- dry_run (boolean): When true, returns a preview without writing. Default true.

Zone restriction: the path must start with a declared zone or staging root.`,
      inputSchema: z
        .object({
          path: filePathArg('KB-relative path to write, e.g. "Pillars/images/diagram.png"'),
          content: z
            .string()
            .max(50 * 1024 * 1024)
            .describe('File content: UTF-8 string or base64-encoded bytes depending on encoding.'),
          encoding: z
            .enum(['utf-8', 'base64'])
            .default('utf-8')
            .describe('Content encoding. Use "base64" for binary files. Default "utf-8".'),
          create_dirs: z.boolean().default(true).describe('Create parent directories if they do not exist. Default true.'),
          dry_run: z.boolean().default(true).describe('Preview the operation without writing. Change to false to actually write.')
        })
        .strict(),
      annotations: DESTRUCTIVE
    },
    (args) => files.writeFile(cfg, args)
  )

  server.registerTool(
    'kb_file_rename',
    {
      title: 'Rename KB File',
      description: `Rename or move a side file within the knowledge base zones.

Non-destructive: fails if the destination already exists.

Parameters:
- from (string): Current KB-relative path.
- to (string): New KB-relative path.
- create_dirs (boolean): Create destination parent directories if needed. Default true.

Zone restriction: both from and to must start with a declared zone or staging root.`,
      inputSchema: z
        .object({
          from: filePathArg('Current KB-relative file path, e.g. "Pillars/images/old.png"'),
          to: filePathArg('New KB-relative file path, e.g. "Pillars/images/new.png"'),
          create_dirs: z.boolean().default(true).describe('Create destination parent directories if they do not exist. Default true.')
        })
        .strict(),
      annotations: WRITE
    },
    (args) => files.renameFile(cfg, args)
  )

  server.registerTool(
    'kb_file_delete',
    {
      title: 'Delete KB File',
      description: `Delete a side file from the knowledge base.

Parameters:
- path (string): KB-relative path to delete.
- dry_run (boolean): When true, returns a preview without deleting. Default true.

Zone restriction: the path must start with a declared zone or staging root.`,
      inputSchema: z
        .object({
          path: filePathArg('KB-relative path to delete, e.g. "Pillars/images/old.png"'),
          dry_run: z.boolean().default(true).describe('Preview only; change to false to actually delete.')
        })
        .strict(),
      annotations: DESTRUCTIVE
    },
    (args) => files.deleteFile(cfg, args)
  )
}
