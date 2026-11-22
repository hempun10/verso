import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "An unexpected error occurred.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-input bg-secondary p-6 text-center shadow-2xl">
          <h1 className="text-base font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-subtle-foreground">
            {this.state.message}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-white px-4 text-xs font-semibold text-background hover:bg-cta-hover"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-input bg-card px-4 text-xs font-medium text-strong-foreground hover:bg-accent"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
