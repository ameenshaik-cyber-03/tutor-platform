"use client";
// Root-level error boundary — catches any unhandled error thrown while
// rendering a page under app/ (but not layout.tsx itself; see global-error.tsx
// for that). Next.js requires this to be a Client Component.
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side errors can't use lib/logger.ts (server-only patterns like
    // structured JSON to stdout don't help here) — console.error is enough
    // for now; wire this to Sentry's client SDK once it's installed.
    console.error("Unhandled render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center">
      <div className="max-w-sm">
        <h1 className="font-display font-extrabold text-2xl mb-2">Something went wrong</h1>
        <p className="text-sm text-ink/50 mb-6">
          That's on us, not you. Try again, or come back in a moment.
        </p>
        <button
          onClick={reset}
          className="btn-3d text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
