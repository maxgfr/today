import { useState } from 'react'
import { useAppState, useDispatch } from '../../store/context'
import { describeRule } from '../../domain/recurrence'
import type { RecurrenceRule } from '../../domain/types'
import { Button, IconButton } from '../../ui/Button'

/**
 * Recurring tasks.
 *
 * Three shapes cover almost everything a day actually repeats on: every day,
 * chosen weekdays, or an interval. A full RRULE editor would be a second app,
 * and "the third Tuesday unless it is a holiday" is a calendar's problem.
 *
 * A template never rewrites the past. Instances appear on days as they are
 * opened, so switching one on today does not conjure a month of tasks nobody
 * ever saw — see `domain/recurrence.ts`.
 */

const WEEKDAYS = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 0, label: 'S' },
]

const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function Repeats({ today }: { today: string }) {
  const state = useAppState()
  const dispatch = useDispatch()

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'daily' | 'weekly' | 'everyN'>('weekly')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
  const [interval, setInterval] = useState(2)
  const [unit, setUnit] = useState<'day' | 'week'>('week')

  const templates = Object.values(state.templates).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )

  const rule = (): RecurrenceRule => {
    if (kind === 'daily') return { kind: 'daily' }
    if (kind === 'weekly') return { kind: 'weekly', weekdays }
    return { kind: 'everyN', n: Math.max(1, interval), unit }
  }

  const canAdd = title.trim() !== '' && (kind !== 'weekly' || weekdays.length > 0)

  const add = () => {
    if (!canAdd) return
    dispatch({
      type: 'addTemplate',
      title,
      rule: rule(),
      startDay: today,
      now: new Date().toISOString(),
    })
    setTitle('')
  }

  return (
    <section aria-labelledby="repeats-heading">
      <h2 id="repeats-heading" className="board-label border-b-2 border-rule-strong pb-2">
        Repeats
      </h2>

      {templates.length > 0 && (
        <ul className="mt-4">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule py-3"
            >
              <span className={`min-w-0 flex-1 ${template.active ? '' : 'text-ink-muted'}`}>
                {template.title}
              </span>
              <span className="board-label text-ink-muted">{describeRule(template.rule)}</span>

              <label className="board-label flex cursor-pointer items-center gap-2 text-ink-muted">
                <input
                  type="checkbox"
                  checked={template.active}
                  onChange={() =>
                    dispatch({
                      type: 'updateTemplate',
                      id: template.id,
                      patch: { active: !template.active },
                    })
                  }
                  className="size-4 accent-[var(--board-accent)]"
                />
                On
              </label>

              <IconButton
                icon="trash"
                size={15}
                label={`Delete the repeat ${template.title}`}
                onClick={() => dispatch({ type: 'deleteTemplate', id: template.id })}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border border-rule p-4">
        <label className="block">
          <span className="board-label text-ink-muted">New repeat</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            }}
            placeholder="Water the plants #home"
            className="mt-2 w-full border-b-2 border-rule py-1.5 text-row focus:border-accent"
          />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <fieldset className="flex items-center gap-4">
            <legend className="sr-only">How often</legend>
            {(['daily', 'weekly', 'everyN'] as const).map((option) => (
              <label key={option} className="board-label flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="repeat-kind"
                  checked={kind === option}
                  onChange={() => setKind(option)}
                  className="size-4 accent-[var(--board-accent)]"
                />
                {option === 'daily' ? 'Daily' : option === 'weekly' ? 'On days' : 'Every'}
              </label>
            ))}
          </fieldset>

          {kind === 'weekly' && (
            <fieldset className="flex items-center gap-1">
              <legend className="sr-only">Which weekdays</legend>
              {WEEKDAYS.map((weekday) => {
                const on = weekdays.includes(weekday.value)
                return (
                  <label
                    key={weekday.value}
                    className={`board-label flex size-8 cursor-pointer items-center justify-center border-2 transition-colors ${
                      on
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-rule text-ink-muted hover:border-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setWeekdays((current) =>
                          on
                            ? current.filter((value) => value !== weekday.value)
                            : [...current, weekday.value],
                        )
                      }
                      className="sr-only"
                    />
                    <span aria-hidden="true">{weekday.label}</span>
                    <span className="sr-only">{FULL_WEEKDAYS[weekday.value]}</span>
                  </label>
                )
              })}
            </fieldset>
          )}

          {kind === 'everyN' && (
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="repeat-interval">
                Interval
              </label>
              <input
                id="repeat-interval"
                type="number"
                min={1}
                max={365}
                value={interval}
                onChange={(event) => setInterval(Number(event.target.value))}
                className="tabular w-16 border-b-2 border-rule py-1 text-center focus:border-accent"
              />
              <label className="sr-only" htmlFor="repeat-unit">
                Unit
              </label>
              <select
                id="repeat-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value as 'day' | 'week')}
                className="board-label border-b-2 border-rule bg-transparent py-1 focus:border-accent"
              >
                <option value="day">days</option>
                <option value="week">weeks</option>
              </select>
            </div>
          )}

          <Button onClick={add} disabled={!canAdd} className="ml-auto">
            Add repeat
          </Button>
        </div>

        <p className="mt-4 text-[0.8125rem] text-ink-muted">
          Starts today. Days already behind you are left alone.
        </p>
      </div>
    </section>
  )
}
