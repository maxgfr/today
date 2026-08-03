import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppState, useDispatch } from '../../store/context'
import { dayProgress, tasksForDay } from '../../domain/selectors'
import { addDays, formatShortWeekday, fromDayId, startOfWeek, weekDays } from '../../lib/date'
import { navigate } from '../../app/router'
import type { Task } from '../../domain/types'
import { Overlay } from '../../ui/Overlay'
import { IconButton } from '../../ui/Button'
import { Slat } from '../today/Slat'
import { PriorityMark } from '../today/TaskMeta'

/**
 * The concourse: seven boards side by side.
 *
 * This exists to answer one question — is Thursday already full? — and to let
 * you move something off today without deciding it is abandoned. It is
 * deliberately thinner than the day view: no inline editing, no details, no
 * capture. Anything more would make it somewhere to work, and there is only one
 * of those.
 */

const WeekTask = ({ task }: { task: Task }) => {
  const dispatch = useDispatch()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const done = task.status === 'done'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-rule last:border-b-0 ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-start gap-2 px-2 py-2">
        <Slat
          size="sm"
          done={done}
          label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onToggle={() =>
            dispatch({ type: 'toggleTask', id: task.id, now: new Date().toISOString() })
          }
        />
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${task.title} to another day`}
          className={`min-w-0 flex-1 cursor-grab text-left text-[0.8125rem] leading-snug active:cursor-grabbing ${
            done ? 'text-ink-muted line-through decoration-accent' : 'text-ink'
          }`}
        >
          {task.title}
        </button>
        <PriorityMark priority={task.priority} />
      </div>
    </li>
  )
}

function DayColumn({ day, today }: { day: string; today: string }) {
  const state = useAppState()
  const tasks = useMemo(() => tasksForDay(state, day), [state, day])
  const progress = dayProgress(state, day)
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` })

  const isToday = day === today
  const isPast = day < today

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        onClick={() => navigate({ name: 'today', day })}
        className={`flex items-baseline justify-between gap-2 border-b-2 px-2 pb-1.5 text-left transition-colors ${
          isToday ? 'border-accent text-accent' : 'border-rule-strong text-ink hover:text-accent'
        }`}
      >
        <span className="board-label">{formatShortWeekday(day)}</span>
        <span className={`board-label tabular ${isPast ? 'text-rule' : 'text-ink-muted'}`}>
          {fromDayId(day).getDate()}
        </span>
      </button>

      <div
        ref={setNodeRef}
        className={`min-h-32 flex-1 border-b border-rule transition-colors ${
          isOver ? 'bg-accent-wash' : ''
        }`}
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {tasks.map((task) => (
              <WeekTask key={task.id} task={task} />
            ))}
          </ul>
        </SortableContext>
      </div>

      {progress.total > 0 && (
        <p className="board-label tabular px-2 pt-1.5 text-ink-muted">
          {progress.done}/{progress.total}
        </p>
      )}
    </div>
  )
}

export function WeekView({ anchor, today }: { anchor: string; today: string }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const [week, setWeek] = useState(() => startOfWeek(anchor))

  const days = useMemo(() => weekDays(week), [week])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return

    const id = String(active.id)
    const target = String(over.id)

    // Dropped on empty space in a column: append to that day.
    if (target.startsWith('day:')) {
      const toDay = target.slice(4)
      dispatch({ type: 'moveTask', id, toDay, toIndex: tasksForDay(state, toDay).length })
      return
    }

    // Dropped on another task: take its place.
    const overTask = state.tasks[target]
    if (!overTask || overTask.id === id) return

    const siblings = tasksForDay(state, overTask.day).filter((task) => task.id !== id)
    dispatch({
      type: 'moveTask',
      id,
      toDay: overTask.day,
      toIndex: Math.max(
        0,
        siblings.findIndex((task) => task.id === overTask.id),
      ),
    })
  }

  return (
    <Overlay
      title="Week"
      onClose={() => navigate({ name: 'today', day: today })}
      actions={
        <div className="flex items-center gap-1">
          <IconButton
            icon="chevronLeft"
            label="Previous week"
            onClick={() => setWeek(addDays(week, -7))}
          />
          <IconButton
            icon="chevronRight"
            label="Next week"
            onClick={() => setWeek(addDays(week, 7))}
          />
        </div>
      }
    >
      <p className="board-label mb-5 text-ink-muted">
        Drag anything onto another day. Pick a day to open it.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        {/* Seven columns on a wide screen; a horizontal rail on a phone, where
            seven columns of task titles would be seven columns of nothing. */}
        <div className="-mx-5 grid snap-x snap-mandatory auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid-flow-row sm:grid-cols-7 sm:gap-3 sm:overflow-visible sm:px-0">
          {days.map((day) => (
            <div key={day} className="snap-start">
              <DayColumn day={day} today={today} />
            </div>
          ))}
        </div>
      </DndContext>
    </Overlay>
  )
}
