/**
 * The icon set, authored rather than imported.
 *
 * Transit signage draws its own pictograms, and a borrowed library would drag
 * its own corner language and stroke weight into a world built on square caps
 * and 2px rules. Every glyph here sits on the same 24-unit grid, uses the same
 * 2px stroke, square caps and square joins, and no curves the signage grammar
 * would not draw.
 *
 * Icons are decorative by default — every control that uses one also carries a
 * text label or an `aria-label`, so the glyph never has to carry meaning alone.
 */

import type { SVGProps } from 'react'

export type IconName = keyof typeof paths

const paths = {
  check: <path d="M4 12.5 9.5 18 20 6.5" />,
  plus: <path d="M12 4v16M4 12h16" />,
  minus: <path d="M4 12h16" />,
  close: <path d="M5 5l14 14M19 5L5 19" />,
  chevronLeft: <path d="M15 4 7 12l8 8" />,
  chevronRight: <path d="M9 4l8 8-8 8" />,
  chevronDown: <path d="M4 9l8 8 8-8" />,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  arrowDown: <path d="M12 4v15M6 13l6 6 6-6" />,
  grip: (
    <>
      <path d="M4 9h16M4 15h16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 21 21" />
    </>
  ),
  undo: <path d="M9 6 3 12l6 6M3 12h11a6 6 0 0 1 0 12h-2" />,
  redo: <path d="M15 6l6 6-6 6M21 12H10a6 6 0 0 0 0 12h2" />,
  week: (
    <>
      <path d="M3 4h18v16H3z" />
      <path d="M3 9h18M9 9v11M15 9v11" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20V12M10 20V4M16 20v-6M22 20H2" />
    </>
  ),
  settings: (
    <>
      <path d="M3 7h18M3 17h18" />
      <path d="M9 4v6M15 14v6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h8l10 10-8 8L3 11z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
  note: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  download: <path d="M12 3v13M6 11l6 6 6-6M4 21h16" />,
  upload: <path d="M12 20V7M6 12l6-6 6 6M4 3h16" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  monitor: (
    <>
      <path d="M3 4h18v13H3z" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  keyboard: (
    <>
      <path d="M2 6h20v12H2z" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </>
  ),
  repeat: <path d="M4 9V6h13l-3-3M20 15v3H7l3 3" />,
  offline: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 15.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 4-2.5M19 12a10 10 0 0 0-6-2.9" />
      <path d="M12 19h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M8.5 12l2.5 2.5L16 10" />
    </>
  ),
} as const

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
  /** Visual size in pixels; the stroke stays optically even across sizes. */
  size?: number
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}
