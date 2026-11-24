import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Extracts a concise, clean error message without raw technical logs, URLs, or stack traces.
 *
 * @param {Error|string|unknown} error
 * @returns {string}
 */
export function getCleanErrorMessage(error) {
  if (!error) return "An unexpected error occurred.";

  const raw = typeof error === "string" ? error : (error?.message || String(error));
  if (!raw || typeof raw !== "string") return "An unexpected error occurred.";

  // 1. Dynamic import / chunk loading errors
  if (
    raw.includes("Failed to fetch dynamically imported module") ||
    raw.includes("Importing a module script failed") ||
    raw.includes("ChunkLoadError")
  ) {
    const fileMatch = raw.match(/([a-zA-Z0-9_-]+)\.(?:jsx?|tsx?|js)/);
    if (fileMatch && fileMatch[1]) {
      return `Failed to load component: ${fileMatch[1]}`;
    }
    return "Failed to load application module";
  }

  // 2. Extract only the primary error line (strip stack traces and multi-line logs)
  const firstLine = raw.split("\n")[0].trim();

  // 3. Strip full URLs, query timestamps, and file paths
  const cleanLine = firstLine
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+\/[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+/g, "")
    .replace(/[A-Z]:\\[^\s)]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleanLine || "An unexpected error occurred.";
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    // Log concise error without dumping full component tree in console
    console.error("ErrorBoundary caught:", error?.message || error);
  }

  handleReload = () => {
    try {
      window.sessionStorage.removeItem("aquapay_chunk_retry");
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isModuleFetchError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Importing a module script failed");

      const cleanErrorMessage = getCleanErrorMessage(this.state.error);

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800 antialiased">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-sm space-y-4">
            <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-rose-600">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                {isModuleFetchError ? "Application Update Detected" : "Something went wrong"}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isModuleFetchError
                  ? "A new version of the application is available or the development server restarted. Please reload to apply the latest changes."
                  : "An unexpected error occurred while rendering this view."}
              </p>
            </div>
            {cleanErrorMessage && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-mono text-slate-700 break-words">
                {cleanErrorMessage}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
