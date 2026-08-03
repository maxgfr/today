import { describe, expect, it } from 'vitest'
import {
  allTags,
  currentStreak,
  dayProgress,
  lifetimeStats,
  matchesFilters,
  noFilters,
  searchTasks,
  taskAge,
  weekStats,
} from './selectors'
import { reducer, sortedTasksOf } from './reducer'
import type { Action } from './reducer'
import { emptyState } from './types'
import type { AppState } from './types'

const NOW = '2026-08-03T09:00:00.000Z'
const MONDAY = '2026-08-03'

const apply = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)

const add = (day: string, input: string): Action => ({ type: 'addTask', day, input, now: NOW })

/** Builds a day where the first `done` tasks of `total` are completed. */
function day(state: AppState, dayId: string, total: number, done: number): AppState {
  let next = state
  for (let i = 0; i < total; i++) next = reducer(next, add(dayId, `${dayId} task ${i}`))
  for (const task of sortedTasksOf(next, dayId).slice(0, done)) {
    next = reducer(next, { type: 'toggleTask', id: task.id, now: NOW })
  }
  return next
}

describe('dayProgress', () => {
  it('counts what is done against what was planned', () => {
    const state = day(emptyState(), MONDAY, 4, 3)
    expect(dayProgress(state, MONDAY)).toMatchObject({ total: 4, done: 3, complete: false })
    expect(dayProgress(state, MONDAY).ratio).toBeCloseTo(0.75)
  })

  it('an empty day is not a complete day', () => {
    // Nothing was asked, so nothing was achieved — 100% here would be a lie.
    expect(dayProgress(emptyState(), MONDAY)).toMatchObject({
      total: 0,
      done: 0,
      ratio: 0,
      complete: false,
    })
  })

  it('is complete only when everything planned is done', () => {
    expect(dayProgress(day(emptyState(), MONDAY, 3, 3), MONDAY).complete).toBe(true)
  })

  it('excludes dropped tasks from the count', () => {
    let state = apply(emptyState(), add(MONDAY, 'Keep'), add(MONDAY, 'Drop'))
    const dropped = sortedTasksOf(state, MONDAY)[1]!
    state = reducer(state, { type: 'triage', id: dropped.id, decision: 'drop', today: MONDAY })
    expect(dayProgress(state, MONDAY).total).toBe(1)
  })

  it('sums estimates and tracks what is left', () => {
    let state = apply(emptyState(), add(MONDAY, 'A ~30m'), add(MONDAY, 'B ~1h'))
    const a = sortedTasksOf(state, MONDAY)[0]!
    state = reducer(state, { type: 'toggleTask', id: a.id, now: NOW })

    expect(dayProgress(state, MONDAY)).toMatchObject({ estimateMin: 90, remainingMin: 60 })
  })
})

describe('allTags', () => {
  it('ranks tags by use, then alphabetically', () => {
    const state = apply(
      emptyState(),
      add(MONDAY, 'A #dev'),
      add(MONDAY, 'B #dev'),
      add(MONDAY, 'C #ops'),
      add(MONDAY, 'D #admin'),
    )
    expect(allTags(state)).toEqual([
      { tag: 'dev', count: 2 },
      { tag: 'admin', count: 1 },
      { tag: 'ops', count: 1 },
    ])
  })
})

describe('matchesFilters', () => {
  const state = apply(emptyState(), add(MONDAY, 'Review the deploy pipeline #dev !1'))
  const task = sortedTasksOf(state, MONDAY)[0]!

  it('matches on any substring of the title', () => {
    expect(matchesFilters(task, { ...noFilters, query: 'deploy' })).toBe(true)
    expect(matchesFilters(task, { ...noFilters, query: 'DEPLOY' })).toBe(true)
    expect(matchesFilters(task, { ...noFilters, query: 'nothing' })).toBe(false)
  })

  it('matches on tags and priority', () => {
    expect(matchesFilters(task, { ...noFilters, tags: ['dev'] })).toBe(true)
    expect(matchesFilters(task, { ...noFilters, tags: ['ops'] })).toBe(false)
    expect(matchesFilters(task, { ...noFilters, priorities: [1] })).toBe(true)
    expect(matchesFilters(task, { ...noFilters, priorities: [2, 3] })).toBe(false)
  })

  it('matches on notes and subtasks', () => {
    const withDetail = reducer(
      reducer(state, { type: 'setNotes', id: task.id, notes: 'ask Chris first' }),
      { type: 'addSubtask', taskId: task.id, title: 'draft the rollback plan' },
    )
    const detailed = withDetail.tasks[task.id]!

    expect(matchesFilters(detailed, { ...noFilters, query: 'chris' })).toBe(true)
    expect(matchesFilters(detailed, { ...noFilters, query: 'rollback' })).toBe(true)
  })

  it('hides completed tasks when asked', () => {
    const done = reducer(state, { type: 'toggleTask', id: task.id, now: NOW })
    expect(matchesFilters(done.tasks[task.id]!, { ...noFilters, hideDone: true })).toBe(false)
  })
})

describe('searchTasks', () => {
  it('returns nothing for an empty query', () => {
    const state = apply(emptyState(), add(MONDAY, 'Something'))
    expect(searchTasks(state, '  ')).toEqual([])
  })

  it('puts prefix matches first', () => {
    const state = apply(emptyState(), add(MONDAY, 'Review the deploy'), add(MONDAY, 'Deploy it'))
    expect(searchTasks(state, 'deploy').map((t) => t.title)).toEqual([
      'Deploy it',
      'Review the deploy',
    ])
  })

  it('searches across every day, most recent first', () => {
    const state = apply(emptyState(), add('2026-08-01', 'Ship old'), add('2026-08-05', 'Ship new'))
    expect(searchTasks(state, 'ship').map((t) => t.title)).toEqual(['Ship new', 'Ship old'])
  })

  it('skips dropped tasks', () => {
    let state = apply(emptyState(), add(MONDAY, 'Abandoned thing'))
    const id = sortedTasksOf(state, MONDAY)[0]!.id
    state = reducer(state, { type: 'triage', id, decision: 'drop', today: MONDAY })
    expect(searchTasks(state, 'abandoned')).toEqual([])
  })
})

describe('weekStats', () => {
  it('reports seven Monday-first days', () => {
    let state = day(emptyState(), '2026-08-03', 3, 3)
    state = day(state, '2026-08-05', 2, 1)

    const stats = weekStats(state, '2026-08-06')
    expect(stats.days.map((d) => d.day)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ])
    expect(stats).toMatchObject({ total: 5, done: 4 })
    expect(stats.ratio).toBeCloseTo(0.8)
  })

  it('an empty week does not divide by zero', () => {
    expect(weekStats(emptyState(), MONDAY)).toMatchObject({ total: 0, done: 0, ratio: 0 })
  })
})

describe('currentStreak', () => {
  it('counts consecutive fully-completed days', () => {
    let state = day(emptyState(), '2026-08-01', 2, 2)
    state = day(state, '2026-08-02', 1, 1)
    state = day(state, '2026-08-03', 3, 3)

    expect(currentStreak(state, '2026-08-03')).toBe(3)
  })

  it('breaks on a day left unfinished', () => {
    let state = day(emptyState(), '2026-08-01', 2, 2)
    state = day(state, '2026-08-02', 2, 1)
    state = day(state, '2026-08-03', 1, 1)

    expect(currentStreak(state, '2026-08-03')).toBe(1)
  })

  it('an unfinished today does not break a run in progress', () => {
    // The day is not over. Punishing it at 10am would be nonsense.
    let state = day(emptyState(), '2026-08-01', 1, 1)
    state = day(state, '2026-08-02', 1, 1)
    state = day(state, '2026-08-03', 3, 1)

    expect(currentStreak(state, '2026-08-03')).toBe(2)
  })

  it('a day with no tasks is skipped, not counted as a failure', () => {
    // A deliberately empty weekend should not cost anyone their streak.
    let state = day(emptyState(), '2026-08-01', 1, 1)
    state = day(state, '2026-08-03', 1, 1)

    expect(currentStreak(state, '2026-08-03')).toBe(2)
  })

  it('is zero with no history at all', () => {
    expect(currentStreak(emptyState(), MONDAY)).toBe(0)
  })

  it('terminates instead of scanning forever', () => {
    expect(currentStreak(day(emptyState(), MONDAY, 1, 1), MONDAY)).toBe(1)
  })
})

describe('lifetimeStats', () => {
  it('summarises the whole history', () => {
    let state = day(emptyState(), '2026-08-01', 2, 2)
    state = day(state, '2026-08-02', 4, 1)

    expect(lifetimeStats(state)).toMatchObject({
      completed: 3,
      activeDays: 2,
      perfectDays: 1,
      busiestDay: { day: '2026-08-01', done: 2 },
    })
  })

  it('has no busiest day before anything is completed', () => {
    expect(lifetimeStats(day(emptyState(), MONDAY, 3, 0)).busiestDay).toBeNull()
  })
})

describe('taskAge', () => {
  it('is zero for a task that was never carried', () => {
    const state = apply(emptyState(), add(MONDAY, 'Fresh'))
    expect(taskAge(sortedTasksOf(state, MONDAY)[0]!, MONDAY)).toBe(0)
  })

  it('measures from where the task originally sat', () => {
    let state = apply(emptyState(), add('2026-07-31', 'Old'))
    const id = Object.keys(state.tasks)[0]!
    state = reducer(state, { type: 'triage', id, decision: 'keep', today: MONDAY })

    expect(taskAge(state.tasks[id]!, MONDAY)).toBe(3)
  })
})
