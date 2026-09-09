---
name: today
description: Manage daily tasks, completion, carryover, planning, and imports or exports in the Today app.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

# today

Reads and writes a **Today** list from the terminal.

The app itself stores everything in the browser's IndexedDB, which nothing outside that browser can
reach — that is the whole point of it. So this skill works on the app's **export file**, which is the
complete state as indented JSON. The loop is:

1. In the app: **Settings → Export JSON**, save over the store file.
2. Work here.
3. In the app: **Settings → Import JSON**, pick the same file.

Import **replaces** the app's data with the file. Say so before suggesting it if the user has been
adding tasks in the browser since the last export — their browser-side changes would be lost.

The file lives at `~/.today/today.json` unless `$TODAY_FILE` or `--file` says otherwise.
`node scripts/today.mjs path` prints the resolved path; `init` creates an empty one.

## Running it

The script sits next to this file. From this skill's directory:

```bash
node scripts/today.mjs <command>
```

Nothing to install: zero dependencies, Node only.

| Command                                    | Does                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| `list [day]`                               | The day's board. Defaults to today.                        |
| `add "<text>" [--day <day>]`               | Writes a task. Markers: `#tag`, `!1`–`!3`, `~30m` / `~2h`. |
| `done <query>`                             | Completes the task whose title contains `<query>`.         |
| `reopen <query>`                           | Puts it back.                                              |
| `drop <query>`                             | Retires it without deleting the record.                    |
| `rm <query>`                               | Deletes it outright.                                       |
| `move <query> <day>`                       | Moves it to another day.                                   |
| `carried`                                  | Everything still open on earlier days, with its age.       |
| `carry <query>\|all today\|tomorrow\|drop` | The morning triage decision.                               |
| `week [day]`                               | Seven days at a glance.                                    |
| `stats`                                    | Streak, total done, days cleared.                          |
| `path` · `init` · `json`                   | Where the file is · create one · dump it raw.              |

A day can be `2026-08-03`, `today`, `tomorrow`, `yesterday`, `+3`, `-2`, or a weekday name (which
means the _next_ one). Add `--json` to `list` and `carried` for machine-readable output.

## How to use it in conversation

- **Read before writing.** Run `list` (or `carried`) first, so you are acting on what is actually
  there and can name the task back to the user.
- **A query is a substring of the title.** `done bank` finds "Call the bank". If it matches more than
  one task the script refuses and prints the candidates — narrow it, never guess which one they
  meant.
- **Batch with several calls, not one clever one.** Three `add` calls read better in the transcript
  than one shell loop, and each failure is legible.
- **Report what changed, briefly.** "Added two, marked the write-up done, three left on today" —
  not a dump of the whole board unless they asked for it.

## What this respects

The list belongs to the user, and two rules of the app carry over here:

- **Nothing rolls over on its own.** Unfinished tasks stay on the day they were written for. Do not
  run `carry` because a task looks stale — surface `carried` and let the user decide. Carrying
  everything forward is a decision, not a tidy-up.
- **A task belongs to a day.** There is no backlog to park things in. If the user is unsure when
  something should happen, ask for a day rather than inventing one.

Do not `rm` on a vague instruction — `drop` is reversible in the file, `rm` is not. And never write
to the store file with anything other than this script: it keeps the export format exactly, and a
hand-edited file may not import.
