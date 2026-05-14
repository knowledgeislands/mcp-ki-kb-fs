import type { Dirent } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ROOT_PATH } from './config.js'
import { isProtectedPath } from './protected.js'
import { assertRealPathWithinRoot, errMessage, errorResult, isNodeError, resolveWithinRoot } from './shared/utils.js'

const NOTE_EXT = '.md'

const isNote = (basename: string): boolean => basename.endsWith(NOTE_EXT)

const relativeFromRoot = (absPath: string): string => path.relative(ROOT_PATH, absPath)

export const readNote = async ({ path: notePath }: { path: string }) => {
  if (!isNote(notePath)) {
    return errorResult(`Notes must end in "${NOTE_EXT}": "${notePath}"`)
  }
  try {
    const absPath = resolveWithinRoot(ROOT_PATH, notePath)
    if (isProtectedPath(relativeFromRoot(absPath))) {
      return errorResult(`Path is protected: "${notePath}"`)
    }
    await assertRealPathWithinRoot(ROOT_PATH, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult(`Not a note file: "${notePath}"`)
    }
    const content = await fs.readFile(absPath, 'utf-8')
    return { content: [{ type: 'text' as const, text: content }] }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(`File not found: "${notePath}" (root: ${ROOT_PATH})`)
    }
    return errorResult(`Error reading note: ${errMessage(err)}`)
  }
}

export const listNotes = async ({ path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = dirPath ? resolveWithinRoot(ROOT_PATH, dirPath) : ROOT_PATH
    if (isProtectedPath(relativeFromRoot(absDir))) {
      return errorResult(`Path is protected: "${dirPath}"`)
    }
    await assertRealPathWithinRoot(ROOT_PATH, absDir)
    const notes = await collectNotes(absDir, recursive)
    const relative = notes.map((p) => path.relative(ROOT_PATH, p))
    return {
      content: [
        {
          type: 'text' as const,
          text: relative.length > 0 ? relative.join('\n') : '(no notes found)'
        }
      ]
    }
  } catch (err) {
    return errorResult(`Error listing notes: ${errMessage(err)}`)
  }
}

export const listFolders = async ({ path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = dirPath ? resolveWithinRoot(ROOT_PATH, dirPath) : ROOT_PATH
    if (isProtectedPath(relativeFromRoot(absDir))) {
      return errorResult(`Path is protected: "${dirPath}"`)
    }
    await assertRealPathWithinRoot(ROOT_PATH, absDir)
    const folders = await collectFolders(absDir, recursive)
    const relative = folders.map((p) => path.relative(ROOT_PATH, p))
    return {
      content: [
        {
          type: 'text' as const,
          text: relative.length > 0 ? relative.join('\n') : '(no folders found)'
        }
      ]
    }
  } catch (err) {
    return errorResult(`Error listing folders: ${errMessage(err)}`)
  }
}

export const writeNote = async ({ path: notePath, content, create_dirs, dry_run }: { path: string; content: string; create_dirs: boolean; dry_run: boolean }) => {
  if (!isNote(notePath)) {
    return errorResult(`Notes must end in "${NOTE_EXT}": "${notePath}"`)
  }
  try {
    const absPath = resolveWithinRoot(ROOT_PATH, notePath)
    if (isProtectedPath(relativeFromRoot(absPath))) {
      return errorResult(`Path is protected: "${notePath}"`)
    }
    if (create_dirs && !dry_run) {
      await fs.mkdir(path.dirname(absPath), { recursive: true })
    }
    await assertRealPathWithinRoot(ROOT_PATH, absPath)
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
    await fs.writeFile(absPath, content, 'utf-8')
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
      return errorResult(`Directory not found for: "${notePath}" — set create_dirs: true to create it automatically`)
    }
    return errorResult(`Error writing note: ${errMessage(err)}`)
  }
}

const readEntries = async (dir: string): Promise<Dirent[]> => {
  try {
    return (await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' })) as Dirent[]
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(`Directory not found: "${path.relative(ROOT_PATH, dir)}"`)
    }
    throw err
  }
}

const collectNotes = async (dir: string, recursive: boolean): Promise<string[]> => {
  const entries = await readEntries(dir)
  const results: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (isProtectedPath(relativeFromRoot(full))) continue
    if (entry.isDirectory()) {
      if (recursive) results.push(...(await collectNotes(full, true)))
    } else if (entry.isFile() && isNote(entry.name)) {
      results.push(full)
    }
  }
  return results
}

const collectFolders = async (dir: string, recursive: boolean): Promise<string[]> => {
  const entries = await readEntries(dir)
  const results: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const full = path.join(dir, entry.name)
    if (isProtectedPath(relativeFromRoot(full))) continue
    results.push(full)
    if (recursive) {
      results.push(...(await collectFolders(full, true)))
    }
  }
  return results
}
