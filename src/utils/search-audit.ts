import type { McpServer } from '@modelcontextprotocol/server'
import { type AuditConfig, appendSearchAuditEvent } from './audit-log.js'
import { errorResult } from './results.js'

type Handler = (request: unknown, context: unknown) => unknown | Promise<unknown>
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Intercept only the public tools/call registration, never SDK private fields. */
export const installSearchAudit = (server: McpServer, audit: AuditConfig, aliases: readonly string[]): void => {
  const original = server.server.setRequestHandler.bind(server.server)
  server.server.setRequestHandler = new Proxy(original, {
    apply(target, receiver, args: [string, Handler]) {
      const [method, handler] = args
      if (method !== 'tools/call') return Reflect.apply(target, receiver, args)
      const wrapped: Handler = async (request, context) => {
        const params = object(request) && object(request.params) ? request.params : undefined
        if (params?.name !== 'kb_search') return handler(request, context)
        const start = Date.now()
        const input = object(params.arguments) ? params.arguments : {}
        let result: unknown
        let ok = false
        try {
          result = await handler(request, context)
          ok = object(result) && result.isError !== true
        } catch {
          ok = false
        }
        if (!ok) result = errorResult('searching KB', new Error('Search request rejected or unavailable.'))
        if (audit.mode !== 'off') {
          const appended = await appendSearchAuditEvent(audit, {
            ts: new Date().toISOString(),
            server: 'mcp-ki-kb-fs',
            tool: 'kb_search',
            level: 'read',
            ok,
            duration_ms: Date.now() - start,
            ...(!ok ? { error: 'Search request rejected or unavailable.' } : {}),
            args: {
              ...(typeof input.kb === 'string' && aliases.includes(input.kb) ? { kb: input.kb } : {}),
              mode:
                input.mode === undefined
                  ? 'query'
                  : typeof input.mode === 'string' && ['query', 'search', 'vsearch'].includes(input.mode)
                    ? input.mode
                    : 'invalid',
              outcome: ok ? 'success' : 'error',
              query_type: typeof input.query === 'string' ? 'string' : input.query === undefined ? 'missing' : 'other',
              query_bytes: typeof input.query === 'string' ? Buffer.byteLength(input.query) : 0
            }
          })
          if (!appended)
            return errorResult('searching KB', new Error('Search audit unavailable; no successful search is reported.'))
        }
        return result
      }
      return Reflect.apply(target, receiver, [method, wrapped])
    }
  })
}
