import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './router'
import { today } from '../lib/date'

describe('parseHash', () => {
  it('defaults to today', () => {
    // Every unrecognised address lands on the day, because the day is the app.
    for (const hash of ['', '#', '#/', '#/nonsense', '#/day/not-a-date']) {
      expect(parseHash(hash)).toEqual({ name: 'today', day: today() })
    }
  })

  it('reads an explicit day', () => {
    expect(parseHash('#/day/2026-08-03')).toEqual({ name: 'today', day: '2026-08-03' })
  })

  it('reads the week overlay with and without an anchor', () => {
    expect(parseHash('#/week/2026-08-03')).toEqual({ name: 'week', anchor: '2026-08-03' })
    expect(parseHash('#/week')).toEqual({ name: 'week', anchor: today() })
  })

  it('falls back to this week when the anchor is impossible', () => {
    expect(parseHash('#/week/2026-02-30')).toEqual({ name: 'week', anchor: today() })
  })

  it('reads the stats overlay', () => {
    expect(parseHash('#/stats')).toEqual({ name: 'stats' })
  })
})

describe('routeToHash', () => {
  it('keeps today at the root, so the default address stays clean', () => {
    expect(routeToHash({ name: 'today', day: today() })).toBe('#/')
  })

  it('addresses any other day explicitly', () => {
    expect(routeToHash({ name: 'today', day: '2026-01-01' })).toBe('#/day/2026-01-01')
  })

  it('round-trips every route', () => {
    for (const route of [
      { name: 'today', day: '2026-08-03' },
      { name: 'week', anchor: '2026-08-03' },
      { name: 'stats' },
    ] as const) {
      expect(parseHash(routeToHash(route))).toEqual(route)
    }
  })
})
