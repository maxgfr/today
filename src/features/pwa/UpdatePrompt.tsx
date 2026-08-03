import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'

/**
 * The two things the service worker has to say.
 *
 * A new version waits for a click rather than reloading itself. `autoUpdate`
 * would eventually refresh the page under someone halfway through typing a
 * task, which is precisely the trust an offline-first app cannot spend.
 *
 * Going offline is stated once and then dismissed — in this app it is the
 * normal condition, not an incident, and a permanent warning badge would be
 * lying about the severity.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const [offline, setOffline] = useState(!navigator.onLine)
  const [dismissedOffline, setDismissedOffline] = useState(false)

  useEffect(() => {
    const goOffline = () => {
      setOffline(true)
      setDismissedOffline(false)
    }
    const goOnline = () => setOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  const showOffline = offline && !dismissedOffline

  if (!needRefresh && !showOffline) return null

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:justify-end sm:pr-6"
    >
      <div className="animate-rise flex w-full max-w-md items-center gap-3 border-2 border-rule-strong bg-surface px-4 py-3">
        <span aria-hidden="true" className="shrink-0 text-accent">
          <Icon name={needRefresh ? 'repeat' : 'offline'} size={18} />
        </span>

        <p className="min-w-0 flex-1 text-[0.9375rem]">
          {needRefresh
            ? 'A new version is ready.'
            : 'You are offline. Everything still works — nothing needed the network anyway.'}
        </p>

        {needRefresh ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button className="px-3 py-1.5" onClick={() => void updateServiceWorker(true)}>
              Reload
            </Button>
            <Button variant="ghost" className="px-3 py-1.5" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="shrink-0 px-3 py-1.5"
            onClick={() => setDismissedOffline(true)}
          >
            Got it
          </Button>
        )}
      </div>
    </div>
  )
}
