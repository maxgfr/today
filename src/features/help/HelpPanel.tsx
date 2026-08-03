import { ROW_SHORTCUTS, SHORTCUTS } from '../../app/shortcuts'
import { IconButton } from '../../ui/Button'
import { Modal } from '../../ui/Modal'

/**
 * The keyboard map, on `?`.
 *
 * A tooltip per control would teach these one at a time and never as a system.
 * Shown together, the shape of the keyboard layer is visible in one glance,
 * which is the only way anyone learns the second tier.
 */
export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Keyboard shortcuts" onClose={onClose}>
      <div className="animate-rise max-h-[80vh] overflow-y-auto border-2 border-rule-strong bg-surface">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-rule-strong bg-surface px-5 py-3">
          <h2 className="board-display text-xl uppercase">Keyboard</h2>
          <IconButton icon="close" label="Close the keyboard map" onClick={onClose} />
        </header>

        <div className="grid gap-x-10 gap-y-8 px-5 py-6 sm:grid-cols-2">
          <section>
            <h3 className="board-label mb-3 border-b border-rule pb-2 text-ink-muted">Anywhere</h3>
            <dl className="flex flex-col gap-2.5">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.keys} className="flex items-baseline justify-between gap-4">
                  <dt className="board-label tabular shrink-0 text-accent">{shortcut.keys}</dt>
                  <dd className="text-right text-[0.9375rem] text-ink-muted">{shortcut.action}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="board-label mb-3 border-b border-rule pb-2 text-ink-muted">
              Inside a task row
            </h3>
            <dl className="flex flex-col gap-2.5">
              {ROW_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.keys} className="flex items-baseline justify-between gap-4">
                  <dt className="board-label tabular shrink-0 text-accent">{shortcut.keys}</dt>
                  <dd className="text-right text-[0.9375rem] text-ink-muted">{shortcut.action}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-muted">
              Tab walks through the rows. To reorder without a mouse, tab to a row's handle, press
              Space to pick it up, move it with the arrow keys, and press Space again to drop it.
            </p>
          </section>
        </div>
      </div>
    </Modal>
  )
}
