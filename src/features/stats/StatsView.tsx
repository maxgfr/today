import { useMemo, useState } from 'react'
import { useAppState } from '../../store/context'
import { currentStreak, lifetimeStats, weekStats } from '../../domain/selectors'
import { addDays, formatMonthDay, startOfWeek } from '../../lib/date'
import { navigate } from '../../app/router'
import { Overlay } from '../../ui/Overlay'
import { IconButton } from '../../ui/Button'
import { WeekChart } from './WeekChart'

/**
 * The service record.
 *
 * Four numbers and one chart, chosen to answer questions rather than to fill a
 * dashboard. Each headline is a stat tile because a single number is not a
 * chart — a one-bar bar chart would be the number wearing a costume.
 *
 * The streak is stated flatly, with the rule that produced it written next to
 * it. A number nobody can explain becomes a number people play to, and a to-do
 * app that makes you file fake tasks to protect a score has started working
 * against the day it is supposed to describe.
 */

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="border-t-2 border-rule-strong pt-3">
      {/* Proportional figures: tabular digits read loose at display size. */}
      <p className="board-display text-[clamp(2rem,5.5vw,3.25rem)] leading-none">{value}</p>
      <p className="board-label mt-2 text-ink-muted">{label}</p>
      {note && <p className="mt-1 text-[0.8125rem] leading-snug text-ink-muted">{note}</p>}
    </div>
  )
}

export function StatsView({ today }: { today: string }) {
  const state = useAppState()
  const [week, setWeek] = useState(() => startOfWeek(today))

  const stats = useMemo(() => weekStats(state, week), [state, week])
  const lifetime = useMemo(() => lifetimeStats(state), [state])
  const streak = useMemo(() => currentStreak(state, today), [state, today])

  const isThisWeek = week === startOfWeek(today)

  return (
    <Overlay title="Stats" onClose={() => navigate({ name: 'today', day: today })}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Stat
          value={String(streak)}
          label={streak === 1 ? 'Day streak' : 'Day streak'}
          note="Days in a row where everything planned got done. Days you planned nothing are skipped, not counted against you."
        />
        <Stat
          value={stats.total === 0 ? '—' : `${Math.round(stats.ratio * 100)}%`}
          label={isThisWeek ? 'This week' : 'That week'}
          note={`${stats.done} of ${stats.total} done`}
        />
        <Stat
          value={String(lifetime.completed)}
          label="Things done"
          note={`Across ${lifetime.activeDays} ${lifetime.activeDays === 1 ? 'day' : 'days'}`}
        />
        <Stat
          value={String(lifetime.perfectDays)}
          label="Days cleared"
          note={
            lifetime.busiestDay
              ? `Busiest was ${formatMonthDay(lifetime.busiestDay.day)}, ${lifetime.busiestDay.done} done`
              : 'No day finished yet'
          }
        />
      </div>

      <section className="mt-14">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="board-label">
            {formatMonthDay(week)} — {formatMonthDay(addDays(week, 6))}
          </h2>
          <div className="flex items-center gap-1">
            <IconButton
              icon="chevronLeft"
              label="Previous week"
              onClick={() => setWeek(addDays(week, -7))}
            />
            <IconButton
              icon="chevronRight"
              label="Next week"
              disabled={isThisWeek}
              onClick={() => setWeek(addDays(week, 7))}
            />
          </div>
        </header>

        <WeekChart stats={stats} today={today} />
      </section>
    </Overlay>
  )
}
