import { describe, it, expect } from 'vitest'
import { mapWithConcurrency } from './mapWithConcurrency'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const flush = () => new Promise((r) => setImmediate(r))

describe('mapWithConcurrency', () => {
  it('returns results in input order regardless of completion order', async () => {
    const delays = [30, 10, 20]
    const result = await mapWithConcurrency(delays, 3, async (ms, index) => {
      await new Promise((r) => setTimeout(r, ms))
      return `item-${index}`
    })

    expect(result).toEqual(['item-0', 'item-1', 'item-2'])
  })

  it('never runs more than `limit` tasks at once, and starts the next as soon as one finishes', async () => {
    const gates = Array.from({ length: 5 }, () => deferred<void>())
    let running = 0
    let maxRunning = 0
    const started: number[] = []

    const all = mapWithConcurrency(gates, 2, async (gate, index) => {
      started.push(index)
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await gate.promise
      running -= 1
      return index
    })

    await flush()
    expect(started).toEqual([0, 1])

    gates[1].resolve()
    await flush()
    expect(started).toEqual([0, 1, 2])

    gates.forEach((g) => g.resolve())
    await expect(all).resolves.toEqual([0, 1, 2, 3, 4])
    expect(maxRunning).toBe(2)
  })

  it('handles an empty list', async () => {
    await expect(mapWithConcurrency([], 5, async () => 1)).resolves.toEqual([])
  })

  it('rejects a non-positive limit', async () => {
    await expect(mapWithConcurrency([1], 0, async (x) => x)).rejects.toThrow(/limit/)
  })
})
