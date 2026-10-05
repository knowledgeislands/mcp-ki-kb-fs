import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig, selectKnowledgeBase } from './index.js'

const access = vi.hoisted(() => ({ unreadable: false }))
vi.mock('node:fs', async (original) => {
  const actual = await original<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (access.unreadable && String(args[0]).endsWith('.ki.toml')) throw new Error('synthetic unreadable file')
      return actual.readFileSync(...args)
    }
  }
})
const roots: string[] = []
afterEach(() => {
  access.unreadable = false
  roots.splice(0).forEach((root) => {
    fs.rmSync(root, { recursive: true, force: true })
  })
})
const fixture = () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'kb-config-'))
  roots.push(root)
  const env = { MCP_KI_KB_FS_KNOWLEDGE_BASES: JSON.stringify({ alpha: root }) }
  return { root, env, write: (toml: string) => fs.writeFileSync(join(root, '.ki.toml'), toml) }
}
describe('canonical zone reader migration', () => {
  it('resolves canonical quoted staging/custom paths and retains legacy allowlist and equal prior reader overrides', () => {
    const f = fixture()
    f.write(
      '[skills.ki-repo-kb.zones]\nPillars = "Knowledge"\n"+" = "Incoming"\n"-" = "Outgoing"\n[knowledgeislands-kb]\nroot_file_allowlist = ["README.md"]\n[knowledgeislands-kb.zones]\nPillars = "Knowledge"\n'
    )
    const base = selectKnowledgeBase(loadConfig(f.env), 'alpha')
    expect(base.zones).toMatchObject({ Pillars: 'Knowledge', inbound: 'Incoming', outbound: 'Outgoing' })
    expect(base.rootFileAllowlist).toEqual(['README.md'])
  })
  it('rejects conflict, malformed/unsafe/noncanonical/overlapping zones', () => {
    for (const declaration of [
      '[skills.ki-repo-kb]\nzones = 4',
      '[skills.ki-repo-kb.zones]\ninbound = "Incoming"',
      '[skills.ki-repo-kb.zones]\nPillars = 4',
      '[skills.ki-repo-kb.zones]\nPillars = "../private"',
      '[knowledgeislands-kb.zones]\nPillars = "../private"',
      '[skills.ki-repo-kb.zones]\nPillars = "Calendar/Child"',
      '[skills.ki-repo-kb.zones]\nPillars = "Knowledge"\n[knowledgeislands-kb.zones]\nPillars = "Areas"'
    ]) {
      const f = fixture()
      f.write(declaration)
      expect(() => loadConfig(f.env)).toThrow(/zones|zone/)
    }
  })
  it('preserves prior reader defaults when a confined declaration becomes unreadable', () => {
    const f = fixture()
    f.write('[skills.ki-repo-kb]')
    access.unreadable = true
    expect(selectKnowledgeBase(loadConfig(f.env), 'alpha').kiConfigRaw).toBeNull()
  })
  it('rejects unsafe declaration files before exposing bytes or parser messages', () => {
    for (const type of ['symlink', 'directory', 'oversize']) {
      const f = fixture(),
        declaration = join(f.root, '.ki.toml')
      if (type === 'symlink') {
        const target = join(f.root, 'outside.txt')
        fs.writeFileSync(target, 'PRIVATE PARSER ERROR [[')
        fs.symlinkSync(target, declaration)
      } else if (type === 'directory') fs.mkdirSync(declaration)
      else fs.writeFileSync(declaration, 'x'.repeat(1024 * 1024 + 1))
      expect(() => loadConfig(f.env)).toThrow('Unsafe .ki.toml declaration')
    }
  })
})
describe('explicit optional search binding', () => {
  it('binds only configured aliases to independent stable registry IDs and normal absolute state paths', () => {
    const f = fixture()
    const cfg = loadConfig({
      ...f.env,
      MCP_KI_KB_FS_SEARCH_BINDINGS: JSON.stringify({
        alpha: { registry_id: 'registry-alpha', state_directory: f.root }
      })
    })
    expect(selectKnowledgeBase(cfg, 'alpha').search).toEqual({ registryId: 'registry-alpha', stateDirectory: f.root })
    expect(
      selectKnowledgeBase(loadConfig({ ...f.env, MCP_KI_KB_FS_SEARCH_BINDINGS: '  ' }), 'alpha').search
    ).toBeUndefined()
  })
  it('rejects every malformed declaration and duplicate binding', () => {
    const f = fixture()
    for (const binding of [
      '{bad',
      'null',
      '[]',
      JSON.stringify({ undeclared: { registry_id: 'alpha', state_directory: f.root } }),
      JSON.stringify({ alpha: 4 }),
      JSON.stringify({ alpha: { registry_id: 'alpha', state_directory: f.root, extra: true } }),
      JSON.stringify({ alpha: { registry_id: 'bad ID', state_directory: f.root } }),
      JSON.stringify({ alpha: { registry_id: 'alpha', state_directory: 4 } }),
      JSON.stringify({ alpha: { registry_id: 'alpha', state_directory: 'relative' } }),
      JSON.stringify({ alpha: { registry_id: 'alpha', state_directory: `${f.root}/../state` } })
    ])
      expect(() => loadConfig({ ...f.env, MCP_KI_KB_FS_SEARCH_BINDINGS: binding })).toThrow(/binding|BINDINGS/)
    expect(() =>
      loadConfig({
        MCP_KI_KB_FS_KNOWLEDGE_BASES: JSON.stringify({ alpha: f.root, beta: f.root }),
        MCP_KI_KB_FS_SEARCH_BINDINGS: JSON.stringify({
          alpha: { registry_id: 'alpha', state_directory: f.root },
          beta: { registry_id: 'alpha', state_directory: f.root }
        })
      })
    ).toThrow('Duplicate search registry binding')
  })
})
