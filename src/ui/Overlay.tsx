import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

/**
 * The shell every secondary surface wears.
 *
 * Week, Stats and Settings are places you pass through, not places you live,
 * so they share one frame that always names its own exit and always returns to
 * the day. They are full-bleed rather than modal dialogs: the board underneath
 * is not context you need while you are here, and dimming it would suggest you
 * are about to come back to the same spot, which you are not.
 *
 * Escape closes. Focus moves to the panel on open so the keyboard follows the
 * eye, and returns to whatever opened it on close.
 */
export function Overlay({
  title,
  onClose,
  actions,
  children,
}: {
  title: string
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panel.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus?.()
    }
  }, [onClose])

  return (
    <div
      ref={panel}
      tabIndex={-1}
      className="animate-rise mx-auto w-full max-w-5xl px-5 py-8 outline-none sm:px-8 sm:py-12"
    >
      <header className="mb-6 flex items-center justify-between gap-4 border-b-2 border-rule-strong pb-4">
        <h1 className="board-display text-[clamp(1.75rem,5vw,2.75rem)] uppercase leading-none">
          {title}
        </h1>
        <div className="flex items-center gap-2">
          {actions}
          <IconButton icon="close" label="Back to today" onClick={onClose} size={20} />
        </div>
      </header>

      {children}
    </div>
  )
}
