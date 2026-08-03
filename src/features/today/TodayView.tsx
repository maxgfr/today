import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useAppState, useDispatch } from '../../store/context'
import { dayProgress, matchesFilters, tasksForDay, type Filters } from '../../domain/selectors'
import { DayHeader } from './DayHeader'
import { TaskRow } from './TaskRow'
import { Capture, type CaptureHandle } from './Capture'
import { CAPTURE_HINT_ID } from './hint'
import { DayCleared, EmptyDay, FirstRun } from './EmptyStates'

/**
 * The board. This is the app; everything else is an overlay over it.
 *
 * Drag is wired through dnd-kit rather than the HTML5 drag API for one reason:
 * the keyboard sensor. Reordering a day is a primary action, and an ordering
 * you can only change with a mouse is an ordering half the users cannot change.
 */
export function TodayView({
  day,
  today,
  filters,
  captureRef,
}: {
  day: string
  today: string
  filters: Filters
  captureRef: React.RefObject<CaptureHandle | null>
}) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [dragging, setDragging] = useState<string | null>(null)
  const announced = useRef<string | null>(null)

  const tasks = useMemo(() => tasksForDay(state, day), [state, day])
  const visible = useMemo(
    () => tasks.filter((task) => matchesFilters(task, filters)),
    [tasks, filters],
  )
  const progress = useMemo(() => dayProgress(state, day), [state, day])

  // Numbering runs over the open rows only, so completing one closes the gap
  // instead of leaving a hole where a task used to be.
  const positions = useMemo(() => {
    const map = new Map<string, number>()
    let next = 1
    for (const task of visible) {
      if (task.status !== 'done') map.set(task.id, next++)
    }
    return map
  }, [visible])

  const sensors = useSensors(
    // A few pixels of slop so a click on a row never registers as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    if (!over || active.id === over.id) return

    const toIndex = tasks.findIndex((task) => task.id === over.id)
    if (toIndex >= 0) {
      dispatch({ type: 'moveTask', id: String(active.id), toDay: day, toIndex })
    }
  }

  // Announce the cleared day once, for a reader who cannot see the board flip.
  useEffect(() => {
    announced.current = progress.complete ? day : null
  }, [progress.complete, day])

  const neverWritten = tasks.length === 0
  const isFirstRun = neverWritten && Object.keys(state.tasks).length === 0

  return (
    <section aria-label={`Tasks for ${day}`}>
      <DayHeader day={day} progress={progress} />

      <div className="border-y-2 border-rule-strong">
        {/* Capture opens the board: on a screen about one day, the first thing
            you meet is the way to say what the day is. */}
        <Capture day={day} ref={captureRef} />

        {progress.complete && <DayCleared done={progress.done} />}

        {neverWritten && (isFirstRun ? <FirstRun /> : <EmptyDay />)}

        {!neverWritten && !progress.complete && visible.length === 0 && (
          <p className="border-b border-rule px-4 py-8 text-center text-ink-muted">
            Nothing on this day matches the current filter.
          </p>
        )}

        {!progress.complete && visible.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }: DragStartEvent) => setDragging(String(active.id))}
            onDragCancel={() => setDragging(null)}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={visible.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul>
                {visible.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    position={positions.get(task.id) ?? 0}
                    today={today}
                  />
                ))}
              </ul>
            </SortableContext>

            <DragOverlay>
              {dragging && (
                <ul className="bg-ground">
                  <TaskRow
                    isDragging
                    task={state.tasks[dragging]!}
                    position={positions.get(dragging) ?? 0}
                    today={today}
                  />
                </ul>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* The syntax lives at the foot of the board and only in the accessibility
          tree. Sighted users learn it from the live echo beside the field and
          from the first-run state; a permanent line of instructions under a
          text input is the kind of chrome that never stops being read once and
          then ignored forever. `aria-describedby` does not care where this sits,
          so it is announced on focus wherever it is in the document. */}
      <p id={CAPTURE_HINT_ID} className="sr-only">
        Type the task, then press Enter. Optional markers: hash tag to label it, exclamation mark
        followed by 1, 2 or 3 to set a priority, tilde followed by a duration such as 30m or 2h to
        estimate it.
      </p>

      <p aria-live="polite" className="sr-only">
        {progress.complete ? `Day cleared. ${progress.done} things done.` : ''}
      </p>
    </section>
  )
}
