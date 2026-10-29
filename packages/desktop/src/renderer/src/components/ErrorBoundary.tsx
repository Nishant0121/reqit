import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleCopy = (): void => {
    const { error, errorInfo } = this.state;
    const details = [
      `Error: ${error?.message || 'Unknown error'}`,
      `Stack: ${error?.stack || 'No stack trace'}`,
      `Component Stack: ${errorInfo?.componentStack || 'No component stack'}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n\n');

    navigator.clipboard.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-(--bg-base) p-6 text-(--text-primary) select-none">
          <div
            className="flex w-full max-w-xl flex-col gap-5 rounded-lg border p-6 shadow-xl"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3 text-(--status-err)">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <div>
                <h1 className="text-lg font-bold text-(--text-primary)">Something went wrong</h1>
                <p className="text-[13px] text-(--text-muted)">
                  Reqit encountered an unexpected runtime error.
                </p>
              </div>
            </div>

            <div
              className="max-h-56 overflow-y-auto rounded border p-3 font-mono text-[12px] leading-relaxed select-text"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--status-err)',
              }}
            >
              <div className="font-semibold">{error?.toString()}</div>
              {error?.stack && (
                <div className="mt-2 whitespace-pre-wrap text-(--text-muted) opacity-90">
                  {error.stack}
                </div>
              )}
              {errorInfo?.componentStack && (
                <div className="mt-2 whitespace-pre-wrap text-(--text-muted) opacity-75">
                  {errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={this.handleCopy}
                className="flex items-center gap-2 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-(--bg-hover)"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-(--status-ok)" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied Details' : 'Copy Details'}
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 rounded bg-(--accent) px-4 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Reqit
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
