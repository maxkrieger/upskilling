import { Component, type ReactNode } from "react";
import { reportClientError } from "../errorReporting.ts";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Catches render-time errors, reports them, and shows a minimal fallback. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportClientError({
      kind: "react",
      message: error.message,
      stack: (error.stack ?? "") + (info.componentStack ?? ""),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center px-4 text-center">
          <div className="max-w-sm">
            <div className="mb-2 text-3xl">😵</div>
            <h1 className="font-serif text-xl text-ink">Something went wrong</h1>
            <p className="mt-1 text-sm text-muted">
              The error has been reported. Try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accentSoft"
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
