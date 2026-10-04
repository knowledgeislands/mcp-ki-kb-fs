import { describe, expect, it } from 'vitest'
import { computeEtag, etagSchema, PreconditionFailedError } from './etag.js'

describe('computeEtag', () => {
  it('returns sha256: plus the lowercase hex digest of every byte', () => {
    expect(computeEtag(Buffer.from('abc'))).toBe(
      'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('changes on a same-size byte edit', () => {
    expect(computeEtag(Buffer.from('abc'))).not.toBe(computeEtag(Buffer.from('abd')))
  })
})

describe('etagSchema', () => {
  it('accepts exactly the emitted validator shape', () => {
    expect(etagSchema.safeParse(computeEtag(Buffer.from('x'))).success).toBe(true)
  })

  it.each([
    '*',
    'W/"abc"',
    `"${computeEtag(Buffer.from('x'))}"`,
    computeEtag(Buffer.from('x')).toUpperCase(),
    'sha256:abc',
    `md5:${'0'.repeat(64)}`
  ])('rejects %s', (value) => {
    expect(etagSchema.safeParse(value).success).toBe(false)
  })
})

describe('PreconditionFailedError', () => {
  it('prefixes its message so callers can recognise it', () => {
    const err = new PreconditionFailedError('stale')
    expect(err.message).toBe('Precondition failed: stale')
    expect(err.name).toBe('PreconditionFailedError')
  })
})
