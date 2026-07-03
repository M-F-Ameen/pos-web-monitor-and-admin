import type { InputHTMLAttributes } from 'react'
import './Input.css'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Optional icon (e.g. search) - appears at start in RTL */
  icon?: React.ReactNode
  /** Size of the input */
  size?: 'sm' | 'md' | 'lg'
  /** Full width */
  fullWidth?: boolean
}

/**
 * Text input with optional leading icon.
 * RTL: icon appears on the right (logical start).
 */
export function Input({
  icon,
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}: InputProps) {
  const classNames = [
    'pos-input-wrapper',
    fullWidth && 'pos-input-wrapper--full',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const inputClassNames = [
    'pos-input',
    `pos-input--${size}`,
    icon && 'pos-input--has-icon',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames}>
      {icon && <span className="pos-input__icon" aria-hidden>{icon}</span>}
      <input
        type="text"
        className={inputClassNames}
        dir="auto"
        {...props}
      />
    </div>
  )
}
