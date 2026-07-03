import type { HTMLAttributes } from 'react'
import './Card.css'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

/**
 * Base card container for panels and product/cart items.
 * Uses design system background and radius.
 */
export function Card({
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  const classNames = [
    'pos-card',
    `pos-card--padding-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  )
}
