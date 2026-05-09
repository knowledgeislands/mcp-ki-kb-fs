import type { Dirent } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { VAULT_ROOT } from './config.ts'
import { errorResult, isNodeError, resolveVaultPath } from './utils.ts'

export async function readNote({ path: notePath }: { path: string }) {
  try {
    const absPath = resolveVaultPath(notePath)
    const content = await fs.readFile(absPath, 'utf-8')
    return { content: [{ type: 'text' as const, text: content }] }
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(`File not found: "${notePath}" (vault: ${VAULT_ROOT})`)
    }
    const msg = err instanceof Error ? err.message : String(err)
    return errorResult(`Error reading note: ${msg}`)
  }
}

export async function listNotes({ path: dirPath, recursive }: { path: string; recursive: boolean }) {
  try {
    const absDir = dirPath ? resolveVaultPath(dirPath) : VAULT_ROOT
    const notes = await collectNotes(absDir, recursive)
    const relative = notes.map((p) => path.relative(VAULT_ROOT, p))
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

export async function writeNote({ path: notePath, content, create_dirs }: { path: string; content: string; create_dirs: boolean }) {
  try {
    const absPath = resolveVaultPath(notePath)
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

async function collectNotes(dir: string, recursive: boolean): Promise<string[]> {
  let entries: Dirent[]
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true, encoding: 'utf-8' })) as Dirent[]
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      throw new Error(`Directory not found: "${path.relative(VAULT_ROOT, dir)}"`)
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
