import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDispatch } from '../../store/context'
import { formatInput, parseInput } from '../../domain/parse'
import type { Priority, Task } from '../../domain/types'
import { Icon } from '../../ui/Icon'
import { IconButton } from '../../ui/Button'
import { Slat } from './Slat'
import { TaskMeta } from './TaskMeta'
import { TaskDetail } from './TaskDetail'

/**
 * One line of the board.
 *
 * The row number is not decoration: it is the position the user set by
 * dragging, it renumbers live as the day is rearranged, and a completed row
 * loses it and shows a rule instead — the service has left the board.
 *
 * Title editing happens in place. A double-click, Enter, or a click on the
 * title swaps the text for an input pre-filled with the quick-capture syntax
 * (`Ship it #dev !1 ~30m`), so what you edit is exactly what you typed.
 */
export function TaskRow({
  task,
  index,
  today,
  isDragging: dragOverlay = false,
}: {
  task: Task
  index: number
  today: string
  isDragging?: boolean
}) {
  const dispatch = useDispatch()
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const done = task.status === 'done'

  const startEditing = () => {
    setDraft(
      formatInput({
        title: task.title,
        tags: task.tags,
        priority: task.priority,
        estimateMin: task.estimateMin,
      }),
    )
    setEditing(true)
  }

  const commit = () => {
    if (parseInput(draft).title !== '') dispatch({ type: 'editTask', id: task.id, input: draft })
    setEditing(false)
  }

  /**
   * Row shortcuts fire from whichever real control inside the row has focus,
   * so the row itself never becomes a fake widget with its own tab stop. Keys
   * that a focused button already owns — Space, Enter — are left alone rather
   * than intercepted, which is why they are absent here.
   *
   * This is plain event delegation from real buttons, not a div pretending to
   * be a control, which is why `no-static-element-interactions` is off for this
   * file in `.oxlintrc.json`: the wrapper has no click handler and no role to
   * claim, and giving it one would add a tab stop nobody asked for.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target
    if (editing || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return

    if (event.key === 'x') {
      event.preventDefault()
      dispatch({ type: 'toggleTask', id: task.id, now: new Date().toISOString() })
    } else if (event.key >= '1' && event.key <= '3') {
      dispatch({ type: 'setPriority', id: task.id, priority: Number(event.key) as Priority })
    } else if (event.key === '0') {
      dispatch({ type: 'setPriority', id: task.id, priority: 0 })
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      dispatch({ type: 'deleteTask', id: task.id })
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group border-b border-rule bg-ground last:border-b-0 ${
        isDragging ? 'opacity-30' : ''
      } ${dragOverlay ? 'border-2 border-accent shadow-[0_8px_24px_rgba(0,0,0,0.18)]' : ''}`}
    >
      <div className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4" onKeyDown={onKeyDown}>
        <span
          aria-hidden="true"
          className={`board-label tabular w-6 shrink-0 text-right ${
            done ? 'text-rule' : 'text-ink-muted'
          }`}
        >
          {done ? '—' : String(index + 1).padStart(2, '0')}
        </span>

        <Slat
          done={done}
          label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onToggle={() =>
            dispatch({ type: 'toggleTask', id: task.id, now: new Date().toISOString() })
          }
        />

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setEditing(false)
              }
            }}
            aria-label={`Edit ${task.title}`}
            className="min-w-0 flex-1 border-b-2 border-accent py-0.5 text-row"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className={`min-w-0 flex-1 truncate text-left text-row transition-colors ${
              done ? 'text-ink-muted line-through decoration-accent decoration-2' : 'text-ink'
            }`}
          >
            {task.title}
          </button>
        )}

        {!editing && <TaskMeta task={task} today={today} />}

        <div className="flex shrink-0 items-center">
          <IconButton
            icon={open ? 'minus' : 'note'}
            size={15}
            label={open ? `Hide details of ${task.title}` : `Show details of ${task.title}`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={
              open || task.subtasks.length > 0 || task.notes !== ''
                ? ''
                : 'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100'
            }
          />
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${task.title}`}
            className="cursor-grab p-2 text-rule opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <Icon name="grip" size={16} />
          </button>
        </div>
      </div>

      {open && <TaskDetail task={task} />}
    </li>
  )
}
