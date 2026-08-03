import { describe, expect, it } from 'vitest'
import { describeRule, dueInstances, occursOn } from './recurrence'
import { reducer, sortedTasksOf } from './reducer'
import type { Action } from './reducer'
import { emptyState } from './types'
import type { AppState, RecurrenceRule } from './types'

const NOW = '2026-08-03T09:00:00.000Z'
const MONDAY = '2026-08-03'
const TUESDAY = '2026-08-04'
const WEDNESDAY = '2026-08-05'
const NEXT_MONDAY = '2026-08-10'

const apply = (state: AppState, ...actions: Action[]): AppState => actions.reduce(reducer, state)

const withTemplate = (rule: RecurrenceRule, startDay = MONDAY, title = 'Standup'): AppState =>
  apply(emptyState(), { type: 'addTemplate', title, rule, startDay, now: NOW })

describe('occursOn', () => {
  it('never fires before the start day', () => {
    expect(occursOn({ kind: 'daily' }, MONDAY, '2026-08-02')).toBe(false)
    expect(occursOn({ kind: 'daily' }, MONDAY, MONDAY)).toBe(true)
  })

  it('daily fires every day', () => {
    for (const day of [MONDAY, TUESDAY, WEDNESDAY, NEXT_MONDAY]) {
      expect(occursOn({ kind: 'daily' }, MONDAY, day)).toBe(true)
    }
  })

  it('weekly fires on the listed weekdays only', () => {
    const weekdays: RecurrenceRule = { kind: 'weekly', weekdays: [1, 3, 5] } // Mon, Wed, Fri
    expect(occursOn(weekdays, MONDAY, MONDAY)).toBe(true)
    expect(occursOn(weekdays, MONDAY, TUESDAY)).toBe(false)
    expect(occursOn(weekdays, MONDAY, WEDNESDAY)).toBe(true)
    expect(occursOn(weekdays, MONDAY, '2026-08-07')).toBe(true)
    expect(occursOn(weekdays, MONDAY, '2026-08-08')).toBe(false)
  })

  it('weekly with no weekdays never fires', () => {
    expect(occursOn({ kind: 'weekly', weekdays: [] }, MONDAY, MONDAY)).toBe(false)
  })

  it('everyN counts from the start day', () => {
    const everyThreeDays: RecurrenceRule = { kind: 'everyN', n: 3, unit: 'day' }
    expect(occursOn(everyThreeDays, MONDAY, MONDAY)).toBe(true)
    expect(occursOn(everyThreeDays, MONDAY, TUESDAY)).toBe(false)
    expect(occursOn(everyThreeDays, MONDAY, '2026-08-06')).toBe(true)
    expect(occursOn(everyThreeDays, MONDAY, '2026-08-09')).toBe(true)
  })

  it('everyN in weeks lands on the same weekday', () => {
    const biweekly: RecurrenceRule = { kind: 'everyN', n: 2, unit: 'week' }
    expect(occursOn(biweekly, MONDAY, MONDAY)).toBe(true)
    expect(occursOn(biweekly, MONDAY, NEXT_MONDAY)).toBe(false)
    expect(occursOn(biweekly, MONDAY, '2026-08-17')).toBe(true)
  })

  it('rejects a zero or negative interval instead of dividing by it', () => {
    expect(occursOn({ kind: 'everyN', n: 0, unit: 'day' }, MONDAY, TUESDAY)).toBe(false)
  })
})

describe('dueInstances', () => {
  it('produces one instance for a due template', () => {
    const instances = dueInstances(withTemplate({ kind: 'daily' }), MONDAY, NOW)
    expect(instances).toHaveLength(1)
    expect(instances[0]).toMatchObject({ title: 'Standup', day: MONDAY, status: 'open' })
    expect(instances[0]!.seriesId).not.toBeNull()
  })

  it('carries the template priority and tags onto the instance', () => {
    const state = withTemplate({ kind: 'daily' }, MONDAY, 'Standup #team !2')
    const [instance] = dueInstances(state, MONDAY, NOW)
    expect(instance).toMatchObject({ title: 'Standup', tags: ['team'], priority: 2 })
  })

  it('skips an inactive template', () => {
    let state = withTemplate({ kind: 'daily' })
    const id = Object.keys(state.templates)[0]!
    state = reducer(state, { type: 'updateTemplate', id, patch: { active: false } })
    expect(dueInstances(state, MONDAY, NOW)).toEqual([])
  })

  it('never generates for a day before the start', () => {
    expect(dueInstances(withTemplate({ kind: 'daily' }, TUESDAY), MONDAY, NOW)).toEqual([])
  })
})

describe('materialise', () => {
  it('is idempotent — opening the same day twice adds one task', () => {
    let state = withTemplate({ kind: 'daily' })

    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })
    expect(sortedTasksOf(state, MONDAY)).toHaveLength(1)

    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })
    expect(sortedTasksOf(state, MONDAY)).toHaveLength(1)
  })

  it('does not resurrect an instance that was completed', () => {
    let state = withTemplate({ kind: 'daily' })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    const instance = sortedTasksOf(state, MONDAY)[0]!
    state = reducer(state, { type: 'toggleTask', id: instance.id, now: NOW })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    expect(sortedTasksOf(state, MONDAY)).toHaveLength(1)
    expect(sortedTasksOf(state, MONDAY)[0]!.status).toBe('done')
  })

  it('does not resurrect an instance that was dropped', () => {
    let state = withTemplate({ kind: 'daily' })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    const instance = sortedTasksOf(state, MONDAY)[0]!
    state = reducer(state, { type: 'triage', id: instance.id, decision: 'drop', today: MONDAY })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    expect(Object.values(state.tasks)).toHaveLength(1)
  })

  it('appends after the tasks already written for that day', () => {
    let state = withTemplate({ kind: 'daily' })
    state = reducer(state, { type: 'addTask', day: MONDAY, input: 'Written by hand', now: NOW })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    expect(sortedTasksOf(state, MONDAY).map((t) => t.title)).toEqual(['Written by hand', 'Standup'])
  })

  it('materialises several templates at once, each with a distinct position', () => {
    let state = withTemplate({ kind: 'daily' }, MONDAY, 'Standup')
    state = reducer(state, {
      type: 'addTemplate',
      title: 'Inbox zero',
      rule: { kind: 'daily' },
      startDay: MONDAY,
      now: NOW,
    })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    const tasks = sortedTasksOf(state, MONDAY)
    expect(tasks).toHaveLength(2)
    expect(new Set(tasks.map((t) => t.order)).size).toBe(2)
  })

  it('leaves the past alone — a template started today writes nothing for yesterday', () => {
    let state = withTemplate({ kind: 'daily' }, MONDAY)
    state = reducer(state, { type: 'materialise', day: '2026-08-02', now: NOW })
    expect(Object.values(state.tasks)).toHaveLength(0)
  })

  it('records the day it last ran for', () => {
    const state = reducer(withTemplate({ kind: 'daily' }), {
      type: 'materialise',
      day: MONDAY,
      now: NOW,
    })
    expect(state.settings.lastMaterialisedDay).toBe(MONDAY)
  })

  it('deleting a template leaves instances already written', () => {
    let state = withTemplate({ kind: 'daily' })
    state = reducer(state, { type: 'materialise', day: MONDAY, now: NOW })

    const id = Object.keys(state.templates)[0]!
    state = reducer(state, { type: 'deleteTemplate', id })

    expect(state.templates).toEqual({})
    expect(sortedTasksOf(state, MONDAY)).toHaveLength(1)
  })
})

describe('describeRule', () => {
  it('reads as English, not as a data structure', () => {
    expect(describeRule({ kind: 'daily' })).toBe('Every day')
    expect(describeRule({ kind: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Every weekday')
    expect(describeRule({ kind: 'weekly', weekdays: [0, 6] })).toBe('Every weekend')
    expect(describeRule({ kind: 'weekly', weekdays: [1, 4] })).toBe('Every Mon, Thu')
    expect(describeRule({ kind: 'weekly', weekdays: [] })).toBe('Never')
    expect(describeRule({ kind: 'everyN', n: 1, unit: 'week' })).toBe('Every week')
    expect(describeRule({ kind: 'everyN', n: 3, unit: 'day' })).toBe('Every 3 days')
  })
})
