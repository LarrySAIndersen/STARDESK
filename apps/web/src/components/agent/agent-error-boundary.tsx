"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type AgentErrorBoundaryProps = Readonly<{
  children: ReactNode;
}>;

type AgentErrorBoundaryState = Readonly<{
  error: Error | null;
}>;

/** Catches client render errors in the agent shell so navigation does not fail silently. */
export class AgentErrorBoundary extends Component<
  AgentErrorBoundaryProps,
  AgentErrorBoundaryState
> {
  state: AgentErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AgentErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AgentErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="border-star-red/30 bg-star-red/5 mx-5 my-4 rounded-sm border px-4 py-3"
          role="alert"
        >
          <p className="text-star-red text-sm font-semibold">Noget gik galt i grænsefladen</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {this.state.error.message || "Prøv at genindlæse siden."}
          </p>
          <button
            type="button"
            className="text-star-navy mt-3 text-sm font-medium underline"
            onClick={() => window.location.reload()}
          >
            Genindlæs siden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
