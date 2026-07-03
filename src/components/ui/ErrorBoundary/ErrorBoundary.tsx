import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "../Button";
import { IconAlertTriangle, IconRefresh } from "../Icons";
import "./ErrorBoundary.css";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Called when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Custom error message */
  message?: string;
}

/**
 * Error boundary component to catch JavaScript errors anywhere in the child component tree.
 * Provides a fallback UI and error reporting capabilities.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error in development (simple check without process.env)
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost"
    ) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback, message } = this.props;
      const { error } = this.state;

      // Use custom fallback if provided
      if (fallback && error) {
        return fallback(error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__content">
            <div className="error-boundary__icon">
              <IconAlertTriangle />
            </div>
            <h2 className="error-boundary__title">عذراً، حدث خطأ غير متوقع</h2>
            <p className="error-boundary__message">
              {message || "حدث خطأ في التطبيق. يرجى المحاولة مرة أخرى."}
            </p>
            {typeof window !== "undefined" &&
              window.location.hostname === "localhost" &&
              error && (
                <details className="error-boundary__details">
                  <summary>تفاصيل الخطأ (وضع التطوير)</summary>
                  <pre className="error-boundary__error-text">
                    {error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            <div className="error-boundary__actions">
              <Button
                variant="primary"
                icon={<IconRefresh />}
                onClick={this.handleReset}
              >
                إعادة المحاولة
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components.
 * Wraps the ErrorBoundary class component for easier usage.
 */
export function ErrorBoundaryWrapper({
  children,
  fallback,
  onError,
  message,
}: ErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError} message={message}>
      {children}
    </ErrorBoundary>
  );
}
