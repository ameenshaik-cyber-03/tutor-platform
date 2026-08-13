"use client";
// Catches errors thrown in the ROOT layout itself (app/layout.tsx) — a
// separate case from error.tsx, which only catches errors in pages/nested
// layouts. This one has to render its own <html>/<body> since the root
// layout that would normally provide them is what failed.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root layout error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "sans-serif", padding: "4rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please refresh the page.</p>
        <button onClick={reset} style={{ padding: "0.5rem 1.5rem", marginTop: "1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
