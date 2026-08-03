import { useEffect, useState } from 'react'
import { today as currentDay } from '../lib/date'
import type { DayId } from '../domain/types'

/**
 * The current day, kept honest while the app stays open.
 *
 * An offline to-do app gets left open overnight. Without this, the header would
 * still read Monday on Tuesday morning and the triage tray would never appear —
 * the two things the whole app is built around.
 *
 * A timer set to fire exactly at midnight is not enough on its own: a sleeping
 * laptop does not fire it, so waking the tab re-checks as well.
 */
export function useToday(): DayId {
  const [day, setDay] = useState(currentDay)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const scheduleNextMidnight = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 1, 0)

      timer = setTimeout(() => {
        setDay(currentDay())
        scheduleNextMidnight()
      }, midnight.getTime() - now.getTime())
    }

    const syncNow = () => {
      if (document.visibilityState === 'visible') setDay(currentDay())
    }

    scheduleNextMidnight()
    document.addEventListener('visibilitychange', syncNow)
    window.addEventListener('focus', syncNow)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', syncNow)
      window.removeEventListener('focus', syncNow)
    }
  }, [])

  return day
}
