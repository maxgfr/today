import { describe, expect, it } from 'vitest'
import {
  addDays,
  ageLabel,
  daysBetween,
  isValidDayId,
  relativeDayLabel,
  startOfWeek,
  toDayId,
  weekDays,
  weekdayOf,
} from './date'

describe('toDayId', () => {
  it('uses local time, not UTC', () => {
    // 23:30 local on the 3rd is still the 3rd, whatever UTC thinks.
    expect(toDayId(new Date(2026, 7, 3, 23, 30))).toBe('2026-08-03')
    expect(toDayId(new Date(2026, 7, 3, 0, 15))).toBe('2026-08-03')
  })

  it('pads single-digit months and days', () => {
    expect(toDayId(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('survives a DST transition', () => {
    // Europe/Paris springs forward on 2026-03-29. Anchoring at midday means the
    // 23-hour day still lands on the next calendar date.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })
})

describe('daysBetween', () => {
  it('is signed and symmetric', () => {
    expect(daysBetween('2026-08-01', '2026-08-04')).toBe(3)
    expect(daysBetween('2026-08-04', '2026-08-01')).toBe(-3)
    expect(daysBetween('2026-08-04', '2026-08-04')).toBe(0)
  })
})

describe('startOfWeek', () => {
  it('is Monday-first', () => {
    // 2026-08-03 is a Monday, 2026-08-09 the Sunday that closes that week.
    expect(weekdayOf('2026-08-03')).toBe(1)
    expect(startOfWeek('2026-08-03')).toBe('2026-08-03')
    expect(startOfWeek('2026-08-09')).toBe('2026-08-03')
    expect(startOfWeek('2026-08-06')).toBe('2026-08-03')
  })

  it('returns seven consecutive days starting on Monday', () => {
    expect(weekDays('2026-08-06')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ])
  })
})

describe('isValidDayId', () => {
  it('accepts real dates only', () => {
    expect(isValidDayId('2026-08-03')).toBe(true)
    expect(isValidDayId('2028-02-29')).toBe(true)
  })

  it('rejects impossible or malformed dates', () => {
    expect(isValidDayId('2026-02-30')).toBe(false)
    expect(isValidDayId('2026-13-01')).toBe(false)
    expect(isValidDayId('2026-8-3')).toBe(false)
    expect(isValidDayId('not a date')).toBe(false)
    expect(isValidDayId(20260803)).toBe(false)
    expect(isValidDayId(null)).toBe(false)
  })
})

describe('relativeDayLabel', () => {
  it('names the days around the reference', () => {
    expect(relativeDayLabel('2026-08-03', '2026-08-03')).toBe('Today')
    expect(relativeDayLabel('2026-08-04', '2026-08-03')).toBe('Tomorrow')
    expect(relativeDayLabel('2026-08-02', '2026-08-03')).toBe('Yesterday')
  })
})

describe('ageLabel', () => {
  it('scales the unit with the wait', () => {
    expect(ageLabel('2026-08-03', '2026-08-03')).toBe('0d')
    expect(ageLabel('2026-08-01', '2026-08-04')).toBe('3d')
    expect(ageLabel('2026-07-20', '2026-08-03')).toBe('2w')
    expect(ageLabel('2026-06-01', '2026-08-03')).toBe('2mo')
  })
})
