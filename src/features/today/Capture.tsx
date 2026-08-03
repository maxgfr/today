import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { useDispatch } from '../../store/context'
import { parseInput } from '../../domain/parse'
import { Icon } from '../../ui/Icon'
import { PriorityMark } from './TaskMeta'
import { formatEstimate } from './format'
import { CAPTURE_HINT_ID } from './hint'

export type CaptureHandle = { focus: () => void }

/**
 * Writing down the next thing.
 *
 * The field opens the board, directly under the date: on a screen whose whole
 * subject is one day, the first thing you meet should be the way to say what
 * that day is. New tasks still land at the end of the list, because a morning
 * is typed in the order you intend to work — prepending would reverse it.
 *
 * It keeps focus after Enter: three or four lines usually go in at once, and
 * reaching for the mouse between them is the friction that sends people back to
 * a text file.
 *
 * The syntax is taught in three places, none of which is a permanent line of
 * instructions under the input: markers echo live beside the field as you type
 * them, the first-run state spells them out, and `?` lists them. What remains
 * here is an `aria-describedby` hint, read aloud on focus and invisible on
 * screen — the people who cannot see the echo are exactly the ones who need
 * the syntax stated.
 */
export function Capture({ day, ref }: { day: string; ref?: Ref<CaptureHandle> }) {
  const dispatch = useDispatch()
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }), [])

  const parsed = parseInput(value)
  const showsEcho = parsed.tags.length > 0 || parsed.priority > 0 || parsed.estimateMin !== null

  const submit = () => {
    if (parsed.title === '') return
    dispatch({ type: 'addTask', day, input: value, now: new Date().toISOString() })
    setValue('')
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="border-b border-rule"
    >
      <div className="flex items-center gap-3 px-3 py-4 sm:gap-4 sm:px-4">
        <span aria-hidden="true" className="w-6 shrink-0 text-right text-accent">
          <Icon name="arrowRight" size={18} />
        </span>

        <input
          ref={input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setValue('')
              input.current?.blur()
            }
          }}
          placeholder="What needs doing today?"
          aria-label="Add a task"
          aria-describedby={CAPTURE_HINT_ID}
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          spellCheck={false}
          className="min-w-0 flex-1 text-row placeholder:text-ink-muted"
        />

        {showsEcho && (
          <div className="flex shrink-0 items-center gap-2.5">
            {parsed.tags.map((tag) => (
              <span key={tag} className="board-label text-ink-muted">
                #{tag}
              </span>
            ))}
            {parsed.estimateMin !== null && (
              <span className="board-quantity text-ink-muted">
                {formatEstimate(parsed.estimateMin)}
              </span>
            )}
            <PriorityMark priority={parsed.priority} />
          </div>
        )}
      </div>
    </form>
  )
}
