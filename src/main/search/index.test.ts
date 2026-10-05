import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stringify } from 'yaml'
import { loadConfig, selectKnowledgeBase } from '../../config/index.js'
import { ENGINE, modelPaths, sha256 } from '../../generated/kb-search/contract.js'
import { searchKb, searchResultSchema } from './index.js'

const race = vi.hoisted(() => ({ grown: false }))
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>()
  return {
    ...actual,
    readFile: async (...args: Parameters<typeof actual.readFile>) =>
      race.grown && String(args[0]).endsWith('/.owner') ? Buffer.alloc(129) : actual.readFile(...args)
  }
})
const roots: string[] = []
afterEach(() => {
  race.grown = false
  roots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true })
  })
})
const fixture = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'kb-search-')))
  roots.push(root)
  const kb = join(root, 'kb'),
    state = join(root, 'state'),
    cache = join(root, 'cache')
  const id = 'alpha',
    index = 'ki-kb-alpha',
    generation = 'first'
  const directory = join(state, 'search', id),
    gen = join(directory, 'generations', generation)
  const projection = join(gen, 'projection'),
    config = join(gen, 'config', `${index}.yml`),
    database = join(gen, 'index.sqlite')
  for (const dir of [kb, state, directory, join(projection, 'documents'), join(gen, 'config')])
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const declaration =
    '[skills.ki-repo]\nrepo_type = "kb"\nrepository = "https://github.com/fixture/alpha"\ntitle = "Alpha"\ndescription = "Synthetic Alpha"\nstore_roles = ["sources"]\n[skills.ki-repo-kb]\n[skills.ki-repo-kb.zones]\nPillars = "Knowledge"\n"+" = "Incoming"\n"-" = "Outgoing"\n'
  writeFileSync(join(kb, '.ki.toml'), declaration)
  mkdirSync(join(kb, 'Knowledge'))
  const path = 'Knowledge/Mixed Case Note.md',
    text = `---\nmirrors: alpha-sources/Records/Alpha.pdf\nmirror_type: summarised\nmirror_sha256: "${'a'.repeat(64)}"\n---\n# Real local title\n\nA local restoration answer belongs to Alpha. ${'durable fact '.repeat(30)}\n`
  writeFileSync(join(kb, path), text)
  const key = `documents/${sha256(path)}.md`
  writeFileSync(join(projection, key), text)
  writeFileSync(database, 'synthetic database fixture')
  writeFileSync(join(directory, '.owner'), 'ki/kb-search-owned/v1\n')
  const registry = `schema = 1\n[repositories.alpha]\nrepository = "https://github.com/fixture/alpha"\npath = ${JSON.stringify(kb)}\nsearch_boundary = "alpha-private"\n[repositories.alpha.stores]\nsources = "/nonexistent/synthetic-source-store"\n`
  writeFileSync(join(state, 'registry.toml'), registry)
  const mapping = {
    schema: 'ki/kb-search/v1',
    registry_id: id,
    repository: 'https://github.com/fixture/alpha',
    root: kb,
    trust_boundary: 'alpha-private',
    index,
    generation,
    engine: ENGINE,
    collections: [index],
    purpose: { title: 'Alpha', description: 'Synthetic Alpha' },
    zones: {
      Calendar: 'Calendar',
      Pillars: 'Knowledge',
      Resources: 'Resources',
      Streams: 'Streams',
      Admin: 'Admin',
      inbound: 'Incoming',
      outbound: 'Outgoing'
    },
    declaration_sha256: sha256(declaration),
    projection,
    config,
    database,
    model_cache: cache,
    daemon_url: 'http://127.0.0.1:12345',
    source_store_declared: true,
    source_store_binding_declared: true,
    documents: { [key]: { path, sha256: sha256(text) } }
  }
  const mappingFile = join(directory, 'mapping.json')
  const save = () => writeFileSync(mappingFile, JSON.stringify(mapping))
  save()
  writeFileSync(
    config,
    stringify({
      collections: {
        [index]: {
          path: projection,
          pattern: '**/*.md',
          context: { '/': 'Alpha: Synthetic Alpha' },
          includeByDefault: true
        }
      },
      models: modelPaths(cache)
    })
  )
  mkdirSync(join(cache, 'qmd/models'), { recursive: true })
  for (const file of Object.values(modelPaths(cache))) writeFileSync(file, 'synthetic model fixture, never loaded')
  const cfg = loadConfig({
    MCP_KI_KB_FS_KNOWLEDGE_BASES: JSON.stringify({ test: kb }),
    MCP_KI_KB_FS_SEARCH_BINDINGS: JSON.stringify({ test: { registry_id: id, state_directory: state } })
  })
  const base = selectKnowledgeBase(cfg, 'test')
  const candidate = {
    file: `qmd://${index}/${key}`,
    docid: `#${sha256(text).slice(0, 6)}`,
    score: 0.9,
    title: 'HOSTILE TITLE',
    snippet: 'FOREIGN SECRET',
    context: 'FOREIGN CONTEXT',
    line: 999999
  }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ results: [candidate] })))
  return { root, kb, state, cache, directory, mapping, mappingFile, save, path, text, key, candidate, base, fetcher }
}
const request = { query: 'restoration', mode: 'search' as const, limit: 5 }

describe('source-authenticated optional search', () => {
  it('uses current local text/custom zones and typed pinned requests, never backend offsets/text', async () => {
    const f = fixture()
    const result = await searchKb(f.base, { ...request, zone: 'Pillars', pathPrefix: 'Knowledge' }, f.fetcher)
    expect(result.results[0]).toMatchObject({
      path: f.path,
      title: 'Real local title',
      mirror_content: 'extract',
      line_start: 8,
      mirrors: 'alpha-sources/Records/Alpha.pdf'
    })
    expect(JSON.stringify(result)).not.toMatch(/HOSTILE|FOREIGN/)
    expect(result.results[0]?.snippet).toContain('local restoration')
    expect(result).toMatchObject({
      exhaustive: false,
      profile: 'http-lexical',
      source_store_declared: true,
      source_store_binding_declared: true
    })
    const init = f.fetcher.mock.calls[0]?.[1]
    expect(JSON.parse(String(init?.body))).toEqual({
      searches: [{ type: 'lex', query: 'restoration' }],
      collections: ['ki-kb-alpha'],
      limit: 200,
      candidateLimit: 200,
      rerank: false
    })
    expect(init?.redirect).toBe('error')
    expect(readFileSync(join(f.kb, f.path), 'utf8')).toBe(f.text)
  })
  it('supports vector and typed hybrid with already-existing models', async () => {
    for (const mode of ['vsearch', 'query'] as const) {
      const f = fixture()
      await searchKb(f.base, { ...request, mode }, f.fetcher)
      const sent = JSON.parse(String(f.fetcher.mock.calls[0]?.[1]?.body))
      expect(sent.searches.map((entry: { type: string }) => entry.type)).toEqual(
        mode === 'query' ? ['lex', 'vec'] : ['vec']
      )
      expect(sent.rerank).toBe(mode === 'query')
    }
  })
  it('fails missing models before contacting the daemon, while lexical needs none', async () => {
    const f = fixture()
    rmSync(f.cache, { recursive: true })
    await expect(searchKb(f.base, { ...request, mode: 'query' }, f.fetcher)).rejects.toThrow('models')
    expect(f.fetcher).not.toHaveBeenCalled()
    await expect(searchKb(f.base, request, f.fetcher)).resolves.toHaveProperty('results')
  })
  it('fails closed on all hostile URI/content identity envelopes', async () => {
    for (const patch of [
      { file: 'qmd://ki-kb-omega/documents/fake.md' },
      { file: `qmd://ki-kb-alpha/${'%2e%2e'}/private.md` },
      { docid: '#ffffff' },
      { score: null },
      { unexpected: 'FOREIGN SECRET' }
    ]) {
      const f = fixture()
      f.fetcher.mockResolvedValue(new Response(JSON.stringify({ results: [{ ...f.candidate, ...patch }] })))
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('results')
    }
  })
  it('rejects unavailable transport, redirects, oversized and malformed response shapes safely', async () => {
    for (const response of [
      new Response('', { status: 503 }),
      new Response('not json'),
      new Response('{}'),
      new Response('{"results":{}}'),
      new Response('secret', { headers: { 'content-length': '9999999' } })
    ]) {
      const f = fixture()
      f.fetcher.mockResolvedValue(response)
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('unavailable')
    }
    const f = fixture()
    f.fetcher.mockRejectedValue(new Error(`/private/secret ${request.query}`))
    await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('daemon')
  })
  it('refuses absent binding and missing endpoint without provisioning anything', async () => {
    const f = fixture()
    delete f.base.search
    await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
    expect(f.fetcher).not.toHaveBeenCalled()
    const other = fixture()
    other.mapping.daemon_url = null as unknown as string
    other.save()
    await expect(searchKb(other.base, request, other.fetcher)).rejects.toThrow('daemon')
  })
  it('calls the local protected-path policy before interpreting manifest contents', async () => {
    for (const documents of [
      null,
      { a: null },
      { a: { path: 4 } },
      { a: { path: 'Knowledge/.hidden.md' } },
      { a: { path: 'README.md' } }
    ]) {
      const f = fixture()
      writeFileSync(f.mappingFile, JSON.stringify({ ...f.mapping, documents }))
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
      expect(f.fetcher).not.toHaveBeenCalled()
    }
    const f = fixture()
    writeFileSync(f.mappingFile, 'null')
    await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
  })
  it('checks state/declaration/current source drift before retrieval', async () => {
    const changes = [
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.directory, '.owner'), 'wrong owner'),
      (f: ReturnType<typeof fixture>) => chmodSync(f.directory, 0o755),
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.kb, '.ki.toml'), 'changed declaration'),
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.kb, f.path), 'changed note'),
      (f: ReturnType<typeof fixture>) => writeFileSync(f.mapping.config, 'changed config'),
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.mapping.projection, f.key), 'changed projection'),
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.mapping.projection, 'extra.md'), 'unauthorized'),
      (f: ReturnType<typeof fixture>) =>
        writeFileSync(join(f.mapping.projection, 'documents', 'extra.md'), 'unauthorized'),
      (f: ReturnType<typeof fixture>) => {
        rmSync(f.mapping.database)
        mkdirSync(f.mapping.database)
      },
      (f: ReturnType<typeof fixture>) => {
        rmSync(join(f.kb, f.path))
        symlinkSync('/nonexistent/private-note', join(f.kb, f.path))
      },
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.kb, 'Knowledge', '.ki.toml'), 'new nested repository')
    ]
    for (const change of changes) {
      const f = fixture()
      change(f)
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
      expect(f.fetcher).not.toHaveBeenCalled()
    }
  })
  it('checks valid-looking contradictory authority and malformed state', async () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => {
        f.mapping.root = f.root
        f.save()
      },
      (f: ReturnType<typeof fixture>) => {
        f.mapping.trust_boundary = 'other'
        f.save()
      },
      (f: ReturnType<typeof fixture>) => {
        f.mapping.purpose.title = 'Other'
        f.save()
      },
      (f: ReturnType<typeof fixture>) => {
        f.mapping.zones.Pillars = 'Other'
        f.save()
      },
      (f: ReturnType<typeof fixture>) => {
        f.mapping.source_store_declared = false
        f.save()
      },
      (f: ReturnType<typeof fixture>) => {
        f.mapping.source_store_binding_declared = false
        f.save()
      },
      (f: ReturnType<typeof fixture>) => writeFileSync(f.mappingFile, 'invalid json'),
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.state, 'registry.toml'), 'schema = 2')
    ]) {
      const f = fixture()
      change(f)
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
      expect(f.fetcher).not.toHaveBeenCalled()
    }
  })
  it('revokes old zone authority even when a changed declaration digest is reblessed', async () => {
    for (const after of [false, true]) {
      const f = fixture()
      const revoke = () => {
        const declaration = readFileSync(join(f.kb, '.ki.toml'), 'utf8').replace(
          'Pillars = "Knowledge"',
          'Pillars = "RevokedKnowledge"'
        )
        writeFileSync(join(f.kb, '.ki.toml'), declaration)
        f.mapping.declaration_sha256 = sha256(declaration)
        f.save()
      }
      if (after)
        f.fetcher.mockImplementation(async () => {
          revoke()
          return new Response(JSON.stringify({ results: [f.candidate] }))
        })
      else revoke()
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow(after ? 'results' : 'configuration')
      expect(f.fetcher).toHaveBeenCalledTimes(after ? 1 : 0)
    }
    const f = fixture()
    f.base.zones.Pillars = 'OtherStartupZone'
    await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
    expect(f.fetcher).not.toHaveBeenCalled()
  })
  it('checks state and source again after the daemon and exposes no backend content', async () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.kb, f.path), 'changed while fetching'),
      (f: ReturnType<typeof fixture>) => {
        f.mapping.daemon_url = 'http://127.0.0.1:54321'
        f.save()
      }
    ]) {
      const f = fixture()
      f.fetcher.mockImplementation(async () => {
        change(f)
        return new Response(JSON.stringify({ results: [f.candidate] }))
      })
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('results')
    }
  })
  it('checks canonical-only search authority independently of legacy reader compatibility', async () => {
    for (const tail of ['\n[knowledgeislands-kb.zones]\nPillars = "Knowledge"\n', '\n']) {
      const f = fixture()
      let text = readFileSync(join(f.kb, '.ki.toml'), 'utf8')
      text = tail.trim() ? text + tail : text.replace('repo_type = "kb"', 'repo_type = "project"')
      writeFileSync(join(f.kb, '.ki.toml'), text)
      f.mapping.declaration_sha256 = sha256(text)
      f.save()
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
    }
  })

  it('rejects authority ambiguity, absent entries and malformed declarations before retrieval', async () => {
    for (const change of [
      (f: ReturnType<typeof fixture>) =>
        writeFileSync(
          join(f.state, 'registry.toml'),
          readFileSync(join(f.state, 'registry.toml'), 'utf8') +
            '\n[repositories.duplicate]\nrepository = "https://github.com/fixture/alpha"\npath = "/different/synthetic"\n'
        ),
      (f: ReturnType<typeof fixture>) =>
        writeFileSync(
          join(f.state, 'registry.toml'),
          readFileSync(join(f.state, 'registry.toml'), 'utf8').replace('search_boundary = "alpha-private"\n', '')
        ),
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.state, 'registry.toml'), 'schema = 1\n[repositories]\n'),
      (f: ReturnType<typeof fixture>) =>
        writeFileSync(
          join(f.state, 'registry.toml'),
          readFileSync(join(f.state, 'registry.toml'), 'utf8').replace(JSON.stringify(f.kb), JSON.stringify(f.root))
        ),
      (f: ReturnType<typeof fixture>) => {
        f.mapping.repository = 'https://github.com/fixture/other'
        f.save()
      },
      (f: ReturnType<typeof fixture>) => writeFileSync(join(f.directory, '.owner'), 'x'.repeat(129)),
      (f: ReturnType<typeof fixture>) => {
        rmSync(join(f.directory, '.owner'))
        mkdirSync(join(f.directory, '.owner'))
      },
      (_f: ReturnType<typeof fixture>) => {
        race.grown = true
      }
    ]) {
      const f = fixture()
      change(f)
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
      expect(f.fetcher).not.toHaveBeenCalled()
      race.grown = false
    }
    for (const declaration of [
      'title = "Not a KB"\n',
      '[skills.other]\nx = 1\n',
      '[skills.ki-repo]\nrepo_type = "kb"\nrepository = "https://github.com/fixture/alpha"\n[skills.ki-repo-kb]\n',
      '[skills.ki-repo]\nrepo_type = "kb"\nrepository = "https://github.com/fixture/other"\n[skills.ki-repo-kb]\n'
    ]) {
      const f = fixture()
      writeFileSync(join(f.kb, '.ki.toml'), declaration)
      f.mapping.declaration_sha256 = sha256(declaration)
      f.save()
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
    }
  })
  it('requires canonical repository identity even for empty synthetic indexes', async () => {
    for (const declaration of ['title = "No skills"\n', '[skills.ki-repo-kb]\n']) {
      const f = fixture()
      writeFileSync(join(f.kb, '.ki.toml'), declaration)
      f.mapping.declaration_sha256 = sha256(declaration)
      f.mapping.documents = {}
      rmSync(join(f.mapping.projection, f.key))
      const cfg = loadConfig({ MCP_KI_KB_FS_KNOWLEDGE_BASES: JSON.stringify({ test: f.kb }) })
      f.base.zones = selectKnowledgeBase(cfg, 'test').zones
      f.mapping.zones = { ...f.base.zones }
      f.save()
      await expect(searchKb(f.base, request, f.fetcher)).rejects.toThrow('configuration')
      expect(f.fetcher).not.toHaveBeenCalled()
    }
  })
  it('reads explicitly undeclared source-store metadata without touching any source store', async () => {
    const f = fixture()
    const declaration = readFileSync(join(f.kb, '.ki.toml'), 'utf8').replace('store_roles = ["sources"]\n', '')
    writeFileSync(join(f.kb, '.ki.toml'), declaration)
    f.mapping.declaration_sha256 = sha256(declaration)
    f.mapping.source_store_declared = false
    f.mapping.source_store_binding_declared = false
    f.save()
    writeFileSync(
      join(f.state, 'registry.toml'),
      readFileSync(join(f.state, 'registry.toml'), 'utf8').split('[repositories.alpha.stores]')[0] ?? ''
    )
    await expect(searchKb(f.base, request, f.fetcher)).resolves.toMatchObject({
      source_store_declared: false,
      source_store_binding_declared: false
    })
  })
  it('rejects invalid direct inputs and validates bounded output', async () => {
    const f = fixture()
    await expect(searchKb(f.base, { ...request, query: 'é'.repeat(600) }, f.fetcher)).rejects.toThrow('configuration')
    const result = await searchKb(f.base, request, f.fetcher)
    expect(searchResultSchema.safeParse({ ...result, extra: true }).success).toBe(false)
    expect(searchResultSchema.safeParse({ ...result, results: [{ ...result.results[0], line_end: 0 }] }).success).toBe(
      false
    )
    expect(
      searchResultSchema.safeParse({ ...result, results: [{ ...result.results[0], line_start: 10, line_end: 2 }] })
        .success
    ).toBe(false)
  })
})

it('vendored source has exact pinned upstream digests with only the declared import adaptation', () => {
  const directory = join(import.meta.dirname, '../../generated/kb-search')
  const receipt = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8'))
  expect(receipt.commit).toBe('d794bc9f2bb8fad7b20e390b3e8ec1c4f5617394')
  expect(receipt.files['contract.ts'].source_sha256).toBe(
    '5197d9b37a99784c7134966d32d37eb6d6700fc09663438b135307bf657b6100'
  )
  expect(receipt.files['source-mirrors.ts'].source_sha256).toBe(
    'df7e86d4d0cf3197f8d919d8a9624adab5b550b3eb36ab6cba5d5c7c83f6a6f9'
  )
  for (const [name, value] of Object.entries(receipt.files) as [
    string,
    { source_sha256: string; vendored_sha256: string }
  ][]) {
    const bytes = readFileSync(join(directory, name))
    expect(sha256(bytes)).toBe(value.vendored_sha256)
    expect(
      createHash('sha256')
        .update(bytes.toString('utf8').replace("'./source-mirrors.js'", "'./source-mirrors.ts'"))
        .digest('hex')
    ).toBe(value.source_sha256)
  }
})
