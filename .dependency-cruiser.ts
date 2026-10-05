import type { IConfiguration } from 'dependency-cruiser'

// Anchor every rule on an owned area so a resolved `.js` import and its `.ts`
// source are matched as the one module they are. The layers are the ones
// docs/guides/developer/architecture.md states: entry point, tools (wire
// surface), main (behaviour), utils and config beneath them, generated vendored.
const area = (...names: readonly string[]) => `^src/(${names.join('|')})(/|$)`
const file = (...paths: readonly string[]) => `^src/(${paths.join('|')})\\.ts$`
const product = '^src/'
const testFile = '\\.test\\.ts$'
const mcpSdk = '^node_modules/@modelcontextprotocol/'

const config: IConfiguration = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Every module has one dependency direction; a cycle makes its owner unclear.',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-unresolvable',
      comment: 'An unresolved import escapes every boundary rule and must never look like a clean graph.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    },
    {
      name: 'main-does-not-know-the-wire',
      comment:
        'Behaviour takes a selected KnowledgeBase, returns plain data and throws plain Errors; registration, the entry point and the MCP SDK stay above it.',
      severity: 'error',
      from: { path: area('main') },
      to: { path: [area('tools', 'mcp-server'), mcpSdk] }
    },
    {
      name: 'tool-shells-stay-thin',
      comment:
        'A tool registration declares its schema and calls main through an area index; it never reaches into behaviour internals or the path-containment and audit mechanics.',
      severity: 'error',
      from: { path: area('tools'), pathNot: testFile },
      to: {
        path: product,
        pathNot: file(
          'main/[^/]+/index',
          'config/index',
          'tools/shared',
          'tools/[^/]+/index',
          'utils/(annotations|results)',
          'generated/kb-search/contract'
        )
      }
    },
    {
      name: 'utils-stay-beneath-behaviour',
      comment:
        'Cross-cutting mechanics serve every layer, so they cannot depend on behaviour, tools or the entry point.',
      severity: 'error',
      from: { path: area('utils') },
      to: { path: area('main', 'tools', 'mcp-server') }
    },
    {
      name: 'config-stays-beneath-behaviour',
      comment:
        'Config defines and validates KnowledgeBase for every layer, so it cannot depend on the layers it feeds.',
      severity: 'error',
      from: { path: area('config') },
      to: { path: area('main', 'tools', 'mcp-server') }
    },
    {
      name: 'entry-point-is-not-a-library',
      comment:
        'The server entry point loads config and reads the environment at module scope; importing it would start a server.',
      severity: 'error',
      from: { path: product, pathNot: area('mcp-server') },
      to: { path: area('mcp-server') }
    },
    {
      name: 'generated-stays-vendored',
      comment:
        'Generated and vendored payloads are pinned by receipts and regenerated wholesale, so they cannot depend on hand-written source.',
      severity: 'error',
      from: { path: area('generated') },
      to: { path: product, pathNot: area('generated') }
    },
    {
      name: 'product-does-not-ship-the-dev-client',
      comment:
        'The mcporter client is codegen for development; mcporter is a devDependency the published server cannot load.',
      severity: 'error',
      from: { path: product, pathNot: [area('generated'), testFile] },
      to: { path: ['^src/generated/(client\\.ts|types\\.d\\.ts)$', '^node_modules/mcporter/'] }
    },
    {
      name: 'contract-suites-use-public-surfaces',
      comment:
        'Tool and cross-base contract suites prove behaviour through the published surfaces, never by reaching into implementation internals.',
      severity: 'error',
      from: { path: ['^src/tools/.+\\.test\\.ts$', '^src/main/files/(cross-base|repository-contract)\\.test\\.ts$'] },
      to: { path: product, pathNot: file('main/[^/]+/index', 'config/index', 'tools/[^/]+/index') }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.d.ts', '.json']
    }
  }
}

export default config
