/**
 * The whole domain in one file.
 *
 * Two rules shape every type here:
 *
 * 1. A task always belongs to a day. There is no inbox, no backlog, no
 *    "someday" bucket — if it is not on a day, it does not exist. That is what
 *    keeps the app about *today* instead of about a growing pile.
 * 2. Nothing moves on its own. A task written for Monday stays on Monday until
 *    a person decides otherwise, which is what makes the morning triage
 *    meaningful rather than decorative.
 */

/** A calendar day in the user's own timezone, `YYYY-MM-DD`. Never a Date. */
export type DayId = string

export type TaskStatus = 'open' | 'done' | 'dropped'

/** 0 means "no priority" and sorts last. 1 is the most urgent. */
export type Priority = 0 | 1 | 2 | 3

export type Subtask = {
  id: string
  title: string
  done: boolean
}

export type Task = {
  id: string
  title: string
  notes: string
  status: TaskStatus
  day: DayId
  /** Fractional index within its day. Renormalised when neighbours get too close. */
  order: number
  priority: Priority
  tags: string[]
  subtasks: Subtask[]
  estimateMin: number | null
  createdAt: string
  completedAt: string | null
  /** The day this task was first written for, set when it is carried forward. */
  carriedFrom: DayId | null
  /** Links an instance back to the recurring template that produced it. */
  seriesId: string | null
}

export type RecurrenceRule =
  | { kind: 'daily' }
  /** `weekdays` uses 0 = Sunday, matching `Date.prototype.getDay`. */
  | { kind: 'weekly'; weekdays: number[] }
  | { kind: 'everyN'; n: number; unit: 'day' | 'week' }

export type RecurringTemplate = {
  id: string
  title: string
  priority: Priority
  tags: string[]
  rule: RecurrenceRule
  /** No instance is ever produced before this day. */
  startDay: DayId
  active: boolean
  createdAt: string
}

export type Theme = 'light' | 'dark' | 'system'

export type Settings = {
  theme: Theme
  /**
   * The last day whose carried-over tasks were triaged. Guards the tray from
   * reappearing after it has been dealt with, without needing a per-task flag.
   */
  lastTriagedDay: DayId | null
  /** The last day recurring templates were materialised for. */
  lastMaterialisedDay: DayId | null
}

export type AppState = {
  version: 1
  tasks: Record<string, Task>
  templates: Record<string, RecurringTemplate>
  settings: Settings
}

export const CURRENT_VERSION = 1 as const

export const emptyState = (): AppState => ({
  version: CURRENT_VERSION,
  tasks: {},
  templates: {},
  settings: { theme: 'system', lastTriagedDay: null, lastMaterialisedDay: null },
})
