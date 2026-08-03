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

      <div className="border-t-2 border-rule-strong">
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
                {visible.map((task, index) => (
                  <TaskRow key={task.id} task={task} index={index} today={today} />
                ))}
              </ul>
            </SortableContext>

            <DragOverlay>
              {dragging && (
                <ul className="bg-ground">
                  <TaskRow
                    isDragging
                    task={state.tasks[dragging]!}
                    index={visible.findIndex((task) => task.id === dragging)}
                    today={today}
                  />
                </ul>
              )}
            </DragOverlay>
          </DndContext>
        )}

        <Capture day={day} ref={captureRef} />
      </div>

      <p aria-live="polite" className="sr-only">
        {progress.complete ? `Day cleared. ${progress.done} things done.` : ''}
      </p>
    </section>
  )
}
