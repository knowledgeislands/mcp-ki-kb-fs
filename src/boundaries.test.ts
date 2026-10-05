/**
 * Proves the layer boundaries in `.dependency-cruiser.ts` are enforced, and
 * that the checker is still reading this repository rather than agreeing with
 * an empty graph. dependency-cruiser supports TypeScript <7 only, so it runs
 * from its own install root (`tooling/boundaries`); against the repository's
 * TypeScript 7 it would cruise nothing and report nothing.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

type Dependency = Readonly<{ resolved: string; dependencyTypes?: readonly string[]; couldNotResolve?: boolean }>
type Cruise = Readonly<{
  modules: readonly Readonly<{ source: string; dependencies: readonly Dependency[] }>[]
  summary: Readonly<{ violations: readonly Readonly<{ rule: Readonly<{ name: string }>; from: string; to: string }>[] }>
}>

const root = resolve(import.meta.dirname, '..')
const tooling = join(root, 'tooling/boundaries')
const checker = join(tooling, 'node_modules/.bin/depcruise')
// Subprocess cruises need headroom on a busy shared host or under coverage.
const timeout = 30_000
// Close to the real product-source count, so a partial parse cannot pass.
const moduleFloor = 40

const cruise = (roots: readonly string[], directory = root): Cruise => {
  // depcruise exits non-zero on a violation; keep its JSON so negative cases
  // assert the named rule rather than only the exit status.
  try {
    return JSON.parse(
      execFileSync(
        process.execPath,
        [checker, '--config', '.dependency-cruiser.ts', '--output-type', 'json', ...roots],
        {
          cwd: directory,
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe']
        }
      )
    ) as Cruise
  } catch (error) {
    const output = (error as { stdout?: string }).stdout
    if (!output) throw error
    return JSON.parse(output) as Cruise
  }
}

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.isFile() && /\.ts$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [relative(root, path)] : []
  })

const temporary: string[] = []
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { force: true, recursive: true })
})

describe('enforced module boundaries (mcp-ki-kb-fs)', () => {
  it('runs on an isolated, supported TypeScript transpiler', () => {
    const transpilers = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          "import { getAvailableTranspilers } from 'dependency-cruiser'; console.log(JSON.stringify(getAvailableTranspilers()))"
        ],
        { cwd: tooling, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
    ) as { name: string; available: boolean }[]
    expect(transpilers).toContainEqual(expect.objectContaining({ name: 'typescript', available: true }))

    const isolated = JSON.parse(readFileSync(join(tooling, 'package.json'), 'utf8')) as {
      private?: boolean
      dependencies: Record<string, string>
    }
    const product = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
    }
    expect(isolated.private).toBe(true)
    expect(Object.keys(isolated.dependencies).sort()).toEqual(['dependency-cruiser', 'typescript'])
    expect(isolated.dependencies['dependency-cruiser']).toBe(product.devDependencies['dependency-cruiser'])
  })

  it(
    'cruises the complete, resolved product graph with no violations',
    () => {
      const graph = cruise(['src'])
      const owned = graph.modules.filter((module) => module.source.startsWith('src/'))
      const edges = owned.flatMap((module) =>
        module.dependencies.map((dependency) => ({ from: module.source, ...dependency }))
      )

      expect(owned.length).toBeGreaterThanOrEqual(moduleFloor)
      expect(sourceFiles(join(root, 'src')).filter((path) => !owned.some((module) => module.source === path))).toEqual(
        []
      )
      expect(edges.filter((edge) => edge.couldNotResolve)).toEqual([])
      expect(graph.summary.violations).toEqual([])

      // Type-only imports cross layers exactly as value imports do; a type-blind
      // parse would lose every one of these Config/KnowledgeBase edges.
      const typeOnlyCrossings = edges.filter(
        (edge) =>
          edge.resolved === 'src/config/index.ts' &&
          !edge.from.startsWith('src/config/') &&
          edge.dependencyTypes?.includes('type-only')
      )
      expect(typeOnlyCrossings.length).toBeGreaterThan(0)

      // A real tools -> main crossing resolves to the module, not a guess.
      expect(graph.modules.find((module) => module.source === 'src/tools/kb/index.ts')?.dependencies).toContainEqual(
        expect.objectContaining({ resolved: 'src/main/files/index.ts', couldNotResolve: false })
      )
    },
    timeout
  )

  // Each case is a deliberate violation in a private synthetic tree: the real
  // checkout stays read-only and every imported target is an actual TS module.
  it.each([
    ['src/main/files/probe.ts', 'src/tools/kb/index.ts', 'main-does-not-know-the-wire'],
    ['src/tools/kb/index.ts', 'src/main/files/etag.ts', 'tool-shells-stay-thin'],
    ['src/utils/probe.ts', 'src/main/files/index.ts', 'utils-stay-beneath-behaviour'],
    ['src/config/index.ts', 'src/main/config/index.ts', 'config-stays-beneath-behaviour'],
    ['src/probe.ts', 'src/mcp-server/index.ts', 'entry-point-is-not-a-library'],
    ['src/generated/kb-search/contract.ts', 'src/utils/utils.ts', 'generated-stays-vendored'],
    ['src/main/files/probe.ts', 'src/generated/client.ts', 'product-does-not-ship-the-dev-client'],
    ['src/tools/kb/index.test.ts', 'src/main/files/etag.ts', 'contract-suites-use-public-surfaces']
  ])(
    'reports %s -> %s as %s',
    (source, target, rule) => {
      const directory = mkdtempSync(join(tmpdir(), 'mcp-ki-kb-fs-boundaries-'))
      temporary.push(directory)
      writeFileSync(join(directory, '.dependency-cruiser.ts'), readFileSync(join(root, '.dependency-cruiser.ts')))
      writeFileSync(
        join(directory, 'tsconfig.json'),
        '{"compilerOptions":{"module":"NodeNext","moduleResolution":"NodeNext"}}'
      )
      mkdirSync(join(directory, source, '..'), { recursive: true })
      mkdirSync(join(directory, target, '..'), { recursive: true })
      writeFileSync(join(directory, target), 'export const fixture = true\n')
      const specifier = '../'.repeat(source.split('/').length - 1) + target.replace(/\.ts$/, '.js')
      writeFileSync(join(directory, source), `import '${specifier}'\n`)

      const graph = cruise([source], directory)
      expect(graph.modules.find((module) => module.source === source)?.dependencies).toContainEqual(
        expect.objectContaining({ resolved: target, couldNotResolve: false })
      )
      expect(graph.summary.violations.map((violation) => violation.rule.name)).toContain(rule)
    },
    timeout
  )
})
