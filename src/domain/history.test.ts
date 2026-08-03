import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, historyReducer, initHistory } from './history'
import type { HistoryAction, HistoryState } from './history'
import { sortedTasksOf } from './reducer'
import { emptyState } from './types'

const NOW = '2026-08-03T09:00:00.000Z'
const MONDAY = '2026-08-03'

const step = (state: HistoryState, action: HistoryAction, at = 0) =>
  historyReducer(state, action, at)

const apply = (state: HistoryState, actions: HistoryAction[], at = 0) =>
  actions.reduce((acc, action) => step(acc, action, at), state)

const titles = (state: HistoryState) => sortedTasksOf(state.present, MONDAY).map((t) => t.title)

const start = () => initHistory(emptyState())

const addTask = (input: string): HistoryAction => ({
  type: 'addTask',
  day: MONDAY,
  input,
  now: NOW,
})

describe('undo / redo', () => {
  it('walks back and forward through edits', () => {
    let state = apply(start(), [addTask('A'), addTask('B'), addTask('C')])
    expect(titles(state)).toEqual(['A', 'B', 'C'])

    state = step(state, { type: 'undo' })
    expect(titles(state)).toEqual(['A', 'B'])

    state = step(state, { type: 'undo' })
    expect(titles(state)).toEqual(['A'])

    state = step(state, { type: 'redo' })
    expect(titles(state)).toEqual(['A', 'B'])

    state = step(state, { type: 'redo' })
    expect(titles(state)).toEqual(['A', 'B', 'C'])
  })

  it('does nothing at either end of the timeline', () => {
    const empty = start()
    expect(step(empty, { type: 'undo' })).toBe(empty)
    expect(canUndo(empty)).toBe(false)

    const one = step(empty, addTask('A'))
    expect(step(one, { type: 'redo' })).toBe(one)
    expect(canRedo(one)).toBe(false)
    expect(canUndo(one)).toBe(true)
  })

  it('a new edit after undo drops the abandoned future', () => {
    let state = apply(start(), [addTask('A'), addTask('B')])
    state = step(state, { type: 'undo' })
    state = step(state, addTask('C'))

    expect(titles(state)).toEqual(['A', 'C'])
    expect(canRedo(state)).toBe(false)
  })

  it('undoes a completion', () => {
    let state = step(start(), addTask('Thing'))
    const id = sortedTasksOf(state.present, MONDAY)[0]!.id

    state = step(state, { type: 'toggleTask', id, now: NOW })
    expect(state.present.tasks[id]!.status).toBe('done')

    state = step(state, { type: 'undo' })
    expect(state.present.tasks[id]!.status).toBe('open')
  })

  it('undoes a triage decision', () => {
    let state = step(start(), { type: 'addTask', day: '2026-08-01', input: 'Old', now: NOW })
    const id = Object.keys(state.present.tasks)[0]!

    state = step(state, { type: 'triage', id, decision: 'drop', today: MONDAY })
    expect(state.present.tasks[id]!.status).toBe('dropped')

    state = step(state, { type: 'undo' })
    expect(state.present.tasks[id]!.status).toBe('open')
  })

  it('undoes a drag', () => {
    let state = apply(start(), [addTask('A'), addTask('B')])
    const b = sortedTasksOf(state.present, MONDAY)[1]!

    state = step(state, { type: 'moveTask', id: b.id, toDay: MONDAY, toIndex: 0 })
    expect(titles(state)).toEqual(['B', 'A'])

    state = step(state, { type: 'undo' })
    expect(titles(state)).toEqual(['A', 'B'])
  })
})

describe('coalescing', () => {
  it('collapses a run of edits on the same task into one step', () => {
    let state = step(start(), addTask('Thing'))
    const id = sortedTasksOf(state.present, MONDAY)[0]!.id

    // Typing "Thingy" one letter at a time, inside the coalescing window.
    state = step(state, { type: 'editTask', id, input: 'T' }, 1000)
    state = step(state, { type: 'editTask', id, input: 'Th' }, 1100)
    state = step(state, { type: 'editTask', id, input: 'Thi' }, 1200)
    expect(state.present.tasks[id]!.title).toBe('Thi')

    state = step(state, { type: 'undo' })
    expect(state.present.tasks[id]!.title).toBe('Thing')
  })

  it('starts a new step once the pause is long enough', () => {
    let state = step(start(), addTask('Thing'))
    const id = sortedTasksOf(state.present, MONDAY)[0]!.id

    state = step(state, { type: 'editTask', id, input: 'First edit' }, 1000)
    state = step(state, { type: 'editTask', id, input: 'Second edit' }, 5000)

    state = step(state, { type: 'undo' })
    expect(state.present.tasks[id]!.title).toBe('First edit')
  })

  it('does not merge edits to different tasks', () => {
    let state = apply(start(), [addTask('A'), addTask('B')])
    const [a, b] = sortedTasksOf(state.present, MONDAY)

    state = step(state, { type: 'editTask', id: a!.id, input: 'A edited' }, 1000)
    state = step(state, { type: 'editTask', id: b!.id, input: 'B edited' }, 1050)

    state = step(state, { type: 'undo' })
    expect(state.present.tasks[b!.id]!.title).toBe('B')
    expect(state.present.tasks[a!.id]!.title).toBe('A edited')
  })
})

describe('actions outside the timeline', () => {
  it('a no-op action does not consume an undo slot', () => {
    const state = step(start(), addTask('A'))
    const after = step(state, addTask('   '))
    expect(after).toBe(state)
  })

  it('theme changes are not undoable', () => {
    let state = step(start(), addTask('A'))
    state = step(state, { type: 'setTheme', theme: 'dark' })

    state = step(state, { type: 'undo' })
    expect(titles(state)).toEqual([])
    expect(state.present.settings.theme).toBe('dark')
  })

  it('materialising recurring tasks is not undoable', () => {
    let state = step(start(), {
      type: 'addTemplate',
      title: 'Standup',
      rule: { kind: 'daily' },
      startDay: MONDAY,
      now: NOW,
    })
    state = step(state, { type: 'materialise', day: MONDAY, now: NOW })
    expect(titles(state)).toEqual(['Standup'])

    // Undo reaches past it, to the template creation.
    state = step(state, { type: 'undo' })
    expect(state.present.templates).toEqual({})
  })

  it('hydrating from disk starts a fresh timeline', () => {
    let state = apply(start(), [addTask('A'), addTask('B')])
    state = step(state, { type: 'hydrate', state: emptyState() })

    expect(canUndo(state)).toBe(false)
    expect(canRedo(state)).toBe(false)
  })

  it('importing a file cannot be undone into the previous data', () => {
    let state = apply(start(), [addTask('A')])
    state = step(state, { type: 'importState', state: emptyState() })

    expect(canUndo(state)).toBe(false)
    expect(titles(state)).toEqual([])
  })
})

describe('bounded history', () => {
  it('keeps the timeline to a fixed depth', () => {
    let state = start()
    for (let i = 0; i < 250; i++) state = step(state, addTask(`Task ${i}`))

    expect(state.past.length).toBeLessThanOrEqual(100)

    // Undoing everything available never throws and never empties the list
    // beyond what history remembers.
    while (canUndo(state)) state = step(state, { type: 'undo' })
    expect(titles(state).length).toBeGreaterThan(0)
  })
})
