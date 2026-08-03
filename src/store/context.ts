import { createContext, use } from 'react'
import type { AppState } from '../domain/types'
import type { HistoryAction } from '../domain/history'

export type StoreStatus = 'loading' | 'ready'

export type StoreValue = {
  state: AppState
  status: StoreStatus
  canUndo: boolean
  canRedo: boolean
  /** False when the browser gave us no durable storage — surfaced in the UI. */
  persisted: boolean
}

/**
 * State and dispatch are separate contexts on purpose: components that only
 * dispatch (buttons, the capture field) do not re-render when a task changes
 * three rows away.
 */
export const StoreContext = createContext<StoreValue | null>(null)
export const DispatchContext = createContext<((action: HistoryAction) => void) | null>(null)

export function useStore(): StoreValue {
  const value = use(StoreContext)
  if (!value) throw new Error('useStore must be used inside <StoreProvider>')
  return value
}

export function useAppState(): AppState {
  return useStore().state
}

export function useDispatch(): (action: HistoryAction) => void {
  const dispatch = use(DispatchContext)
  if (!dispatch) throw new Error('useDispatch must be used inside <StoreProvider>')
  return dispatch
}
