import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ROOT_PATH } from './config.js'
import { listNotes, readNote, writeNote } from './notes.js'

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
    const result = await writeNote({ path: 'a.md', content: '# hello', create_dirs: true })
    expect(result.content[0].text).toBe('Written: "a.md" (7 bytes)')
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'a.md'), 'utf-8')
    expect(onDisk).toBe('# hello')
  })

  it('creates parent directories when create_dirs is true', async () => {
    await writeNote({ path: 'sub/nested/deep.md', content: 'x', create_dirs: true })
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'sub/nested/deep.md'), 'utf-8')
    expect(onDisk).toBe('x')
  })

  it('returns a friendly error when the parent dir is missing and create_dirs is false', async () => {
    const result = await writeNote({ path: 'missing/note.md', content: 'x', create_dirs: false })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Directory not found for: "missing/note.md"')
    expect(result.content[0].text).toContain('set create_dirs: true')
  })

  it('rejects path traversal', async () => {
    const result = await writeNote({ path: '../escape.md', content: 'x', create_dirs: true })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0].text).toContain('Path escapes root')
  })

  it('overwrites an existing file', async () => {
    await writeNote({ path: 'over.md', content: 'first', create_dirs: true })
    await writeNote({ path: 'over.md', content: 'second', create_dirs: true })
    const onDisk = await fs.readFile(path.join(ROOT_PATH, 'over.md'), 'utf-8')
    expect(onDisk).toBe('second')
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
    const result = await readNote({ path: '../etc/passwd' })
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
