import type { Dirent } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ROOT_PATH } from './config.ts'
import { errorResult, isNodeError, resolveWithinRoot } from './utils.ts'

export const readNote = async ({ path: notePath }: { path: string }) => {
  try {
    const absPath = resolveWithinRoot(ROOT_PATH, notePath)
    const content = await fs.readFile(absPath, 'utf-8')
    return { content: [{ type: 'text' as const, text: content }] }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(`File not found: "${notePath}" (root: ${ROOT_PATH})`)
    }
    const msg = err instanceof Error ? err.message : String(err)
    return errorResult(`Error reading note: ${msg}`)
  }
}

export const listNotes = async ({ path: dirPath, recursive }: { path: string; recursive: boolean }) => {
  try {
    const absDir = dirPath ? resolveWithinRoot(ROOT_PATH, dirPath) : ROOT_PATH
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
    const msg = err instanceof Error ? err.message : String(err)
    return errorResult(`Error listing notes: ${msg}`)
  }
}

export const writeNote = async ({ path: notePath, content, create_dirs }: { path: string; content: string; create_dirs: boolean }) => {
  try {
    const absPath = resolveWithinRoot(ROOT_PATH, notePath)
    if (create_dirs) {
      await fs.mkdir(path.dirname(absPath), { recursive: true })
    }
    await fs.writeFile(absPath, content, 'utf-8')
    return {
      content: [
        {
          type: 'text' as const,
          text: `Written: "${notePath}" (${Buffer.byteLength(content, 'utf-8')} bytes)`
        }
      ]
    }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(`Directory not found for: "${notePath}" — set create_dirs: true to create it automatically`)
    }
    const msg = err instanceof Error ? err.message : String(err)
    return errorResult(`Error writing note: ${msg}`)
  }
}

const collectNotes = async (dir: string, recursive: boolean): Promise<string[]> => {
  let entries: Dirent[]
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' })) as Dirent[]
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(`Directory not found: "${path.relative(ROOT_PATH, dir)}"`)
    }
    throw err
  }

  const results: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory() && recursive) {
      results.push(...(await collectNotes(full, true)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}
