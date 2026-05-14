/**
 * Append-only JSONL audit log for tool invocations.
 *
 * Every destructive tool is logged by default (those whose `annotations.destructiveHint`
 * is true). Reads can be included by setting MCP_KB_AUDIT_LOG_ALL=1. Path is
 * configurable via MCP_KB_AUDIT_LOG_PATH; defaults to
 * `<MCP_KB_ROOT_PATH>/.audit/audit.jsonl`.
 *
 * Failures to write the audit line are swallowed (stderr only) — a broken log
 * must never prevent a tool call from completing.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { AUDIT_LOG_ALL, AUDIT_LOG_PATH } from '../config.js'

export type Role = 'auditor' | 'cleaner'

export interface AuditEvent {
  ts: string
  server: string
  tool: string
  role: Role
  ok: boolean
  duration_ms: number
  error?: string
  args: unknown
}

const SERVER_NAME = 'mcp-kb'
const MAX_ARG_CHARS = 4096

const sanitizeArgs = (args: unknown): unknown => {
  let safe: unknown = args
  if (args && typeof args === 'object' && !Array.isArray(args)) {
    const copy: Record<string, unknown> = { ...(args as Record<string, unknown>) }
    if (typeof copy.content === 'string') {
      copy.content = `[redacted ${Buffer.byteLength(copy.content, 'utf-8')}B]`
    }
    safe = copy
  }
  const serialized = JSON.stringify(safe)
  if (serialized.length > MAX_ARG_CHARS) {
    return { _truncated: true, preview: serialized.slice(0, MAX_ARG_CHARS) }
  }
  return safe
}

export const appendAuditEvent = async (event: AuditEvent): Promise<void> => {
  try {
    await fs.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true })
    await fs.appendFile(AUDIT_LOG_PATH, `${JSON.stringify(event)}\n`, 'utf-8')
  } catch (err) {
    console.error(`[audit-log] failed to write: ${err instanceof Error ? err.message : String(err)}`)
  }
}

type ToolCallback = (...callbackArgs: unknown[]) => unknown | Promise<unknown>

const extractErrorText = (result: unknown): string | undefined => {
  const content = (result as { content?: { type: string; text: string }[] }).content
  if (!Array.isArray(content)) return undefined
  const first = content.find((c) => c.type === 'text')
  return first?.text
}

export const withAuditLog = (toolName: string, role: Role, callback: ToolCallback): ToolCallback => {
  if (role === 'auditor' && !AUDIT_LOG_ALL) return callback
  return async (...callbackArgs: unknown[]) => {
    const start = Date.now()
    const args = callbackArgs[0]
    try {
      const result = await callback(...callbackArgs)
      const isError = typeof result === 'object' && result !== null && (result as { isError?: boolean }).isError === true
      const errText = isError ? extractErrorText(result) : undefined
      void appendAuditEvent({
        ts: new Date().toISOString(),
        server: SERVER_NAME,
        tool: toolName,
        role,
        ok: !isError,
        duration_ms: Date.now() - start,
        error: errText,
        args: sanitizeArgs(args)
      })
      return result
    } catch (err) {
      void appendAuditEvent({
        ts: new Date().toISOString(),
        server: SERVER_NAME,
        tool: toolName,
        role,
        ok: false,
        duration_ms: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        args: sanitizeArgs(args)
      })
      throw err
    }
  }
}

type RegisterTool = McpServer['registerTool']

/**
 * Wrap `server.registerTool` so every registered tool's callback is decorated
 * with the audit logger. Role is inferred from `annotations.destructiveHint`
 * in the tool config.
 */
export const makeAuditedRegister = (server: McpServer): RegisterTool => {
  return new Proxy(server.registerTool.bind(server) as RegisterTool, {
    apply(target, thisArg, args: Parameters<RegisterTool>) {
      const name = args[0]
      const config = args[1] as { annotations?: { destructiveHint?: boolean } } | undefined
      const role: Role = config?.annotations?.destructiveHint ? 'cleaner' : 'auditor'
      const wrappedArgs = [...args] as Parameters<RegisterTool>
      const callback = wrappedArgs[2] as ToolCallback
      wrappedArgs[2] = withAuditLog(name, role, callback) as (typeof wrappedArgs)[2]
      return Reflect.apply(target, thisArg, wrappedArgs)
    }
  })
}
