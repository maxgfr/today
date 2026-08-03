import { describe, expect, it } from 'vitest'
import { migrate } from './migrate'
import { deserialise, serialise } from '../lib/io'
import { reducer } from '../domain/reducer'
import { emptyState } from '../domain/types'

const NOW = '2026-08-03T09:00:00.000Z'
const MONDAY = '2026-08-03'

const populated = () => {
  let state = reducer(emptyState(), {
    type: 'addTask',
    day: MONDAY,
    input: 'Ship it #dev !1 ~30m',
    now: NOW,
  })
  state = reducer(state, {
    type: 'addTemplate',
    title: 'Standup',
    rule: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] },
    startDay: MONDAY,
    now: NOW,
  })
  return reducer(state, { type: 'setTheme', theme: 'dark' })
}

describe('migrate — rejecting', () => {
  it('refuses anything that is not this app’s data', () => {
    for (const input of [null, undefined, 42, 'string', [], { hello: 'world' }]) {
      expect(migrate(input)).toBeNull()
    }
  })

  it('refuses data written by a newer version', () => {
    // Truncating unknown fields on the next write would destroy them silently.
    expect(migrate({ version: 99, tasks: {}, templates: {}, settings: {} })).toBeNull()
  })

  it('accepts a blob that is recognisably ours even if nearly empty', () => {
    expect(migrate({ version: 1 })).toMatchObject({ version: 1, tasks: {}, templates: {} })
  })
})

describe('migrate — repairing', () => {
  it('drops a task with no title rather than showing a blank row', () => {
    const state = migrate({ version: 1, tasks: [{ id: 'a', title: '   ', day: MONDAY }] })
    expect(state!.tasks).toEqual({})
  })

  it('drops a task whose day is impossible', () => {
    const state = migrate({
      version: 1,
      tasks: [
        { id: 'a', title: 'Real', day: MONDAY },
        { id: 'b', title: 'Broken', day: '2026-02-30' },
        { id: 'c', title: 'Missing day' },
      ],
    })
    expect(Object.values(state!.tasks).map((t) => t.title)).toEqual(['Real'])
  })

  it('keeps the good tasks when one is malformed', () => {
    // Losing a year of history to one bad row would be the worse failure.
    const state = migrate({
      version: 1,
      tasks: [
        { id: 'a', title: 'Keeps', day: MONDAY },
        'not an object',
        { id: 'c', title: 'Also keeps', day: MONDAY },
      ],
    })
    expect(Object.keys(state!.tasks)).toHaveLength(2)
  })

  it('coerces fields of the wrong type instead of failing', () => {
    const state = migrate({
      version: 1,
      tasks: [
        {
          id: 'a',
          title: 'Odd',
          day: MONDAY,
          status: 'nonsense',
          priority: 47,
          order: 'not a number',
          tags: ['ok', 42, '', 'ok'],
          notes: null,
          estimateMin: 'soon',
          completedAt: 'not a date',
        },
      ],
    })

    expect(state!.tasks.a).toMatchObject({
      status: 'open',
      priority: 0,
      order: 0,
      tags: ['ok'],
      notes: '',
      estimateMin: null,
      completedAt: null,
    })
  })

  it('mints an id for a task that lost one', () => {
    const state = migrate({ version: 1, tasks: [{ title: 'No id', day: MONDAY }] })
    const [id] = Object.keys(state!.tasks)
    expect(id).toBeTruthy()
    expect(state!.tasks[id!]!.title).toBe('No id')
  })

  it('reads tasks as a record or as an array', () => {
    const asRecord = migrate({ version: 1, tasks: { a: { id: 'a', title: 'X', day: MONDAY } } })
    const asArray = migrate({ version: 1, tasks: [{ id: 'a', title: 'X', day: MONDAY }] })
    expect(asRecord!.tasks).toEqual(asArray!.tasks)
  })

  it('discards a recurrence rule it does not understand', () => {
    const state = migrate({
      version: 1,
      templates: [
        { id: 't', title: 'Good', rule: { kind: 'daily' }, startDay: MONDAY },
        { id: 'u', title: 'Bad', rule: { kind: 'lunar' }, startDay: MONDAY },
        { id: 'v', title: 'Zero', rule: { kind: 'everyN', n: 0 }, startDay: MONDAY },
      ],
    })
    expect(Object.keys(state!.templates)).toEqual(['t'])
  })

  it('filters impossible weekdays out of a weekly rule', () => {
    const state = migrate({
      version: 1,
      templates: [
        {
          id: 't',
          title: 'W',
          rule: { kind: 'weekly', weekdays: [1, 9, -2, 5, 1] },
          startDay: MONDAY,
        },
      ],
    })
    expect(state!.templates.t!.rule).toEqual({ kind: 'weekly', weekdays: [1, 5] })
  })

  it('falls back to sane settings', () => {
    const state = migrate({
      version: 1,
      settings: { theme: 'chartreuse', lastTriagedDay: 'whenever', lastMaterialisedDay: 12 },
    })
    expect(state!.settings).toEqual({
      theme: 'system',
      lastTriagedDay: null,
      lastMaterialisedDay: null,
    })
  })

  it('keeps subtasks and drops the empty ones', () => {
    const state = migrate({
      version: 1,
      tasks: [
        {
          id: 'a',
          title: 'Parent',
          day: MONDAY,
          subtasks: [{ id: 's', title: 'Step', done: true }, { title: '  ' }, 'junk'],
        },
      ],
    })
    expect(state!.tasks.a!.subtasks).toEqual([{ id: 's', title: 'Step', done: true }])
  })
})

describe('export / import round trip', () => {
  it('restores the state byte-for-byte', () => {
    const original = populated()
    const result = deserialise(serialise(original))

    expect(result.ok).toBe(true)
    expect(result.ok && result.state).toEqual(original)
  })

  it('reports how much is being imported', () => {
    const result = deserialise(serialise(populated()))
    expect(result.ok && result.taskCount).toBe(1)
  })

  it('stamps the export without polluting the imported state', () => {
    const text = serialise(emptyState(), new Date('2026-08-03T10:00:00.000Z'))
    expect(JSON.parse(text)).toMatchObject({ app: 'today', exportedAt: '2026-08-03T10:00:00.000Z' })

    const result = deserialise(text)
    expect(result.ok && result.state).toEqual(emptyState())
  })

  it('explains itself when the file is not JSON', () => {
    const result = deserialise('{ not json')
    expect(result).toEqual({ ok: false, reason: 'That file is not valid JSON.' })
  })

  it('explains itself when the JSON is not a Today export', () => {
    const result = deserialise('{"some":"other app"}')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toMatch(/Today export/)
  })

  it('produces JSON a human can actually read', () => {
    expect(serialise(populated())).toContain('\n  ')
  })
})
