import { describe, expect, it } from 'vitest'
import { serialiseMutation } from './mutation-queue.js'

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('serialiseMutation', () => {
  it('runs operations one at a time in submission order', async () => {
    const events: string[] = []
    const op = (name: string) => async () => {
      events.push(`${name}:start`)
      await tick()
      events.push(`${name}:end`)
      return name
    }
    const results = await Promise.all([
      serialiseMutation(op('a')),
      serialiseMutation(op('b')),
      serialiseMutation(op('c'))
    ])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
  })

  it('does not strand the queue after a failure', async () => {
    const failed = serialiseMutation(async () => {
      throw new Error('boom')
    })
    const next = serialiseMutation(async () => 'after')
    await expect(failed).rejects.toThrow('boom')
    await expect(next).resolves.toBe('after')
  })
})
