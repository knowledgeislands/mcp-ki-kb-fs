import { strict as assert } from 'node:assert'
import * as os from 'node:os'
import * as path from 'node:path'

const expandHome = (p: string): string => {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

try {
  process.loadEnvFile(`./.env.${process.env.NODE_ENV}`)
} catch {
  // no .env present — that's fine
}

assert(process.env.MCP_KB_ROOT_PATH, 'MCP_KB_ROOT_PATH environment variable must be set')

export const ROOT_PATH: string = path.resolve(expandHome(process.env.MCP_KB_ROOT_PATH))

export const AUDIT_LOG_PATH: string = path.resolve(expandHome(process.env.MCP_KB_AUDIT_LOG_PATH ?? path.join(os.homedir(), '.local', 'state', 'mcp-kb', 'audit.jsonl')))
export const AUDIT_LOG_ALL: boolean = process.env.MCP_KB_AUDIT_LOG_ALL === '1'
