import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0f0f0f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: "rgba(201,168,76,0.12)",
                border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(43,78%,52%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 style={{ color: "rgba(255,255,255,0.9)", fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              An unexpected error occurred. Our team has been notified. Please return to the home page and try again.
            </p>
            {this.state.error && (
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.75rem", fontFamily: "monospace", marginBottom: "1.5rem", wordBreak: "break-all" }}>
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              style={{
                background: "hsl(43,78%,52%)",
                color: "#000",
                border: "none",
                borderRadius: 6,
                padding: "0.625rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
