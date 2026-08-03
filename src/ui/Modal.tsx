import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A real `<dialog>`, opened modally.
 *
 * The browser then owns the hard parts and owns them correctly: focus is
 * trapped inside, the rest of the page goes inert, Escape closes, and focus
 * returns to whatever opened it. Every hand-rolled version of this gets at
 * least one of those wrong, usually the inert part, and a screen reader walks
 * straight out of the dialog into the page behind it.
 *
 * The backdrop-click handler is why two jsx-a11y rules are off for this file in
 * `.oxlintrc.json`. Clicking outside is a mouse convenience with an exact
 * keyboard equivalent already provided by the platform — Escape, via `oncancel`
 * — so the accessibility concern those rules protect is met, just not in a
 * place a static check can see.
 */
export function Modal({
  label,
  onClose,
  align = 'center',
  children,
}: {
  label: string
  onClose: () => void
  align?: 'center' | 'top'
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Clicking the backdrop is a click on the dialog element itself; the
      // panel inside stops its own clicks from reaching here.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={`board-modal ${align === 'top' ? 'board-modal-top' : ''}`}
    >
      {children}
    </dialog>
  )
}
