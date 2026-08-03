import { describe, expect, it } from 'vitest'
import { carriedOverTasks, needsTriage, reducer, sortedTasksOf } from './reducer'
import type { Action } from './reducer'
import { emptyState } from './types'
import type { AppState, Task } from './types'

const NOW = '2026-08-03T09:00:00.000Z'
const MONDAY = '2026-08-03'
const TUESDAY = '2026-08-04'
const SUNDAY = '2026-08-02'

const apply = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)

const add = (day: string, input: string): Action => ({ type: 'addTask', day, input, now: NOW })

const titles = (state: AppState, day: string) => sortedTasksOf(state, day).map((t) => t.title)

const only = (state: AppState): Task => {
  const tasks = Object.values(state.tasks)
  expect(tasks).toHaveLength(1)
  return tasks[0]!
}

describe('addTask', () => {
  it('parses markers and files the task on the given day', () => {
    const state = apply(emptyState(), add(MONDAY, 'Ship it #dev !2 ~30m'))
    const task = only(state)

    expect(task).toMatchObject({
      title: 'Ship it',
      day: MONDAY,
      status: 'open',
      priority: 2,
      tags: ['dev'],
      estimateMin: 30,
      completedAt: null,
      carriedFrom: null,
      seriesId: null,
    })
  })

  it('appends in typing order', () => {
    const state = apply(
      emptyState(),
      add(MONDAY, 'First'),
      add(MONDAY, 'Second'),
      add(MONDAY, 'Third'),
    )
    expect(titles(state, MONDAY)).toEqual(['First', 'Second', 'Third'])
  })

  it('can prepend', () => {
    const state = apply(emptyState(), add(MONDAY, 'First'), {
      type: 'addTask',
      day: MONDAY,
      input: 'Urgent',
      now: NOW,
      position: 'start',
    })
    expect(titles(state, MONDAY)).toEqual(['Urgent', 'First'])
  })

  it('ignores an input with no title', () => {
    const before = emptyState()
    expect(reducer(before, add(MONDAY, '   '))).toBe(before)
    expect(reducer(before, add(MONDAY, '#tag !1'))).toBe(before)
  })
})

describe('toggleTask', () => {
  it('stamps and clears the completion time', () => {
    let state = apply(emptyState(), add(MONDAY, 'Thing'))
    const id = only(state).id

    state = reducer(state, { type: 'toggleTask', id, now: NOW })
    expect(only(state)).toMatchObject({ status: 'done', completedAt: NOW })

    state = reducer(state, { type: 'toggleTask', id, now: NOW })
    expect(only(state)).toMatchObject({ status: 'open', completedAt: null })
  })

  it('leaves the position alone, so a completed task does not jump', () => {
    let state = apply(emptyState(), add(MONDAY, 'A'), add(MONDAY, 'B'), add(MONDAY, 'C'))
    const b = sortedTasksOf(state, MONDAY)[1]!
    state = reducer(state, { type: 'toggleTask', id: b.id, now: NOW })
    expect(titles(state, MONDAY)).toEqual(['A', 'B', 'C'])
  })
})

describe('editTask', () => {
  it('replaces the title', () => {
    let state = apply(emptyState(), add(MONDAY, 'Old title'))
    state = reducer(state, { type: 'editTask', id: only(state).id, input: 'New title' })
    expect(only(state).title).toBe('New title')
  })

  it('does not wipe metadata the edit did not mention', () => {
    let state = apply(emptyState(), add(MONDAY, 'Thing #dev !1 ~30m'))
    state = reducer(state, { type: 'editTask', id: only(state).id, input: 'Renamed thing' })

    expect(only(state)).toMatchObject({
      title: 'Renamed thing',
      tags: ['dev'],
      priority: 1,
      estimateMin: 30,
    })
  })

  it('overwrites metadata that the edit does mention', () => {
    let state = apply(emptyState(), add(MONDAY, 'Thing #dev !1'))
    state = reducer(state, { type: 'editTask', id: only(state).id, input: 'Thing #ops !3' })
    expect(only(state)).toMatchObject({ tags: ['ops'], priority: 3 })
  })

  it('refuses to empty a title', () => {
    const state = apply(emptyState(), add(MONDAY, 'Thing'))
    expect(reducer(state, { type: 'editTask', id: only(state).id, input: '  ' })).toBe(state)
  })
})

describe('moveTask', () => {
  it('reorders within a day', () => {
    let state = apply(emptyState(), add(MONDAY, 'A'), add(MONDAY, 'B'), add(MONDAY, 'C'))
    const c = sortedTasksOf(state, MONDAY)[2]!

    state = reducer(state, { type: 'moveTask', id: c.id, toDay: MONDAY, toIndex: 0 })
    expect(titles(state, MONDAY)).toEqual(['C', 'A', 'B'])
  })

  it('moves a task to another day at the requested position', () => {
    let state = apply(emptyState(), add(MONDAY, 'A'), add(TUESDAY, 'X'), add(TUESDAY, 'Y'))
    const a = sortedTasksOf(state, MONDAY)[0]!

    state = reducer(state, { type: 'moveTask', id: a.id, toDay: TUESDAY, toIndex: 1 })
    expect(titles(state, MONDAY)).toEqual([])
    expect(titles(state, TUESDAY)).toEqual(['X', 'A', 'Y'])
  })

  it('clamps an out-of-range index instead of losing the task', () => {
    let state = apply(emptyState(), add(MONDAY, 'A'), add(MONDAY, 'B'))
    const a = sortedTasksOf(state, MONDAY)[0]!

    state = reducer(state, { type: 'moveTask', id: a.id, toDay: MONDAY, toIndex: 99 })
    expect(titles(state, MONDAY)).toEqual(['B', 'A'])
  })

  it('survives enough repeated drops to exhaust float precision', () => {
    let state = apply(emptyState(), add(MONDAY, 'A'), add(MONDAY, 'B'), add(MONDAY, 'C'))

    for (let i = 0; i < 80; i++) {
      const target = sortedTasksOf(state, MONDAY)[2]!
      state = reducer(state, { type: 'moveTask', id: target.id, toDay: MONDAY, toIndex: 1 })
    }

    const final = sortedTasksOf(state, MONDAY)
    expect(final).toHaveLength(3)
    expect(new Set(final.map((t) => t.order)).size).toBe(3)
  })
})

describe('carried-over triage', () => {
  const withStale = () =>
    apply(
      emptyState(),
      add(SUNDAY, 'Left over'),
      add('2026-07-30', 'Very old'),
      add(MONDAY, "Today's"),
    )

  it('lists only open tasks from earlier days, oldest first', () => {
    expect(carriedOverTasks(withStale(), MONDAY).map((t) => t.title)).toEqual([
      'Very old',
      'Left over',
    ])
  })

  it('does not carry a completed task forward', () => {
    let state = withStale()
    const stale = carriedOverTasks(state, MONDAY)[0]!
    state = reducer(state, { type: 'toggleTask', id: stale.id, now: NOW })
    expect(carriedOverTasks(state, MONDAY).map((t) => t.title)).toEqual(['Left over'])
  })

  it('nothing moves on its own — the day is untouched until triaged', () => {
    expect(titles(withStale(), MONDAY)).toEqual(["Today's"])
  })

  it('keep moves the task to today and records where it came from', () => {
    let state = withStale()
    const stale = carriedOverTasks(state, MONDAY).find((t) => t.title === 'Left over')!

    state = reducer(state, { type: 'triage', id: stale.id, decision: 'keep', today: MONDAY })
    expect(state.tasks[stale.id]).toMatchObject({ day: MONDAY, carriedFrom: SUNDAY })
  })

  it('later pushes to tomorrow', () => {
    let state = withStale()
    const stale = carriedOverTasks(state, MONDAY).find((t) => t.title === 'Left over')!

    state = reducer(state, { type: 'triage', id: stale.id, decision: 'later', today: MONDAY })
    expect(state.tasks[stale.id]).toMatchObject({ day: TUESDAY, carriedFrom: SUNDAY })
  })

  it('drop hides the task without deleting the record', () => {
    let state = withStale()
    const stale = carriedOverTasks(state, MONDAY).find((t) => t.title === 'Left over')!

    state = reducer(state, { type: 'triage', id: stale.id, decision: 'drop', today: MONDAY })
    expect(state.tasks[stale.id]!.status).toBe('dropped')
    expect(carriedOverTasks(state, MONDAY).map((t) => t.title)).toEqual(['Very old'])
  })

  it('keeps the original origin day across repeated carries', () => {
    let state = apply(emptyState(), add('2026-07-30', 'Ancient'))
    const id = only(state).id

    state = reducer(state, { type: 'triage', id, decision: 'keep', today: SUNDAY })
    state = reducer(state, { type: 'triage', id, decision: 'keep', today: MONDAY })

    // Not '2026-08-02': the badge must say how old the task really is.
    expect(state.tasks[id]!.carriedFrom).toBe('2026-07-30')
  })

  it('triageAll applies one decision and closes the tray', () => {
    let state = withStale()
    state = reducer(state, { type: 'triageAll', decision: 'keep', today: MONDAY })

    expect(titles(state, MONDAY).sort()).toEqual(["Today's", 'Left over', 'Very old'].sort())
    expect(state.settings.lastTriagedDay).toBe(MONDAY)
    expect(needsTriage(state, MONDAY)).toBe(false)
  })

  it('reopens the tray the next day', () => {
    let state = withStale()
    state = reducer(state, { type: 'dismissTriage', today: MONDAY })
    expect(needsTriage(state, MONDAY)).toBe(false)
    expect(needsTriage(state, TUESDAY)).toBe(true)
  })

  it('stays closed when there is nothing to triage', () => {
    const state = apply(emptyState(), add(MONDAY, 'Only today'))
    expect(needsTriage(state, MONDAY)).toBe(false)
  })
})

describe('subtasks', () => {
  it('adds, toggles, edits and removes', () => {
    let state = apply(emptyState(), add(MONDAY, 'Parent'))
    const taskId = only(state).id

    state = reducer(state, { type: 'addSubtask', taskId, title: 'Step one' })
    const subtaskId = only(state).subtasks[0]!.id
    expect(only(state).subtasks).toHaveLength(1)

    state = reducer(state, { type: 'toggleSubtask', taskId, subtaskId })
    expect(only(state).subtasks[0]!.done).toBe(true)

    state = reducer(state, { type: 'editSubtask', taskId, subtaskId, title: 'Step 1' })
    expect(only(state).subtasks[0]!.title).toBe('Step 1')

    state = reducer(state, { type: 'deleteSubtask', taskId, subtaskId })
    expect(only(state).subtasks).toEqual([])
  })

  it('ignores a blank subtask', () => {
    const state = apply(emptyState(), add(MONDAY, 'Parent'))
    expect(reducer(state, { type: 'addSubtask', taskId: only(state).id, title: '  ' })).toBe(state)
  })
})

describe('clearAll', () => {
  it('wipes the data but keeps the chosen theme', () => {
    let state = apply(emptyState(), add(MONDAY, 'Thing'))
    state = reducer(state, { type: 'setTheme', theme: 'dark' })
    state = reducer(state, { type: 'clearAll' })

    expect(state.tasks).toEqual({})
    expect(state.templates).toEqual({})
    expect(state.settings.theme).toBe('dark')
  })
})

describe('unknown targets', () => {
  it('are no-ops rather than crashes', () => {
    const state = emptyState()
    for (const action of [
      { type: 'toggleTask', id: 'nope', now: NOW },
      { type: 'deleteTask', id: 'nope' },
      { type: 'editTask', id: 'nope', input: 'x' },
      { type: 'setPriority', id: 'nope', priority: 1 },
      { type: 'moveTask', id: 'nope', toDay: MONDAY, toIndex: 0 },
      { type: 'triage', id: 'nope', decision: 'keep', today: MONDAY },
      { type: 'deleteTemplate', id: 'nope' },
    ] satisfies Action[]) {
      expect(reducer(state, action)).toBe(state)
    }
  })
})
