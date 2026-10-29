import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render-time errors so a single page crash does not blank the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: 24,
            background: '#fff',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#1A202C' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p style={{ marginTop: 8, color: '#4A5568', fontSize: '0.875rem', lineHeight: 1.5 }}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              marginTop: 16,
              background: '#DD6B20',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
