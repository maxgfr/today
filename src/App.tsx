import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StoreProvider } from './store/StoreProvider'
import { useAppState, useDispatch, useStore } from './store/context'
import { useToday } from './app/useToday'
import { useRoute, navigate } from './app/router'
import { useThemeEffect } from './app/theme'
import { useShortcuts } from './app/shortcuts'
import { needsTriage } from './domain/reducer'
import { tasksForDay, noFilters, type Filters } from './domain/selectors'
import { addDays } from './lib/date'
import { requestPersistence } from './lib/idb'
import { TodayView } from './features/today/TodayView'
import { FilterBar } from './features/today/FilterBar'
import type { CaptureHandle } from './features/today/Capture'
import { TriageTray } from './features/triage/TriageTray'
import { WeekView } from './features/week/WeekView'
import { StatsView } from './features/stats/StatsView'
import { SettingsView } from './features/settings/SettingsView'
import { CommandPalette, type Command } from './features/palette/CommandPalette'
import { HelpPanel } from './features/help/HelpPanel'
import { UpdatePrompt } from './features/pwa/UpdatePrompt'
import { IconButton } from './ui/Button'
import { Icon } from './ui/Icon'

function Board() {
  const state = useAppState()
  const dispatch = useDispatch()
  const { status, canUndo, canRedo } = useStore()

  const today = useToday()
  const route = useRoute()

  const [filters, setFilters] = useState<Filters>(noFilters)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const capture = useRef<CaptureHandle>(null)

  useThemeEffect(state.settings.theme)

  const day = route.name === 'today' ? route.day : today

  // Ask once, after the first real interaction has had time to happen, for the
  // browser not to evict the only copy of the user's data.
  useEffect(() => {
    if (status === 'ready') void requestPersistence()
  }, [status])

  // Recurring instances appear when a day is actually opened — never behind
  // your back, and never backfilled onto days already gone.
  useEffect(() => {
    if (status !== 'ready' || day < today) return
    dispatch({ type: 'materialise', day, now: new Date().toISOString() })
  }, [status, day, today, dispatch])

  const goToDay = useCallback((target: string) => navigate({ name: 'today', day: target }), [])

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'new',
        label: 'Write a new task',
        icon: 'plus',
        keys: 'N',
        run: () => {
          goToDay(today)
          setTimeout(() => capture.current?.focus(), 0)
        },
      },
      {
        id: 'week',
        label: 'Open the week',
        icon: 'week',
        keys: 'W',
        run: () => navigate({ name: 'week', anchor: day }),
      },
      {
        id: 'stats',
        label: 'Open stats',
        icon: 'stats',
        keys: 'S',
        run: () => navigate({ name: 'stats' }),
      },
      {
        id: 'settings',
        label: 'Open settings',
        icon: 'settings',
        keys: ',',
        run: () => navigate({ name: 'settings' }),
      },
      {
        id: 'today',
        label: 'Go to today',
        icon: 'arrowRight',
        keys: 'T',
        run: () => goToDay(today),
      },
      {
        id: 'tomorrow',
        label: 'Go to tomorrow',
        icon: 'chevronRight',
        run: () => goToDay(addDays(today, 1)),
      },
      {
        id: 'yesterday',
        label: 'Go to yesterday',
        icon: 'chevronLeft',
        run: () => goToDay(addDays(today, -1)),
      },
      {
        id: 'undo',
        label: 'Undo',
        icon: 'undo',
        keys: '⌘Z',
        run: () => dispatch({ type: 'undo' }),
      },
      {
        id: 'redo',
        label: 'Redo',
        icon: 'redo',
        keys: '⇧⌘Z',
        run: () => dispatch({ type: 'redo' }),
      },
      {
        id: 'theme',
        label: `Switch to ${state.settings.theme === 'dark' ? 'light' : 'dark'} theme`,
        icon: state.settings.theme === 'dark' ? 'sun' : 'moon',
        run: () =>
          dispatch({ type: 'setTheme', theme: state.settings.theme === 'dark' ? 'light' : 'dark' }),
      },
      {
        id: 'help',
        label: 'Show the keyboard map',
        icon: 'keyboard',
        keys: '?',
        run: () => setHelpOpen(true),
      },
    ],
    [day, today, goToDay, dispatch, state.settings.theme],
  )

  useShortcuts(
    useMemo(
      () => ({
        openPalette: () => setPaletteOpen(true),
        focusCapture: () => capture.current?.focus(),
        undo: () => dispatch({ type: 'undo' }),
        redo: () => dispatch({ type: 'redo' }),
        openWeek: () => navigate({ name: 'week', anchor: day }),
        openStats: () => navigate({ name: 'stats' }),
        openSettings: () => navigate({ name: 'settings' }),
        toggleHelp: () => setHelpOpen((open) => !open),
        previousDay: () => goToDay(addDays(day, -1)),
        nextDay: () => goToDay(addDays(day, 1)),
        goToToday: () => goToDay(today),
      }),
      [day, today, goToDay, dispatch],
    ),
  )

  if (status === 'loading') {
    return <div className="min-h-dvh" aria-busy="true" />
  }

  if (route.name === 'week') return <WeekView anchor={route.anchor} today={today} />
  if (route.name === 'stats') return <StatsView today={today} />
  if (route.name === 'settings') return <SettingsView today={today} />

  const showTriage = day === today && needsTriage(state, today)
  const dayTaskCount = tasksForDay(state, day).length

  return (
    // `my-auto` rather than `justify-center`: a short day sits in the optical
    // centre of the screen instead of clinging to the top with half the viewport
    // empty below it, and a long one still scrolls from the top without the
    // clipping that centred flex children are famous for.
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto my-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {showTriage && <TriageTray today={today} />}

        <FilterBar filters={filters} onChange={setFilters} taskCount={dayTaskCount} />

        <TodayView day={day} today={today} filters={filters} captureRef={capture} />

        {/* Navigation lives under the board, not over it: on this screen the day
          is the subject and everything here is a way to leave it. */}
        <nav
          aria-label="Elsewhere"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4"
        >
          <div className="flex items-center gap-1">
            <IconButton
              icon="chevronLeft"
              label="Previous day"
              onClick={() => goToDay(addDays(day, -1))}
            />
            {day !== today ? (
              <button
                type="button"
                onClick={() => goToDay(today)}
                className="board-label px-2 py-2 text-accent underline underline-offset-4 hover:no-underline"
              >
                Back to today
              </button>
            ) : (
              <span className="board-label px-2 py-2 text-ink-muted">Today</span>
            )}
            <IconButton
              icon="chevronRight"
              label="Next day"
              onClick={() => goToDay(addDays(day, 1))}
            />
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              icon="undo"
              label="Undo"
              disabled={!canUndo}
              onClick={() => dispatch({ type: 'undo' })}
            />
            <IconButton
              icon="redo"
              label="Redo"
              disabled={!canRedo}
              onClick={() => dispatch({ type: 'redo' })}
            />
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-rule" />
            <IconButton
              icon="search"
              label="Commands and search"
              onClick={() => setPaletteOpen(true)}
            />
            <IconButton
              icon="week"
              label="Week"
              onClick={() => navigate({ name: 'week', anchor: day })}
            />
            <IconButton icon="stats" label="Stats" onClick={() => navigate({ name: 'stats' })} />
            <IconButton
              icon="settings"
              label="Settings"
              onClick={() => navigate({ name: 'settings' })}
            />
            <IconButton icon="keyboard" label="Keyboard map" onClick={() => setHelpOpen(true)} />
          </div>
        </nav>

        <p className="mt-6 flex items-center gap-2 text-[0.75rem] text-ink-muted">
          <Icon name="shield" size={13} />
          Stored in this browser only. Nothing is sent anywhere.
        </p>

        {paletteOpen && (
          <CommandPalette
            commands={commands}
            onClose={() => setPaletteOpen(false)}
            onOpenTask={goToDay}
          />
        )}
        {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
      </div>
    </div>
  )
}

export function App() {
  return (
    <StoreProvider>
      <Board />
      <UpdatePrompt />
    </StoreProvider>
  )
}
