import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Controls in the board's vocabulary: square, ruled, tracked caps. No radius,
 * no shadow, no gradient — a signage system draws a control by outlining it or
 * filling it, and elevation is declared once, by the rule.
 */

type Variant = 'solid' | 'outline' | 'ghost'

const base =
  'board-label inline-flex items-center justify-center gap-2 whitespace-nowrap ' +
  'transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed'

const variants: Record<Variant, string> = {
  solid: 'bg-ink text-ground hover:bg-accent hover:text-accent-ink px-4 py-2.5',
  outline:
    'border-2 border-rule-strong text-ink hover:bg-ink hover:text-ground px-4 py-2.5 ' +
    'disabled:hover:bg-transparent disabled:hover:text-ink',
  ghost:
    'text-ink-muted hover:text-ink hover:bg-sunken px-2.5 py-2 ' +
    'disabled:hover:bg-transparent disabled:hover:text-ink-muted',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  icon?: IconName
  children?: ReactNode
}

export function Button({
  variant = 'outline',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName
  /** Required: an icon-only control must still name its action for a screen reader. */
  label: string
  size?: number
}

/**
 * `size-11` is 44px, the smallest target a finger hits reliably. Desktop drops
 * to 36px, where a cursor is precise and the extra padding only costs density.
 */
export function IconButton({ icon, label, size = 18, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={
        'inline-flex size-11 items-center justify-center text-ink-muted transition-colors ' +
        'duration-150 hover:bg-sunken hover:text-ink disabled:opacity-30 sm:size-9 ' +
        `disabled:hover:bg-transparent disabled:hover:text-ink-muted ${className}`
      }
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}
