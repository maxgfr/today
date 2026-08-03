/**
 * Read models.
 *
 * Everything the UI shows is derived here rather than stored, so there is no
 * second copy of the truth to fall out of sync — counts, streaks and tag lists
 * cannot disagree with the tasks they describe.
 */

import { addDays, daysBetween, weekDays } from '../lib/date'
import type { AppState, DayId, Task } from './types'

export type Filters = {
  query: string
  tags: string[]
  priorities: number[]
  hideDone: boolean
}

export const noFilters: Filters = { query: '', tags: [], priorities: [], hideDone: false }

export const hasActiveFilters = (filters: Filters): boolean =>
  filters.query.trim() !== '' ||
  filters.tags.length > 0 ||
  filters.priorities.length > 0 ||
  filters.hideDone

export function tasksForDay(state: AppState, day: DayId): Task[] {
  return Object.values(state.tasks)
    .filter((task) => task.day === day && task.status !== 'dropped')
    .sort((a, b) => a.order - b.order)
}

export function matchesFilters(task: Task, filters: Filters): boolean {
  if (filters.hideDone && task.status === 'done') return false
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false
  if (filters.tags.length > 0 && !filters.tags.some((tag) => task.tags.includes(tag))) return false

  const query = filters.query.trim().toLowerCase()
  if (query === '') return true

  return (
    task.title.toLowerCase().includes(query) ||
    task.notes.toLowerCase().includes(query) ||
    task.tags.some((tag) => tag.includes(query)) ||
    task.subtasks.some((subtask) => subtask.title.toLowerCase().includes(query))
  )
}

export type DayProgress = {
  total: number
  done: number
  /** 0–1. A day with no tasks is 0, not 1: nothing was asked, nothing achieved. */
  ratio: number
  /** True only when there was something to do and all of it is done. */
  complete: boolean
  estimateMin: number
  remainingMin: number
}

export function dayProgress(state: AppState, day: DayId): DayProgress {
  const tasks = tasksForDay(state, day)
  const done = tasks.filter((task) => task.status === 'done').length
  const estimateMin = tasks.reduce((sum, task) => sum + (task.estimateMin ?? 0), 0)
  const remainingMin = tasks
    .filter((task) => task.status === 'open')
    .reduce((sum, task) => sum + (task.estimateMin ?? 0), 0)

  return {
    total: tasks.length,
    done,
    ratio: tasks.length === 0 ? 0 : done / tasks.length,
    complete: tasks.length > 0 && done === tasks.length,
    estimateMin,
    remainingMin,
  }
}

/** Every tag in use, most-used first. Powers the filter bar and the palette. */
export function allTags(state: AppState): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const task of Object.values(state.tasks)) {
    if (task.status === 'dropped') continue
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** Full-text search across every day. The palette's task results come from here. */
export function searchTasks(state: AppState, query: string, limit = 20): Task[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed === '') return []

  return Object.values(state.tasks)
    .filter((task) => task.status !== 'dropped' && matchesFilters(task, { ...noFilters, query }))
    .sort((a, b) => {
      // Prefix matches first, then the most recent day.
      const aStarts = a.title.toLowerCase().startsWith(trimmed)
      const bStarts = b.title.toLowerCase().startsWith(trimmed)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return b.day.localeCompare(a.day) || a.order - b.order
    })
    .slice(0, limit)
}

export type WeekStats = {
  days: { day: DayId; total: number; done: number }[]
  total: number
  done: number
  ratio: number
}

export function weekStats(state: AppState, anchor: DayId): WeekStats {
  const days = weekDays(anchor).map((day) => {
    const progress = dayProgress(state, day)
    return { day, total: progress.total, done: progress.done }
  })
  const total = days.reduce((sum, day) => sum + day.total, 0)
  const done = days.reduce((sum, day) => sum + day.done, 0)
  return { days, total, done, ratio: total === 0 ? 0 : done / total }
}

/**
 * Consecutive days, ending today, on which every planned task was completed.
 *
 * Days with no tasks are skipped rather than breaking the run — a weekend you
 * deliberately left empty is not a failure, and punishing it would push people
 * to file fake tasks to protect a number.
 *
 * Today is also forgiving: an unfinished today does not break a streak that is
 * still in progress, it just does not extend it yet.
 */
export function currentStreak(state: AppState, today: DayId): number {
  let streak = 0
  let cursor = today
  let inspected = 0

  while (inspected < 366) {
    const progress = dayProgress(state, cursor)

    if (progress.total === 0) {
      if (cursor !== today && streak === 0 && inspected > 0) break
    } else if (progress.complete) {
      streak += 1
    } else if (cursor === today) {
      // In progress, not yet a break.
    } else {
      break
    }

    cursor = addDays(cursor, -1)
    inspected += 1
  }

  return streak
}

export type LifetimeStats = {
  completed: number
  activeDays: number
  perfectDays: number
  busiestDay: { day: DayId; done: number } | null
}

export function lifetimeStats(state: AppState): LifetimeStats {
  const byDay = new Map<DayId, { total: number; done: number }>()

  for (const task of Object.values(state.tasks)) {
    if (task.status === 'dropped') continue
    const entry = byDay.get(task.day) ?? { total: 0, done: 0 }
    entry.total += 1
    if (task.status === 'done') entry.done += 1
    byDay.set(task.day, entry)
  }

  let completed = 0
  let perfectDays = 0
  let busiestDay: { day: DayId; done: number } | null = null

  for (const [day, entry] of byDay) {
    completed += entry.done
    if (entry.total > 0 && entry.done === entry.total) perfectDays += 1
    if (entry.done > 0 && (busiestDay === null || entry.done > busiestDay.done)) {
      busiestDay = { day, done: entry.done }
    }
  }

  return { completed, activeDays: byDay.size, perfectDays, busiestDay }
}

/** How long a carried task has been waiting, in days. */
export const taskAge = (task: Task, today: DayId): number =>
  task.carriedFrom === null ? 0 : Math.max(0, daysBetween(task.carriedFrom, today))
