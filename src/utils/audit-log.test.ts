import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DESTRUCTIVE, READ_ONLY } from './annotations.js'

describe('appendAuditEvent / withAuditLog (mcp-kb-fs)', () => {
  const tmpDir = path.join(os.tmpdir(), 'mcp-kb-fs-audit-log-tests', `run-${process.pid}-${Date.now()}`)
  const logPath = path.join(tmpDir, 'audit.jsonl')

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true })
    vi.resetModules()
    process.env.MCP_KB_FS_AUDIT_LOG_PATH = logPath
    delete process.env.MCP_KB_FS_AUDIT_LOG
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
    delete process.env.MCP_KB_FS_AUDIT_LOG_PATH
    delete process.env.MCP_KB_FS_AUDIT_LOG
  })

  it('appends an event line for a destructive-level tool', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ path: 'memo.md' })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.tool).toBe('kb_note_write')
    expect(event.level).toBe('destructive')
    expect(event.ok).toBe(true)
    expect(event.server).toBe('mcp-kb-fs')
    expect(event.args).toEqual({ path: 'memo.md' })
  })

  it('redacts the content field on writeNote-style args', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ path: 'memo.md', content: 'x'.repeat(5000) })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.args.content).toMatch(/^\[redacted \d+B\]$/)
  })

  it('records ok:false when the result has isError:true', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ isError: true, content: [{ type: 'text', text: 'boom' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('boom')
  })

  it('records ok:false when the handler throws', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => {
      throw new Error('kaboom')
    })
    await expect(wrapped({})).rejects.toThrow(/kaboom/)
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('kaboom')
  })

  it('skips read-level tools by default (mode=writes)', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const handler = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    const wrapped = withAuditLog('kb_note_read', 'read', handler)
    expect(wrapped).toBe(handler)
  })

  it('logs read-level tools when MCP_KB_FS_AUDIT_LOG=all', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG = 'all'
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_read', 'read', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.level).toBe('read')
  })

  it('skips both levels when MCP_KB_FS_AUDIT_LOG=off and never creates a log file', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG = 'off'
    const { withAuditLog } = await import('./audit-log.js')
    const writeHandler = vi.fn(async (_args: unknown) => ({ content: [{ type: 'text', text: 'ok' }] }))
    expect(withAuditLog('kb_note_write', 'destructive', writeHandler)).toBe(writeHandler)
    await writeHandler({})
    await new Promise((r) => setTimeout(r, 20))
    await expect(fs.access(logPath)).rejects.toThrow()
  })

  it('rejects unknown MCP_KB_FS_AUDIT_LOG values at config load', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG = 'sometimes'
    await expect(import('./audit-log.js')).rejects.toThrow(/Invalid MCP_KB_FS_AUDIT_LOG/)
  })

  it('creates the audit log with mode 0o600 and chmods an existing 0o644 log down to 0o600', async () => {
    await fs.mkdir(path.dirname(logPath), { recursive: true })
    await fs.writeFile(logPath, '', { mode: 0o644 })
    expect(((await fs.stat(logPath)).mode & 0o777).toString(8)).toBe('644')

    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))

    const mode = (await fs.stat(logPath)).mode & 0o777
    expect(mode.toString(8)).toBe('600')
  })

  it('truncates args when the serialized form exceeds MAX_ARG_CHARS', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    // `content` gets redacted (short string), so use a different key with a huge value.
    await wrapped({ huge: 'x'.repeat(5000) })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.args._truncated).toBe(true)
    expect(typeof event.args.preview).toBe('string')
  })

  it('rotates the audit log when it exceeds MCP_KB_FS_AUDIT_LOG_MAX_BYTES (keeps history)', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG_MAX_BYTES = '100'
    process.env.MCP_KB_FS_AUDIT_LOG_KEEP = '2'
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    // Write enough events to trigger multiple rotations.
    for (let i = 0; i < 6; i++) await wrapped({ idx: i })
    await new Promise((r) => setTimeout(r, 50))
    await expect(fs.access(`${logPath}.1`)).resolves.toBeUndefined()
    delete process.env.MCP_KB_FS_AUDIT_LOG_MAX_BYTES
    delete process.env.MCP_KB_FS_AUDIT_LOG_KEEP
  })

  it('rotates by truncating the log when KEEP=0 (no history)', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG_MAX_BYTES = '100'
    process.env.MCP_KB_FS_AUDIT_LOG_KEEP = '0'
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    for (let i = 0; i < 6; i++) await wrapped({ idx: i })
    await new Promise((r) => setTimeout(r, 50))
    // No `.1` rotation file when KEEP=0.
    await expect(fs.access(`${logPath}.1`)).rejects.toThrow()
    delete process.env.MCP_KB_FS_AUDIT_LOG_MAX_BYTES
    delete process.env.MCP_KB_FS_AUDIT_LOG_KEEP
  })

  it('swallows appendFile failures (e.g. path is a directory) without throwing', async () => {
    // Make the log path a directory so appendFile fails with EISDIR.
    await fs.mkdir(logPath, { recursive: true })
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('kb_note_write', 'destructive', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    // Should NOT throw — appendAuditEvent catches all write errors.
    await expect(wrapped({})).resolves.toBeDefined()
  })
})

describe('levelFromAnnotations / makeAccessGatedRegister (mcp-kb-fs)', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.MCP_KB_FS_ACCESS_LEVEL
  })

  afterEach(() => {
    delete process.env.MCP_KB_FS_ACCESS_LEVEL
  })

  it('maps READ_ONLY annotations to read', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(READ_ONLY)).toBe('read')
  })

  it('maps DESTRUCTIVE annotations to destructive', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(DESTRUCTIVE)).toBe('destructive')
  })

  it('maps explicit non-destructive write annotations to write', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false })).toBe('write')
  })

  it('defaults to destructive (fail-safe) when annotations are missing', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(undefined)).toBe('destructive')
  })

  it('skips registration for tools whose level exceeds the gate (default: read only)', async () => {
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const registerTool = vi.fn()
    const fakeServer = { registerTool } as unknown as Parameters<typeof makeAccessGatedRegister>[0]
    const gated = makeAccessGatedRegister(fakeServer)
    gated('kb_note_read', { title: 't', description: 'd', annotations: READ_ONLY } as never, (async () => ({ content: [] })) as never)
    gated('kb_note_write', { title: 't', description: 'd', annotations: DESTRUCTIVE } as never, (async () => ({ content: [] })) as never)
    expect(registerTool).toHaveBeenCalledTimes(1)
    expect((registerTool.mock.calls[0] as unknown[])[0]).toBe('kb_note_read')
  })

  it('registers read + non-destructive writes when MCP_KB_FS_ACCESS_LEVEL=write (but not destructive ones)', async () => {
    process.env.MCP_KB_FS_ACCESS_LEVEL = 'write'
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const registerTool = vi.fn()
    const fakeServer = { registerTool } as unknown as Parameters<typeof makeAccessGatedRegister>[0]
    const gated = makeAccessGatedRegister(fakeServer)
    const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const
    gated('kb_note_read', { title: 't', description: 'd', annotations: READ_ONLY } as never, (async () => ({ content: [] })) as never)
    gated('kb_note_add', { title: 't', description: 'd', annotations: WRITE } as never, (async () => ({ content: [] })) as never)
    gated('kb_note_delete', { title: 't', description: 'd', annotations: DESTRUCTIVE } as never, (async () => ({ content: [] })) as never)
    expect(registerTool).toHaveBeenCalledTimes(2)
    expect((registerTool.mock.calls[0] as unknown[])[0]).toBe('kb_note_read')
    expect((registerTool.mock.calls[1] as unknown[])[0]).toBe('kb_note_add')
  })

  it('registers all levels when MCP_KB_FS_ACCESS_LEVEL=destructive', async () => {
    process.env.MCP_KB_FS_ACCESS_LEVEL = 'destructive'
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const registerTool = vi.fn()
    const fakeServer = { registerTool } as unknown as Parameters<typeof makeAccessGatedRegister>[0]
    const gated = makeAccessGatedRegister(fakeServer)
    gated('kb_note_read', { title: 't', description: 'd', annotations: READ_ONLY } as never, (async () => ({ content: [] })) as never)
    gated('kb_note_delete', { title: 't', description: 'd', annotations: DESTRUCTIVE } as never, (async () => ({ content: [] })) as never)
    expect(registerTool).toHaveBeenCalledTimes(2)
  })

  it('treats an unannotated tool as destructive (fail-safe)', async () => {
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const registerTool = vi.fn()
    const fakeServer = { registerTool } as unknown as Parameters<typeof makeAccessGatedRegister>[0]
    const gated = makeAccessGatedRegister(fakeServer)
    gated('unannotated_tool', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    // default gate is 'read' only → unannotated (treated as destructive) is skipped
    expect(registerTool).toHaveBeenCalledTimes(0)
  })

  it('rejects unknown MCP_KB_FS_ACCESS_LEVEL values at config load', async () => {
    process.env.MCP_KB_FS_ACCESS_LEVEL = 'admin'
    await expect(import('../config.js')).rejects.toThrow(/Invalid MCP_KB_FS_ACCESS_LEVEL="admin"/)
  })
})
