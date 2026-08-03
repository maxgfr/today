import { useState } from 'react'
import { useDispatch } from '../../store/context'
import type { Task } from '../../domain/types'
import { Icon } from '../../ui/Icon'
import { TaskMeta } from './TaskMeta'

/**
 * What the day has already produced.
 *
 * Completing a task takes it out of the list — the list is what is left to do,
 * and a finished day whose rows are all still sitting there struck through is
 * not visibly finished. But taken out is not thrown away: everything done today
 * collects here, in the order it was completed, and stays reachable.
 *
 * Two ways out, and they are deliberately different weights. **Put back**
 * returns the task to the list, for the case where it was checked off too
 * early or turned out not to be finished. **Delete** removes the record for
 * good — it is the only destructive control on this screen, so it asks first
 * rather than acting on a mis-tap next to Put back.
 *
 * The drawer opens itself when the day is complete: at that point what you did
 * is the only content left, and hiding it behind a click would make the best
 * moment of the day the emptiest screen.
 */
export function DoneDrawer({
  tasks,
  today,
  complete,
}: {
  tasks: Task[]
  today: string
  complete: boolean
}) {
  const dispatch = useDispatch()
  // `null` means "follow the day"; a boolean is the user overriding that.
  const [override, setOverride] = useState<boolean | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  if (tasks.length === 0) return null

  const open = override ?? complete

  return (
    <section aria-labelledby="done-heading" className="border-t border-rule">
      <h2 id="done-heading">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOverride(!open)
            setConfirming(null)
          }}
          className="board-label flex w-full items-center gap-2 px-3 py-3 text-left text-ink-muted transition-colors hover:text-ink sm:px-4"
        >
          <span
            aria-hidden="true"
            className={`transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          >
            <Icon name="chevronDown" size={14} />
          </span>
          Done
          <span className="board-quantity text-accent">{tasks.length}</span>
        </button>
      </h2>

      {open && (
        <ul className="animate-rise">
          {tasks.map((task) => (
            <li key={task.id} className="border-t border-rule">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 sm:px-4">
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center bg-accent text-accent-ink"
                >
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>

                <span className="min-w-0 flex-1 text-row text-ink-muted line-through decoration-accent decoration-2">
                  {task.title}
                </span>

                <TaskMeta task={task} today={today} />

                {confirming === task.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'deleteTask', id: task.id })
                        setConfirming(null)
                      }}
                      className="board-label border-2 border-accent bg-accent px-3 py-1.5 text-accent-ink"
                    >
                      Delete for good
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="board-label px-3 py-1.5 text-ink-muted hover:text-ink"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({ type: 'toggleTask', id: task.id, now: new Date().toISOString() })
                      }
                      className="board-label border-2 border-rule px-3 py-1.5 text-ink transition-colors hover:border-rule-strong"
                    >
                      Put back
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(task.id)}
                      aria-label={`Delete ${task.title} for good`}
                      className="board-label px-3 py-1.5 text-ink-muted hover:text-accent"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
