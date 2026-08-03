import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { useDispatch } from '../../store/context'
import { parseInput } from '../../domain/parse'
import { Icon } from '../../ui/Icon'
import { PriorityMark } from './TaskMeta'
import { formatEstimate } from './format'

export type CaptureHandle = { focus: () => void }

/**
 * Writing down the next thing.
 *
 * The field sits at the foot of the board, where the next row would go, so
 * adding a task reads as extending the list rather than filing something into
 * it. It keeps focus after Enter: a morning is usually three or four lines
 * typed in one go, and reaching for the mouse between them would be the
 * friction that sends people back to a text file.
 *
 * As markers are typed they are echoed live beside the field, which is how the
 * syntax gets learned — no help page, no tour, just the result appearing.
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
      className="border-t-2 border-rule-strong"
    >
      <div className="flex items-center gap-3 px-3 py-3.5 sm:gap-4 sm:px-4">
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
          enterKeyHint="done"
          autoComplete="off"
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

      <p className="px-3 pb-3 text-[0.6875rem] text-ink-muted sm:px-4 sm:pl-[3.25rem]">
        <span className="tabular">#tag</span> to label · <span className="tabular">!1</span> to{' '}
        <span className="tabular">!3</span> to rank · <span className="tabular">~30m</span> or{' '}
        <span className="tabular">~2h</span> to estimate
      </p>
    </form>
  )
}
