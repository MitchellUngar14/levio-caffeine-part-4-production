import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Catches a render crash anywhere below it and shows a message with a reload
 * button instead of a blank page. Data is untouched: it lives in the store.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("caffeine_tracker crashed", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <section className="panel" role="alert" style={{ gap: 12, maxWidth: 680, margin: "40px auto" }}>
          <h1 className="section-label">// crash</h1>
          <p style={{ margin: 0 }}>
            <span className="warn">!!</span> Something went wrong: {this.state.error.message}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            Your drinks and settings are still saved in this browser. Reload to try again. If it keeps happening, export a backup from settings.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              [ reload ]
            </button>
            <a className="btn" href="#/settings" onClick={() => this.setState({ error: null })}>
              [ settings ]
            </a>
          </div>
        </section>
      </div>
    );
  }
}
