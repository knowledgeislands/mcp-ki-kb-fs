import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { makeAccessGatedRegister } from './access-level.js'
import { READ_ONLY } from './annotations.js'
import type { AuditConfig } from './audit-log.js'
import { jsonResult } from './results.js'
import { installSearchAudit } from './search-audit.js'

const roots: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  roots.splice(0).forEach((p) => {
    rmSync(p, { recursive: true, force: true })
  })
})
type Handler = (request: unknown, context: unknown) => Promise<unknown>
const setup = (mode: AuditConfig['mode'] = 'writes', behavior: 'valid' | 'throw' | 'bad-output' = 'valid') => {
  const root = mkdtempSync(join(tmpdir(), 'search-audit-'))
  roots.push(root)
  const audit: AuditConfig = { mode, path: join(root, 'audit.jsonl'), maxBytes: 0, keep: 0 }
  const server = new McpServer({ name: 'audit-fixture', version: '0.0.0' })
  let dispatch: Handler = async () => {
    throw new Error('SDK handler not registered')
  }
  const original = server.server.setRequestHandler.bind(server.server)
  // Capture only public registration arguments; invoke the SDK-supplied dispatcher.
  server.server.setRequestHandler = new Proxy(original, {
    apply(target, receiver, args: [string, Handler]) {
      const result = Reflect.apply(target, receiver, args)
      if (args[0] === 'tools/call') dispatch = args[1]
      return result
    }
  })
  installSearchAudit(server, audit, ['alpha'])
  const callback = vi.fn(async () => {
    if (behavior === 'throw') throw new Error('SECRET /private/note.md')
    return jsonResult({ answer: behavior === 'bad-output' ? 42 : 'SECRET RESULT' })
  })
  const register = makeAccessGatedRegister(server, 'read', audit)
  const searchTool = register(
    'kb_search',
    {
      inputSchema: z
        .object({ kb: z.literal('alpha'), query: z.string(), mode: z.enum(['query', 'search', 'vsearch']).optional() })
        .strict(),
      outputSchema: z.object({ answer: z.string() }).strict(),
      annotations: READ_ONLY
    },
    callback
  )
  register('ordinary_read', { inputSchema: z.object({}).strict(), annotations: READ_ONLY }, async () =>
    jsonResult({ ordinary: true })
  )
  const call = (
    args: unknown = { kb: 'alpha', query: 'SECRET /private/query.md', mode: 'query' },
    name = 'kb_search'
  ) =>
    dispatch(
      { method: 'tools/call', params: { name, arguments: args } },
      {
        signal: new AbortController().signal,
        requestId: 1,
        sendNotification: async () => {},
        sendRequest: async () => {}
      }
    ) as Promise<{ isError?: boolean; content: unknown }>
  return {
    root,
    audit,
    callback,
    call,
    searchTool,
    rawCall: (request: unknown) => dispatch(request, {}),
    events: () =>
      readFileSync(audit.path, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
  }
}
describe('recognizable public SDK search dispatch audit', () => {
  it('audits successes and SDK input failures exactly once under writes/all with no query/results/path content', async () => {
    for (const mode of ['writes', 'all'] as const) {
      const f = setup(mode)
      expect((await f.call()).isError).not.toBe(true)
      for (const args of [
        { kb: 'unknown', query: 'SECRET' },
        { kb: 'alpha', query: 5, mode: 5 },
        { kb: 'alpha' },
        { kb: 'alpha', query: 'SECRET', extra: '/private/secret' },
        [],
        null
      ])
        expect((await f.call(args)).isError).toBe(true)
      expect(f.callback).toHaveBeenCalledTimes(1)
      expect(f.events()).toHaveLength(7)
      expect(f.events()[0].args).toEqual({
        kb: 'alpha',
        mode: 'query',
        outcome: 'success',
        query_type: 'string',
        query_bytes: 24
      })
      expect(readFileSync(f.audit.path, 'utf8')).not.toMatch(/SECRET|private|answer|results/)
    }
  })
  it('audits callback errors and SDK output validation rejection exactly once with sanitized errors', async () => {
    for (const behavior of ['throw', 'bad-output'] as const) {
      const f = setup('writes', behavior)
      const result = await f.call()
      expect(result.isError).toBe(true)
      expect(f.events()).toHaveLength(1)
      expect(f.events()[0].ok).toBe(false)
      expect(JSON.stringify(result)).not.toMatch(/SECRET|private|answer/)
    }
  })
  it('audits a recognized SDK lookup failure before tool execution', async () => {
    const f = setup()
    f.searchTool.disable()
    expect((await f.call()).isError).toBe(true)
    expect(f.callback).not.toHaveBeenCalled()
    expect(f.events()).toHaveLength(1)
  })
  it('does not invent a search audit for an unrecognizable protocol envelope', async () => {
    const f = setup()
    await expect(f.rawCall({ method: 'tools/call' })).rejects.toThrow()
    expect(() => readFileSync(f.audit.path)).toThrow()
  })
  it('honors off and leaves other read calls untouched', async () => {
    const f = setup('off')
    expect((await f.call()).isError).not.toBe(true)
    expect(() => readFileSync(f.audit.path)).toThrow()
    const other = setup('writes')
    expect((await other.call({}, 'ordinary_read')).isError).not.toBe(true)
    expect(() => readFileSync(other.audit.path)).toThrow()
  })
  it('fails sanitized when enabled append is unavailable rather than returning unaudited success', async () => {
    const f = setup()
    mkdirSync(f.audit.path)
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await f.call()
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).toContain('audit unavailable')
    expect(stderr.mock.calls.flat().join(' ')).not.toMatch(/SECRET|private|audit\.jsonl/)
  })
  it('keeps a successfully appended event when best-effort rotation fails without disclosing paths', async () => {
    const f = setup()
    f.audit.maxBytes = 1
    f.audit.keep = 1
    mkdirSync(`${f.audit.path}.1`)
    writeFileSync(join(`${f.audit.path}.1`, 'blocker'), 'synthetic')
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await f.call()).isError).not.toBe(true)
    expect(f.events()).toHaveLength(1)
    expect(stderr.mock.calls.flat().join(' ')).toBe('[audit-log] search rotation failed')
  })
})
