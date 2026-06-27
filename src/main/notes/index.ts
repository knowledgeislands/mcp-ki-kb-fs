/**
 * The KB note/folder operations — read / list / write / rename / delete /
 * create-folder — as implementation functions. The tool handlers
 * (src/tools/notes/index.ts) are thin wrappers that call one of these. Keeping
 * the logic here (not in the excluded aggregator) makes every branch
 * unit-testable against a real temp KB root.
 *
 * Every entry point takes `Config` as its first argument — the KB root and all
 * other settings are injected, never read from a module singleton.
 */
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Config } from '../../config/index.js'
import { isProtectedPath } from '../../utils/protected.js'
import { assertRealPathWithinRoot, errorResult, isNodeError, resolveWithinRoot } from '../../utils/utils.js'
import { isInScope, outOfScopeError } from '../../utils/zones.js'
import { collectFolders, collectNotes, relativeFromRoot } from '../shared.js'

const NOTE_EXT = '.md'

const isNote = (basename: string): boolean => basename.endsWith(NOTE_EXT)

const textResult = (text: string) => ({ content: [{ type: 'text' as const, text }] })

// Which slice of a note `readNote` returns.
export type NotePart = 'all' | 'frontmatter' | 'body'

// Split a note into its YAML frontmatter (the lines between the leading `---`
// fences, fences excluded) and the body after the closing fence. `frontmatter`
// is null when the note has no leading `---` fence; `malformed` is true when it
// opens a fence that never closes (mirrors the kb checker's well-formedness rule).
type FrontmatterSplit = { frontmatter: string | null; body: string; malformed: boolean }
const splitFrontmatter = (content: string): FrontmatterSplit => {
  const lines = content.split('\n')
  if (lines[0]?.trim() !== '---') return { frontmatter: null, body: content, malformed: false }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      return { frontmatter: lines.slice(1, i).join('\n'), body: lines.slice(i + 1).join('\n'), malformed: false }
    }
  }
  return { frontmatter: null, body: content, malformed: true }
}

export const readNote = async (cfg: Config, { path: notePath, part = 'all' }: { path: string; part?: NotePart }) => {
  if (!isNote(notePath)) {
    return errorResult('reading note', new Error(`Notes must end in "${NOTE_EXT}": "${notePath}"`))
  }
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, notePath)
    const rel = relativeFromRoot(cfg.rootPath, absPath)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('reading note', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('reading note', new Error(`Path is protected: "${notePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult('reading note', new Error(`Not a note file: "${notePath}"`))
    }
    const content = await fs.readFile(absPath, 'utf-8')
    if (part === 'all') return textResult(content)
    const split = splitFrontmatter(content)
    if (split.malformed) {
      return errorResult('reading note', new Error(`Malformed frontmatter in "${notePath}": opening "---" has no closing "---"`))
    }
    if (part === 'frontmatter') return textResult(split.frontmatter ?? '(no frontmatter)')
    return textResult(split.body)
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('reading note', new Error(`File not found: "${notePath}"`))
    }
    return errorResult('reading note', err)
  }
}

export const listNotes = async (cfg: Config, { path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = resolveWithinRoot(cfg.rootPath, dirPath)
    const rel = relativeFromRoot(cfg.rootPath, absDir)
    if (rel && !isInScope(rel, cfg.zones)) {
      return errorResult('listing notes', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('listing notes', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    const notes = await collectNotes(cfg.rootPath, absDir, recursive)
    const relative = notes.map((p) => path.relative(cfg.rootPath, p))
    return {
      content: [
        {
          type: 'text' as const,
          text: relative.length === 0 ? '(no notes found)' : relative.join('\n')
        }
      ]
    }
  } catch (err) {
    return errorResult('listing notes', err)
  }
}

export const listFolders = async (cfg: Config, { path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = resolveWithinRoot(cfg.rootPath, dirPath)
    const rel = relativeFromRoot(cfg.rootPath, absDir)
    if (rel && !isInScope(rel, cfg.zones)) {
      return errorResult('listing folders', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('listing folders', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    const folders = await collectFolders(cfg.rootPath, absDir, recursive)
    const relative = folders.map((p) => path.relative(cfg.rootPath, p))
    return {
      content: [
        {
          type: 'text' as const,
          text: relative.length === 0 ? '(no folders found)' : relative.join('\n')
        }
      ]
    }
  } catch (err) {
    return errorResult('listing folders', err)
  }
}

export const renameNote = async (cfg: Config, { from, to, create_dirs }: { from: string; to: string; create_dirs: boolean }) => {
  if (!isNote(from)) {
    return errorResult('renaming note', new Error(`Notes must end in "${NOTE_EXT}": "${from}"`))
  }
  if (!isNote(to)) {
    return errorResult('renaming note', new Error(`Notes must end in "${NOTE_EXT}": "${to}"`))
  }
  try {
    const absFrom = resolveWithinRoot(cfg.rootPath, from)
    const absTo = resolveWithinRoot(cfg.rootPath, to)
    const relFrom = relativeFromRoot(cfg.rootPath, absFrom)
    const relTo = relativeFromRoot(cfg.rootPath, absTo)
    if (!isInScope(relFrom, cfg.zones)) {
      return errorResult('renaming note', new Error(outOfScopeError(cfg.zones)))
    }
    if (!isInScope(relTo, cfg.zones)) {
      return errorResult('renaming note', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(relFrom)) {
      return errorResult('renaming note', new Error(`Path is protected: "${from}"`))
    }
    if (isProtectedPath(relTo)) {
      return errorResult('renaming note', new Error(`Path is protected: "${to}"`))
    }
    if (absFrom === absTo) {
      return errorResult('renaming note', new Error(`Rename source and destination are the same path: "${from}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absFrom)
    const fromStat = await fs.stat(absFrom)
    if (!fromStat.isFile()) {
      return errorResult('renaming note', new Error(`Not a note file: "${from}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absTo)
    if (create_dirs) {
      await fs.mkdir(path.dirname(absTo), { recursive: true })
    }
    try {
      await fs.access(absTo)
      return errorResult('renaming note', new Error(`Destination already exists: "${to}" (rename is non-destructive)`))
    } catch (err) {
      if (!(isNodeError(err) && err.code === 'ENOENT')) throw err
    }
    await fs.rename(absFrom, absTo)
    return {
      content: [{ type: 'text' as const, text: `Renamed: "${from}" → "${to}"` }]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(
        'renaming note',
        new Error(`File not found: "${from}" — or destination parent missing for "${to}" (set create_dirs: true)`)
      )
    }
    return errorResult('renaming note', err)
  }
}

export const deleteNote = async (cfg: Config, { path: notePath, dry_run }: { path: string; dry_run: boolean }) => {
  if (!isNote(notePath)) {
    return errorResult('deleting note', new Error(`Notes must end in "${NOTE_EXT}": "${notePath}"`))
  }
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, notePath)
    const rel = relativeFromRoot(cfg.rootPath, absPath)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('deleting note', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('deleting note', new Error(`Path is protected: "${notePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult('deleting note', new Error(`Not a note file: "${notePath}"`))
    }
    if (dry_run) {
      return {
        content: [{ type: 'text' as const, text: `[dry_run] would delete (${stat.size} bytes): "${notePath}"` }]
      }
    }
    await fs.unlink(absPath)
    return {
      content: [{ type: 'text' as const, text: `Deleted: "${notePath}" (${stat.size} bytes)` }]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('deleting note', new Error(`File not found: "${notePath}"`))
    }
    return errorResult('deleting note', err)
  }
}

export const createFolder = async (cfg: Config, { path: dirPath }: { path: string }) => {
  if (!dirPath) {
    return errorResult('creating folder', new Error('Folder path must not be empty'))
  }
  try {
    const absDir = resolveWithinRoot(cfg.rootPath, dirPath)
    const rel = relativeFromRoot(cfg.rootPath, absDir)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('creating folder', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('creating folder', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    let existed = false
    try {
      const stat = await fs.stat(absDir)
      if (stat.isFile()) {
        return errorResult('creating folder', new Error(`Path exists as a file, not a folder: "${dirPath}"`))
      }
      existed = stat.isDirectory()
    } catch (err) {
      if (!(isNodeError(err) && err.code === 'ENOENT')) throw err
    }
    await fs.mkdir(absDir, { recursive: true })
    return {
      content: [
        {
          type: 'text' as const,
          text: existed ? `Folder already exists: "${dirPath}"` : `Created folder: "${dirPath}"`
        }
      ]
    }
  } catch (err) {
    return errorResult('creating folder', err)
  }
}

export const writeNote = async (
  cfg: Config,
  { path: notePath, content, create_dirs, dry_run }: { path: string; content: string; create_dirs: boolean; dry_run: boolean }
) => {
  if (!isNote(notePath)) {
    return errorResult('writing note', new Error(`Notes must end in "${NOTE_EXT}": "${notePath}"`))
  }
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, notePath)
    const rel = relativeFromRoot(cfg.rootPath, absPath)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('writing note', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('writing note', new Error(`Path is protected: "${notePath}"`))
    }
    // Realpath-guard BEFORE creating any directory — a symlinked ancestor must be
    // caught before `mkdir -p` can materialise dirs at its target.
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    if (create_dirs && !dry_run) {
      await fs.mkdir(path.dirname(absPath), { recursive: true })
    }
    const bytes = Buffer.byteLength(content, 'utf-8')
    if (dry_run) {
      let exists = false
      let existingBytes = 0
      try {
        const stat = await fs.stat(absPath)
        exists = stat.isFile()
        existingBytes = stat.size
      } catch (err) {
        if (!(isNodeError(err) && err.code === 'ENOENT')) throw err
      }
      const action = exists ? `would overwrite (${existingBytes} → ${bytes} bytes)` : `would create (${bytes} bytes)`
      return {
        content: [{ type: 'text' as const, text: `[dry_run] ${action}: "${notePath}"` }]
      }
    }
    // Atomic write: write a sibling temp file then rename over the target, so a
    // crash mid-write can't leave a note half-rewritten. rename() is atomic within a dir.
    const tmpPath = `${absPath}.${randomUUID()}.tmp`
    await fs.writeFile(tmpPath, content, 'utf-8')
    await fs.rename(tmpPath, absPath)
    return {
      content: [{ type: 'text' as const, text: `Written: "${notePath}" (${bytes} bytes)` }]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(
        'writing note',
        new Error(`Directory not found for: "${notePath}" — set create_dirs: true to create it automatically`)
      )
    }
    return errorResult('writing note', err)
  }
}
