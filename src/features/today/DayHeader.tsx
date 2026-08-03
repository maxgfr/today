import {
  formatMonthDay,
  formatWeekday,
  relativeDayLabel,
  today as currentDay,
} from '../../lib/date'
import type { DayProgress } from '../../domain/selectors'

/**
 * The board's headline.
 *
 * The weekday runs at display scale because the day is the product: it is the
 * one thing on screen that should be legible from across a room, and it is
 * what tells you at a glance that the app has noticed midnight passed. The
 * counter opposite is the board's status line — how much of the day is left,
 * stated as a fact, with no encouragement attached.
 */
export function DayHeader({ day, progress }: { day: string; progress: DayProgress }) {
  const isToday = day === currentDay()

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-5">
      <div className="min-w-0">
        <h1 className="board-display text-display uppercase">{formatWeekday(day)}</h1>
        <p className="board-label mt-2 flex items-center gap-2 text-ink-muted">
          <span>{formatMonthDay(day)}</span>
          {!isToday && (
            <>
              <span aria-hidden="true" className="text-rule">
                /
              </span>
              <span className="text-accent">{relativeDayLabel(day, currentDay())}</span>
            </>
          )}
        </p>
      </div>

      {progress.total > 0 && (
        <p className="board-label tabular shrink-0 pb-1 text-ink-muted">
          <span className={progress.complete ? 'text-accent' : 'text-ink'}>{progress.done}</span>
          <span aria-hidden="true"> / {progress.total}</span>
          <span className="sr-only">
            {' '}
            of {progress.total} done
            {progress.remainingMin > 0 ? `, about ${progress.remainingMin} minutes left` : ''}
          </span>
        </p>
      )}
    </header>
  )
}
