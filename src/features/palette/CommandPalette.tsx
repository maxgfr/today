import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../../store/context'
import { searchTasks } from '../../domain/selectors'
import { relativeDayLabel, today as currentDay } from '../../lib/date'
import { Icon, type IconName } from '../../ui/Icon'
import { Modal } from '../../ui/Modal'

/**
 * One field that reaches everything.
 *
 * Hand-rolled rather than pulled from a library: the whole surface is four
 * elements, and a component kit would arrive carrying its own radius, shadow
 * and motion language into a world that has none of those.
 *
 * Commands and tasks share one list. Typing "bank" should find the task about
 * the bank; typing "week" should find the week. Making the user pick a mode
 * first would be an extra decision to reach a search box.
 *
 * The `listbox`/`option` roles below are the ARIA combobox pattern and are the
 * reason `jsx-a11y/prefer-tag-over-role` is off in `.oxlintrc.json`: that rule
 * suggests `<select>`/`<option>`, which cannot host a filtered, two-section,
 * arrow-navigated list. Everything that a real element *can* do is a real
 * element — the dialog is a native `<dialog>`, and every row is a `<button>`.
 */

export type Command = {
  id: string
  label: string
  hint?: string
  icon: IconName
  keys?: string
  run: () => void
}

const score = (label: string, query: string): number => {
  const haystack = label.toLowerCase()
  if (haystack.startsWith(query)) return 0
  const at = haystack.indexOf(query)
  return at === -1 ? Number.POSITIVE_INFINITY : at + 1
}

export function CommandPalette({
  commands,
  onClose,
  onOpenTask,
}: {
  commands: Command[]
  onClose: () => void
  onOpenTask: (day: string) => void
}) {
  const state = useAppState()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const trimmed = query.trim().toLowerCase()

  const matchedCommands = useMemo(
    () =>
      trimmed === ''
        ? commands
        : commands
            .map((command) => ({ command, rank: score(command.label, trimmed) }))
            .filter(({ rank }) => Number.isFinite(rank))
            .sort((a, b) => a.rank - b.rank)
            .map(({ command }) => command),
    [commands, trimmed],
  )

  const matchedTasks = useMemo(
    () => (trimmed === '' ? [] : searchTasks(state, trimmed, 8)),
    [state, trimmed],
  )

  const total = matchedCommands.length + matchedTasks.length

  useEffect(() => setActive(0), [trimmed])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (index: number) => {
    const command = matchedCommands[index]
    if (command) {
      onClose()
      command.run()
      return
    }
    const task = matchedTasks[index - matchedCommands.length]
    if (task) {
      onClose()
      onOpenTask(task.day)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault()
      setActive((index) => (total === 0 ? 0 : (index + 1) % total))
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault()
      setActive((index) => (total === 0 ? 0 : (index - 1 + total) % total))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(active)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <Modal label="Commands and search" onClose={onClose} align="top">
      <div className="animate-rise mx-auto w-full max-w-xl border-2 border-rule-strong bg-surface">
        <div className="flex items-center gap-3 border-b-2 border-rule-strong px-4 py-3">
          <span aria-hidden="true" className="text-accent">
            <Icon name="search" size={18} />
          </span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, or run a command"
            aria-label="Search tasks, or run a command"
            aria-activedescendant={total > 0 ? `palette-option-${active}` : undefined}
            aria-controls="palette-list"
            role="combobox"
            aria-expanded="true"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 text-[1.0625rem]"
          />
        </div>

        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-80 overflow-y-auto">
          {matchedCommands.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                id={`palette-option-${index}`}
                role="option"
                aria-selected={index === active}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                  index === active ? 'bg-accent text-accent-ink' : 'text-ink'
                }`}
              >
                <Icon name={command.icon} size={16} />
                <span className="flex-1 truncate text-[0.9375rem]">{command.label}</span>
                {command.hint && <span className="board-label opacity-70">{command.hint}</span>}
                {command.keys && (
                  <span className="board-label tabular opacity-70">{command.keys}</span>
                )}
              </button>
            </li>
          ))}

          {matchedTasks.length > 0 && (
            <li className="board-label border-y border-rule bg-sunken px-4 py-1.5 text-ink-muted">
              Tasks
            </li>
          )}

          {matchedTasks.map((task, offset) => {
            const index = matchedCommands.length + offset
            return (
              <li key={task.id}>
                <button
                  type="button"
                  id={`palette-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    index === active ? 'bg-accent text-accent-ink' : 'text-ink'
                  }`}
                >
                  <Icon name={task.status === 'done' ? 'check' : 'arrowRight'} size={16} />
                  <span
                    className={`flex-1 truncate text-[0.9375rem] ${
                      task.status === 'done' ? 'line-through' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="board-label opacity-70">
                    {relativeDayLabel(task.day, currentDay())}
                  </span>
                </button>
              </li>
            )
          })}

          {total === 0 && (
            <li className="px-4 py-6 text-center text-[0.9375rem] text-ink-muted">
              Nothing matches “{query.trim()}”.
            </li>
          )}
        </ul>
      </div>
    </Modal>
  )
}
