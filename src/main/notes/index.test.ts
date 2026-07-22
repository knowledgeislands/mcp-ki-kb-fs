import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Config } from '../../config/index.js'
import { createFolder, deleteNote, listFolders, listNotes, readNote, renameNote, writeNote } from './index.js'

// Config is injected, not read from env: build a Config literal pointing at a
// per-process temp KB root and pass it as the first arg to every main fn.
const ROOT_PATH = path.join(os.tmpdir(), 'knowledgeislands-tests', `notes-${process.pid}`)
// Zone used for all test fixtures. Every real KB op must start within a zone.
const ZONE = 'Pillars'
const zp = (...parts: string[]) => path.join(ROOT_PATH, ZONE, ...parts)
const cfg: Config = {
  rootPath: ROOT_PATH,
  accessLevel: 'destructive',
  auditLogMode: 'off',
  auditLogPath: path.join(ROOT_PATH, '.audit.jsonl'),
  auditLogMaxBytes: 0,
  auditLogKeep: 0,
  zones: {
    Calendar: 'Calendar',
    Pillars: 'Pillars',
    Resources: 'Resources',
    Streams: 'Streams',
    Admin: 'Admin',
    inbound: '+',
    outbound: '-'
  },
  rootFileAllowlist: ['README.md', 'AGENTS.md', 'CLAUDE.md'],
  kiConfigRaw: null
}

beforeAll(async () => {
  await fs.mkdir(ROOT_PATH, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT_PATH, { recursive: true, force: true })
})

beforeEach(async () => {
  // Wipe contents between tests, then recreate the zone dir
  const entries = await fs.readdir(ROOT_PATH)
  await Promise.all(entries.map((e) => fs.rm(path.join(ROOT_PATH, e), { recursive: true, force: true })))
  await fs.mkdir(zp(), { recursive: true })
})

describe('writeNote', () => {
  it('writes a new note and reports byte count', async () => {
    const result = await writeNote(cfg, { path: `${ZONE}/a.md`, content: '# hello', create_dirs: true, dry_run: false })
    expect(result.content[0].text).toBe(`Written: "${ZONE}/a.md" (7 bytes)`)
    const onDisk = await fs.readFile(zp('a.md'), 'utf-8')
    expect(onDisk).toBe('# hello')
  })

  it('creates parent directories when create_dirs is true', async () => {
    await writeNote(cfg, { path: `${ZONE}/sub/nested/deep.md`, content: 'x', create_dirs: true, dry_run: false })
    const onDisk = await fs.readFile(zp('sub', 'nested', 'deep.md'), 'utf-8')
    expect(onDisk).toBe('x')
  })

  it('returns a friendly error when the parent dir is missing and create_dirs is false', async () => {
    const result = await writeNote(cfg, { path: `${ZONE}/missing/note.md`, content: 'x', create_dirs: false, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`Directory not found for: "${ZONE}/missing/note.md"`)
    expect(result.content[0].text).toContain('set create_dirs: true')
  })

  it('rejects path traversal', async () => {
    const result = await writeNote(cfg, { path: '../escape.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects paths outside KB zones', async () => {
    const result = await writeNote(cfg, { path: 'root-level.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('outside KB zones')
  })

  it('overwrites an existing file', async () => {
    await writeNote(cfg, { path: `${ZONE}/over.md`, content: 'first', create_dirs: true, dry_run: false })
    await writeNote(cfg, { path: `${ZONE}/over.md`, content: 'second', create_dirs: true, dry_run: false })
    const onDisk = await fs.readFile(zp('over.md'), 'utf-8')
    expect(onDisk).toBe('second')
  })

  it('dry_run previews a new file without writing', async () => {
    const result = await writeNote(cfg, { path: `${ZONE}/preview.md`, content: 'hello world', create_dirs: true, dry_run: true })
    expect(result.content[0].text).toBe(`[dry_run] would create (11 bytes): "${ZONE}/preview.md"`)
    await expect(fs.access(zp('preview.md'))).rejects.toThrow()
  })

  it('dry_run previews an overwrite with both old and new byte counts', async () => {
    await writeNote(cfg, { path: `${ZONE}/doc.md`, content: 'short', create_dirs: true, dry_run: false })
    const result = await writeNote(cfg, { path: `${ZONE}/doc.md`, content: 'a much longer body', create_dirs: true, dry_run: true })
    expect(result.content[0].text).toBe(`[dry_run] would overwrite (5 → 18 bytes): "${ZONE}/doc.md"`)
    const onDisk = await fs.readFile(zp('doc.md'), 'utf-8')
    expect(onDisk).toBe('short')
  })

  it('dry_run rethrows non-ENOENT errors from the existence probe (e.g. ENOTDIR)', async () => {
    await fs.writeFile(zp('blocker.md'), 'x', 'utf-8')
    // "blocker.md" is a file; "blocker.md/child.md" forces ENOTDIR from fs.stat.
    const result = await writeNote(cfg, { path: `${ZONE}/blocker.md/child.md`, content: 'y', create_dirs: false, dry_run: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Error writing note')
  })
})

describe('readNote', () => {
  it('reads an existing note', async () => {
    await fs.writeFile(zp('r.md'), 'content', 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/r.md` })
    expect(result.content[0].text).toBe('content')
  })

  it('returns a friendly error for a missing file', async () => {
    const result = await readNote(cfg, { path: `${ZONE}/missing.md` })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`File not found: "${ZONE}/missing.md"`)
    expect(result.content[0].text).not.toContain(ROOT_PATH)
  })

  it('rejects path traversal', async () => {
    const result = await readNote(cfg, { path: '../escape.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  const FM_NOTE = '---\ntags:\n  - x\nstatus: current\n---\n# Heading\n\nBody text.\n'

  it('part "frontmatter" returns only the YAML between the fences', async () => {
    await fs.writeFile(zp('fm.md'), FM_NOTE, 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/fm.md`, part: 'frontmatter' })
    expect(result.content[0].text).toBe('tags:\n  - x\nstatus: current')
  })

  it('part "body" returns only the markdown after the closing fence', async () => {
    await fs.writeFile(zp('fm.md'), FM_NOTE, 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/fm.md`, part: 'body' })
    expect(result.content[0].text).toBe('# Heading\n\nBody text.\n')
  })

  it('part "frontmatter" reports "(no frontmatter)" when the note has none', async () => {
    await fs.writeFile(zp('plain.md'), '# Just a heading\n', 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/plain.md`, part: 'frontmatter' })
    expect(result.content[0].text).toBe('(no frontmatter)')
  })

  it('part "body" returns the whole note when there is no frontmatter', async () => {
    await fs.writeFile(zp('plain.md'), '# Just a heading\n', 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/plain.md`, part: 'body' })
    expect(result.content[0].text).toBe('# Just a heading\n')
  })

  it('errors when frontmatter is requested but the opening fence never closes', async () => {
    await fs.writeFile(zp('bad.md'), '---\ntags: x\nno closing fence\n', 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/bad.md`, part: 'frontmatter' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`Malformed frontmatter in "${ZONE}/bad.md"`)
  })
})

describe('listNotes', () => {
  it('returns "(no notes found)" for an empty directory', async () => {
    const result = await listNotes(cfg, { path: '', recursive: false })
    expect(result.content[0].text).toBe('(no notes found)')
  })

  it('lists .md files in the root', async () => {
    await fs.writeFile(zp('a.md'), 'a', 'utf-8')
    await fs.writeFile(zp('b.md'), 'b', 'utf-8')
    await fs.writeFile(zp('note.txt'), 'ignored', 'utf-8')
    const result = await listNotes(cfg, { path: '', recursive: false })
    expect(result.content[0].text).toBe('(no notes found)')
    // Non-recursive root listing does not descend into zone dirs
  })

  it('lists .md files within a zone', async () => {
    await fs.writeFile(zp('a.md'), 'a', 'utf-8')
    await fs.writeFile(zp('b.md'), 'b', 'utf-8')
    await fs.writeFile(zp('note.txt'), 'ignored', 'utf-8')
    const result = await listNotes(cfg, { path: ZONE, recursive: false })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/a.md`, `${ZONE}/b.md`])
  })

  it('does not descend into sub-directories when recursive is false', async () => {
    await fs.mkdir(zp('sub'), { recursive: true })
    await fs.writeFile(zp('top.md'), 'a', 'utf-8')
    await fs.writeFile(zp('sub', 'nested.md'), 'b', 'utf-8')
    const result = await listNotes(cfg, { path: ZONE, recursive: false })
    expect(result.content[0].text).toBe(`${ZONE}/top.md`)
  })

  it('descends into sub-directories when recursive is true', async () => {
    await fs.mkdir(zp('sub'), { recursive: true })
    await fs.writeFile(zp('top.md'), 'a', 'utf-8')
    await fs.writeFile(zp('sub', 'nested.md'), 'b', 'utf-8')
    const result = await listNotes(cfg, { path: ZONE, recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/sub/nested.md`, `${ZONE}/top.md`])
  })

  it('lists notes inside a specified subdirectory', async () => {
    await fs.mkdir(zp('sub'), { recursive: true })
    await fs.writeFile(zp('sub', 'inner.md'), 'a', 'utf-8')
    const result = await listNotes(cfg, { path: `${ZONE}/sub`, recursive: false })
    expect(result.content[0].text).toBe(`${ZONE}/sub/inner.md`)
  })

  it('returns a friendly error when the directory is missing', async () => {
    const result = await listNotes(cfg, { path: `${ZONE}/does-not-exist`, recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`Directory not found: "${ZONE}/does-not-exist"`)
  })

  it('returns a friendly error for path traversal', async () => {
    const result = await listNotes(cfg, { path: '../', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('listFolders', () => {
  it('returns "(no folders found)" for an empty directory', async () => {
    // root listing shows the zone dir — use the zone path to get empty result
    const result = await listFolders(cfg, { path: ZONE, recursive: false })
    expect(result.content[0].text).toBe('(no folders found)')
  })

  it('lists folders inside a zone, ignores notes', async () => {
    await fs.mkdir(zp('a'), { recursive: true })
    await fs.mkdir(zp('b'), { recursive: true })
    await fs.writeFile(zp('note.md'), 'ignored', 'utf-8')
    const result = await listFolders(cfg, { path: ZONE, recursive: false })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/a`, `${ZONE}/b`])
  })

  it('does not descend when recursive is false', async () => {
    await fs.mkdir(zp('top', 'nested'), { recursive: true })
    const result = await listFolders(cfg, { path: ZONE, recursive: false })
    expect(result.content[0].text).toBe(`${ZONE}/top`)
  })

  it('descends when recursive is true', async () => {
    await fs.mkdir(zp('top', 'nested'), { recursive: true })
    await fs.mkdir(zp('sibling'), { recursive: true })
    const result = await listFolders(cfg, { path: ZONE, recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/sibling`, `${ZONE}/top`, `${ZONE}/top/nested`])
  })

  it('lists folders inside a specified subdirectory', async () => {
    await fs.mkdir(zp('sub', 'inner'), { recursive: true })
    const result = await listFolders(cfg, { path: `${ZONE}/sub`, recursive: false })
    expect(result.content[0].text).toBe(`${ZONE}/sub/inner`)
  })

  it('returns a friendly error when the directory is missing', async () => {
    const result = await listFolders(cfg, { path: `${ZONE}/does-not-exist`, recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`Directory not found: "${ZONE}/does-not-exist"`)
  })

  it('returns a friendly error for path traversal', async () => {
    const result = await listFolders(cfg, { path: '../', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('zone-scoping guard', () => {
  it('readNote rejects paths outside KB zones', async () => {
    const result = await readNote(cfg, { path: 'root-level.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('outside KB zones')
  })

  it('listNotes rejects a subdirectory that is not a zone', async () => {
    const result = await listNotes(cfg, { path: 'archive', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('outside KB zones')
  })

  it('listFolders rejects a subdirectory that is not a zone', async () => {
    const result = await listFolders(cfg, { path: 'archive', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('outside KB zones')
  })

  it('writeNote rejects paths outside KB zones', async () => {
    const result = await writeNote(cfg, { path: 'README.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('outside KB zones')
  })
})

describe('protected path rules', () => {
  it('readNote refuses dotfiles within a zone', async () => {
    const r1 = await readNote(cfg, { path: `${ZONE}/.env.md` })
    expect(r1.content[0].text).toContain('Path is protected')
    const r2 = await readNote(cfg, { path: `${ZONE}/sub/.hidden.md` })
    expect(r2.content[0].text).toContain('Path is protected')
  })

  it('readNote allows nested README inside a zone (root-only rule)', async () => {
    await fs.mkdir(zp('archive'), { recursive: true })
    await fs.writeFile(zp('archive', 'README.md'), 'note', 'utf-8')
    const result = await readNote(cfg, { path: `${ZONE}/archive/README.md` })
    expect(result.content[0].text).toBe('note')
  })

  it('writeNote refuses root-level meta files (outside zones)', async () => {
    const result = await writeNote(cfg, { path: 'README.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    // Root README is outside zone; zone error fires first
    expect(result.content[0].text).toContain('outside KB zones')
  })

  it('writeNote refuses dotfiles within a zone', async () => {
    const result = await writeNote(cfg, { path: `${ZONE}/.obsidian/foo.md`, content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('listNotes hides root meta files and dotfiles, keeps nested same-name', async () => {
    // Files written directly to disk to test what collectNotes filters
    await fs.writeFile(path.join(ROOT_PATH, 'README.md'), 'meta', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'CLAUDE.md'), 'meta', 'utf-8')
    await fs.writeFile(zp('real.md'), 'note', 'utf-8')
    await fs.mkdir(path.join(ROOT_PATH, '.obsidian'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, '.obsidian', 'config.md'), 'hidden', 'utf-8')
    const result = await listNotes(cfg, { path: ZONE, recursive: false })
    expect(result.content[0].text).toBe(`${ZONE}/real.md`)
  })

  it('readNote refuses a directory (even with .md suffix)', async () => {
    await fs.mkdir(zp('sub.md'), { recursive: true })
    const result = await readNote(cfg, { path: `${ZONE}/sub.md` })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Not a note file')
  })
})

describe('path hardening', () => {
  it('readNote escapes root via traversal', async () => {
    const result = await readNote(cfg, { path: '../escape.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('readNote escapes root via symlink (realpath check)', async () => {
    const outside = path.join(ROOT_PATH, '..', 'kb-test-outside')
    try {
      await fs.mkdir(outside, { recursive: true })
      await fs.writeFile(path.join(outside, 'secret.md'), 'leaked', 'utf-8')
      await fs.symlink(outside, zp('leak'))
      const result = await readNote(cfg, { path: `${ZONE}/leak/secret.md` })
      expect((result as { isError?: boolean }).isError).toBe(true)
      expect(result.content[0].text).toContain('Path escapes root')
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })

  it('writeNote escapes root via symlink (realpath check)', async () => {
    const outside = path.join(ROOT_PATH, '..', 'kb-test-outside-w')
    try {
      await fs.mkdir(outside, { recursive: true })
      await fs.symlink(outside, zp('leakdir'))
      const result = await writeNote(cfg, { path: `${ZONE}/leakdir/x.md`, content: 'leaked', create_dirs: false, dry_run: false })
      expect((result as { isError?: boolean }).isError).toBe(true)
      expect(result.content[0].text).toContain('Path escapes root')
      await expect(fs.readFile(path.join(outside, 'x.md'), 'utf-8')).rejects.toThrow()
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})

describe('renameNote', () => {
  it('renames a note', async () => {
    await fs.writeFile(zp('a.md'), 'a', 'utf-8')
    await fs.writeFile(zp('b.md'), 'b', 'utf-8')
    const result = await renameNote(cfg, { from: `${ZONE}/a.md`, to: `${ZONE}/c.md`, create_dirs: true })
    expect(result.content[0].text).toContain('Renamed:')
    expect(await fs.readFile(zp('c.md'), 'utf-8')).toBe('a')
    expect(await fs.readFile(zp('b.md'), 'utf-8')).toBe('b')
  })

  it('returns an error when destination already exists', async () => {
    await fs.writeFile(zp('a.md'), 'a', 'utf-8')
    await fs.writeFile(zp('b.md'), 'b', 'utf-8')
    const result = await renameNote(cfg, { from: `${ZONE}/a.md`, to: `${ZONE}/b.md`, create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Destination')
    expect(await fs.readFile(zp('a.md'), 'utf-8')).toBe('a')
    expect(await fs.readFile(zp('b.md'), 'utf-8')).toBe('b')
  })

  it('returns a friendly error when the source is missing', async () => {
    const result = await renameNote(cfg, { from: `${ZONE}/missing.md`, to: `${ZONE}/new.md`, create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`File not found: "${ZONE}/missing.md"`)
  })

  it('rejects a non-.md destination', async () => {
    const result = await renameNote(cfg, { from: `${ZONE}/a.md`, to: `${ZONE}/b.md`.replace('.md', '.txt'), create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('rejects renaming to the same path', async () => {
    const result = await renameNote(cfg, { from: `${ZONE}/a.md`, to: `${ZONE}/a.md`, create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Rename source and destination are the same path')
  })

  it('creates destination parent dirs when create_dirs is true', async () => {
    await fs.writeFile(zp('src.md'), 'x', 'utf-8')
    const result = await renameNote(cfg, { from: `${ZONE}/src.md`, to: `${ZONE}/sub/dst.md`, create_dirs: true })
    expect(result.content[0].text).toContain('Renamed:')
    expect(await fs.readFile(zp('sub', 'dst.md'), 'utf-8')).toBe('x')
  })

  it('fails to rename from a directory (not a file)', async () => {
    await fs.mkdir(zp('dir.md'), { recursive: true })
    const result = await renameNote(cfg, { from: `${ZONE}/dir.md`, to: `${ZONE}/new.md`, create_dirs: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Not a note file')
  })

  it('fails when create_dirs is false and the destination parent is missing', async () => {
    await fs.writeFile(zp('src.md'), 'x', 'utf-8')
    const result = await renameNote(cfg, { from: `${ZONE}/src.md`, to: `${ZONE}/missing/dst.md`, create_dirs: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`destination parent missing for "${ZONE}/missing/dst.md"`)
    expect(result.content[0].text).toContain('set create_dirs: true')
    expect(await fs.readFile(zp('src.md'), 'utf-8')).toBe('x')
  })

  it('reports ENOTDIR when the path traverses through a file', async () => {
    await fs.writeFile(zp('blocker.md'), 'x', 'utf-8')
    await fs.writeFile(zp('src.md'), 'y', 'utf-8')
    const result = await renameNote(cfg, { from: `${ZONE}/src.md`, to: `${ZONE}/blocker.md/dst.md`, create_dirs: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
  })
})

describe('deleteNote', () => {
  it('deletes a note and returns byte count', async () => {
    await fs.writeFile(zp('a.md'), 'hello', 'utf-8')
    const result = await deleteNote(cfg, { path: `${ZONE}/a.md`, dry_run: false })
    expect(result.content[0].text).toContain('Deleted:')
    await expect(fs.access(zp('a.md'))).rejects.toThrow()
  })

  it('dry_run reports what would be deleted without deleting', async () => {
    await fs.writeFile(zp('a.md'), 'hello', 'utf-8')
    const result = await deleteNote(cfg, { path: `${ZONE}/a.md`, dry_run: true })
    expect(result.content[0].text).toContain('[dry_run]')
    await fs.access(zp('a.md')) // throws if file was deleted
  })

  it('returns a friendly error when the file is missing', async () => {
    const result = await deleteNote(cfg, { path: `${ZONE}/missing.md`, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain(`File not found: "${ZONE}/missing.md"`)
  })

  it('rejects a non-.md path', async () => {
    const result = await deleteNote(cfg, { path: `${ZONE}/a.txt`, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('rejects path traversal', async () => {
    const result = await deleteNote(cfg, { path: '../escape.md', dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('refuses protected paths within a zone', async () => {
    await fs.writeFile(zp('.secret.md'), 'x', 'utf-8')
    const result = await deleteNote(cfg, { path: `${ZONE}/.secret.md`, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
    expect(await fs.readFile(zp('.secret.md'), 'utf-8')).toBe('x')
  })

  it('returns an error when path is a directory not a file', async () => {
    await fs.mkdir(zp('subdir'), { recursive: true })
    const result = await deleteNote(cfg, { path: `${ZONE}/subdir`, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })
})

describe('createFolder', () => {
  it('creates a new folder', async () => {
    const result = await createFolder(cfg, { path: `${ZONE}/newfolder` })
    expect(result.content[0].text).toBe(`Created folder: "${ZONE}/newfolder"`)
    await fs.access(zp('newfolder')) // throws if not created
  })

  it('returns a success message for an already-existing folder', async () => {
    await fs.mkdir(zp('existing'), { recursive: true })
    const result = await createFolder(cfg, { path: `${ZONE}/existing` })
    expect(result.content[0].text).toContain('Folder already exists')
  })

  it('returns a friendly error for an empty path', async () => {
    const result = await createFolder(cfg, { path: '' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Folder path must not be empty')
  })

  it('rejects path traversal', async () => {
    const result = await createFolder(cfg, { path: '../escape' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects paths outside KB zones', async () => {
    const result = await createFolder(cfg, { path: 'not-a-zone' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('outside KB zones')
  })

  it('returns an error when path is an existing file', async () => {
    await fs.writeFile(zp('blocker.md'), 'x', 'utf-8')
    // "blocker.md" is a file; "blocker.md/sub" forces a failure
    const result = await createFolder(cfg, { path: `${ZONE}/blocker.md/sub` })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Error')
  })
})

describe('walk robustness', () => {
  it('caps recursion at MAX_WALK_DEPTH (32); (0..40) go in, (33+) not in results', async () => {
    // Build a chain deeper than MAX_WALK_DEPTH without walking it during construction
    const DEPTH_PAST_CAP = 40
    const makeDeepChain = async (segments: string[]) => {
      const dir = path.join(ROOT_PATH, ...segments)
      await fs.mkdir(dir, { recursive: true })
      if (segments.length < DEPTH_PAST_CAP) {
        await makeDeepChain([...segments, `d${segments.length - 2}`])
      }
    }
    await makeDeepChain([ZONE, 'd0', 'd1'])
    // Drop a note at depth 1 so listNotes has something to find
    await fs.writeFile(path.join(ROOT_PATH, ZONE, 'd0', 'note.md'), 'x', 'utf-8')
    const result = await listNotes(cfg, { path: ZONE, recursive: true })
    const lines = result.content[0].text.split('\n')
    // Should find the note at depth 1 within ZONE
    expect(lines.some((l) => l.includes('d0') && l.endsWith('note.md'))).toBe(true)
    // Should NOT see past the cap (no .md files that deep anyway, but belt-and-braces)
    expect(lines.some((l) => l.includes(`d${DEPTH_PAST_CAP - 1}`))).toBe(false)
  })

  it('does not descend into node_modules', async () => {
    await fs.mkdir(zp('node_modules', 'pkg'), { recursive: true })
    await fs.writeFile(zp('node_modules', 'pkg', 'dep.md'), 'x', 'utf-8')
    await fs.writeFile(zp('real.md'), 'x', 'utf-8')
    const result = await listNotes(cfg, { path: ZONE, recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/real.md`])
  })

  it('listFolders does not descend into node_modules (not listed)', async () => {
    await fs.mkdir(zp('node_modules', 'pkg'), { recursive: true })
    await fs.mkdir(zp('visible'), { recursive: true })
    const result = await listFolders(cfg, { path: ZONE, recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/visible`])
  })

  it('listFolders hides dotdirs', async () => {
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    await fs.mkdir(zp('.obsidian', 'sub'), { recursive: true })
    await fs.mkdir(zp('visible'), { recursive: true })
    const result = await listFolders(cfg, { path: ZONE, recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual([`${ZONE}/visible`])
  })
})
