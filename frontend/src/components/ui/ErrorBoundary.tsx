import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches React errors and displays error UI
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback?.(this.state.error, this.reset) ?? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="text-4xl mb-4">💥</div>
            <h2 className="text-xl font-bold text-negative-700 mb-2">
              حدث خطأ في التطبيق
            </h2>
            <p className="text-negative-600 text-center max-w-sm mb-6">
              {this.state.error.message}
            </p>
            <button
              onClick={this.reset}
              className="bg-negative-600 hover:bg-negative-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              حاول مرة أخرى
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
