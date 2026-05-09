#!/usr/bin/env node

/**
 * mcp-kb
 *
 * Local stdio MCP server providing read access to a local directory of markdown files as a knowledge base.
 * Scoped to a single vault root — all paths are validated against it to prevent
 * directory traversal.
 *
 * Configuration (environment variables):
 *   ROOT_PATH    Absolute or ~ path to the vault root.
 */

import * as fs from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ROOT_PATH } from './config.ts'
import * as notes from './notes.ts'

console.error(`mcp-kb starting...`)
console.error(`  ROOT_PATH=${ROOT_PATH}`)

const server = new McpServer({
  name: 'mcp-kb',
  version: '1.1.0'
})

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false } as const

server.registerTool(
  'kb_read_note',
  {
    title: 'Read KB Note',
    description: `Read the full markdown content of a Knowledge Base note by its vault-relative path.

Args:
  - path (string): Vault-relative path to the note.
    Example: "CLAUDE.md"

Returns:
  The raw markdown text of the file.

Errors:
  - "File not found" when the path does not exist in the vault.
  - "Path escapes root" when the path attempts directory traversal.`,
    inputSchema: z
      .object({
        path: z.string().min(1, 'Path must not be empty').describe('Vault-relative path to the note, e.g. "Pillars/Finance/Budget.md"')
      })
      .strict(),
    annotations: READ_ONLY
  },
  notes.readNote
)

server.registerTool(
  'kb_list_notes',
  {
    title: 'List KB Notes',
    description: `List markdown notes (.md files) inside a vault directory.

Args:
  - path (string): Vault-relative directory path. Omit or pass "" for the vault root.
  - recursive (boolean): When true, descends into all subdirectories. Default false.

Returns:
  Newline-separated list of vault-relative paths to .md files found.`,
    inputSchema: z
      .object({
        path: z.string().default('').describe('Vault-relative directory path. Empty string lists the vault root.'),
        recursive: z.boolean().default(false).describe('Descend into subdirectories when true.')
      })
      .strict(),
    annotations: READ_ONLY
  },
  notes.listNotes
)

server.registerTool(
  'kb_write_note',
  {
    title: 'Write KB Note',
    description: `Write or overwrite a markdown note in the Knowledge Base vault.

Args:
  - path (string): Vault-relative path to the note.
    Example: "CLAUDE.md"
  - content (string): Full markdown content to write to the file.
  - create_dirs (boolean): Create parent directories if they do not exist. Default true.

Returns:
  Confirmation message with the vault-relative path and byte count written.

Errors:
  - "Path escapes root" when the path attempts directory traversal.
  - "Directory not found" when create_dirs is false and the parent directory does not exist.`,
    inputSchema: z
      .object({
        path: z.string().min(1, 'Path must not be empty').describe('Vault-relative path to the note, e.g. "CLAUDE.md"'),
        content: z.string().describe('Full markdown content to write to the file.'),
        create_dirs: z.boolean().default(true).describe('Create parent directories if they do not exist. Default true.')
      })
      .strict(),
    annotations: DESTRUCTIVE
  },
  notes.writeNote
)

async function main(): Promise<void> {
  try {
    await fs.access(ROOT_PATH)
  } catch {
    console.error(`mcp-kb: vault root not accessible: ${ROOT_PATH}\nSet ROOT_PATH to the correct path and restart.`)
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`mcp-kb ready`)
}

main().catch((err) => {
  console.error('mcp-kb fatal:', err)
  process.exit(1)
})
