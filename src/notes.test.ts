import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ROOT_PATH } from './config.js'
import { listFolders, listNotes, readNote, writeNote } from './notes.js'

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
    const result = await writeNote({ path: 'a.md', content: '# hello', create_dirs: true, dry_run: false })
    expect(result.content[0].text).toBe('Written: "a.md" (7 bytes)')
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'a.md'), 'utf-8')
    expect(onDisk).toBe('# hello')
  })

  it('creates parent directories when create_dirs is true', async () => {
    await writeNote({ path: 'sub/nested/deep.md', content: 'x', create_dirs: true, dry_run: false })
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'sub/nested/deep.md'), 'utf-8')
    expect(onDisk).toBe('x')
  })

  it('returns a friendly error when the parent dir is missing and create_dirs is false', async () => {
    const result = await writeNote({ path: 'missing/note.md', content: 'x', create_dirs: false, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found for: "missing/note.md"')
    expect(result.content[0].text).toContain('set create_dirs: true')
  })

  it('rejects path traversal', async () => {
    const result = await writeNote({ path: '../escape.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('overwrites an existing file', async () => {
    await writeNote({ path: 'over.md', content: 'first', create_dirs: true, dry_run: false })
    await writeNote({ path: 'over.md', content: 'second', create_dirs: true, dry_run: false })
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'over.md'), 'utf-8')
    expect(onDisk).toBe('second')
  })

  it('dry_run previews a new file without writing', async () => {
    const result = await writeNote({ path: 'preview.md', content: 'hello world', create_dirs: true, dry_run: true })
    expect(result.content[0].text).toBe('[dry_run] would create (11 bytes): "preview.md"')
    await expect(fs.access(path.join(ROOT_PATH, 'preview.md'))).rejects.toThrow()
  })

  it('dry_run previews an overwrite with both old and new byte counts', async () => {
    await writeNote({ path: 'doc.md', content: 'short', create_dirs: true, dry_run: false })
    const result = await writeNote({ path: 'doc.md', content: 'a much longer body', create_dirs: true, dry_run: true })
    expect(result.content[0].text).toBe('[dry_run] would overwrite (5 → 18 bytes): "doc.md"')
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'doc.md'), 'utf-8')
    expect(onDisk).toBe('short')
  })
})

describe('readNote', () => {
  it('reads an existing note', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'r.md'), 'content', 'utf-8')
    const result = await readNote({ path: 'r.md' })
    expect(result.content[0].text).toBe('content')
  })

  it('returns a friendly error for a missing file', async () => {
    const result = await readNote({ path: 'missing.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('File not found: "missing.md"')
    expect(result.content[0].text).toContain(`(root: ${ROOT_PATH})`)
  })

  it('rejects path traversal', async () => {
    const result = await readNote({ path: '../escape.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('listNotes', () => {
  it('returns "(no notes found)" for an empty directory', async () => {
    const result = await listNotes({ path: '', recursive: false })
    expect(result.content[0].text).toBe('(no notes found)')
  })

  it('lists .md files in the root', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'b.md'), 'b', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'note.txt'), 'ignored', 'utf-8')
    const result = await listNotes({ path: '', recursive: false })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['a.md', 'b.md'])
  })

  it('does not descend by default', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'top.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'sub/nested.md'), 'b', 'utf-8')
    const result = await listNotes({ path: '', recursive: false })
    expect(result.content[0].text).toBe('top.md')
  })

  it('descends when recursive is true', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'top.md'), 'a', 'utf-8')
    await fs.writeFile(path.join(ROOT_PATH, 'sub/nested.md'), 'b', 'utf-8')
    const result = await listNotes({ path: '', recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['sub/nested.md', 'top.md'])
  })

  it('lists notes inside a specified subdirectory', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'sub/inner.md'), 'a', 'utf-8')
    const result = await listNotes({ path: 'sub', recursive: false })
    expect(result.content[0].text).toBe('sub/inner.md')
  })

  it('returns a friendly error when the directory is missing', async () => {
    const result = await listNotes({ path: 'does-not-exist', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found: "does-not-exist"')
  })

  it('rejects path traversal', async () => {
    const result = await listNotes({ path: '../', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('listFolders', () => {
  it('returns "(no folders found)" for an empty directory', async () => {
    const result = await listFolders({ path: '', recursive: false })
    expect(result.content[0].text).toBe('(no folders found)')
  })

  it('lists immediate subfolders in the root and ignores files', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'a'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, 'b'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'note.md'), 'ignored', 'utf-8')
    const result = await listFolders({ path: '', recursive: false })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['a', 'b'])
  })

  it('does not descend by default', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'top/nested'), { recursive: true })
    const result = await listFolders({ path: '', recursive: false })
    expect(result.content[0].text).toBe('top')
  })

  it('descends when recursive is true', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'top/nested'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, 'sibling'), { recursive: true })
    const result = await listFolders({ path: '', recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['sibling', 'top', 'top/nested'])
  })

  it('lists folders inside a specified subdirectory', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub/inner'), { recursive: true })
    const result = await listFolders({ path: 'sub', recursive: false })
    expect(result.content[0].text).toBe('sub/inner')
  })

  it('returns a friendly error when the directory is missing', async () => {
    const result = await listFolders({ path: 'does-not-exist', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found: "does-not-exist"')
  })

  it('rejects path traversal', async () => {
    const result = await listFolders({ path: '../', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })
})

describe('protection: dotfiles and root-meta files', () => {
  it('readNote refuses root README.md', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'README.md'), 'secret', 'utf-8')
    const result = await readNote({ path: 'README.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected: "README.md"')
  })

  it('readNote refuses root CLAUDE.md', async () => {
    const result = await readNote({ path: 'CLAUDE.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('readNote refuses dotfiles at any depth', async () => {
    const r1 = await readNote({ path: '.env.md' })
    expect(r1.content[0].text).toContain('Path is protected')
    const r2 = await readNote({ path: 'sub/.hidden.md' })
    expect(r2.content[0].text).toContain('Path is protected')
  })

  it('readNote ALLOWS nested README.md (root-only meta rule)', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'archive'), { recursive: true })
    await fs.writeFile(path.join(ROOT_PATH, 'archive/README.md'), 'note', 'utf-8')
    const result = await readNote({ path: 'archive/README.md' })
    expect(result.content[0].text).toBe('note')
  })

  it('writeNote refuses root README.md', async () => {
    const result = await writeNote({ path: 'README.md', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('writeNote refuses dotdir paths', async () => {
    const result = await writeNote({ path: '.obsidian/foo.md', content: 'x', create_dirs: true, dry_run: false })
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

    const result = await listNotes({ path: '', recursive: true })
    const lines = result.content[0].text.split('\n').sort()
    expect(lines).toEqual(['archive/README.md', 'real.md'])
  })

  it('listFolders hides dotdirs', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'visible'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    await fs.mkdir(path.join(ROOT_PATH, '.obsidian/sub'), { recursive: true })

    const result = await listFolders({ path: '', recursive: true })
    expect(result.content[0].text).toBe('visible')
  })

  it('listNotes refuses to descend into a protected path argument', async () => {
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    const result = await listNotes({ path: '.git', recursive: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })
})

describe('protection: .md extension enforcement', () => {
  it('readNote refuses non-.md paths', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'note.txt'), 'x', 'utf-8')
    const result = await readNote({ path: 'note.txt' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('writeNote refuses non-.md paths', async () => {
    const result = await writeNote({ path: 'note.txt', content: 'x', create_dirs: true, dry_run: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Notes must end in ".md"')
  })

  it('readNote refuses a directory path', async () => {
    await fs.mkdir(path.join(ROOT_PATH, 'sub.md'), { recursive: true })
    const result = await readNote({ path: 'sub.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Not a note file')
  })
})

describe('path resolution hardening', () => {
  it('rejects deeply nested traversal that escapes root', async () => {
    const result = await readNote({ path: 'a/b/../../../escape.md' })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('rejects symlink escape via realpath check', async () => {
    const outside = path.join(ROOT_PATH, '..', 'kb-test-outside')
    await fs.mkdir(outside, { recursive: true })
    await fs.writeFile(path.join(outside, 'secret.md'), 'leaked', 'utf-8')
    try {
      await fs.symlink(outside, path.join(ROOT_PATH, 'leak'))
      const result = await readNote({ path: 'leak/secret.md' })
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
      const result = await writeNote({ path: 'leakdir/x.md', content: 'leaked', create_dirs: false, dry_run: false })
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

describe('error path coverage', () => {
  it('listFolders refuses a protected (dotdir) path argument', async () => {
    await fs.mkdir(path.join(ROOT_PATH, '.git'), { recursive: true })
    const result = await listFolders({ path: '.git', recursive: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path is protected')
  })

  it('listNotes rethrows non-ENOENT readdir errors (e.g. ENOTDIR when target is a file)', async () => {
    await fs.writeFile(path.join(ROOT_PATH, 'a.md'), 'x', 'utf-8')
    const result = await listNotes({ path: 'a.md', recursive: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    // ENOTDIR bubbles up as the generic "Error listing notes:" wrapper, not
    // the friendly ENOENT-only "Directory not found" message in readEntries.
    expect(result.content[0].text).toContain('Error listing notes:')
  })
})
