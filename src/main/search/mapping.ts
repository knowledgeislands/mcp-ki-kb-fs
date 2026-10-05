import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { parse } from 'smol-toml'
import { stringify } from 'yaml'
import { z } from 'zod'
import { type KnowledgeBase, resolveKiDeclaration } from '../../config/index.js'
import {
  assertOwnedPath,
  fail,
  modelPaths,
  record,
  SOURCE_BYTES,
  safeId,
  sha256,
  validateMapping
} from '../../generated/kb-search/contract.js'
import { isProtectedPath } from '../../utils/protected.js'
import { assertRealPathWithinRoot, resolveWithinRoot } from '../../utils/utils.js'

const registrySchema = z
  .object({
    schema: z.literal(1),
    repositories: z.record(
      z.string().refine(safeId),
      z
        .object({
          repository: z.string().regex(/^https:\/\/github\.com\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/),
          path: z.string().refine(isAbsolute),
          search_boundary: z.string().refine(safeId).optional(),
          stores: z
            .object({
              sources: z.string().refine(isAbsolute).optional(),
              legacy: z.string().refine(isAbsolute).optional()
            })
            .strict()
            .optional()
        })
        .strict()
    )
  })
  .strict()

const regular = async (file: string, max: number): Promise<Buffer> => {
  const stat = await lstat(file)
  if (!stat.isFile() || stat.size > max) return fail('unsafe state file')
  const bytes = await readFile(file)
  if (bytes.length > max) return fail('state file exceeded its bound')
  return bytes
}

/** Explicit owner-generated state only. Every operation here is a bounded read. */
export const loadSearchMapping = async (base: KnowledgeBase) => {
  if (!base.search) return fail('explicit search binding required')
  const { registryId: id, stateDirectory: state } = base.search
  const directory = join(state, 'search', id)
  const marker = join(directory, '.owner')
  const registryFile = join(state, 'registry.toml')
  const mappingFile = join(directory, 'mapping.json')
  for (const file of [directory, marker, registryFile, mappingFile]) await assertOwnedPath(state, file)
  if ((await lstat(directory)).mode & 0o077) return fail('search state must remain private')
  if ((await regular(marker, 128)).toString('utf8') !== 'ki/kb-search-owned/v1\n') return fail('unmanaged search state')
  const registry = registrySchema.parse(parse((await regular(registryFile, 4 * SOURCE_BYTES)).toString('utf8')))
  const entries = Object.values(registry.repositories)
  for (const field of ['repository', 'path', 'search_boundary'] as const) {
    const values = entries.map((entry) => entry[field]).filter((value) => value !== undefined)
    if (new Set(values).size !== values.length) return fail('ambiguous registry authority')
  }
  const entry = registry.repositories[id]
  const physicalRoot = await realpath(base.rootPath)
  if (!entry?.search_boundary || entry.path !== physicalRoot) return fail('registry root or boundary mismatch')
  const raw: unknown = JSON.parse((await regular(mappingFile, 4 * SOURCE_BYTES)).toString('utf8'))
  if (!record(raw) || !record(raw.documents)) return fail('invalid document inventory')
  for (const document of Object.values(raw.documents)) {
    if (!record(document) || typeof document.path !== 'string' || isProtectedPath(document.path))
      return fail('protected or malformed source path')
  }
  const mapping = validateMapping(raw, state, id)
  for (const document of Object.values(mapping.documents)) {
    await assertRealPathWithinRoot(physicalRoot, resolveWithinRoot(physicalRoot, document.path))
  }
  if (
    mapping.root !== physicalRoot ||
    mapping.repository !== entry.repository ||
    mapping.trust_boundary !== entry.search_boundary
  )
    return fail('mapping identity mismatch')
  const declaration = await regular(join(physicalRoot, '.ki.toml'), SOURCE_BYTES)
  if (sha256(declaration) !== mapping.declaration_sha256) return fail('declaration changed')
  const fresh = resolveKiDeclaration(declaration.toString('utf8'))
  if (
    Object.entries(fresh.zones).some(
      ([key, value]) => mapping.zones[key] !== value || base.zones[key as keyof typeof base.zones] !== value
    )
  )
    return fail('current canonical zones changed; restart and refresh explicit state')
  const parsed = parse(declaration.toString('utf8'))
  const skills = record(parsed.skills) ? parsed.skills : {}
  const repo = record(skills['ki-repo']) ? skills['ki-repo'] : {}
  const kb = skills['ki-repo-kb']
  const legacy = parsed['knowledgeislands-kb']
  if (
    !record(kb) ||
    repo.repo_type !== 'kb' ||
    repo.repository !== mapping.repository ||
    (record(legacy) && legacy.zones !== undefined)
  )
    return fail('canonical KB declaration required; migrate retired zones')
  if (
    mapping.purpose.title !== repo.title ||
    mapping.purpose.description !== repo.description ||
    Object.entries(base.zones).some(([key, value]) => mapping.zones[key] !== value) ||
    mapping.source_store_declared !== (Array.isArray(repo.store_roles) && repo.store_roles.includes('sources')) ||
    mapping.source_store_binding_declared !== (entry.stores?.sources !== undefined)
  )
    return fail('mapping declaration mismatch')
  for (const file of [mapping.projection, mapping.config, mapping.database]) await assertOwnedPath(state, file)
  const expected = stringify({
    collections: {
      [mapping.index]: {
        path: mapping.projection,
        pattern: '**/*.md',
        context: { '/': `${mapping.purpose.title}: ${mapping.purpose.description}` },
        includeByDefault: true
      }
    },
    models: modelPaths(mapping.model_cache)
  })
  if ((await regular(mapping.config, 65536)).toString('utf8') !== expected) return fail('derived config changed')
  if (!(await lstat(mapping.database)).isFile()) return fail('derived database missing')
  if ((await readdir(mapping.projection)).join('|') !== 'documents') return fail('projection changed')
  await assertOwnedPath(state, join(mapping.projection, 'documents'))
  if ((await readdir(join(mapping.projection, 'documents'))).length !== Object.keys(mapping.documents).length)
    return fail('projection inventory changed')
  for (const [key, document] of Object.entries(mapping.documents)) {
    const file = join(mapping.projection, key)
    await assertOwnedPath(state, file)
    if (sha256(await regular(file, SOURCE_BYTES)) !== document.sha256) return fail('projection content changed')
  }
  return mapping
}
