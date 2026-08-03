import { allTags, hasActiveFilters, type Filters } from '../../domain/selectors'
import { useAppState } from '../../store/context'
import { Icon } from '../../ui/Icon'

/**
 * Filters, shown only once there is enough on the board for them to matter.
 *
 * A day of four tasks does not need a filter bar, and showing one anyway would
 * put controls above the only content that counts. Below six tasks and with
 * nothing selected, this renders nothing at all.
 */
export function FilterBar({
  filters,
  onChange,
  taskCount,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  taskCount: number
}) {
  const state = useAppState()
  const tags = allTags(state).slice(0, 8)
  const active = hasActiveFilters(filters)

  if (taskCount < 6 && !active) return null

  const toggleTag = (tag: string) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(tag)
        ? filters.tags.filter((value) => value !== tag)
        : [...filters.tags, tag],
    })

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <label className="flex min-w-40 flex-1 items-center gap-2 border-b border-rule py-1 focus-within:border-accent">
        <span aria-hidden="true" className="text-ink-muted">
          <Icon name="search" size={15} />
        </span>
        <input
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Filter this day"
          aria-label="Filter this day"
          className="min-w-0 flex-1 text-[0.9375rem]"
        />
      </label>

      {tags.map((entry) => {
        const on = filters.tags.includes(entry.tag)
        return (
          <button
            key={entry.tag}
            type="button"
            aria-pressed={on}
            onClick={() => toggleTag(entry.tag)}
            className={`board-label border px-2 py-1 transition-colors ${
              on
                ? 'border-accent bg-accent text-accent-ink'
                : 'border-rule text-ink-muted hover:border-ink hover:text-ink'
            }`}
          >
            #{entry.tag}
          </button>
        )
      })}

      <button
        type="button"
        aria-pressed={filters.hideDone}
        onClick={() => onChange({ ...filters, hideDone: !filters.hideDone })}
        className={`board-label border px-2 py-1 transition-colors ${
          filters.hideDone
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-rule text-ink-muted hover:border-ink hover:text-ink'
        }`}
      >
        Hide done
      </button>

      {active && (
        <button
          type="button"
          onClick={() => onChange({ query: '', tags: [], priorities: [], hideDone: false })}
          className="board-label px-2 py-1 text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Clear
        </button>
      )}
    </div>
  )
}
