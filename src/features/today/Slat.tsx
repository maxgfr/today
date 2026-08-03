import { Icon } from '../../ui/Icon'

/**
 * The completion control, drawn as a split-flap slat.
 *
 * This is the app's one authored motion: the slat turns over the way a
 * departure board's character does when a service changes state. It is a
 * `button` with `aria-pressed` rather than a styled checkbox because the label
 * lives in the row beside it, and because a real button gets keyboard
 * activation, focus, and voice control for free.
 *
 * The `key` on the inner face is what replays the flip: React remounts the
 * element when `done` changes, and a CSS animation runs on mount. Under
 * `prefers-reduced-motion` the animation is reduced to nothing and the state
 * still changes instantly — the accent fill carries the meaning either way.
 */
export function Slat({
  done,
  label,
  onToggle,
  size = 'md',
}: {
  done: boolean
  label: string
  onToggle: () => void
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'size-5' : 'size-7'
  // Completion is the most-tapped control in the app; on a phone its hit area
  // is padded out to 44px without the slat itself growing.
  const hit = size === 'sm' ? '-m-1.5 p-1.5' : '-m-2 p-2 sm:-m-1 sm:p-1'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={label}
      className={`group shrink-0 ${hit}`}
      style={{ perspective: '260px' }}
    >
      <span
        key={String(done)}
        className={`slat flex ${box} animate-flip items-center justify-center border-2 transition-colors duration-150 ${
          done
            ? 'border-accent bg-accent text-accent-ink'
            : 'border-rule-strong text-transparent group-hover:border-accent group-hover:text-accent'
        }`}
      >
        <Icon name="check" size={size === 'sm' ? 12 : 16} strokeWidth={3} />
      </span>
    </button>
  )
}
