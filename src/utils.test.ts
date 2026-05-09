import { describe, expect, it } from 'vitest'
import { errorResult, isNodeError, jsonResult, resolveWithinRoot } from './utils.js'

describe('resolveWithinRoot', () => {
  const root = '/tmp/kb-root'

  it('resolves a simple relative path inside the root', () => {
    expect(resolveWithinRoot(root, 'note.md')).toBe('/tmp/kb-root/note.md')
  })

  it('resolves a nested relative path', () => {
    expect(resolveWithinRoot(root, 'sub/dir/note.md')).toBe('/tmp/kb-root/sub/dir/note.md')
  })

  it('strips a leading slash', () => {
    expect(resolveWithinRoot(root, '/note.md')).toBe('/tmp/kb-root/note.md')
  })

  it('normalises windows-style separators', () => {
    expect(resolveWithinRoot(root, 'sub\\dir\\note.md')).toBe('/tmp/kb-root/sub/dir/note.md')
  })

  it('returns the root itself when given an empty path', () => {
    expect(resolveWithinRoot(root, '')).toBe(root)
  })

  it('rejects path traversal via ..', () => {
    expect(() => resolveWithinRoot(root, '../escape.md')).toThrow(/Path escapes root/)
  })

  it('rejects an absolute path that resolves outside the root', () => {
    expect(() => resolveWithinRoot(root, '/../etc/passwd')).toThrow(/Path escapes root/)
  })

  it('rejects deeply nested traversal that escapes', () => {
    expect(() => resolveWithinRoot(root, 'a/b/../../../escape.md')).toThrow(/Path escapes root/)
  })

  it('handles a root that already ends with a separator', () => {
    expect(resolveWithinRoot('/tmp/kb-root/', 'note.md')).toBe('/tmp/kb-root/note.md')
  })
})

describe('errorResult', () => {
  it('builds the MCP error response shape', () => {
    expect(errorResult('something went wrong')).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'something went wrong' }]
    })
  })
})

describe('jsonResult', () => {
  it('serialises a payload to pretty JSON in a text block', () => {
    const result = jsonResult({ a: 1, b: 'two' })
    expect(result.content[0].type).toBe('text')
    expect(JSON.parse(result.content[0].text)).toEqual({ a: 1, b: 'two' })
  })
})

describe('isNodeError', () => {
  it('returns true for a node ENOENT-style error', () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' })
    expect(isNodeError(err)).toBe(true)
  })

  it('returns false for a plain Error', () => {
    expect(isNodeError(new Error('plain'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isNodeError('string')).toBe(false)
    expect(isNodeError(null)).toBe(false)
    expect(isNodeError(42)).toBe(false)
  })
})
