import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in Club Management UI.", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-error-boundary">
          <h1>문제가 발생했습니다</h1>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })} type="button">
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
