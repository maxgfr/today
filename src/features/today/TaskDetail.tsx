import { useState } from 'react'
import { useDispatch } from '../../store/context'
import type { Task } from '../../domain/types'
import { Slat } from './Slat'
import { IconButton } from '../../ui/Button'
import { Icon } from '../../ui/Icon'

/**
 * What sits under a row when it is opened: steps and a note.
 *
 * Deliberately not a modal. Breaking a task into steps is thinking out loud
 * about the day, and interrupting the day to do it — dimming the board, taking
 * focus, requiring a dismissal — would make the smaller move feel like the
 * bigger one. The row grows instead.
 */
export function TaskDetail({ task }: { task: Task }) {
  const dispatch = useDispatch()
  const [draft, setDraft] = useState('')

  const addStep = () => {
    if (draft.trim() === '') return
    dispatch({ type: 'addSubtask', taskId: task.id, title: draft })
    setDraft('')
  }

  return (
    <div className="animate-rise border-t border-rule bg-sunken/60 px-4 py-4 pl-16 sm:pl-[4.5rem]">
      <ul className="flex flex-col gap-1">
        {task.subtasks.map((subtask) => (
          <li key={subtask.id} className="group/step flex items-center gap-3 py-1">
            <Slat
              size="sm"
              done={subtask.done}
              label={
                subtask.done ? `Reopen step ${subtask.title}` : `Complete step ${subtask.title}`
              }
              onToggle={() =>
                dispatch({ type: 'toggleSubtask', taskId: task.id, subtaskId: subtask.id })
              }
            />
            <input
              value={subtask.title}
              onChange={(event) =>
                dispatch({
                  type: 'editSubtask',
                  taskId: task.id,
                  subtaskId: subtask.id,
                  title: event.target.value,
                })
              }
              aria-label={`Step: ${subtask.title}`}
              className={`min-w-0 flex-1 py-0.5 text-[0.95rem] ${
                subtask.done ? 'text-ink-muted line-through decoration-accent' : 'text-ink'
              }`}
            />
            <IconButton
              icon="close"
              size={14}
              label={`Delete step ${subtask.title}`}
              onClick={() =>
                dispatch({ type: 'deleteSubtask', taskId: task.id, subtaskId: subtask.id })
              }
              className="opacity-0 transition-opacity group-hover/step:opacity-100 focus-visible:opacity-100"
            />
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-center gap-3 py-1">
        <span className="flex size-5 shrink-0 items-center justify-center text-ink-muted">
          <Icon name="plus" size={14} />
        </span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addStep()
            }
          }}
          onBlur={addStep}
          placeholder="Add a step"
          aria-label="Add a step"
          className="min-w-0 flex-1 py-0.5 text-[0.95rem]"
        />
      </div>

      <label className="mt-3 block">
        <span className="board-label text-ink-muted">Note</span>
        <textarea
          value={task.notes}
          onChange={(event) =>
            dispatch({ type: 'setNotes', id: task.id, notes: event.target.value })
          }
          rows={task.notes.split('\n').length + 1}
          placeholder="Anything worth remembering about this one"
          className="mt-1.5 w-full resize-y border-l-2 border-rule py-1 pl-3 text-[0.95rem] leading-relaxed focus:border-accent"
        />
      </label>
    </div>
  )
}
