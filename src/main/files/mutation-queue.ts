/**
 * Process-wide serialisation for file mutations.
 *
 * Every mutating file entry point the server exposes (write, rename, delete)
 * runs through this one FIFO queue, so a conditional write's validation and
 * replacement cannot interleave with another mutation issued through the same
 * server process. It is deliberately simple and process-local: it is not a
 * cross-process lock, and another process or editor can still change a file
 * between validation and replacement.
 */
let tail: Promise<unknown> = Promise.resolve()

export const serialiseMutation = <T>(operation: () => Promise<T>): Promise<T> => {
  const run = tail.then(() => operation())
  // Keep the chain alive whether the operation succeeds or fails, so one
  // failure never strands later mutations.
  tail = run.catch(() => undefined)
  return run
}
