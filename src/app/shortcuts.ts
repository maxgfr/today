import { useEffect } from 'react'

export type ShortcutHandlers = {
  openPalette: () => void
  focusCapture: () => void
  undo: () => void
  redo: () => void
  openWeek: () => void
  openStats: () => void
  openSettings: () => void
  toggleHelp: () => void
  previousDay: () => void
  nextDay: () => void
  goToToday: () => void
}

/** True while the keystroke belongs to whatever the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * The keyboard layer.
 *
 * Two tiers, and the split matters: anything with a modifier works everywhere,
 * including mid-sentence, because ⌘Z has to undo a typo. Bare letters only fire
 * when nothing has focus that could receive them, or `n` would be impossible to
 * type into a task title.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey

      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        handlers.openPalette()
        return
      }

      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) handlers.redo()
        else handlers.undo()
        return
      }

      // Ctrl+Y is the other half of the world's redo convention.
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handlers.redo()
        return
      }

      if (modifier || event.altKey || isTyping(event.target)) return

      switch (event.key) {
        case 'n':
          event.preventDefault()
          handlers.focusCapture()
          break
        case '/':
          event.preventDefault()
          handlers.openPalette()
          break
        case 'w':
          handlers.openWeek()
          break
        case 's':
          handlers.openStats()
          break
        case ',':
          handlers.openSettings()
          break
        case '?':
          handlers.toggleHelp()
          break
        case '[':
          handlers.previousDay()
          break
        case ']':
          handlers.nextDay()
          break
        case 't':
          handlers.goToToday()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'N', action: 'Write a new task' },
  { keys: '⌘K  /', action: 'Commands and search' },
  { keys: '⌘Z  ⇧⌘Z', action: 'Undo, redo' },
  { keys: 'W', action: 'Week' },
  { keys: 'S', action: 'Stats' },
  { keys: ',', action: 'Settings' },
  { keys: '[  ]', action: 'Previous day, next day' },
  { keys: 'T', action: 'Back to today' },
  { keys: '?', action: 'This list' },
  { keys: 'Esc', action: 'Close whatever is open' },
]

/** Keys that act on the row your focus is currently inside. */
export const ROW_SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'X', action: 'Complete or reopen' },
  { keys: '1  2  3', action: 'Set priority' },
  { keys: '0', action: 'Clear priority' },
  { keys: '⌫', action: 'Delete' },
]
