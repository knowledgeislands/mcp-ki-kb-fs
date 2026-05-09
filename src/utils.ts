import * as path from 'node:path'
import { VAULT_ROOT } from './config.ts'

/**
 * Resolve a vault-relative path to an absolute path, rejecting any attempt
 * to escape the vault root via `..` or symlink tricks.
 */
export function resolveVaultPath(relativePath: string): string {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const resolved = path.resolve(VAULT_ROOT, cleaned)
  const vaultWithSep = VAULT_ROOT.endsWith(path.sep) ? VAULT_ROOT : VAULT_ROOT + path.sep
  if (resolved !== VAULT_ROOT && !resolved.startsWith(vaultWithSep)) {
    throw new Error(`Path escapes vault root: "${relativePath}"`)
  }
  return resolved
}

export function errorResult(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }]
  }
}

export function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}
