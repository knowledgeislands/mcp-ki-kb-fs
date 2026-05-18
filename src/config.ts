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

assert(process.env.MCP_KB_FS_ROOT_PATH, 'MCP_KB_FS_ROOT_PATH environment variable must be set')

export const ROOT_PATH: string = path.resolve(expandHome(process.env.MCP_KB_FS_ROOT_PATH))

export type Role = 'viewer' | 'editor'
export const ALL_ROLES: readonly Role[] = ['viewer', 'editor'] as const

const parseRoles = (raw: string | undefined): Set<Role> => {
  if (raw === undefined || raw.trim() === '') return new Set(['viewer'])
  const requested = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (requested.length === 0) return new Set(['viewer'])
  const invalid = requested.filter((r): r is string => !(ALL_ROLES as readonly string[]).includes(r))
  if (invalid.length > 0) {
    throw new Error(`Invalid MCP_KB_FS_ROLES entries: ${invalid.join(', ')}. Allowed: ${ALL_ROLES.join(', ')}`)
  }
  return new Set(requested as Role[])
}

export const ENABLED_ROLES: ReadonlySet<Role> = parseRoles(process.env.MCP_KB_FS_ROLES)

export const AUDIT_LOG_PATH: string = path.resolve(expandHome(process.env.MCP_KB_FS_AUDIT_LOG_PATH ?? path.join(os.homedir(), '.local', 'state', 'mcp-kb-fs', 'audit.jsonl')))

/**
 * Scope of tool invocations to record. Default `writes` logs destructive tools
 * only; `all` adds read-only ones; `off` disables logging entirely (the
 * wrapper short-circuits and never opens the file).
 */
export type AuditLogMode = 'off' | 'writes' | 'all'

const parseAuditLogMode = (raw: string | undefined): AuditLogMode => {
  const v = raw?.trim().toLowerCase()
  if (v === undefined || v === '') return 'writes'
  if (v === 'off' || v === 'writes' || v === 'all') return v
  throw new Error(`Invalid MCP_KB_FS_AUDIT_LOG="${raw}" — expected one of: off, writes, all.`)
}

export const AUDIT_LOG_MODE: AuditLogMode = parseAuditLogMode(process.env.MCP_KB_FS_AUDIT_LOG)

/**
 * Size-based rotation. After each append, if `audit.jsonl` exceeds
 * MCP_KB_FS_AUDIT_LOG_MAX_BYTES (default 10 MiB), it's renamed to `audit.jsonl.1`
 * and older rotations shift up. MCP_KB_FS_AUDIT_LOG_KEEP (default 5) controls
 * how many rotated files survive. Set MAX_BYTES=0 to disable rotation.
 */
const parseNonNegativeInt = (raw: string | undefined, fallback: number, varName: string): number => {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${varName}="${raw}" — expected a non-negative integer.`)
  }
  return n
}
export const AUDIT_LOG_MAX_BYTES: number = parseNonNegativeInt(process.env.MCP_KB_FS_AUDIT_LOG_MAX_BYTES, 10 * 1024 * 1024, 'MCP_KB_FS_AUDIT_LOG_MAX_BYTES')
export const AUDIT_LOG_KEEP: number = parseNonNegativeInt(process.env.MCP_KB_FS_AUDIT_LOG_KEEP, 5, 'MCP_KB_FS_AUDIT_LOG_KEEP')
