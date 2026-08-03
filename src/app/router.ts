import { useEffect, useState } from 'react'
import { isValidDayId, today } from '../lib/date'
import type { DayId } from '../domain/types'

/**
 * Hash routing, forty lines of it.
 *
 * The hash is what makes this work on GitHub Pages without a 404 fallback: the
 * server only ever serves `index.html`, and everything after the `#` never
 * leaves the browser. A router library would add a dependency for three routes
 * and one of them is the home screen.
 *
 * Week and Stats are overlays over Today, not peers of it — see `Route`.
 */
export type Route =
  | { name: 'today'; day: DayId }
  | { name: 'week'; anchor: DayId }
  | { name: 'stats' }
  | { name: 'settings' }

export const routeToHash = (route: Route): string => {
  switch (route.name) {
    case 'today':
      return route.day === today() ? '#/' : `#/day/${route.day}`
    case 'week':
      return `#/week/${route.anchor}`
    case 'stats':
      return '#/stats'
    case 'settings':
      return '#/settings'
  }
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, param] = path

  if (head === 'week') return { name: 'week', anchor: isValidDayId(param) ? param : today() }
  if (head === 'stats') return { name: 'stats' }
  if (head === 'settings') return { name: 'settings' }
  if (head === 'day' && isValidDayId(param)) return { name: 'today', day: param }

  return { name: 'today', day: today() }
}

export function navigate(route: Route): void {
  const hash = routeToHash(route)
  if (window.location.hash !== hash) window.location.hash = hash
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return route
}

/** Closing an overlay returns to the day, never to an arbitrary history entry. */
export const closeOverlay = (): void => navigate({ name: 'today', day: today() })
