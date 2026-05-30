import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Config } from '../../config/index.js'
import { createFolder, deleteNote, listFolders, listNotes, readNote, renameNote, writeNote } from './index.js'

// Config is injected, not read from env: build a Config literal pointing at a
// per-process temp KB root and pass it as the first arg to every main fn.
const ROOT_PATH = path.join(os.tmpdir(), 'knowledgeislands-tests', `notes-${process.pid}`)
const cfg: Config = {
  rootPath: ROOT_PATH,
  accessLevel: 'destructive',
  auditLogMode: 'off',
  auditLogPath: path.join(ROOT_PATH, '.audit.jsonl'),
  auditLogMaxBytes: 0,
  auditLogKeep: 0
}

beforeAll(async () => {
  await fs.mkdir(ROOT_PATH, { recursive: true })
})

afterAll(async () => {
  await fs.rm(ROOT_PATH, { recursive: true, force: true })
})

beforeEach(async () => {
  // Wipe the contents between tests for isolation
  const entries = await fs.readdir(ROOT_PATH)
  await Promise.all(entries.map((e) => fs.rm(path.join(ROOT_PATH, e), { recursive: true, force: true })))
})

describe('writeNote', () => {
  it('writes a new note and reports byte count', async () => {
    const result = await writeNote(cfg, { path: 'a.md', content: '# hello', create_dirs: true, dry_run: false })
    expect(result.content[0].text).toBe('Written: "a.md" (7 bytes)')
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'a.md'), 'utf-8')
    expect(onDisk).toBe('# hello')
  })

  it('creates parent directories when create_dirs is true', async () => {
    await writeNote(cfg, { path: 'sub/nested/deep.md', content: 'x', create_dirs: true, dry_run: false })
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'sub/nested/deep.md'), 'utf-8')
    expect(onDisk).toBe('x')
  })

  it('returns a friendly error when the parent dir is missing and create_dirs is false', async () => {
    const result = await writeNote(cfg, { path: 'missing/note.md', content: 'x', create_dirs: false, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found for: "missing/note.md"')
    expect(result.content[0].text).toContain('set create_dirs: true')
  })

  it('rejects path traversal', async () => {
    const result = await writeNote(cfg, { path: '../escape.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('overwrites an existing file', async () => {
    await writeNote(cfg, { path: 'over.md', content: 'first', create_dirs: true, dry_run: false })
    await writeNote(cfg, { path: 'over.md', content: 'second', create_dirs: true, dry_run: false })
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'over.md'), 'utf-8')
    expect(onDisk).toBe('second')
  })

  it('dry_run previews a new file without writing', async () => {
    const result = await writeNote(cfg, { path: 'preview.md', content: 'hello world', create_dirs: true, dry_run: true })
    expect(result.content[0].text).toBe('[dry_run] would create (11 bytes): "preview.md"')
    await expect(fs.access(path.join(ROOT_PATH, 'preview.md'))).rejects.toThrow()
  })

  it('dry_run previews an overwrite with both old and new byte counts', async () => {
    await writeNote(cfg, { path: 'doc.md', content: 'short', create_dirs: true, dry_run: false })
    const result = await writeNote(cfg, { path: 'doc.md', content: 'a much longer body', create_dirs: true, dry_run: true })
    expect(result.content[0].text).toBe('[dry_run] would overwrite (5 → 18 bytes): "doc.md"')
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'doc.md'), 'utf-8')
    expect(onDisk).toBe('short')
  })

  it('dry_run rethrows non-ENOENT errors from the existence probe (e.g. ENOTDIR)', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'blocker.md'), 'x', 'utf-8')
    // "blocker.md" is a file; "blocker.md/child.md" forces ENOTDIR from fs.stat.
    const result = await writeNote(cfg, { path: 'blocker.md/child.md', content: 'y', create_dirs: false, dry_run: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Error writing note')
  })
})

describe('readNote', () => {
  it('reads an existing note', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'r.md'), 'content', 'utf-8')
    const result = await readNote(cfg, { path: 'r.md' })
    expect(result.content[0].text).toBe('content')
  })

  it('returns a friendly error for a missing file', async () => {
    const result = await readNote(cfg, { path: 'missing.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('File not found: "missing.md"')
    expect(result.content[0].text).toContain(`(root: ${ROOT_PATH})`)
  })

  it('rejects path traversal', async () => {
    const result = await readNote(cfg, { path: '../escape.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('listNotes', () => {
  it('returns "(no notes found)" for an empty directory', async () => {
    const result = await listNotes(cfg, { path: '', recursive: false })
    expect(result.content[0].text).toBe('(no notes found)')
  })

  it('lists .md files in the root', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'b.md'), 'b', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'note.txt'), 'ignored', 'utf-8')
    const result = await listNotes(cfg, { path: '', recursive: false })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['a.md', 'b.md'])
  })

  it('does not descend by default', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'top.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'sub/nested.md'), 'b', 'utf-8')
    const result = await listNotes(cfg, { path: '', recursive: false })
    expect(result.content[0].text).toBe('top.md')
  })

  it('descends when recursive is true', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'top.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'sub/nested.md'), 'b', 'utf-8')
    const result = await listNotes(cfg, { path: '', recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['sub/nested.md', 'top.md'])
  })

  it('lists notes inside a specified subdirectory', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'sub/inner.md'), 'a', 'utf-8')
    const result = await listNotes(cfg, { path: 'sub', recursive: false })
    expect(result.content[0].text).toBe('sub/inner.md')
  })

  it('returns a friendly error when the directory is missing', async () => {
    const result = await listNotes(cfg, { path: 'does-not-exist', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found: "does-not-exist"')
  })

  it('rejects path traversal', async () => {
    const result = await listNotes(cfg, { path: '../', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('listFolders', () => {
  it('returns "(no folders found)" for an empty directory', async () => {
    const result = await listFolders(cfg, { path: '', recursive: false })
    expect(result.content[0].text).toBe('(no folders found)')
  })

  it('lists immediate subfolders in the root and ignores files', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'a'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, 'b'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'note.md'), 'ignored', 'utf-8')
    const result = await listFolders(cfg, { path: '', recursive: false })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['a', 'b'])
  })

  it('does not descend by default', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'top/nested'), { recursive: true })
    const result = await listFolders(cfg, { path: '', recursive: false })
    expect(result.content[0].text).toBe('top')
  })

  it('descends when recursive is true', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'top/nested'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, 'sibling'), { recursive: true })
    const result = await listFolders(cfg, { path: '', recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['sibling', 'top', 'top/nested'])
  })

  it('lists folders inside a specified subdirectory', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub/inner'), { recursive: true })
    const result = await listFolders(cfg, { path: 'sub', recursive: false })
    expect(result.content[0].text).toBe('sub/inner')
  })

  it('returns a friendly error when the directory is missing', async () => {
    const result = await listFolders(cfg, { path: 'does-not-exist', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found: "does-not-exist"')
  })

  it('rejects path traversal', async () => {
    const result = await listFolders(cfg, { path: '../', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('protection: dotfiles and root-meta files', () => {
  it('readNote refuses root README.md', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'README.md'), 'secret', 'utf-8')
    const result = await readNote(cfg, { path: 'README.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected: "README.md"')
  })

  it('readNote refuses root CLAUDE.md', async () => {
    const result = await readNote(cfg, { path: 'CLAUDE.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('readNote refuses dotfiles at any depth', async () => {
    const r1 = await readNote(cfg, { path: '.env.md' })
    expect(r1.content[0].text).toContain('Path is protected')
    const r2 = await readNote(cfg, { path: 'sub/.hidden.md' })
    expect(r2.content[0].text).toContain('Path is protected')
  })

  it('readNote ALLOWS nested README.md (root-only meta rule)', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'archive'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'archive/README.md'), 'note', 'utf-8')
    const result = await readNote(cfg, { path: 'archive/README.md' })
    expect(result.content[0].text).toBe('note')
  })

  it('writeNote refuses root README.md', async () => {
    const result = await writeNote(cfg, { path: 'README.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('writeNote refuses dotdir paths', async () => {
    const result = await writeNote(cfg, { path: '.obsidian/foo.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('listNotes hides root meta files and dotfiles, keeps nested same-name', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'README.md'), 'meta', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'CLAUDE.md'), 'meta', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'real.md'), 'note', 'utf-8')
    await fs.mkdir(path.join(ROOT_PATH, '.obsidian'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, '.obsidian/config.md'), 'hidden', 'utf-8')
    await fs.mkdir(path.join(ROOT_PATH, 'archive'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'archive/README.md'), 'real readme', 'utf-8')

    const result = await listNotes(cfg, { path: '', recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['archive/README.md', 'real.md'])
  })

  it('listFolders hides dotdirs', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'visible'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, '.obsidian/sub'), { recursive: true })

    const result = await listFolders(cfg, { path: '', recursive: true })
    expect(result.content[0].text).toBe('visible')
  })

  it('listNotes refuses to descend into a protected path argument', async () => {
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    const result = await listNotes(cfg, { path: '.git', recursive: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })
})

describe('protection: .md extension enforcement', () => {
  it('readNote refuses non-.md paths', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'note.txt'), 'x', 'utf-8')
    const result = await readNote(cfg, { path: 'note.txt' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('writeNote refuses non-.md paths', async () => {
    const result = await writeNote(cfg, { path: 'note.txt', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('readNote refuses a directory path', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub.md'), { recursive: true })
    const result = await readNote(cfg, { path: 'sub.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Not a note file')
  })
})

describe('path resolution hardening', () => {
  it('rejects deeply nested traversal that escapes root', async () => {
    const result = await readNote(cfg, { path: 'a/b/../../../escape.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects symlink escape via realpath check', async () => {
    const outside = path.join(ROOT_PATH, '..', 'kb-test-outside')
    await fs.mkdir(outside, { recursive: true })
    await fs.writeFile(path.join(outside, 'secret.md'), 'leaked', 'utf-8')
    try {
      await fs.symlink(outside, path.join(ROOT_PATH, 'leak'))
      const result = await readNote(cfg, { path: 'leak/secret.md' })
      expect((result as { isError?: boolean }).isError).toBe(true)
      expect(result.content[0].text).toContain('Path escapes root')
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })

  it('rejects writeNote into a symlinked-out directory', async () => {
    const outside = path.join(ROOT_PATH, '..', 'kb-test-outside-w')
    await fs.mkdir(outside, { recursive: true })
    try {
      await fs.symlink(outside, path.join(ROOT_PATH, 'leakdir'))
      const result = await writeNote(cfg, { path: 'leakdir/x.md', content: 'leaked', create_dirs: false, dry_run: false })
      expect((result as { isError?: boolean }).isError).toBe(true)
      expect(result.content[0].text).toContain('Path escapes root')
      const exists = await fs
        .access(path.join(outside, 'x.md'))
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})

describe('renameNote', () => {
  it('renames a note to a new path', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'old.md'), 'content', 'utf-8')
    const result = await renameNote(cfg, { from: 'old.md', to: 'new.md', create_dirs: true })
    expect(result.content[0].text).toBe('Renamed: "old.md" → "new.md"')
    await expect(fs.access(path.join(ROOT_PATH, 'old.md'))).rejects.toThrow()
    expect(await fs.readFile(path.join(ROOT_PATH, 'new.md'), 'utf-8')).toBe('content')
  })

  it('moves a note into a subdirectory, creating it', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'top.md'), 'x', 'utf-8')
    const result = await renameNote(cfg, { from: 'top.md', to: 'sub/nested.md', create_dirs: true })
    expect(result.content[0].text).toBe('Renamed: "top.md" → "sub/nested.md"')
    expect(await fs.readFile(path.join(ROOT_PATH, 'sub/nested.md'), 'utf-8')).toBe('x')
  })

  it('refuses to overwrite an existing destination', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'b.md'), 'b', 'utf-8')
    const result = await renameNote(cfg, { from: 'a.md', to: 'b.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Destination already exists: "b.md"')
    expect(await fs.readFile(path.join(ROOT_PATH, 'a.md'), 'utf-8')).toBe('a')
    expect(await fs.readFile(path.join(ROOT_PATH, 'b.md'), 'utf-8')).toBe('b')
  })

  it('returns a friendly error when the source is missing', async () => {
    const result = await renameNote(cfg, { from: 'missing.md', to: 'new.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('File not found: "missing.md"')
  })

  it('rejects non-.md source', async () => {
    const result = await renameNote(cfg, { from: 'a.txt', to: 'b.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md": "a.txt"')
  })

  it('rejects non-.md destination', async () => {
    const result = await renameNote(cfg, { from: 'a.md', to: 'b.txt', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md": "b.txt"')
  })

  it('rejects path traversal in from', async () => {
    const result = await renameNote(cfg, { from: '../escape.md', to: 'ok.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects path traversal in to', async () => {
    const result = await renameNote(cfg, { from: 'ok.md', to: '../escape.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects protected destination (root README.md)', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'src.md'), 'x', 'utf-8')
    const result = await renameNote(cfg, { from: 'src.md', to: 'README.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected: "README.md"')
  })

  it('rejects protected source (root CLAUDE.md)', async () => {
    const result = await renameNote(cfg, { from: 'CLAUDE.md', to: 'safe.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected: "CLAUDE.md"')
  })

  it('rejects same source and destination', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'x', 'utf-8')
    const result = await renameNote(cfg, { from: 'a.md', to: 'a.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Rename source and destination are the same path')
  })

  it('rejects renaming a directory (not a file)', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'dir.md'), { recursive: true })
    const result = await renameNote(cfg, { from: 'dir.md', to: 'other.md', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Not a note file: "dir.md"')
  })

  it('fails when create_dirs is false and the destination parent is missing', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'src.md'), 'x', 'utf-8')
    const result = await renameNote(cfg, { from: 'src.md', to: 'missing/dst.md', create_dirs: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('destination parent missing for "missing/dst.md"')
    expect(result.content[0].text).toContain('set create_dirs: true')
    expect(await fs.readFile(path.join(ROOT_PATH, 'src.md'), 'utf-8')).toBe('x')
  })

  it('rethrows non-ENOENT errors from the destination existence probe (e.g. ENOTDIR)', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'src.md'), 'x', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'blocker.md'), 'y', 'utf-8')
    // "blocker.md" is a file; "blocker.md/child.md" forces ENOTDIR from fs.access.
    const result = await renameNote(cfg, { from: 'src.md', to: 'blocker.md/child.md', create_dirs: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Error renaming note')
  })
})

describe('deleteNote', () => {
  it('dry_run previews deletion without removing the file', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'doomed.md'), 'bye', 'utf-8')
    const result = await deleteNote(cfg, { path: 'doomed.md', dry_run: true })
    expect(result.content[0].text).toBe('[dry_run] would delete (3 bytes): "doomed.md"')
    expect(await fs.readFile(path.join(ROOT_PATH, 'doomed.md'), 'utf-8')).toBe('bye')
  })

  it('deletes a note when dry_run is false', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'goner.md'), 'gone', 'utf-8')
    const result = await deleteNote(cfg, { path: 'goner.md', dry_run: false })
    expect(result.content[0].text).toBe('Deleted: "goner.md" (4 bytes)')
    await expect(fs.access(path.join(ROOT_PATH, 'goner.md'))).rejects.toThrow()
  })

  it('returns a friendly error when the file is missing', async () => {
    const result = await deleteNote(cfg, { path: 'missing.md', dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('File not found: "missing.md"')
  })

  it('rejects non-.md paths', async () => {
    const result = await deleteNote(cfg, { path: 'note.txt', dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('rejects path traversal', async () => {
    const result = await deleteNote(cfg, { path: '../escape.md', dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('refuses protected root README.md', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'README.md'), 'x', 'utf-8')
    const result = await deleteNote(cfg, { path: 'README.md', dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
    expect(await fs.readFile(path.join(ROOT_PATH, 'README.md'), 'utf-8')).toBe('x')
  })

  it('refuses to delete a directory', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub.md'), { recursive: true })
    const result = await deleteNote(cfg, { path: 'sub.md', dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Not a note file: "sub.md"')
  })
})

describe('createFolder', () => {
  it('creates a new folder', async () => {
    const result = await createFolder(cfg, { path: 'fresh' })
    expect(result.content[0].text).toBe('Created folder: "fresh"')
    const stat = await fs.stat(path.join(ROOT_PATH, 'fresh'))
    expect(stat.isDirectory()).toBe(true)
  })

  it('creates nested folders (mkdir -p)', async () => {
    const result = await createFolder(cfg, { path: 'a/b/c' })
    expect(result.content[0].text).toBe('Created folder: "a/b/c"')
    const stat = await fs.stat(path.join(ROOT_PATH, 'a/b/c'))
    expect(stat.isDirectory()).toBe(true)
  })

  it('is idempotent — succeeds when the folder already exists', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'already'), { recursive: true })
    const result = await createFolder(cfg, { path: 'already' })
    expect(result.content[0].text).toBe('Folder already exists: "already"')
  })

  it('refuses when the path exists as a file', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'x', 'utf-8')
    const result = await createFolder(cfg, { path: 'a.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path exists as a file, not a folder')
  })

  it('rejects empty path', async () => {
    const result = await createFolder(cfg, { path: '' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Folder path must not be empty')
  })

  it('rejects path traversal', async () => {
    const result = await createFolder(cfg, { path: '../escape' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects protected dotdirs', async () => {
    const result = await createFolder(cfg, { path: '.git' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('rethrows non-ENOENT errors from the existence probe (e.g. ENOTDIR)', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'blocker.md'), 'x', 'utf-8')
    // "blocker.md" is a file; "blocker.md/sub" forces ENOTDIR from fs.stat.
    const result = await createFolder(cfg, { path: 'blocker.md/sub' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Error creating folder')
  })
})

describe('error path coverage', () => {
  it('listFolders refuses a protected (dotdir) path argument', async () => {
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    const result = await listFolders(cfg, { path: '.git', recursive: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('listNotes rethrows non-ENOENT readdir errors (e.g. ENOTDIR when target is a file)', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'x', 'utf-8')
    const result = await listNotes(cfg, { path: 'a.md', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    // ENOTDIR bubbles up as the generic "Error listing notes:" wrapper, not
    // the friendly ENOENT-only "Directory not found" message in readEntries.
    expect(result.content[0].text).toContain('Error listing notes:')
  })
})
