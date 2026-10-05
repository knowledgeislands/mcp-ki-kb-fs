import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { ENGINE, modelPaths, sha256 } from '../src/generated/kb-search/contract.js'

const fixture = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kb-search-')))

  const kb = join(root, 'kb'), state = join(root, 'state'), cache = join(root, 'cache')
  const id = 'alpha', index = 'ki-kb-alpha', generation = 'first'
  const directory = join(state, 'search', id), gen = join(directory, 'generations', generation)
  const projection = join(gen, 'projection'), config = join(gen, 'config', `${index}.yml`), database = join(gen, 'index.sqlite')
  for (const dir of [kb, state, directory, join(projection, 'documents'), join(gen, 'config')]) mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const declaration = '[skills.ki-repo]\nrepo_type = "kb"\nrepository = "https://github.com/fixture/alpha"\ntitle = "Alpha"\ndescription = "Synthetic Alpha"\nstore_roles = ["sources"]\n[skills.ki-repo-kb]\n[skills.ki-repo-kb.zones]\nPillars = "Knowledge"\n"+" = "Incoming"\n"-" = "Outgoing"\n'
  writeFileSync(join(kb, '.ki.toml'), declaration)
  mkdirSync(join(kb, 'Knowledge'))
  const path = 'Knowledge/Mixed Case Note.md', text = `---\nsource_path: Records/Alpha.pdf\nsource_sha256: "${'a'.repeat(64)}"\n---\n# Real local title\n\nA local restoration answer belongs to Alpha. ${'durable fact '.repeat(30)}\n`
  writeFileSync(join(kb, path), text)
  const key = `documents/${sha256(path)}.md`
  writeFileSync(join(projection, key), text)
  writeFileSync(database, 'synthetic database fixture')
  writeFileSync(join(directory, '.owner'), 'ki/kb-search-owned/v1\n')
  const registry = `schema = 1\n[repositories.alpha]\nrepository = "https://github.com/fixture/alpha"\npath = ${JSON.stringify(kb)}\nsearch_boundary = "alpha-private"\n[repositories.alpha.stores]\nsources = "/nonexistent/synthetic-source-store"\n`
  writeFileSync(join(state, 'registry.toml'), registry)
  const mapping = {
    schema: 'ki/kb-search/v1', registry_id: id, repository: 'https://github.com/fixture/alpha', root: kb,
    trust_boundary: 'alpha-private', index, generation, engine: ENGINE, collections: [index],
    purpose: { title: 'Alpha', description: 'Synthetic Alpha' },
    zones: { Calendar: 'Calendar', Pillars: 'Knowledge', Resources: 'Resources', Streams: 'Streams', Admin: 'Admin', inbound: 'Incoming', outbound: 'Outgoing' },
    declaration_sha256: sha256(declaration), projection, config, database, model_cache: cache,
    daemon_url: 'http://127.0.0.1:12345', source_store_declared: true, source_store_binding_declared: true,
    documents: { [key]: { path, sha256: sha256(text) } }
  }
  const mappingFile = join(directory, 'mapping.json')
  const save = () => writeFileSync(mappingFile, JSON.stringify(mapping))
  save()
  writeFileSync(config, stringify({ collections: { [index]: { path: projection, pattern: '**/*.md', context: { '/': 'Alpha: Synthetic Alpha' }, includeByDefault: true } }, models: modelPaths(cache) }))
  mkdirSync(join(cache, 'qmd/models'), { recursive: true })
  for (const file of Object.values(modelPaths(cache))) writeFileSync(file, 'synthetic model fixture, never loaded')
  const candidate = { file: `qmd://${index}/${key}`, docid: `#${sha256(text).slice(0, 6)}`, score: 0.9, title: 'HOSTILE TITLE', snippet: 'FOREIGN SECRET', context: 'FOREIGN CONTEXT', line: 999999 }
  return { root, kb, state, cache, directory, mapping, mappingFile, save, path, text, key, candidate }
}
const f = fixture()
let requests = 0
const daemon = createServer(async (req, res) => {
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  assert.equal(req.url, '/query'); assert.deepEqual(body.collections, ['ki-kb-alpha'])
  assert.equal(body.candidateLimit, 200); assert.equal(body.limit, 200); requests++
  res.setHeader('content-type', 'application/json')
  const bad = body.searches[0].query === 'backend-failure'
  res.end(JSON.stringify({ results: [{ ...f.candidate, ...(bad ? { file: 'qmd://ki-kb-omega/documents/foreign.md' } : {}) }] }))
})
await new Promise<void>((resolve) => daemon.listen(0, '127.0.0.1', resolve))
const address = daemon.address(); assert(address && typeof address !== 'string')
f.mapping.daemon_url = `http://127.0.0.1:${address.port}`; f.save()
const initial = new Map([join(f.kb, f.path), join(f.kb, '.ki.toml'), join(f.state, 'registry.toml'), f.mappingFile, f.mapping.config, f.mapping.database, join(f.mapping.projection, f.key)].map((path) => [path, readFileSync(path)]))
try {
  for (const era of ['modern', 'legacy'] as const) for (const mode of ['off', 'writes', 'all'] as const) {
    const audit = join(f.root, `${era}-${mode}.jsonl`)
    const client = new Client({ name: 'synthetic-search-smoke', version: '0.0.0' }, { capabilities: {}, ...(era === 'modern' ? { versionNegotiation: { mode: 'auto' as const } } : {}) })
    const transport = new StdioClientTransport({ command: 'node', args: ['dist/mcp-server/index.js'], stderr: 'pipe', env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin', MCP_KI_KB_FS_KNOWLEDGE_BASES: JSON.stringify({ alpha: f.kb }),
      MCP_KI_KB_FS_SEARCH_BINDINGS: JSON.stringify({ alpha: { registry_id: 'alpha', state_directory: f.state } }),
      MCP_KI_KB_FS_ACCESS_LEVEL: 'read', MCP_KI_KB_FS_AUDIT_LOG: mode, MCP_KI_KB_FS_AUDIT_LOG_PATH: audit, MCP_KI_KB_FS_AUDIT_LOG_MAX_BYTES: '0'
    } })
    await client.connect(transport)
    try {
      assert.equal(client.getProtocolEra(), era)
      const tools = (await client.listTools()).tools
      assert.deepEqual(tools.map((t) => t.name).sort(), ['kb_config', 'kb_list', 'kb_read', 'kb_search'])
      const search = tools.find((t) => t.name === 'kb_search'); assert(search); assert.equal(search.annotations?.readOnlyHint, true)
      assert.equal(search.inputSchema.additionalProperties, false); assert.equal(search.outputSchema?.additionalProperties, false)
      let calls = 0
      const call = async (args: Record<string, unknown>) => { calls++; return client.callTool({ name: 'kb_search', arguments: args }) }
      for (const searchMode of ['search', 'vsearch', 'query']) {
        const result = await call({ kb: 'alpha', query: 'SECRET /private/query.md restoration', mode: searchMode, zone: 'Pillars', path_prefix: 'Knowledge' })
        assert.notEqual(result.isError, true)
        const content = result.structuredContent as { results: { path: string; snippet: string; line_start: number }[] }
        assert.equal(content.results[0]?.path, f.path); assert.equal(content.results[0]?.line_start, 7)
        assert(!JSON.stringify(content).match(/HOSTILE|FOREIGN/))
      }
      for (const args of [{ kb: 'unknown', query: 'SECRET' }, { kb: 'alpha', query: 4 }, { kb: 'alpha', query: 'SECRET', extra: '/private/secret' }, { kb: 'alpha', query: 'SECRET', mode: 'invalid' }, { kb: 'alpha', query: 'SECRET', limit: 51 }, { kb: 'alpha', query: 'SECRET', path_prefix: '../private' }, { kb: 'alpha', query: 'é'.repeat(600) }, { kb: 'alpha', query: 'backend-failure', mode: 'search' }]) assert.equal((await call(args)).isError, true)
      if (mode === 'off') assert.equal(existsSync(audit), false)
      else {
        const raw = readFileSync(audit, 'utf8'); const events = raw.trim().split('\n').map((line) => JSON.parse(line))
        assert.equal(events.length, calls); assert.equal(events.filter((event) => event.ok).length, 3)
        assert(!raw.match(/SECRET|private|FOREIGN|HOSTILE|Mixed Case|Knowledge|backend-failure/))
      }
      for (const [path, bytes] of initial) assert.deepEqual(readFileSync(path), bytes)
    } finally { await client.close() }
  }
  assert.equal(requests, 24)
  console.error('✓ synthetic search smoke: compiled Node modern+legacy; strict read gate; lexical/vector/hybrid; custom zones; local citations; writes/all exact-once private audit; off; hostile backend rejection; canonical bytes unchanged')
} finally { await new Promise<void>((resolve, reject) => daemon.close((error) => error ? reject(error) : resolve())); rmSync(f.root, { recursive: true, force: true }) }
