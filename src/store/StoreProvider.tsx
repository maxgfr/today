import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { canRedo, canUndo, historyReducer, initHistory } from '../domain/history'
import type { HistoryAction, HistoryState } from '../domain/history'
import { emptyState } from '../domain/types'
import { createWriter, loadState } from './persist'
import { DispatchContext, StoreContext, type StoreStatus } from './context'

const reduce = (state: HistoryState, action: HistoryAction) => historyReducer(state, action)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [history, rawDispatch] = useReducer(reduce, emptyState(), initHistory)
  const [status, setStatus] = useState<StoreStatus>('loading')
  const [persisted, setPersisted] = useState(true)

  const writer = useRef(createWriter()).current
  const hydrated = useRef(false)

  // Boot: read once, then hand control to the reducer.
  useEffect(() => {
    let cancelled = false

    void loadState().then((result) => {
      if (cancelled) return
      rawDispatch({ type: 'hydrate', state: result.state })
      setPersisted(result.persisted)
      hydrated.current = true
      setStatus('ready')
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Persist every change, but never write the empty pre-hydration state over
  // real data — that would delete everything on a slow first read.
  useEffect(() => {
    if (!hydrated.current) return
    writer.schedule(history.present)
  }, [history.present, writer])

  // Closing the tab mid-sentence should still land the last keystroke.
  // `pagehide` fires on mobile backgrounding where `beforeunload` does not.
  useEffect(() => {
    const flush = () => {
      if (hydrated.current) void writer.flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [writer])

  const dispatch = useCallback((action: HistoryAction) => rawDispatch(action), [])

  const value = useMemo(
    () => ({
      state: history.present,
      status,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
      persisted,
    }),
    [history, status, persisted],
  )

  return (
    <StoreContext value={value}>
      <DispatchContext value={dispatch}>{children}</DispatchContext>
    </StoreContext>
  )
}
