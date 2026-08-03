import { useRef, useState } from 'react'
import { useAppState, useDispatch, useStore } from '../../store/context'
import { deserialise, exportState } from '../../lib/io'
import { clearStoredState } from '../../store/persist'
import { navigate } from '../../app/router'
import type { Theme } from '../../domain/types'
import { Overlay } from '../../ui/Overlay'
import { Button } from '../../ui/Button'
import { Icon, type IconName } from '../../ui/Icon'
import { Repeats } from './Repeats'

/**
 * Settings, and the door out.
 *
 * The data section is the most important thing on this screen. An app that
 * stores everything locally and offers no way to take it with you has not given
 * you your data — it has trapped it in a browser profile that one "clear site
 * data" click destroys. Export is the feature that makes the privacy claim
 * honest rather than merely true.
 */

const THEMES: { value: Theme; label: string; icon: IconName }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
]

type Notice = { tone: 'ok' | 'bad'; text: string } | null

export function SettingsView({ today }: { today: string }) {
  const state = useAppState()
  const dispatch = useDispatch()
  const { persisted } = useStore()

  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirmingWipe, setConfirmingWipe] = useState(false)

  const taskCount = Object.keys(state.tasks).length

  const onFile = async (file: File) => {
    const result = deserialise(await file.text())

    if (!result.ok) {
      setNotice({ tone: 'bad', text: result.reason })
      return
    }

    dispatch({ type: 'importState', state: result.state })
    setNotice({
      tone: 'ok',
      text: `Imported ${result.taskCount} ${result.taskCount === 1 ? 'task' : 'tasks'}. What was here before is gone.`,
    })
  }

  const wipe = async () => {
    dispatch({ type: 'clearAll' })
    await clearStoredState()
    setConfirmingWipe(false)
    setNotice({ tone: 'ok', text: 'Everything is gone. Nothing was sent anywhere on the way out.' })
  }

  return (
    <Overlay title="Settings" onClose={() => navigate({ name: 'today', day: today })}>
      <div className="flex flex-col gap-14">
        <section aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="board-label border-b-2 border-rule-strong pb-2">
            Appearance
          </h2>

          <fieldset className="mt-4 flex flex-wrap gap-3">
            <legend className="sr-only">Theme</legend>
            {THEMES.map((option) => {
              const on = state.settings.theme === option.value
              return (
                <label
                  key={option.value}
                  className={`board-label flex cursor-pointer items-center gap-2.5 border-2 px-4 py-2.5 transition-colors ${
                    on
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-rule text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    checked={on}
                    onChange={() => dispatch({ type: 'setTheme', theme: option.value })}
                    className="sr-only"
                  />
                  <Icon name={option.icon} size={16} />
                  {option.label}
                </label>
              )
            })}
          </fieldset>
        </section>

        <Repeats today={today} />

        <section aria-labelledby="data-heading">
          <h2 id="data-heading" className="board-label border-b-2 border-rule-strong pb-2">
            Your data
          </h2>

          <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
            {taskCount === 0
              ? 'Nothing stored yet.'
              : `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} live in this browser's storage, on this device, and nowhere else.`}{' '}
            No copy exists on any server, which also means clearing your browser data would take
            them with it. Export is how you keep them.
          </p>

          {!persisted && (
            <p className="mt-4 flex items-start gap-2.5 border-2 border-accent px-4 py-3 text-[0.9375rem]">
              <span className="mt-0.5 shrink-0 text-accent">
                <Icon name="offline" size={16} />
              </span>
              <span>
                This browser would not give the app durable storage — a private window usually
                explains it. Anything you write may not survive closing the tab.
              </span>
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button icon="download" onClick={() => exportState(state)} disabled={taskCount === 0}>
              Export JSON
            </Button>

            <Button icon="upload" onClick={() => fileInput.current?.click()}>
              Import JSON
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Choose a Today export to import"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onFile(file)
                event.target.value = ''
              }}
            />
          </div>

          {notice && (
            <p
              aria-live="polite"
              className={`mt-4 border-l-2 py-1 pl-3 text-[0.9375rem] ${
                notice.tone === 'bad' ? 'border-accent text-ink' : 'border-rule text-ink-muted'
              }`}
            >
              {notice.text}
            </p>
          )}
        </section>

        <section aria-labelledby="wipe-heading">
          <h2 id="wipe-heading" className="board-label border-b-2 border-rule-strong pb-2">
            Delete everything
          </h2>

          <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
            Removes every task, every repeat, and the stored copy in this browser. There is no
            backup anywhere, so this cannot be undone — export first if you might want any of it.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {confirmingWipe ? (
              <>
                <Button
                  variant="solid"
                  className="bg-accent text-accent-ink hover:bg-ink hover:text-ground"
                  onClick={() => void wipe()}
                >
                  Yes, delete all {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingWipe(false)}>
                  Keep them
                </Button>
              </>
            ) : (
              <Button
                icon="trash"
                onClick={() => setConfirmingWipe(true)}
                disabled={taskCount === 0}
              >
                Delete everything
              </Button>
            )}
          </div>
        </section>

        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="board-label border-b-2 border-rule-strong pb-2">
            About
          </h2>
          <p className="mt-4 max-w-prose leading-relaxed text-ink-muted">
            Today is a static page. It has no account system, no server, and no analytics, and its
            Content-Security-Policy forbids it from opening a connection to anywhere. You can check
            all of that: open your browser's network tab and use the app, or read the source at{' '}
            <a
              href="https://github.com/maxgfr/today"
              className="text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
            >
              github.com/maxgfr/today
            </a>
            .
          </p>
        </section>
      </div>
    </Overlay>
  )
}
