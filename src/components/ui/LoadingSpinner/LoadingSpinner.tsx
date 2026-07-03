import "./LoadingSpinner.css";

export type LoadingSpinnerSize = "sm" | "md" | "lg" | "xl";
export type LoadingSpinnerVariant = "primary" | "secondary" | "accent";

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: LoadingSpinnerSize;
  /** Visual variant */
  variant?: LoadingSpinnerVariant;
  /** Loading message */
  message?: string;
  /** Whether to show the spinner inline or centered */
  inline?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Loading spinner component for async operations.
 * Shows a rotating spinner with optional loading message.
 */
export function LoadingSpinner({
  size = "md",
  variant = "primary",
  message,
  inline = false,
  className = "",
}: LoadingSpinnerProps) {
  const spinnerClasses = [
    "loading-spinner",
    `loading-spinner--${size}`,
    `loading-spinner--${variant}`,
    !inline && "loading-spinner--centered",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div className={spinnerClasses} role="status" aria-live="polite">
      <div className="loading-spinner__circle" aria-hidden="true">
        <div className="loading-spinner__path" />
      </div>
      {message && (
        <span className="loading-spinner__message" aria-label={message}>
          {message}
        </span>
      )}
      <span className="loading-spinner__sr-only">جاري التحميل...</span>
    </div>
  );

  if (inline) {
    return content;
  }

  return <div className="loading-spinner-container">{content}</div>;
}
