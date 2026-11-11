/**
 * Like `Promise.all(items.map(fn))`, but with at most `limit` calls of `fn` in flight.
 * Results keep the input order. `fn` should handle its own errors: the first rejection
 * rejects the whole call (the same as `Promise.all`).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`limit must be a positive integer, got ${limit}`)
  }

  const results = new Array<R>(items.length)
  let next = 0

  async function runWorker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker))
  return results
}
