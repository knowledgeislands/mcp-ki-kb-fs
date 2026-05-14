import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('appendAuditEvent / withAuditLog (mcp-kb)', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-kb-audit-log-tests', `run-${process.pid}-${Date.now()}`)
  const logPath = path.join(tmpDir, 'audit.jsonl')

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true })
    vi.resetModules()
    process.env.MCP_KB_AUDIT_LOG_PATH = logPath
    delete process.env.MCP_KB_AUDIT_LOG
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
    delete process.env.MCP_KB_AUDIT_LOG_PATH
    delete process.env.MCP_KB_AUDIT_LOG
  })

  it('appends an event line for a cleaner tool', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_write_note', 'cleaner', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ path: 'memo.md' })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.tool).toBe('kb_write_note')
    expect(event.role).toBe('cleaner')
    expect(event.ok).toBe(true)
    expect(event.server).toBe('mcp-kb')
    expect(event.args).toEqual({ path: 'memo.md' })
  })

  it('redacts the content field on writeNote-style args', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_write_note', 'cleaner', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ path: 'memo.md', content: 'x'.repeat(5000) })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.args.content).toMatch(/^\[redacted \d+B\]$/)
  })

  it('records ok:false when the result has isError:true', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_write_note', 'cleaner', async () => ({ isError: true, content: [{ type: 'text', text: 'boom' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('boom')
  })

  it('records ok:false when the handler throws', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_write_note', 'cleaner', async () => {
      throw new Error('kaboom')
    })
    await expect(wrapped({})).rejects.toThrow(/kaboom/)
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('kaboom')
  })

  it('skips auditor tools by default (mode=writes)', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const handler = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    const wrapped = withAuditLog('kb_read_note', 'auditor', handler)
    expect(wrapped).toBe(handler)
  })

  it('logs auditor tools when MCP_KB_AUDIT_LOG=all', async () => {
    process.env.MCP_KB_AUDIT_LOG = 'all'
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_read_note', 'auditor', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.role).toBe('auditor')
  })

  it('skips both roles when MCP_KB_AUDIT_LOG=off and never creates a log file', async () => {
    process.env.MCP_KB_AUDIT_LOG = 'off'
    const { withAuditLog } = await import('./audit-log.js')
    const cleaner = vi.fn(async (_args: unknown) => ({ content: [{ type: 'text', text: 'ok' }] }))
    expect(withAuditLog('kb_write_note', 'cleaner', cleaner)).toBe(cleaner)
    await cleaner({})
    await new Promise((r) => setTimeout(r, 20))
    await expect(fs.access(logPath)).rejects.toThrow()
  })

  it('rejects unknown MCP_KB_AUDIT_LOG values at config load', async () => {
    process.env.MCP_KB_AUDIT_LOG = 'sometimes'
    await expect(import('./audit-log.js')).rejects.toThrow(/Invalid MCP_KB_AUDIT_LOG/)
  })

  it('creates the audit log with mode 0o600 and chmods an existing 0o644 log down to 0o600', async () => {
    await fs.mkdir(path.dirname(logPath), { recursive: true })
    await fs.writeFile(logPath, '', { mode: 0o644 })
    expect(((await fs.stat(logPath)).mode & 0o777).toString(8)).toBe('644')

    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_write_note', 'cleaner', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))

    const mode = (await fs.stat(logPath)).mode & 0o777
    expect(mode.toString(8)).toBe('600')
  })
})
