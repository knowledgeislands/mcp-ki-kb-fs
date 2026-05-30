import { describe, expect, it } from 'vitest'
import { isProtectedPath } from './protected.js'

describe('isProtectedPath', () => {
  it('treats empty path (KB root) as not protected', () => {
    expect(isProtectedPath('')).toBe(false)
  })

  it('protects dotfiles at the root', () => {
    expect(isProtectedPath('.env')).toBe(true)
    expect(isProtectedPath('.DS_Store')).toBe(true)
  })

  it('protects dotdirs at the root', () => {
    expect(isProtectedPath('.git')).toBe(true)
    expect(isProtectedPath('.obsidian')).toBe(true)
  })

  it('protects dotfiles at any depth', () => {
    expect(isProtectedPath('sub/.hidden')).toBe(true)
    expect(isProtectedPath('a/b/c/.x.md')).toBe(true)
  })

  it('protects content beneath a dotdir', () => {
    expect(isProtectedPath('.git/config')).toBe(true)
    expect(isProtectedPath('.obsidian/workspace.json')).toBe(true)
  })

  it('protects root-level meta basenames (case-insensitive, with optional .md)', () => {
    for (const name of ['README', 'README.md', 'readme.md', 'CLAUDE.md', 'claude', 'LICENSE', 'LICENSE.txt', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'AGENTS.md']) {
      expect(isProtectedPath(name)).toBe(true)
    }
  })

  it('does NOT protect meta basenames below the root (root-only rule)', () => {
    expect(isProtectedPath('archive/README.md')).toBe(false)
    expect(isProtectedPath('Pillars/Finance/CLAUDE.md')).toBe(false)
    expect(isProtectedPath('docs/LICENSE.md')).toBe(false)
  })

  it('does not protect ordinary notes', () => {
    expect(isProtectedPath('Inbox/2026-04-30.md')).toBe(false)
    expect(isProtectedPath('Pillars/Finance/Budget.md')).toBe(false)
    expect(isProtectedPath('readme-notes.md')).toBe(false)
  })

  it('handles backslash-style separators', () => {
    expect(isProtectedPath('sub\\.hidden\\note.md')).toBe(true)
  })

  it('ignores trailing slashes', () => {
    expect(isProtectedPath('Pillars/')).toBe(false)
    expect(isProtectedPath('.git/')).toBe(true)
  })
})
