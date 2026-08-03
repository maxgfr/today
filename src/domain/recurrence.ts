/**
 * Recurring tasks, materialised lazily.
 *
 * A recurring task is a *template*, not a stream of rows. Instances are created
 * only when a day is actually opened, which has two consequences worth keeping:
 *
 * - Turning on "every weekday" does not retroactively invent months of tasks
 *   you never saw and never did. Recurrence describes intent going forward.
 * - The store stays proportional to days you have used, not to days that exist.
 *
 * Once materialised, an instance is an ordinary task: edit it, drop it, carry
 * it. Changing the template does not reach back and rewrite what already
 * happened.
 */

import { newId } from '../lib/id'
import { daysBetween, weekdayOf } from '../lib/date'
import type { AppState, DayId, RecurrenceRule, RecurringTemplate, Task } from './types'

export function occursOn(rule: RecurrenceRule, startDay: DayId, day: DayId): boolean {
  if (day < startDay) return false

  switch (rule.kind) {
    case 'daily':
      return true
    case 'weekly':
      return rule.weekdays.includes(weekdayOf(day))
    case 'everyN': {
      if (rule.n < 1) return false
      const elapsed = daysBetween(startDay, day)
      const step = rule.unit === 'week' ? rule.n * 7 : rule.n
      return elapsed % step === 0
    }
  }
}

const instanceExists = (state: AppState, templateId: string, day: DayId): boolean =>
  Object.values(state.tasks).some((task) => task.seriesId === templateId && task.day === day)

function instantiate(template: RecurringTemplate, day: DayId, now: string): Task {
  return {
    id: newId(),
    title: template.title,
    notes: '',
    status: 'open',
    day,
    order: 0, // The reducer assigns the real position against the day's tasks.
    priority: template.priority,
    tags: template.tags,
    subtasks: [],
    estimateMin: null,
    createdAt: now,
    completedAt: null,
    carriedFrom: null,
    seriesId: template.id,
  }
}

/**
 * Instances due on `day` that do not exist yet.
 *
 * The existence check covers dropped and completed instances too, so reopening
 * a day never resurrects a task that was already dealt with.
 */
export function dueInstances(state: AppState, day: DayId, now: string): Task[] {
  return Object.values(state.templates)
    .filter(
      (template) =>
        template.active &&
        occursOn(template.rule, template.startDay, day) &&
        !instanceExists(state, template.id, day),
    )
    .map((template) => instantiate(template, day, now))
}

export function describeRule(rule: RecurrenceRule): string {
  switch (rule.kind) {
    case 'daily':
      return 'Every day'
    case 'weekly': {
      if (rule.weekdays.length === 0) return 'Never'
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const sorted = [...rule.weekdays].sort((a, b) => a - b)
      if (sorted.join() === '1,2,3,4,5') return 'Every weekday'
      if (sorted.join() === '0,6') return 'Every weekend'
      if (sorted.length === 7) return 'Every day'
      return `Every ${sorted.map((d) => names[d]).join(', ')}`
    }
    case 'everyN':
      return rule.n === 1 ? `Every ${rule.unit}` : `Every ${rule.n} ${rule.unit}s`
  }
}
