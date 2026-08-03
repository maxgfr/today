/**
 * Day arithmetic in local time.
 *
 * Everything here works on `YYYY-MM-DD` strings rather than `Date` objects.
 * A to-do app lives in the user's own timezone: "today" is whatever the wall
 * clock says, and a task written at 23:50 belongs to that evening, not to the
 * UTC day that has already rolled over. Formatting `Date` to a local day string
 * once, at the edge, keeps every downstream comparison a plain string compare.
 */

import type { DayId } from '../domain/types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day for a `Date`. Never uses `toISOString` — that is UTC. */
export function toDayId(date: Date): DayId {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function today(now: Date = new Date()): DayId {
  return toDayId(now)
}

/** Midday, so that a DST shift can never push the date onto a neighbouring day. */
export function fromDayId(day: DayId): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function addDays(day: DayId, delta: number): DayId {
  const date = fromDayId(day)
  date.setDate(date.getDate() + delta)
  return toDayId(date)
}

/** Whole days from `a` to `b`. Negative when `b` is in the past. */
export function daysBetween(a: DayId, b: DayId): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((fromDayId(b).getTime() - fromDayId(a).getTime()) / MS_PER_DAY)
}

/** 0 = Sunday, matching `Date.prototype.getDay`. */
export function weekdayOf(day: DayId): number {
  return fromDayId(day).getDay()
}

/** Monday-first, because a week of work starts on Monday. */
export function startOfWeek(day: DayId): DayId {
  const weekday = weekdayOf(day)
  const backToMonday = weekday === 0 ? 6 : weekday - 1
  return addDays(day, -backToMonday)
}

export function weekDays(anchor: DayId): DayId[] {
  const monday = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function isValidDayId(value: unknown): value is DayId {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  // Rejects 2026-02-30 and friends: the round-trip only survives a real date.
  return toDayId(fromDayId(value)) === value
}

const RELATIVE: Record<number, string> = {
  [-1]: 'Yesterday',
  0: 'Today',
  1: 'Tomorrow',
}

/** "Today", "Tomorrow", else a weekday name. Used where space is tight. */
export function relativeDayLabel(day: DayId, reference: DayId): string {
  const delta = daysBetween(reference, day)
  return (
    RELATIVE[delta] ??
    fromDayId(day).toLocaleDateString(undefined, {
      weekday: 'long',
      ...(Math.abs(delta) > 6 ? { month: 'short', day: 'numeric' } : {}),
    })
  )
}

export function formatWeekday(day: DayId): string {
  return fromDayId(day).toLocaleDateString(undefined, { weekday: 'long' })
}

export function formatShortWeekday(day: DayId): string {
  return fromDayId(day).toLocaleDateString(undefined, { weekday: 'short' })
}

export function formatMonthDay(day: DayId): string {
  return fromDayId(day).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

export function formatFullDate(day: DayId): string {
  return fromDayId(day).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** "3d" / "2w" — how long a carried-over task has been waiting. */
export function ageLabel(from: DayId, to: DayId): string {
  const days = Math.max(0, daysBetween(from, to))
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}
