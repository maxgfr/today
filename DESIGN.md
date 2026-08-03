# Design

<!-- impeccable:design-schema 1 -->

Recorded from the built interface, not from intentions. Where this document and the code disagree,
the code is right and this file is stale.

## The world

**Transit signage.** A terminal's departure board, and the printed timetable sheet beside it.

The fit is not decorative. A departure board is a finite, ordered list of things happening today
that empties as they happen, and is blank when the day is over — which is the product's entire
argument about what a to-do list should be. The grammar came with topology, states, controls and
responsive rules already solved, so the app inherited a working system rather than a mood.

Two grounds, both native to that world rather than a light-mode courtesy:

- **Light** is the printed timetable on bone stock. The default, because the app is opened in a
  daylit room and left open all day.
- **Dark** is the illuminated board in the concourse.

The grammar is identical across both: thick rules, tabular figures, one signal colour, no cards, no
rounded corners, no shadows.

## Colour

Defined in `src/ui/tokens.css` as CSS custom properties, exposed to Tailwind through `@theme inline`.

| Token         | Light     | Dark      | Role                                 |
| ------------- | --------- | --------- | ------------------------------------ |
| `ground`      | `#f2efe9` | `#0b0b0c` | The board itself                     |
| `surface`     | `#fbf9f5` | `#141416` | Raised panels: dialogs, the palette  |
| `sunken`      | `#eae6dd` | `#08080a` | Recessed: task detail, table headers |
| `ink`         | `#0b0b0c` | `#f2efe9` | Body and titles — 17.1:1             |
| `ink-muted`   | `#6b6862` | `#9c9990` | Labels and secondary — 4.8:1 / 6.9:1 |
| `rule`        | `#d6d1c4` | `#2c2c30` | Hairlines between rows               |
| `rule-strong` | `#0b0b0c` | `#f2efe9` | The 2–3px board rules                |
| `accent`      | `#c42d0e` | `#ff5a2b` | Signal: done, focus, priority, today |
| `accent-ink`  | `#f2efe9` | `#0b0b0c` | Text on accent                       |
| `accent-wash` | `#f7e4de` | `#2a1409` | Drop targets in the week view        |

**Strategy: restrained.** Neutrals plus one accent, which is right for an Operate surface someone
stares at all day.

**The accent is a different hex per ground on purpose.** The light value had to darken from `#d6310f`
(4.25:1 — fails AA) to `#c42d0e` (4.91:1). Identity is the hue, not the hex; a single value would
have meant failing contrast in one theme to keep a number identical in a stylesheet.

Colour is never the only carrier: priority always prints "P1" next to its accent block, completion
strikes the text as well as filling the slat, and today's bar in the chart is labelled as well as
tinted.

## Type

**Archivo Variable**, the only face, self-hosted at `src/ui/fonts/archivo-latin.woff2` — latin subset
only, 90 KB, precached. A grotesque built for signage, with a width axis, which is what lets one
family cover a 6rem headline and an 11px label without a second file.

| Role                              | Spec                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Display (weekday, overlay titles) | `clamp(2.75rem, 11vw, 6rem)`, weight 800, width 112%, tracking −0.035em, leading 0.86 |
| Row title                         | `clamp(1.0625rem, 1.6vw, 1.3125rem)`, weight 400                                      |
| `.board-label`                    | 11px, weight 700, width 108%, tracking 0.14em, uppercase                              |
| `.board-quantity`                 | 11px, weight 700, tracking 0.06em, tabular — **not** uppercase                        |
| Body copy                         | 15px, normal leading                                                                  |

**Structural chrome shouts; user content does not.** Day names, section labels and counters are
uppercase and tracked. Task titles, notes and steps are sentence case in whatever the user typed.
Shouting someone's own words back at them reads worse and is worse manners.

`.board-quantity` exists because `.board-label` rendered `1h30` as `1H30`, which reads as a code
rather than an hour and a half.

## Composition

- One column, `max-w-3xl`, centred with `my-auto` inside a `min-h-dvh` flex column: a short day sits
  in the optical centre, a long one scrolls from the top without clipping.
- **2px rules** open and close the board; **1px hairlines** separate rows. That is the whole
  elevation system — no shadows, no borders on top of shadows, no cards.
- **Radius is 0 everywhere.** A signage system does not round its corners.
- Row grid: `[number 24px] [slat 28px] [title, flexible] [meta] [controls]`. Below 640px the meta
  drops beneath the title instead of competing for width — truncating a task to "F.." to fit a tag
  is never the right trade.
- Row numbers count **open rows only**, so completing one closes the gap rather than leaving a
  hole that reads like a missing task. A done row shows `—`: it has left the board.

## Motion

**One authored moment: the split-flap.** `@keyframes flip` rotates the completion slat on its X
axis, the way a departure board's character turns over. It replays via a `key` on the inner face, so
React remounts the element and the CSS animation runs.

Two supporting animations, deliberately quiet: `rise` for anything entering (dialogs, the triage
tray, task details) and `board-clear` for the cleared-day banner.

`prefers-reduced-motion: reduce` collapses every duration to ~0. Nothing depends on motion to be
understood — the accent fill and the strikethrough carry completion on their own.

## Focus

`3px solid accent`, `outline-offset: 2px`, no radius. It is a designed element of the signage
language, not a browser default tolerated in a corner, and it is never removed.

## Components

| Piece                   | Where                     | Notes                                                                        |
| ----------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| `Slat`                  | `features/today/Slat.tsx` | The flipping completion control. A `button` with `aria-pressed`.             |
| `Button` / `IconButton` | `ui/Button.tsx`           | Square, ruled, tracked caps. `IconButton` requires a `label`.                |
| `Modal`                 | `ui/Modal.tsx`            | Native `<dialog>` + `showModal()`: real focus trap, real inert, real Escape. |
| `Overlay`               | `ui/Overlay.tsx`          | Full-bleed frame for Week / Stats / Settings. Always returns to the day.     |
| `Icon`                  | `ui/Icon.tsx`             | Authored SVG, 24-unit grid, 2px stroke, **square caps and mitre joins**.     |

Icons are drawn rather than imported: a library would bring its own corner language and round caps
into a world that has neither.

## Charts

One chart exists, in `features/stats/WeekChart.tsx`. Single series — the accent is the data, the
neutral track behind it is the day's total, and there is no categorical palette to validate. No
legend (one series; the caption names it). Values are direct-labelled only on today and the best
day; everything else lives in the tooltip and in the table view underneath, which is the real answer
for anyone who cannot hover.

Square bar ends, against the usual 4px rounded-data-end guidance: radius is 0 across this world, and
one rounded element would read as a foreign object.

## What this world refuses

- Cards, rounded corners, shadows, glass, gradients.
- A permanent navigation chrome. Navigation sits _below_ the board, because on that screen the day
  is the subject and everything else is a way to leave it.
- Uppercase user content.
- Colour as the only carrier of state.
- Any transition that must complete before the user learns what happened.
