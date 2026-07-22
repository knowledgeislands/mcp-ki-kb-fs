/**
 * Side-file operations — read / list / write / rename / delete — for non-markdown
 * assets (images, PDFs, attachments, etc.) that live alongside notes within KB zones.
 *
 * Key differences from the notes module:
 * - No `.md` extension restriction.
 * - Binary-safe reads: content returned as base64 when not valid UTF-8.
 * - Write accepts `encoding: 'utf-8' | 'base64'`; base64 is decoded to bytes before
 *   writing so binary assets round-trip cleanly.
 * - Zone-scoping guard applied before `isProtectedPath`.
 */
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Config } from '../../config/index.js'
import { isProtectedPath } from '../../utils/protected.js'
import { assertRealPathWithinRoot, errorResult, isNodeError, jsonResult, resolveWithinRoot } from '../../utils/utils.js'
import { isInScope, outOfScopeError } from '../../utils/zones.js'
import { collectFiles, collectFolders, collectNotes, relativeFromRoot } from '../shared.js'

// Minimal extension → MIME map for the most common KB side-file types.
// Falls back to application/octet-stream for anything unrecognised.
const MIME_MAP: Record<string, string> = {
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml'
}

const mimeTypeFor = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

const isUtf8 = (buf: Buffer): boolean => {
  try {
    const decoded = buf.toString('utf-8')
    return Buffer.from(decoded, 'utf-8').equals(buf)
  } catch {
    // buf.toString() does not throw in Node.js; this is a defensive fallback.
    /* v8 ignore next */
    return false
  }
}

export type ReadPart = 'all' | 'frontmatter' | 'body'
export type ListKind = 'files' | 'folders' | 'notes'

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

export const readFile = async (cfg: Config, { path: filePath, part = 'all' }: { path: string; part?: ReadPart }) => {
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, filePath)
    const rel = relativeFromRoot(cfg.rootPath, absPath).split(path.sep).join('/')
    const isAllowlistedRootFile = filePath.replaceAll('\\', '/') === rel && cfg.rootFileAllowlist.includes(rel)
    if (!isInScope(rel, cfg.zones) && !isAllowlistedRootFile) {
      return errorResult(
        'reading file',
        new Error(`${outOfScopeError(cfg.zones)} Root-level and named near-root files must exactly match root_file_allowlist.`)
      )
    }
    if (isProtectedPath(rel) && !isAllowlistedRootFile) {
      return errorResult('reading file', new Error(`Path is protected: "${filePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult('reading file', new Error(`Not a file: "${filePath}"`))
    }
    const buf = await fs.readFile(absPath)
    const mimeType = mimeTypeFor(filePath)
    if (isUtf8(buf)) {
      const content = buf.toString('utf-8')
      if (part !== 'all') {
        if (path.extname(filePath).toLowerCase() !== '.md') {
          return errorResult('reading file', new Error(`part is only available for UTF-8 Markdown files: "${filePath}"`))
        }
        const split = splitFrontmatter(content)
        if (split.malformed) {
          return errorResult('reading file', new Error(`Malformed frontmatter in "${filePath}": opening "---" has no closing "---"`))
        }
        return jsonResult({
          path: filePath,
          part,
          encoding: 'utf-8',
          mimeType,
          content: part === 'frontmatter' ? (split.frontmatter ?? '(no frontmatter)') : split.body,
          size: stat.size
        })
      }
      return jsonResult({ path: filePath, part, encoding: 'utf-8', mimeType, content, size: stat.size })
    }
    if (part !== 'all') {
      return errorResult('reading file', new Error(`part is only available for UTF-8 Markdown files: "${filePath}"`))
    }
    return jsonResult({ path: filePath, part, encoding: 'base64', mimeType, content: buf.toString('base64'), size: stat.size })
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('reading file', new Error(`File not found: "${filePath}"`))
    }
    return errorResult('reading file', err)
  }
}

export const listContent = async (
  cfg: Config,
  { path: dirPath, kind, recursive, ext }: { path: string; kind: ListKind; recursive: boolean; ext?: string }
) => {
  try {
    const absDir = resolveWithinRoot(cfg.rootPath, dirPath)
    const rel = relativeFromRoot(cfg.rootPath, absDir)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('listing content', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('listing content', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    const paths =
      kind === 'files'
        ? await collectFiles(cfg.rootPath, absDir, recursive, ext ?? null)
        : kind === 'folders'
          ? await collectFolders(cfg.rootPath, absDir, recursive)
          : await collectNotes(cfg.rootPath, absDir, recursive)
    const entries = paths.map((entry) => path.relative(cfg.rootPath, entry))
    return jsonResult({ path: dirPath, kind, recursive, ext: kind === 'files' ? (ext ?? null) : null, count: entries.length, entries })
  } catch (err) {
    return errorResult('listing content', err)
  }
}

export const listFiles = async (cfg: Config, { path: dirPath, recursive, ext }: { path: string; recursive: boolean; ext?: string }) => {
  try {
    const absDir = resolveWithinRoot(cfg.rootPath, dirPath)
    const rel = relativeFromRoot(cfg.rootPath, absDir)
    if (rel && !isInScope(rel, cfg.zones)) {
      return errorResult('listing files', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('listing files', new Error(`Path is protected: "${dirPath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absDir)
    const files = await collectFiles(cfg.rootPath, absDir, recursive, ext ?? null)
    const relative = files.map((p) => path.relative(cfg.rootPath, p))
    return jsonResult({ path: dirPath, recursive, ext: ext ?? null, count: relative.length, files: relative })
  } catch (err) {
    return errorResult('listing files', err)
  }
}

export type FileEncoding = 'utf-8' | 'base64'

export const writeFile = async (
  cfg: Config,
  {
    path: filePath,
    content,
    encoding = 'utf-8',
    create_dirs,
    dry_run
  }: {
    path: string
    content: string
    encoding?: FileEncoding
    create_dirs: boolean
    dry_run: boolean
  }
) => {
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, filePath)
    const rel = relativeFromRoot(cfg.rootPath, absPath)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('writing file', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('writing file', new Error(`Path is protected: "${filePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const buf = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8')
    const bytes = buf.byteLength
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
      return jsonResult({ dry_run: true, action, path: filePath, encoding, bytes })
    }
    if (create_dirs) {
      await fs.mkdir(path.dirname(absPath), { recursive: true })
    }
    // Atomic write via sibling temp file + rename.
    const tmpPath = `${absPath}.${randomUUID()}.tmp`
    await fs.writeFile(tmpPath, buf)
    await fs.rename(tmpPath, absPath)
    return jsonResult({ path: filePath, bytes, encoding })
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(
        'writing file',
        new Error(`Directory not found for: "${filePath}" — set create_dirs: true to create it automatically`)
      )
    }
    return errorResult('writing file', err)
  }
}

export const renameFile = async (cfg: Config, { from, to, create_dirs }: { from: string; to: string; create_dirs: boolean }) => {
  try {
    const absFrom = resolveWithinRoot(cfg.rootPath, from)
    const absTo = resolveWithinRoot(cfg.rootPath, to)
    const relFrom = relativeFromRoot(cfg.rootPath, absFrom)
    const relTo = relativeFromRoot(cfg.rootPath, absTo)
    if (!isInScope(relFrom, cfg.zones)) {
      return errorResult('renaming file', new Error(outOfScopeError(cfg.zones)))
    }
    if (!isInScope(relTo, cfg.zones)) {
      return errorResult('renaming file', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(relFrom)) {
      return errorResult('renaming file', new Error(`Path is protected: "${from}"`))
    }
    if (isProtectedPath(relTo)) {
      return errorResult('renaming file', new Error(`Path is protected: "${to}"`))
    }
    if (absFrom === absTo) {
      return errorResult('renaming file', new Error(`Source and destination are the same: "${from}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absFrom)
    const fromStat = await fs.stat(absFrom)
    if (!fromStat.isFile()) {
      return errorResult('renaming file', new Error(`Not a file: "${from}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absTo)
    if (create_dirs) {
      await fs.mkdir(path.dirname(absTo), { recursive: true })
    }
    try {
      await fs.access(absTo)
      return errorResult('renaming file', new Error(`Destination already exists: "${to}" (rename is non-destructive)`))
    } catch (err) {
      if (!(isNodeError(err) && err.code === 'ENOENT')) throw err
    }
    await fs.rename(absFrom, absTo)
    return jsonResult({ from, to })
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult(
        'renaming file',
        new Error(`File not found: "${from}" — set create_dirs: true if the destination directory does not exist`)
      )
    }
    return errorResult('renaming file', err)
  }
}

export const deleteFile = async (cfg: Config, { path: filePath, dry_run }: { path: string; dry_run: boolean }) => {
  try {
    const absPath = resolveWithinRoot(cfg.rootPath, filePath)
    const rel = relativeFromRoot(cfg.rootPath, absPath)
    if (!isInScope(rel, cfg.zones)) {
      return errorResult('deleting file', new Error(outOfScopeError(cfg.zones)))
    }
    if (isProtectedPath(rel)) {
      return errorResult('deleting file', new Error(`Path is protected: "${filePath}"`))
    }
    await assertRealPathWithinRoot(cfg.rootPath, absPath)
    const stat = await fs.stat(absPath)
    if (!stat.isFile()) {
      return errorResult('deleting file', new Error(`Not a file: "${filePath}"`))
    }
    if (dry_run) {
      return jsonResult({ dry_run: true, action: `would delete (${stat.size} bytes)`, path: filePath })
    }
    await fs.unlink(absPath)
    return jsonResult({ deleted: true, path: filePath, bytes: stat.size })
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return errorResult('deleting file', new Error(`File not found: "${filePath}"`))
    }
    return errorResult('deleting file', err)
  }
}
