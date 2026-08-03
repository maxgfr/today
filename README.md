# Today

**Your day, one list.** A to-do app for what you are doing _today_ — offline-first, and private in
the only way that counts: there is no server to send anything to.

**[maxgfr.github.io/today](https://maxgfr.github.io/today)**

---

## What leaves your device

Nothing.

Today is a static page. It has no account system, no database, no analytics, and no backend of any
kind. Your tasks are written to your browser's IndexedDB and stay there.

That claim is worth exactly as much as your ability to check it, so:

1. **Watch it.** Open DevTools → Network, then use the app. Add tasks, complete them, reload. After
   the initial page load, nothing appears.
2. **Cut the cord.** Turn on airplane mode, or DevTools → Network → Offline. Everything keeps
   working, because nothing needed the network to begin with.
3. **Read the policy.** The page ships a Content-Security-Policy with `connect-src 'self'`. Even if
   a dependency decided to phone home, the browser would refuse.
4. **Read the gate.** [`scripts/check-no-network.mjs`](scripts/check-no-network.mjs) scans the built
   bundle for outbound origins, network APIs, and a weakened CSP — and **fails CI** if it finds any.
   It runs on every pull request and again before every deploy.

The trade is real and worth stating plainly: nothing is backed up anywhere. Clearing your browser
data deletes your tasks. That is what **Export JSON** in Settings is for.

## What it does

**The day is the product.** Today is the whole app. There is no inbox, no backlog, no "someday"
list. A task belongs to a day or it does not exist.

- **Write the day.** Quick capture with `#tag` to label, `!1`–`!3` to rank, `~30m` or `~2h` to
  estimate. Priorities, tags, steps, notes, and drag to reorder.
- **Nothing rolls over on its own.** Whatever you did not finish is waiting the next morning, with
  its age printed beside it, for a decision: keep it today, push it to tomorrow, or drop it. A pile
  can never grow behind your back.
- **Repeats.** Daily, chosen weekdays, or every N days/weeks. Instances appear as days are opened —
  switching one on today never invents a month of tasks you never saw.
- **Week.** Seven days side by side. Drag anything onto another day.
- **Undo and redo** on everything, including triage and drag.
- **Keyboard first.** `⌘K` for commands and search, `?` for the full map.
- **Stats.** Weekly completion, streak, lifetime totals.
- **Installable.** Add it to your dock or home screen; it works with no connection.

## Keyboard

| Key          | Does                   |
| ------------ | ---------------------- |
| `N`          | Write a new task       |
| `⌘K` or `/`  | Commands and search    |
| `⌘Z` / `⇧⌘Z` | Undo, redo             |
| `W`          | Week                   |
| `S`          | Stats                  |
| `,`          | Settings               |
| `[` `]`      | Previous day, next day |
| `T`          | Back to today          |
| `?`          | The full map           |
| `Esc`        | Close whatever is open |

Inside a task row: `X` completes it, `1`–`3` set priority, `0` clears it, `⌫` deletes it. To reorder
without a mouse, tab to a row's handle, press Space to pick it up, move with the arrow keys, Space
to drop.

## Your data

Everything lives in one JSON document. **Settings → Export JSON** hands you the whole thing, indented
and readable — no proprietary envelope, no compression. Import restores it. Delete everything wipes
it, locally, with nothing sent anywhere on the way out.

```json
{
  "app": "today",
  "exportedAt": "2026-08-03T10:00:00.000Z",
  "version": 1,
  "tasks": { "…": { "title": "Water the plants", "day": "2026-08-03", "status": "open" } },
  "templates": {},
  "settings": { "theme": "system" }
}
```

The importer is deliberately forgiving: a malformed task is dropped, not treated as grounds for
rejecting the file. Losing one bad row beats losing a year of history.

## Running it yourself

```bash
pnpm install
pnpm dev        # http://localhost:5173/today/
pnpm verify     # typecheck, lint, tests, build, privacy gate
```

Deploying your own copy: fork it, change `BASE` in `vite.config.ts` to `/<your-repo>/`, and enable
Pages with **GitHub Actions** as the source. The workflow in `.github/workflows/deploy.yml` does the
rest.

## How it is built

Vite, React 19, TypeScript, Tailwind v4. No backend, no state-management library, no component kit,
no router — the app is small enough that each of those would cost more than it saved.

- `src/domain/` — every state change, as pure functions. Undo/redo is a snapshot wrapper around the
  reducer, so there is no second implementation of each mutation to drift out of sync.
- `src/store/` — one versioned blob in IndexedDB, written debounced and flushed on `pagehide`.
  `migrate.ts` is the single door untrusted data comes through, for both stored state and imports.
- `src/lib/date.ts` — day arithmetic on `YYYY-MM-DD` strings in local time, DST-safe. A task written
  at 23:50 belongs to that evening, not to the UTC day that already rolled over.
- `src/features/` — one folder per surface.
- 151 unit tests cover carry-over, recurrence, undo/redo, ordering, date arithmetic, and import
  repair — the parts where a bug quietly eats someone's day.

Design decisions live in [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md).

## Licence

MIT. The font is [Archivo](https://github.com/Omnibus-Type/Archivo) by Omnibus-Type, under the SIL
Open Font License — vendored into `src/ui/fonts/` rather than loaded from a CDN, because a CDN font
is a request to somebody else's server.
