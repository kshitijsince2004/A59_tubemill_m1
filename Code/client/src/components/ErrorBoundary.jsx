import { Component } from 'react';

/**
 * Root error boundary — keeps the shell recoverable after a render fault
 * without clearing the IndexedDB offline outbox (audit F8).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="login-screen" role="alert">
          <div className="login-screen__card" style={{ maxWidth: 420 }}>
            <h1>Something went wrong</h1>
            <p className="muted">
              The console hit an unexpected error. Offline captures in the outbox are still saved —
              reload to continue.
            </p>
            <p className="error-strip" style={{ marginTop: 12 }}>
              {this.state.error?.message || 'Unknown render error'}
            </p>
            <button
              type="button"
              className="z-btn z-btn--primary"
              style={{ width: '100%', marginTop: 16 }}
              onClick={this.handleReload}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
