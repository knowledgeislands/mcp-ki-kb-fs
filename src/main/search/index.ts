import { z } from 'zod'
import type { KnowledgeBase } from '../../config/index.js'
import {
  authenticateResults,
  boundedJson,
  CANDIDATE_LIMIT,
  currentSources,
  record,
  requireModels,
  type SearchRequest,
  safePath,
  validateRequest,
  ZONES
} from '../../generated/kb-search/contract.js'
import { loadSearchMapping } from './mapping.js'

export const searchRequestSchema = z
  .object({
    query: z.string().min(1),
    mode: z.enum(['query', 'search', 'vsearch']),
    limit: z.number().int().min(1).max(50),
    zone: z.enum(ZONES).optional(),
    pathPrefix: z.string().refine(safePath).optional()
  })
  .strict()
  .superRefine((request, context) => {
    try {
      validateRequest(request)
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid bounded search request.' })
    }
  })

export const searchResultSchema = z
  .object({
    schema: z.literal('ki/kb-search-result/v1'),
    registry_id: z.string(),
    trust_boundary: z.string(),
    index: z.string(),
    generation: z.string(),
    mode: z.enum(['query', 'search', 'vsearch']),
    profile: z.string(),
    candidate_limit: z.literal(200),
    exhaustive: z.literal(false),
    truncated: z.boolean(),
    source_store_declared: z.boolean(),
    source_store_binding_declared: z.boolean(),
    results: z
      .array(
        z
          .object({
            path: z.string(),
            title: z.string().max(256),
            snippet: z.string().max(1600),
            score: z.number().finite(),
            docid: z.string().regex(/^#[0-9a-f]{6}$/),
            line_start: z.number().int().positive(),
            line_end: z.number().int().positive(),
            mirror_content: z.enum(['extract', 'pointer', 'unknown']).nullable(),
            mirrors: z.string().nullable(),
            mirror_type: z.enum(['verbatim', 'annotated', 'summarised', 'indexed']).nullable(),
            mirror_sha256: z
              .string()
              .regex(/^[0-9a-fA-F]{64}$/)
              .nullable()
          })
          .strict()
          .refine((value) => value.line_end >= value.line_start)
      )
      .max(50)
  })
  .strict()
export type SearchResult = z.infer<typeof searchResultSchema>

export const searchKb = async (
  base: KnowledgeBase,
  request: SearchRequest,
  fetcher: typeof fetch = fetch
): Promise<SearchResult> => {
  let phase = 'configuration'
  try {
    searchRequestSchema.parse(request)
    const mapping = await loadSearchMapping(base)
    await currentSources(mapping)
    phase = 'models'
    await requireModels(mapping, request.mode, 'http')
    phase = 'daemon'
    if (!mapping.daemon_url) throw new Error('missing binding')
    const searches =
      request.mode === 'query'
        ? [
            { type: 'lex', query: request.query },
            { type: 'vec', query: request.query }
          ]
        : [{ type: request.mode === 'search' ? 'lex' : 'vec', query: request.query }]
    const raw = await boundedJson(fetcher, `${mapping.daemon_url}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        searches,
        collections: mapping.collections,
        limit: CANDIDATE_LIMIT,
        candidateLimit: CANDIDATE_LIMIT,
        rerank: request.mode === 'query'
      })
    })
    phase = 'results'
    if (!record(raw) || Object.keys(raw).join('|') !== 'results') throw new Error('invalid envelope')
    // Recheck both state authority and source bytes after the daemon returns.
    const current = await loadSearchMapping(base)
    if (JSON.stringify(current) !== JSON.stringify(mapping)) throw new Error('generation changed')
    return searchResultSchema.parse(
      authenticateResults(mapping, await currentSources(mapping), raw.results, request, 'http')
    )
  } catch {
    throw new Error(
      `KB search unavailable: ${phase}. Check the input or ask the operator to refresh/provision explicit search state.`
    )
  }
}
