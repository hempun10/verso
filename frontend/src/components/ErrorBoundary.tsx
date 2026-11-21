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
      <div className="flex min-h-screen items-center justify-center bg-[#08090a] p-6 text-[#f7f8f8]">
        <div className="w-full max-w-md rounded-2xl border border-[#2a2b2f] bg-[#141516] p-6 text-center shadow-2xl">
          <h1 className="text-base font-semibold text-[#f7f8f8]">
            Something went wrong
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">
            {this.state.message}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-white px-4 text-xs font-semibold text-[#08090a] hover:bg-[#f4f4f6]"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#2a2b2f] bg-[#0f1011] px-4 text-xs font-medium text-[#d4d4d8] hover:bg-[#1c1d1f]"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
