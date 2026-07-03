import type { ButtonHTMLAttributes } from "react";
import { LoadingSpinner } from "../LoadingSpinner";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style of the button */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Optional icon to show before label (RTL: icon appears on right) */
  icon?: React.ReactNode;
  /** Full width within container */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Loading text (optional) */
  loadingText?: string;
}

/**
 * Reusable button component for primary actions, secondary actions, and navigation.
 * Supports RTL: icon position follows text direction.
 */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  fullWidth = false,
  loading = false,
  loadingText,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const spinnerSize = size === "sm" ? "sm" : size === "lg" ? "md" : "sm";

  const classNames = [
    "pos-button",
    `pos-button--${variant}`,
    `pos-button--${size}`,
    fullWidth && "pos-button--full",
    loading && "pos-button--loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classNames}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size={spinnerSize} inline variant="secondary" />
      ) : (
        icon && (
          <span className="pos-button__icon" aria-hidden>
            {icon}
          </span>
        )
      )}
      {(children != null || loadingText != null) && (
        <span className="pos-button__label">
          {loading && loadingText ? loadingText : children}
        </span>
      )}
    </button>
  );
}
