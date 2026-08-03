import { Icon } from '../../ui/Icon'

/**
 * The two ends of a day.
 *
 * A cleared board is the strongest moment this product has, so it gets the
 * design's attention rather than a grey "no tasks" line: the rules close, the
 * accent lands once, and the app says the day is done and then stops talking.
 * No confetti, no streak nag, no next-action prompt — the reward for finishing
 * is being left alone.
 *
 * The first-run state has the opposite job: someone who has never seen this
 * app has to learn what to type and what the app does with it, in one screen,
 * without a tour.
 */

export function DayCleared({ done }: { done: number }) {
  return (
    <div className="animate-board-clear origin-top border-y-2 border-accent px-4 py-12 text-center">
      <p className="board-display text-[clamp(1.75rem,5vw,2.75rem)] uppercase text-accent">
        Day cleared
      </p>
      <p className="board-label tabular mt-3 text-ink-muted">
        {done} {done === 1 ? 'thing' : 'things'} done
      </p>
    </div>
  )
}

export function EmptyDay() {
  return (
    <div className="border-b border-rule px-4 py-10 text-center">
      <p className="text-row text-ink-muted">Nothing written down for this day.</p>
    </div>
  )
}

export function FirstRun() {
  return (
    <div className="border-b border-rule px-4 py-10">
      <p className="text-row">Write the first thing you need to do today.</p>

      <dl className="mt-6 grid gap-x-8 gap-y-3 text-[0.9375rem] sm:grid-cols-[auto_1fr]">
        <dt className="board-label pt-1 text-accent">Type</dt>
        <dd className="text-ink-muted">
          <span className="text-ink">Water the plants</span> — that is the whole requirement.
        </dd>

        <dt className="board-label pt-1 text-accent">Add</dt>
        <dd className="text-ink-muted">
          <span className="text-ink">#home</span> to label it, <span className="text-ink">!1</span>{' '}
          to rank it, <span className="text-ink">~20m</span> to estimate it.
        </dd>

        <dt className="board-label pt-1 text-accent">Then</dt>
        <dd className="text-ink-muted">
          Press <kbd className="board-label border border-rule px-1.5 py-0.5">Enter</kbd> and keep
          typing. Three to seven lines is a day.
        </dd>
      </dl>

      <p className="mt-7 flex items-start gap-2.5 border-t border-rule pt-5 text-[0.875rem] text-ink-muted">
        <span className="mt-0.5 shrink-0 text-accent">
          <Icon name="shield" size={16} />
        </span>
        <span>
          Everything you write stays in this browser. There is no account and no server to send it
          to — open the network tab and watch nothing happen.
        </span>
      </p>
    </div>
  )
}
