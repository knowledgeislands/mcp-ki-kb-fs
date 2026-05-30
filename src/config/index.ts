/**
 * Configuration loading. `loadConfig()` reads the environment (optionally
 * hydrated from a `.env.${NODE_ENV}` file) into a plain `Config` value that is
 * passed explicitly into every main call — so the same code runs as an MCP
 * server or from a standalone script. There is NO module-level config
 * singleton: nothing here is read at import time.
 */
import { strict as assert } from 'node:assert'
import * as os from 'node:os'
import * as path from 'node:path'

const expandHome = (p: string): string => {
  return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p
}

/**
 * Single ordinal access level. Each level implies all lower ones:
 *   `read`        — only readOnly tools registered.
 *   `write`       — readOnly + non-destructive mutations (create, send, toggle).
 *   `destructive` — everything, including delete / overwrite / prune.
 *
 * The gate uses ACCESS_LEVEL_RANK for ordinal comparison; a tool registers when
 * its derived level ≤ the configured level.
 */
export type AccessLevel = 'read' | 'write' | 'destructive'
export const ACCESS_LEVELS: readonly AccessLevel[] = ['read', 'write', 'destructive'] as const
export const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = { read: 1, write: 2, destructive: 3 }

/**
 * Scope of tool invocations to record. Default `writes` logs any tool whose
 * derived level is not `read` (i.e. `write` or `destructive`); `all` adds
 * `read` too; `off` disables logging entirely (the wrapper short-circuits and
 * never opens the file).
 */
export type AuditLogMode = 'off' | 'writes' | 'all'

export interface Config {
  /** Absolute KB root. All paths resolve under it and are confined to it. */
  rootPath: string
  accessLevel: AccessLevel
  auditLogMode: AuditLogMode
  auditLogPath: string
  auditLogMaxBytes: number
  auditLogKeep: number
}

const parseAccessLevel = (raw: string | undefined): AccessLevel => {
  const v = raw?.trim()
  if (v === undefined || v === '') return 'read'
  if ((ACCESS_LEVELS as readonly string[]).includes(v)) return v as AccessLevel
  throw new Error(`Invalid MCP_KB_FS_ACCESS_LEVEL="${raw}". Allowed: ${ACCESS_LEVELS.join(', ')}`)
}

const parseAuditLogMode = (raw: string | undefined): AuditLogMode => {
  const v = raw?.trim().toLowerCase()
  if (v === undefined || v === '') return 'writes'
  if (v === 'off' || v === 'writes' || v === 'all') return v
  throw new Error(`Invalid MCP_KB_FS_AUDIT_LOG="${raw}" — expected one of: off, writes, all.`)
}

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

/**
 * Load configuration from `env` (defaults to `process.env`, after attempting to
 * hydrate it from `.env.${NODE_ENV}`). Throws if a required var is missing.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  try {
    process.loadEnvFile(`./.env.${process.env.NODE_ENV}`)
  } catch {
    // no .env present (or Bun, which auto-loads it) — that's fine
  }

  assert(env.MCP_KB_FS_ROOT_PATH, 'MCP_KB_FS_ROOT_PATH environment variable must be set')

  return {
    rootPath: path.resolve(expandHome(env.MCP_KB_FS_ROOT_PATH)),
    accessLevel: parseAccessLevel(env.MCP_KB_FS_ACCESS_LEVEL),
    auditLogMode: parseAuditLogMode(env.MCP_KB_FS_AUDIT_LOG),
    auditLogPath: path.resolve(expandHome(env.MCP_KB_FS_AUDIT_LOG_PATH ?? path.join(os.homedir(), '.local', 'state', 'mcp-kb-fs', 'audit.jsonl'))),
    auditLogMaxBytes: parseNonNegativeInt(env.MCP_KB_FS_AUDIT_LOG_MAX_BYTES, 10 * 1024 * 1024, 'MCP_KB_FS_AUDIT_LOG_MAX_BYTES'),
    auditLogKeep: parseNonNegativeInt(env.MCP_KB_FS_AUDIT_LOG_KEEP, 5, 'MCP_KB_FS_AUDIT_LOG_KEEP')
  }
}
