import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('appends an event line for an editor tool', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('editor_kb_write_note', 'editor', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ path: 'memo.md' })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.tool).toBe('editor_kb_write_note')
    expect(event.role).toBe('editor')
    expect(event.ok).toBe(true)
    expect(event.server).toBe('mcp-kb-fs')
    expect(event.args).toEqual({ path: 'memo.md' })
  })

  it('redacts the content field on writeNote-style args', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('editor_kb_write_note', 'editor', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({ path: 'memo.md', content: 'x'.repeat(5000) })
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.args.content).toMatch(/^\[redacted \d+B\]$/)
  })

  it('records ok:false when the result has isError:true', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('editor_kb_write_note', 'editor', async () => ({ isError: true, content: [{ type: 'text', text: 'boom' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('boom')
  })

  it('records ok:false when the handler throws', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('editor_kb_write_note', 'editor', async () => {
      throw new Error('kaboom')
    })
    await expect(wrapped({})).rejects.toThrow(/kaboom/)
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.ok).toBe(false)
    expect(event.error).toBe('kaboom')
  })

  it('skips viewer tools by default (mode=writes)', async () => {
    const { withAuditLog } = await import('./audit-log.js')
    const handler = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    const wrapped = withAuditLog('viewer_kb_read_note', 'viewer', handler)
    expect(wrapped).toBe(handler)
  })

  it('logs viewer tools when MCP_KB_FS_AUDIT_LOG=all', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG = 'all'
    const { withAuditLog } = await import('./audit-log.js')
    const wrapped = withAuditLog('viewer_kb_read_note', 'viewer', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))
    const event = JSON.parse((await fs.readFile(logPath, 'utf-8')).trim())
    expect(event.role).toBe('viewer')
  })

  it('skips both roles when MCP_KB_FS_AUDIT_LOG=off and never creates a log file', async () => {
    process.env.MCP_KB_FS_AUDIT_LOG = 'off'
    const { withAuditLog } = await import('./audit-log.js')
    const editor = vi.fn(async (_args: unknown) => ({ content: [{ type: 'text', text: 'ok' }] }))
    expect(withAuditLog('editor_kb_write_note', 'editor', editor)).toBe(editor)
    await editor({})
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
    const wrapped = withAuditLog('editor_kb_write_note', 'editor', async () => ({ content: [{ type: 'text', text: 'ok' }] }))
    await wrapped({})
    await new Promise((r) => setTimeout(r, 20))

    const mode = (await fs.stat(logPath)).mode & 0o777
    expect(mode.toString(8)).toBe('600')
  })
})

describe('roleFromToolName / makeRoleGatedRegister (mcp-kb-fs)', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.MCP_KB_FS_ROLES
  })

  afterEach(() => {
    delete process.env.MCP_KB_FS_ROLES
  })

  it('infers role from a viewer_ prefix', async () => {
    const { roleFromToolName } = await import('./roles.js')
    expect(roleFromToolName('viewer_kb_read_note')).toBe('viewer')
  })

  it('infers role from an editor_ prefix', async () => {
    const { roleFromToolName } = await import('./roles.js')
    expect(roleFromToolName('editor_kb_write_note')).toBe('editor')
  })

  it('throws when the tool name lacks a viewer_/editor_ prefix', async () => {
    const { roleFromToolName } = await import('./roles.js')
    expect(() => roleFromToolName('kb_read_note')).toThrow(/expected "viewer_" or "editor_" prefix/)
  })

  it('skips registration for tools whose role is not enabled (default: viewer only)', async () => {
    const { makeRoleGatedRegister } = await import('./roles.js')
    const registerTool = vi.fn()
    const fakeServer = { registerTool } as unknown as Parameters<typeof makeRoleGatedRegister>[0]
    const gated = makeRoleGatedRegister(fakeServer)
    gated('viewer_kb_read_note', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    gated('editor_kb_write_note', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    expect(registerTool).toHaveBeenCalledTimes(1)
    expect((registerTool.mock.calls[0] as unknown[])[0]).toBe('viewer_kb_read_note')
  })

  it('registers both roles when MCP_KB_FS_ROLES=viewer,editor', async () => {
    process.env.MCP_KB_FS_ROLES = 'viewer,editor'
    const { makeRoleGatedRegister } = await import('./roles.js')
    const registerTool = vi.fn()
    const fakeServer = { registerTool } as unknown as Parameters<typeof makeRoleGatedRegister>[0]
    const gated = makeRoleGatedRegister(fakeServer)
    gated('viewer_kb_read_note', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    gated('editor_kb_write_note', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    expect(registerTool).toHaveBeenCalledTimes(2)
  })

  it('rejects unknown MCP_KB_FS_ROLES values at config load', async () => {
    process.env.MCP_KB_FS_ROLES = 'admin'
    await expect(import('../config.js')).rejects.toThrow(/Invalid MCP_KB_FS_ROLES entries: admin/)
  })
})
