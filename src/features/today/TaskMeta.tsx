import type { Priority, Task } from '../../domain/types'
import { ageLabel } from '../../lib/date'
import { Icon } from '../../ui/Icon'
import { formatEstimate } from './format'

/**
 * The right-hand column of a board row: priority, tags, estimate, and the
 * markers that say a row is carried, recurring, or has more underneath.
 *
 * Priority never rides on colour alone — the accent block always carries the
 * literal "P1" beside it, so the ranking survives a monochrome screen and a
 * reader who cannot distinguish the hue.
 */

const priorityStyles: Record<Exclude<Priority, 0>, string> = {
  1: 'bg-accent text-accent-ink border-accent',
  2: 'text-accent border-accent',
  3: 'text-ink-muted border-rule',
}

export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority === 0) return null

  return (
    <span
      className={`board-label border px-1.5 py-0.5 tabular ${priorityStyles[priority]}`}
      title={`Priority ${priority}`}
    >
      P{priority}
    </span>
  )
}

export function TaskMeta({ task, today }: { task: Task; today: string }) {
  const openSubtasks = task.subtasks.filter((subtask) => !subtask.done).length
  const age = task.carriedFrom === null ? null : ageLabel(task.carriedFrom, today)

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {age !== null && age !== '0d' && (
        <span
          className="board-label tabular text-accent"
          title={`Carried over from ${task.carriedFrom}`}
        >
          {age}
        </span>
      )}

      {task.tags.map((tag) => (
        <span key={tag} className="board-label text-ink-muted">
          #{tag}
        </span>
      ))}

      {task.estimateMin !== null && (
        <span className="board-label tabular text-ink-muted">
          {formatEstimate(task.estimateMin)}
        </span>
      )}

      {task.seriesId !== null && (
        <span className="text-ink-muted" title="Repeats">
          <Icon name="repeat" size={14} />
        </span>
      )}

      {task.subtasks.length > 0 && (
        <span
          className="board-label tabular text-ink-muted"
          title={`${openSubtasks} of ${task.subtasks.length} steps left`}
        >
          {task.subtasks.length - openSubtasks}/{task.subtasks.length}
        </span>
      )}

      {task.notes.trim() !== '' && (
        <span className="text-ink-muted" title="Has notes">
          <Icon name="note" size={14} />
        </span>
      )}

      <PriorityMark priority={task.priority} />
    </div>
  )
}
