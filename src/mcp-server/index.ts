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
import { AUDIT_LOG_MODE, AUDIT_LOG_PATH, ENABLED_ROLES, ROOT_PATH } from '../config.js'
import { registerNotesTools } from '../tools/index.js'
import { makeRoleGatedRegister } from '../utils/roles.js'

console.error(`mcp-kb-fs starting...`)
console.error(`  MCP_KB_FS_ROLES=${[...ENABLED_ROLES].sort().join(',')}`)
console.error(`  MCP_KB_FS_ROOT_PATH=${ROOT_PATH}`)
console.error(`  MCP_KB_FS_AUDIT_LOG=${AUDIT_LOG_MODE}${AUDIT_LOG_MODE === 'off' ? '' : ` (path: ${AUDIT_LOG_PATH})`}`)

const server = new McpServer({
  name: 'mcp-kb-fs',
  version: '1.1.0'
})

// Monkey-patch registerTool so every tool's callback is wrapped with the
// audit logger. Done in-place rather than passing a wrapped reference because
// registerNotesTools calls server.registerTool directly.
server.registerTool = makeRoleGatedRegister(server)

registerNotesTools(server)

const main = async (): Promise<void> => {
  try {
    await fs.access(ROOT_PATH)
  } catch {
    console.error(`mcp-kb-fs: MCP_KB_FS_ROOT_PATH not accessible: ${ROOT_PATH}\nSet MCP_KB_FS_ROOT_PATH to the correct path and restart.`)
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
