/**
 * MCP result-envelope helpers.
 *
 * These belong to the thin `tools/` layer only: `main/` returns plain data (or
 * throws), and the tool handler maps that to an envelope here. Keeping the
 * helpers out of `main/` is what stops implementation code from knowing about
 * the MCP wire format.
 *
 * `jsonResult` sets `structuredContent` **and** serialises the same payload
 * into a text content block, so older clients that ignore `structuredContent`
 * still see the JSON. Every tool that calls it must declare a matching
 * `outputSchema` on registration (MCP spec 2026-07-28, §13 of the house
 * standard).
 *
 * Both helpers stamp `resultType: 'complete'`. Under the 2026-07-28 profile a
 * tool result is a discriminated union — a synchronous result must say it is
 * the whole answer rather than a partial or task-backed one — and every result
 * these tools produce is synchronous and complete. The v2 client validates the
 * discriminator on the wire and then lifts a complete result into the stable
 * `callTool` return shape, so callers never see it.
 */
import { errMessage } from './utils.js'

export const errorResult = (action: string, error: unknown) => {
  return {
    resultType: 'complete' as const,
    isError: true as const,
    content: [{ type: 'text' as const, text: `Error ${action}: ${errMessage(error)}` }]
  }
}

export const jsonResult = (payload: unknown) => {
  return {
    resultType: 'complete' as const,
    structuredContent: payload as Record<string, unknown>,
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }]
  }
}
