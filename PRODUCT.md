# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Confirmed by the user: Vite + React 19 + TypeScript, Tailwind v4, `vite-plugin-pwa`. Deployed as a
static build to GitHub Pages at `https://maxgfr.github.io/today` under the base path `/today/`.
Routing is hash-based so the host never needs a 404 fallback. No backend exists and none may be
introduced.

## Users

Anyone who runs their day from a list. This is a general-purpose tool, not one person's private
utility: no assumed profession, no assumed workflow, no vocabulary borrowed from software work.
Someone planning a shift, a course, a household, or a sprint should all recognise their day in it
without translation.

The shape of use is what is shared, not the content: open it in the morning, write down what the day
is, check things off, close it in the evening. A typical day holds three to seven tasks — a real
list of intentions, not a backlog.

Because it is generic and public, first run has to explain itself without a tour: an empty state
that says what to type, the capture syntax shown where it is needed, and the privacy promise stated
on screen rather than buried in a README. Nothing may assume the visitor has read anything first.

Desktop is the primary surface. Mobile must work properly — the app is installable and used on a
phone — but the desktop layout is the one that carries the full expression.

## Product Purpose

Manage the to-do list of _today_, and nothing else.

Success is a person opening the app in the morning, seeing the day they planned, and closing it in
the evening with the list finished. The app has succeeded when it disappears: no configuration to
maintain, no inbox to process, no system to keep in shape.

It exists because most task managers optimise for capturing everything, which quietly converts a
to-do list into an anxiety archive. This one refuses the archive.

## Positioning

Two commitments a neighbouring product could not truthfully copy without becoming this product:

1. **The data physically cannot leave the device.** No account, no server, no sync, no telemetry.
   It is a static site: there is nothing to send data _to_. The Content-Security-Policy pins
   `connect-src 'self'`, and a build gate (`scripts/check-no-network.mjs`) fails CI if any outbound
   origin appears in the bundle. The promise is enforced by the browser and checked by the build,
   not asserted in marketing copy.
2. **Nothing rolls over on its own.** Unfinished tasks do not silently reappear on today. They are
   presented the next morning, with their age, for an explicit Keep / Later / Drop decision. The
   pile can never grow without someone choosing to let it.

## Operating Context

- Opened first thing in the morning, then returned to a dozen times across the day.
- Left open overnight in a background tab, so the app must notice the date changing on its own.
- Used offline: on a plane, on a train, with no connection at all. Offline is the normal case,
  not a degraded one.
- Installed as a PWA on desktop and phone.
- Data lives only in the browser's IndexedDB for that origin. Clearing site data destroys it, which
  makes JSON export a real feature and not a checkbox.

## Capabilities and Constraints

**Confirmed capabilities**

- A day view with quick capture, completion, inline editing, drag reordering, priorities (P1–P3),
  tags, subtasks, notes, and a duration estimate.
- Quick-capture syntax parsed out of the title: `#tag`, `!1`–`!3`, `~30m` / `~2h`.
- Morning triage of tasks left open on earlier days: Keep today, Later, Drop, with an age badge,
  plus Keep all / Drop all.
- Recurring tasks (daily, chosen weekdays, every N days/weeks), materialised lazily and never
  retroactively.
- A week overlay for distributing tasks across seven days, including drag between days.
- Undo/redo across every mutation, including triage and drag.
- A command palette, full-text search, filters, and a keyboard-first control layer.
- Stats: weekly completion, completion rate, streak, lifetime totals.
- JSON export/import and a full data wipe.
- Light/dark/system theme.

**Durable constraints**

- No network requests at runtime, ever. Fonts are self-hosted; no analytics; no external images.
- No account and no server-side anything. Adding one would break the central claim.
- State is a single versioned blob in IndexedDB, written debounced and flushed on `pagehide`.
- Every task belongs to a calendar day. There is no inbox, no backlog, and no "someday" list —
  this is a product decision, not a missing feature.
- Day arithmetic is local-time and DST-safe; `YYYY-MM-DD` strings, never UTC timestamps.

**Deliberately out of scope**

Sync, accounts, collaboration, Pomodoro timers, day templates, passphrase encryption, push
notifications, natural-language date parsing.

## Brand Commitments

- Name: **Today**. Interface language: **English**, throughout.
- The user pinned the visual direction: **bold graphic** — oversized display type, high contrast,
  a visible grid, black and white plus a single saturated accent, decisive transitions. This is
  binding; new-work owns how it is executed, not whether.
- **The day is the product.** Today is the default route and the full-screen surface. Week and Stats
  are overlays that always return to the day. No sidebar, no permanent navigation chrome, no global
  backlog counter in view.
- Tone: direct and unsentimental. No streak guilt, no gamified encouragement, no exclamation marks.
  A finished day is acknowledged once and then left alone.
- Copy stays domain-neutral. Examples in empty states and documentation must not assume the reader
  writes software, works in an office, or keeps any particular kind of schedule.

## Evidence on Hand

- Working domain layer with 151 passing unit tests covering carry-over, recurrence, undo/redo,
  ordering, date arithmetic, and import repair.
- `scripts/check-no-network.mjs`: an executable privacy gate wired into CI and the deploy workflow.
- No users, no testimonials, no benchmarks, no press. The app has never shipped. Nothing of the kind
  may be invented for any surface.

## Product Principles

1. **The day is the product.** Every other surface is subordinate and returns to it.
2. **Nothing moves without a decision.** No silent rollover, no automatic reprioritising, no
   auto-sorting that fights a manual drag.
3. **The privacy claim must be checkable.** Anything asserted on screen has to be verifiable by the
   user in DevTools or by reading the source, or it does not get said.
4. **Finishing is the point.** The design's strongest moment is an empty, completed day — not an
   impressively full one.
5. **Keyboard first, mouse fully supported.** A power user should never need to reach for the mouse;
   a first-time visitor should never need to know that.

## Accessibility & Inclusion

WCAG 2.2 AA is the bar, and the bold-graphic direction has to earn it rather than be excused from
it: the saturated accent must pass AA against both themes, focus states are a designed element and
never removed, drag reordering has a keyboard path, `prefers-reduced-motion` is honoured, and
undo/redo announces its result through a live region.
