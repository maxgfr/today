import { useEffect } from 'react'
import type { Theme } from '../domain/types'

/**
 * Writes the resolved theme onto the document root.
 *
 * `system` is resolved here rather than left to a CSS media query because the
 * app also has to keep `<meta name="theme-color">` in step — on an installed
 * PWA that colour is the window chrome, and a mismatch between the board and
 * the title bar is the seam that gives away a web app.
 */
export function useThemeEffect(theme: Theme): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved

      const colour = resolved === 'dark' ? '#0b0b0c' : '#f2efe9'
      for (const tag of document.querySelectorAll('meta[name="theme-color"]')) {
        tag.setAttribute('content', colour)
      }
    }

    apply()
    if (theme !== 'system') return

    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
