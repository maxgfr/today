import { describe, expect, it } from 'vitest'
import { needsRenormalisation, orderAtEnd, orderAtStart, orderBetween, renormalise } from './order'

describe('orderAtEnd / orderAtStart', () => {
  it('handles an empty list', () => {
    expect(orderAtEnd([])).toBe(1024)
    expect(orderAtStart([])).toBe(1024)
  })

  it('lands outside the existing range', () => {
    expect(orderAtEnd([1024, 2048])).toBeGreaterThan(2048)
    expect(orderAtStart([1024, 2048])).toBeLessThan(1024)
  })

  it('does not assume the input is sorted', () => {
    expect(orderAtEnd([2048, 1024, 3072])).toBeGreaterThan(3072)
  })
})

describe('orderBetween', () => {
  it('takes the midpoint of two neighbours', () => {
    expect(orderBetween(1024, 2048)).toBe(1536)
  })

  it('extends past either edge', () => {
    expect(orderBetween(null, 1024)).toBeLessThan(1024)
    expect(orderBetween(1024, null)).toBeGreaterThan(1024)
    expect(orderBetween(null, null)).toBe(1024)
  })

  it('keeps the new position strictly between its neighbours', () => {
    let low = 0
    let high = 1024
    for (let i = 0; i < 20; i++) {
      const mid = orderBetween(low, high)
      expect(mid).toBeGreaterThan(low)
      expect(mid).toBeLessThan(high)
      high = mid
    }
  })
})

describe('needsRenormalisation', () => {
  it('is quiet on comfortable spacing', () => {
    expect(needsRenormalisation([1024, 2048, 3072])).toBe(false)
  })

  it('fires once float precision runs out', () => {
    // Repeatedly inserting into the same gap is exactly the pathological case.
    let orders = [0, 1024]
    for (let i = 0; i < 60; i++) {
      orders = [orders[0]!, orderBetween(orders[0]!, orders[1]!), orders[1]!].slice(0, 2)
    }
    expect(needsRenormalisation(orders)).toBe(true)
  })
})

describe('renormalise', () => {
  it('respaces evenly while preserving the sequence', () => {
    const items = [
      { id: 'c', order: 3 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]
    expect(renormalise(items)).toEqual({ a: 1024, b: 2048, c: 3072 })
  })

  it('returns an empty map for an empty list', () => {
    expect(renormalise([])).toEqual({})
  })
})
