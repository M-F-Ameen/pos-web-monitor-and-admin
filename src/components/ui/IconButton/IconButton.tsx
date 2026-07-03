import type { ButtonHTMLAttributes } from "react";
import "./IconButton.css";

export type IconButtonVariant = "default" | "accent" | "danger" | "ghost";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style */
  variant?: IconButtonVariant;
  /** Accessible label for screen readers */
  "aria-label": string;
  /** Icon content */
  children: React.ReactNode;
}

/**
 * Icon-only button for navigation and actions.
 * Always provide aria-label for accessibility.
 */
export function IconButton({
  variant = "default",
  children,
  className = "",
  ...props
}: IconButtonProps) {
  const classNames = [
    "pos-icon-button",
    `pos-icon-button--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classNames} {...props}>
      {children}
    </button>
  );
}
