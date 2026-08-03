/**
 * The only door untrusted data comes through.
 *
 * Two callers, one job: a blob read back from IndexedDB (which a browser
 * extension, a previous version, or a half-finished write could have mangled)
 * and a JSON file the user picked from disk. Both are treated as hostile.
 *
 * The rule is repair over reject. Dropping one malformed task is recoverable;
 * refusing the whole file because a single field is the wrong type would mean
 * losing a year of someone's history to a typo. Only a blob that is not
 * recognisably this app's data returns `null`.
 *
 * `now` is a parameter rather than a call to the clock inside, so that repairing
 * the same blob twice produces the same result. Without it, two migrations a
 * millisecond apart disagree on the `createdAt` they invent for a record that
 * lost one — which is a flaky test today and an unexplainable diff later.
 */

import { isValidDayId } from '../lib/date'
import { newId } from '../lib/id'
import { CURRENT_VERSION } from '../domain/types'
import type {
  AppState,
  Priority,
  RecurrenceRule,
  RecurringTemplate,
  Subtask,
  Task,
  TaskStatus,
  Theme,
} from '../domain/types'

type Unknown = Record<string, unknown>

const isObject = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const bool = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const nullableNum = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const isoOrNull = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null

const priority = (value: unknown): Priority => {
  const n = Math.trunc(num(value, 0))
  return (n >= 0 && n <= 3 ? n : 0) as Priority
}

const status = (value: unknown): TaskStatus =>
  value === 'done' || value === 'dropped' || value === 'open' ? value : 'open'

const theme = (value: unknown): Theme =>
  value === 'light' || value === 'dark' || value === 'system' ? value : 'system'

const tags = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((tag): tag is string => typeof tag === 'string' && tag !== ''))]
    : []

const dayOrNull = (value: unknown): string | null => (isValidDayId(value) ? value : null)

function subtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).flatMap((raw) => {
    const title = str(raw.title).trim()
    if (title === '') return []
    return [{ id: str(raw.id) || newId(), title, done: bool(raw.done) }]
  })
}

/** Returns `null` for anything that cannot be repaired into a usable task. */
function task(value: unknown, now: string): Task | null {
  if (!isObject(value)) return null

  const title = str(value.title).trim()
  const day = value.day
  // A task with no title or no valid day is not a task; there is nothing to
  // show and no day on which to show it.
  if (title === '' || !isValidDayId(day)) return null

  return {
    id: str(value.id) || newId(),
    title,
    notes: str(value.notes),
    status: status(value.status),
    day,
    order: num(value.order, 0),
    priority: priority(value.priority),
    tags: tags(value.tags),
    subtasks: subtasks(value.subtasks),
    estimateMin: nullableNum(value.estimateMin),
    createdAt: isoOrNull(value.createdAt) ?? now,
    completedAt: isoOrNull(value.completedAt),
    carriedFrom: dayOrNull(value.carriedFrom),
    seriesId: typeof value.seriesId === 'string' ? value.seriesId : null,
  }
}

function rule(value: unknown): RecurrenceRule | null {
  if (!isObject(value)) return null

  switch (value.kind) {
    case 'daily':
      return { kind: 'daily' }
    case 'weekly': {
      const weekdays = Array.isArray(value.weekdays)
        ? [...new Set(value.weekdays.filter((d) => typeof d === 'number' && d >= 0 && d <= 6))]
        : []
      return { kind: 'weekly', weekdays }
    }
    case 'everyN': {
      const n = Math.trunc(num(value.n, 1))
      const unit = value.unit === 'week' ? 'week' : 'day'
      return n >= 1 ? { kind: 'everyN', n, unit } : null
    }
    default:
      return null
  }
}

function template(value: unknown, now: string): RecurringTemplate | null {
  if (!isObject(value)) return null

  const title = str(value.title).trim()
  const parsedRule = rule(value.rule)
  const startDay = value.startDay
  if (title === '' || parsedRule === null || !isValidDayId(startDay)) return null

  return {
    id: str(value.id) || newId(),
    title,
    priority: priority(value.priority),
    tags: tags(value.tags),
    rule: parsedRule,
    startDay,
    active: bool(value.active, true),
    createdAt: isoOrNull(value.createdAt) ?? now,
  }
}

/**
 * Accepts either a keyed record or an array — an exported file is easier to
 * read as an array, and older blobs were written as records.
 */
function collect<T extends { id: string }>(value: unknown, parse: (raw: unknown) => T | null) {
  const raws = Array.isArray(value) ? value : isObject(value) ? Object.values(value) : []
  const out: Record<string, T> = {}
  for (const raw of raws) {
    const parsed = parse(raw)
    if (parsed) out[parsed.id] = parsed
  }
  return out
}

/**
 * Normalises any stored or imported blob into current state.
 *
 * Returns `null` only when the input is not plausibly this app's data, which is
 * what lets the importer say "that is not a Today export" instead of silently
 * replacing someone's tasks with an empty list.
 */
export function migrate(input: unknown, now: string = new Date().toISOString()): AppState | null {
  if (!isObject(input)) return null

  const looksLikeOurs =
    'version' in input || 'tasks' in input || ('templates' in input && 'settings' in input)
  if (!looksLikeOurs) return null

  const version = num(input.version, CURRENT_VERSION)
  // Data written by a newer version could rely on fields this build drops on
  // read; refusing is safer than silently truncating it on the next write.
  if (version > CURRENT_VERSION) return null

  const settings = isObject(input.settings) ? input.settings : {}

  return {
    version: CURRENT_VERSION,
    tasks: collect(input.tasks, (raw) => task(raw, now)),
    templates: collect(input.templates, (raw) => template(raw, now)),
    settings: {
      theme: theme(settings.theme),
      lastTriagedDay: dayOrNull(settings.lastTriagedDay),
      lastMaterialisedDay: dayOrNull(settings.lastMaterialisedDay),
    },
  }
}
