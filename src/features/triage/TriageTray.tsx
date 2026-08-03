import { useMemo } from 'react'
import { useAppState, useDispatch } from '../../store/context'
import { carriedOverTasks } from '../../domain/reducer'
import { ageLabel, relativeDayLabel } from '../../lib/date'
import { Button } from '../../ui/Button'
import { PriorityMark } from '../today/TaskMeta'

/**
 * The morning triage.
 *
 * This is the product's second commitment made visible: nothing left unfinished
 * yesterday has moved. It is sitting here, with its age printed next to it,
 * waiting for a decision. A task that has been waiting nine days says so, which
 * is the information a silent auto-rollover destroys — after a week of quiet
 * carrying, a nine-day-old task looks exactly like one written this morning.
 *
 * Three decisions, no default, and no way to make the pile grow by accident:
 * Keep puts it on today, Later moves it to tomorrow, Drop retires it.
 *
 * The tray sits above the board rather than over it. Blocking the day behind a
 * modal to ask about yesterday would invert which one matters.
 */
export function TriageTray({ today }: { today: string }) {
  const state = useAppState()
  const dispatch = useDispatch()

  const carried = useMemo(() => carriedOverTasks(state, today), [state, today])
  if (carried.length === 0) return null

  return (
    <section aria-labelledby="triage-heading" className="animate-rise mb-10 border-2 border-accent">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-accent bg-accent px-4 py-2.5 text-accent-ink">
        <h2 id="triage-heading" className="board-label">
          Left over — {carried.length} {carried.length === 1 ? 'thing' : 'things'}
        </h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => dispatch({ type: 'triageAll', decision: 'keep', today })}
            className="board-label underline underline-offset-4 hover:no-underline"
          >
            Keep all
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'triageAll', decision: 'drop', today })}
            className="board-label underline underline-offset-4 hover:no-underline"
          >
            Drop all
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'dismissTriage', today })}
            className="board-label underline underline-offset-4 hover:no-underline"
          >
            Not now
          </button>
        </div>
      </header>

      <ul>
        {carried.map((task) => (
          <li
            key={task.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0"
          >
            <span className="board-quantity w-10 shrink-0 text-accent">
              {ageLabel(task.carriedFrom ?? task.day, today)}
            </span>

            <span className="min-w-0 flex-1 truncate text-row">{task.title}</span>

            <span className="board-label hidden shrink-0 text-ink-muted sm:inline">
              {relativeDayLabel(task.day, today)}
            </span>

            <PriorityMark priority={task.priority} />

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                className="px-3 py-1.5"
                onClick={() => dispatch({ type: 'triage', id: task.id, decision: 'keep', today })}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                className="px-3 py-1.5"
                onClick={() => dispatch({ type: 'triage', id: task.id, decision: 'later', today })}
              >
                Tomorrow
              </Button>
              <Button
                variant="ghost"
                className="px-3 py-1.5"
                onClick={() => dispatch({ type: 'triage', id: task.id, decision: 'drop', today })}
              >
                Drop
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
