/**
 * Opaque content validators for optimistic-concurrency writes.
 *
 * An ETag is `sha256:` followed by the lowercase hex SHA-256 digest of a file's
 * **complete** byte buffer. It is derived from content, not from stat metadata,
 * so same-size and same-second edits still change it, and every read slice of
 * one file (`all`, `frontmatter`, `body`, binary) reports the same validator.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'

const ETAG_PATTERN = /^sha256:[0-9a-f]{64}$/

export const etagSchema = z
  .string()
  .regex(ETAG_PATTERN, 'Must be an ETag exactly as returned by kb_read: "sha256:" plus 64 lowercase hex digits')

export const computeEtag = (bytes: Uint8Array): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

/**
 * Raised when a conditional write's `if_match` validator does not match the
 * current file, or the target no longer exists. The message always starts with
 * `Precondition failed` so callers can distinguish it inside the ordinary error
 * envelope.
 */
export class PreconditionFailedError extends Error {
  constructor(message: string) {
    super(`Precondition failed: ${message}`)
    this.name = 'PreconditionFailedError'
  }
}
