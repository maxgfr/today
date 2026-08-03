import { useState } from 'react'
import { formatShortWeekday, formatMonthDay } from '../../lib/date'
import type { WeekStats } from '../../domain/selectors'

/**
 * Seven days, one measure: how much of each day got done.
 *
 * A single series, so there is no legend and no categorical palette — the
 * accent is the data and the track behind it is the day's total, neutral by
 * design rather than a second category. That also rules out the usual mistake
 * here, a value-ramp that darkens the taller bars and encodes length twice.
 *
 * Values are not printed on every bar. Only today and the best day of the week
 * are labelled directly; everything else lives in the tooltip and, for anyone
 * who cannot hover, in the table underneath — which is the real answer, not the
 * fallback.
 */
export function WeekChart({ stats, today }: { stats: WeekStats; today: string }) {
  const [hovered, setHovered] = useState<string | null>(null)

  const ceiling = Math.max(1, ...stats.days.map((day) => day.total))
  const best = stats.days.reduce(
    (leader, day) => (day.done > leader.done ? day : leader),
    stats.days[0]!,
  )

  return (
    <figure className="m-0">
      <figcaption className="board-label mb-4 text-ink-muted">Done each day this week</figcaption>

      <div className="flex h-52 items-end gap-2 border-b-2 border-rule-strong">
        {stats.days.map((day) => {
          const isToday = day.day === today
          const isBest = day.day === best.day && best.done > 0
          const labelled = isToday || isBest
          const showTip = hovered === day.day

          return (
            <div
              key={day.day}
              className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(day.day)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(day.day)}
              onBlur={() => setHovered(null)}
            >
              {(labelled || showTip) && day.total > 0 && (
                <span
                  className={`board-label tabular pb-1.5 text-center ${
                    isToday ? 'text-accent' : 'text-ink-muted'
                  }`}
                >
                  {day.done}
                </span>
              )}

              {/* The track is the day's whole plan; the fill is what got done. */}
              <button
                type="button"
                aria-label={`${formatMonthDay(day.day)}: ${day.done} of ${day.total} done`}
                className="flex w-full cursor-default flex-col justify-end"
                style={{ height: `${(day.total / ceiling) * 100}%`, minHeight: '2px' }}
              >
                <span
                  aria-hidden="true"
                  className={`block w-full ${
                    day.total > 0 ? 'bg-rule' : ''
                  } flex flex-col justify-end`}
                  style={{ height: '100%' }}
                >
                  <span
                    className={`block w-full transition-[height] duration-300 ${
                      isToday ? 'bg-accent' : 'bg-ink'
                    }`}
                    style={{
                      height: day.total === 0 ? '0%' : `${(day.done / day.total) * 100}%`,
                    }}
                  />
                </span>
              </button>

              {showTip && day.total > 0 && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-8 w-max -translate-x-1/2 border-2 border-rule-strong bg-surface px-2.5 py-1.5"
                >
                  <p className="board-label whitespace-nowrap">{formatMonthDay(day.day)}</p>
                  <p className="tabular whitespace-nowrap text-[0.8125rem] text-ink-muted">
                    {day.done} of {day.total} done
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {stats.days.map((day) => (
          <span
            key={day.day}
            className={`board-label min-w-0 flex-1 text-center ${
              day.day === today ? 'text-accent' : 'text-ink-muted'
            }`}
          >
            {formatShortWeekday(day.day).slice(0, 2)}
          </span>
        ))}
      </div>

      {/* Every value the chart encodes, reachable without hovering anything. */}
      <details className="mt-6 border-t border-rule pt-4">
        <summary className="board-label cursor-pointer text-ink-muted hover:text-ink">
          Read as a table
        </summary>
        <table className="mt-3 w-full text-left text-[0.875rem]">
          <caption className="sr-only">
            Tasks done and planned for each day of the week shown in the chart above
          </caption>
          <thead>
            <tr className="board-label border-b border-rule text-ink-muted">
              <th scope="col" className="py-1.5 font-inherit">
                Day
              </th>
              <th scope="col" className="py-1.5 text-right font-inherit">
                Done
              </th>
              <th scope="col" className="py-1.5 text-right font-inherit">
                Planned
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.days.map((day) => (
              <tr key={day.day} className="border-b border-rule last:border-b-0">
                <th scope="row" className="py-1.5 font-normal">
                  {formatMonthDay(day.day)}
                </th>
                <td className="tabular py-1.5 text-right">{day.done}</td>
                <td className="tabular py-1.5 text-right text-ink-muted">{day.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
