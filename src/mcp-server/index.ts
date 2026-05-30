#!/usr/bin/env node

/**
 * mcp-kb-fs
 *
 * Local stdio MCP server providing read/write access to a local directory of
 * markdown files as a knowledge base. Scoped to a single root — all paths are
 * validated against it to prevent directory traversal.
 *
 * Configuration (environment variables):
 *   MCP_KB_FS_ROOT_PATH    Absolute or ~ path to the knowledge base root.
 */

import * as fs from 'node:fs/promises'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from '../config/index.js'
import { registerNotesTools } from '../tools/index.js'
import { makeAccessGatedRegister } from '../utils/access-level.js'

const config = loadConfig()

console.error(`mcp-kb-fs starting...`)
console.error(`  MCP_KB_FS_ACCESS_LEVEL=${config.accessLevel}`)
console.error(`  MCP_KB_FS_ROOT_PATH=${config.rootPath}`)
console.error(`  MCP_KB_FS_AUDIT_LOG=${config.auditLogMode}${config.auditLogMode === 'off' ? '' : ` (path: ${config.auditLogPath})`}`)

const server = new McpServer({
  name: 'mcp-kb-fs',
  version: '1.1.0'
})

// Monkey-patch registerTool so every tool's callback is wrapped with the
// audit logger. Done in-place rather than passing a wrapped reference because
// registerNotesTools calls server.registerTool directly.
server.registerTool = makeAccessGatedRegister(server, config.accessLevel, {
  mode: config.auditLogMode,
  path: config.auditLogPath,
  maxBytes: config.auditLogMaxBytes,
  keep: config.auditLogKeep
})

registerNotesTools(server, config)

const main = async (): Promise<void> => {
  try {
    await fs.access(config.rootPath)
  } catch {
    console.error(`mcp-kb-fs: MCP_KB_FS_ROOT_PATH not accessible: ${config.rootPath}\nSet MCP_KB_FS_ROOT_PATH to the correct path and restart.`)
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`mcp-kb-fs ready`)
}

main().catch((err) => {
  console.error('mcp-kb-fs fatal:', err)
  process.exit(1)
})
