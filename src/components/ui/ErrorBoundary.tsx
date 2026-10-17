import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** Last line of defence: a render crash shows a calm message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hook your error reporting (e.g. Sentry) here. Console output is stripped from production builds.
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fatal">
        <div className="fatal__card">
          <h1>Something went wrong</h1>
          <p>The page hit an unexpected problem. Your saved data is safe.</p>
          <button type="button" className="btn btn--dark btn--md" onClick={() => window.location.assign('/')}>
            Reload Teacher.aide
          </button>
        </div>
      </div>
    );
  }
}
