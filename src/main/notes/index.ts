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
import type { Dirent } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Config } from '../../config/index.js'
import { isProtectedPath } from '../../utils/protected.js'
import { assertRealPathWithinRoot, errorResult, isNodeError, resolveWithinRoot } from '../../utils/utils.js'

const NOTE_EXT = '.md'

const isNote = (basename: string): boolean => basename.endsWith(NOTE_EXT)

const relativeFromRoot = (rootPath: string, absPath: string): string => path.relative(rootPath, absPath)

export const readNote = async (cfg: Config, { path: notePath }: { path: string }) => {
  if (!isNote(notePath)) {
    return errorResult('reading note', new Error(`Notes must end in "${NOTE_EXT}": "${notePath}"`))
  }
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, notePath)
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absPath))) {
      return errorResult('reading note', new Error(`Path is protected: "${notePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult('reading note', new Error(`Not a note file: "${notePath}"`))
    }
    const content = await fs.readFile(absPath, 'utf-8')
    return { content: [{ type: 'text' as const, text: content }] }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('reading note', new Error(`File not found: "${notePath}" (root: ${cfg.rootPath})`))
    }
    return errorResult('reading note', err)
  }
}

export const listNotes = async (cfg: Config, { path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = dirPath ? resolveWithinRoot(cfg.rootPath, dirPath) : cfg.rootPath
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absDir))) {
      return errorResult('listing notes', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    const notes = await collectNotes(cfg.rootPath, absDir, recursive)
    const relative = notes.map((p) => path.relative(cfg.rootPath, p))
    return {
      content: [
        {
          type: 'text' as const,
          text: relative.length > 0 ? relative.join('\n') : '(no notes found)'
        }
      ]
    }
  } catch (err) {
    return errorResult('listing notes', err)
  }
}

export const listFolders = async (cfg: Config, { path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = dirPath ? resolveWithinRoot(cfg.rootPath, dirPath) : cfg.rootPath
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absDir))) {
      return errorResult('listing folders', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    const folders = await collectFolders(cfg.rootPath, absDir, recursive)
    const relative = folders.map((p) => path.relative(cfg.rootPath, p))
    return {
      content: [
        {
          type: 'text' as const,
          text: relative.length > 0 ? relative.join('\n') : '(no folders found)'
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
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absFrom))) {
      return errorResult('renaming note', new Error(`Path is protected: "${from}"`))
    }
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absTo))) {
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
    // Realpath-guard the destination BEFORE creating any directory — a symlinked
    // ancestor must be caught before `mkdir -p` can materialise dirs at its target.
    await assertRealPathWithinRoot(cfg.rootPath, absTo)
    if (create_dirs) {
      await fs.mkdir(path.dirname(absTo), { recursive: true })
    }
    try {
      await fs.access(absTo)
      return errorResult('renaming note', new Error(`Destination already exists: "${to}" — refusing to overwrite (rename is non-destructive)`))
    } catch (err) {
      if (!(isNodeError(err) && err.code === 'ENOENT')) throw err
    }
    await fs.rename(absFrom, absTo)
    return {
      content: [
        {
          type: 'text' as const,
          text: `Renamed: "${from}" → "${to}"`
        }
      ]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('renaming note', new Error(`File not found: "${from}" (root: ${cfg.rootPath}) — or destination parent missing for "${to}" (set create_dirs: true)`))
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
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absPath))) {
      return errorResult('deleting note', new Error(`Path is protected: "${notePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult('deleting note', new Error(`Not a note file: "${notePath}"`))
    }
    if (dry_run) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `[dry_run] would delete (${stat.size} bytes): "${notePath}"`
          }
        ]
      }
    }
    await fs.unlink(absPath)
    return {
      content: [
        {
          type: 'text' as const,
          text: `Deleted: "${notePath}" (${stat.size} bytes)`
        }
      ]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('deleting note', new Error(`File not found: "${notePath}" (root: ${cfg.rootPath})`))
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
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absDir))) {
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

export const writeNote = async (cfg: Config, { path: notePath, content, create_dirs, dry_run }: { path: string; content: string; create_dirs: boolean; dry_run: boolean }) => {
  if (!isNote(notePath)) {
    return errorResult('writing note', new Error(`Notes must end in "${NOTE_EXT}": "${notePath}"`))
  }
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, notePath)
    if (isProtectedPath(relativeFromRoot(cfg.rootPath, absPath))) {
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
        content: [
          {
            type: 'text' as const,
            text: `[dry_run] ${action}: "${notePath}"`
          }
        ]
      }
    }
    // Atomic write: write a sibling temp file then rename over the target, so a
    // crash mid-write can't leave a note half-rewritten. rename() is atomic within a dir.
    const tmpPath = `${absPath}.${randomUUID()}.tmp`
    await fs.writeFile(tmpPath, content, 'utf-8')
    await fs.rename(tmpPath, absPath)
    return {
      content: [
        {
          type: 'text' as const,
          text: `Written: "${notePath}" (${bytes} bytes)`
        }
      ]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('writing note', new Error(`Directory not found for: "${notePath}" — set create_dirs: true to create it automatically`))
    }
    return errorResult('writing note', err)
  }
}

const readEntries = async (rootPath: string, dir: string): Promise<Dirent[]> => {
  try {
    return (await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' })) as Dirent[]
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(`Directory not found: "${path.relative(rootPath, dir)}"`)
    }
    throw err
  }
}

const collectNotes = async (rootPath: string, dir: string, recursive: boolean): Promise<string[]> => {
  const entries = await readEntries(rootPath, dir)
  const results: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (isProtectedPath(relativeFromRoot(rootPath, full))) continue
    if (entry.isDirectory()) {
      if (recursive) results.push(...(await collectNotes(rootPath, full, true)))
    } else if (entry.isFile() && isNote(entry.name)) {
      results.push(full)
    }
  }
  return results
}

const collectFolders = async (rootPath: string, dir: string, recursive: boolean): Promise<string[]> => {
  const entries = await readEntries(rootPath, dir)
  const results: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const full = path.join(dir, entry.name)
    if (isProtectedPath(relativeFromRoot(rootPath, full))) continue
    results.push(full)
    if (recursive) {
      results.push(...(await collectFolders(rootPath, full, true)))
    }
  }
  return results
}
