#!/usr/bin/env node
// End-to-end smoke test: boot the built server over stdio MCP, list its tools,
// and assert the surface matches what the registration tests expect. Catches
// drift between code and the *wire* contract (registration tests cover the
// in-process registration call pattern; this covers the actual protocol round-trip).
//
// It is also the only place the protocol profile itself is proven. The SDK owns
// `server/discover`, protocol stamping and cache defaults, so there is no local
// literal to read in `src/`: the modern era, the negotiated revision and the
// complete result envelope are observable only from a live client, and the
// retained legacy fallback only from a second client that opens the old way.
//
// Run via `bun run ki:test:smoke` (builds dist/ first). Runs in CI without
// secrets: the only required env var is the knowledge-base declaration, which we
// point at two throwaway temp directories so startup validation passes without
// any real knowledge base on disk. Two, not one, so the wire surface is checked
// to carry a genuine multi-base selector rather than a single-valued one.

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

// Single source of truth for the tool surface — kept in sync with the
// registrations in `src/tools/`. If you add a tool, update both.
const EXPECTED_TOOLS = [
  'kb_config',
  'kb_delete',
  'kb_folder_create',
  'kb_list',
  'kb_read',
  'kb_rename',
  'kb_write'
] as const

const ALIASES = ['smoke-alpha', 'smoke-beta'] as const

const SERVER_NAME = 'mcp-ki-kb-fs'
const MODERN_PROTOCOL_VERSION = '2026-07-28'

const die = (msg: string, detail?: unknown): never => {
  console.error(`✗ smoke failed: ${msg}`)
  if (detail !== undefined) console.error(detail)
  process.exit(1)
}

const createTransport = (declaration: Record<string, string>): StdioClientTransport =>
  new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp-server/index.js'],
    // Raise the access level to `destructive` so the smoke test sees the full
    // surface; the server's default (read only) would otherwise hide every
    // mutating kb_* tool.
    env: {
      ...(process.env as Record<string, string>),
      MCP_KI_KB_FS_ACCESS_LEVEL: 'destructive',
      MCP_KI_KB_FS_KNOWLEDGE_BASES: JSON.stringify(declaration)
    }
  })

/** The wire-level tool contract, asserted against whichever era listed it. */
const assertToolSurface = (tools: { name: string; inputSchema?: unknown }[], era: string): void => {
  const names = tools.map((t) => t.name).sort()
  const expected = [...EXPECTED_TOOLS].sort()

  // Diff with clear messages so CI logs are actionable.
  const missing = expected.filter((n) => !names.includes(n))
  const extra = names.filter((n) => !expected.includes(n as (typeof EXPECTED_TOOLS)[number]))
  if (missing.length || extra.length) {
    die(`${era} tool surface mismatch`, { missing, extra, actualCount: names.length, expectedCount: expected.length })
  }

  // Sanity: every tool advertises an inputSchema object.
  const missingSchema = tools.filter((t) => !t.inputSchema || typeof t.inputSchema !== 'object').map((t) => t.name)
  if (missingSchema.length) die(`${era} tools missing inputSchema`, missingSchema)

  // The multi-base contract, checked on the wire rather than in-process: every
  // tool must REQUIRE `kb`, and advertise exactly the declared aliases as its
  // permitted values. A tool that let `kb` default, or accepted a free-form
  // string, would pass the checks above and fail here.
  for (const tool of tools) {
    const schema = tool.inputSchema as { required?: unknown; properties?: Record<string, { enum?: unknown }> }
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    if (!required.includes('kb')) die(`${era}: ${tool.name} does not require a kb argument`, schema)

    const declared = schema.properties?.kb?.enum
    if (!Array.isArray(declared)) {
      die(`${era}: ${tool.name} does not advertise kb as an enum of declared aliases`, schema)
    }
    const advertised = [...(declared as string[])].sort()
    if (JSON.stringify(advertised) !== JSON.stringify([...ALIASES].sort())) {
      die(`${era}: ${tool.name} advertises the wrong kb aliases`, { advertised, expected: ALIASES })
    }
  }
}

const main = async (): Promise<void> => {
  const roots = ALIASES.map((alias) => fs.mkdtempSync(path.join(os.tmpdir(), `${alias}-`)))
  // One real zone directory per base, so the round trip below exercises a
  // successful result rather than a missing-directory error.
  for (const root of roots) fs.mkdirSync(path.join(root, 'Pillars'), { recursive: true })
  const declaration = Object.fromEntries(ALIASES.map((alias, index) => [alias, roots[index] as string]))

  // `versionNegotiation: { mode: 'auto' }` opens with `server/discover`, so this
  // client exercises the modern path the SDK now owns.
  const client = new Client(
    { name: 'mcp-kb-fs-smoke', version: '0.0.0' },
    { capabilities: {}, versionNegotiation: { mode: 'auto' } }
  )

  await client.connect(createTransport(declaration))

  try {
    const discovery = client.getDiscoverResult()
    if (client.getProtocolEra() !== 'modern') die('server/discover did not select the modern protocol era')
    if (client.getNegotiatedProtocolVersion() !== MODERN_PROTOCOL_VERSION) {
      die('unexpected negotiated protocol version', client.getNegotiatedProtocolVersion())
    }
    if (
      discovery?.resultType !== 'complete' ||
      !discovery.supportedVersions.includes(MODERN_PROTOCOL_VERSION) ||
      discovery._meta?.['io.modelcontextprotocol/serverInfo']?.name !== SERVER_NAME
    ) {
      die('invalid server/discover result', discovery)
    }

    const { tools } = await client.listTools()
    assertToolSurface(tools, 'modern')

    // A real round trip, not just discovery: the v2 client validates the
    // required wire-level `resultType` before lifting a complete result into the
    // stable callTool shape, so a helper that forgot the discriminator fails here.
    const listed = await client.callTool({ name: 'kb_list', arguments: { kb: ALIASES[0], path: 'Pillars' } })
    if (listed.isError) die('kb_list returned an error envelope', listed)
    if (!listed.structuredContent) die('kb_list returned no structuredContent', listed)

    // Argument validation is a tool-execution error in the envelope, never a
    // protocol error — that is what keeps the audit-log wrapper in the path.
    const malformed = await client.callTool({ name: 'kb_list', arguments: { kb: 'undeclared-base', path: 'Pillars' } })
    if (!malformed.isError) die('an undeclared kb alias was accepted', malformed)

    // The deliberate compatibility fallback: a client that opens with the legacy
    // `initialize` handshake is still served, from the same factory, with the
    // identical surface. Remove this assertion only when the fallback is
    // removed on purpose.
    const legacyClient = new Client({ name: 'mcp-kb-fs-legacy-smoke', version: '0.0.0' }, { capabilities: {} })
    await legacyClient.connect(createTransport(declaration))
    try {
      if (legacyClient.getProtocolEra() !== 'legacy') {
        die('legacy initialize fallback did not remain available', legacyClient.getProtocolEra())
      }
      assertToolSurface((await legacyClient.listTools()).tools, 'legacy')
    } finally {
      await legacyClient.close()
    }

    console.error(
      `✓ smoke passed: modern ${MODERN_PROTOCOL_VERSION} discovery, legacy fallback, ${tools.length} tools listed, all requiring kb ∈ {${ALIASES.join(', ')}}, complete result envelope`
    )
  } finally {
    await client.close()
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  }
}

main().catch((err) => die('uncaught', err))
