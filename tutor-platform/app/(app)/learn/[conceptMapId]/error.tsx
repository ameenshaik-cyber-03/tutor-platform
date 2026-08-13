"use client";
// Scoped error boundary for a learn session specifically — if the chat
// orchestration throws, the sidebar/navbar (owned by the layout above this
// route) stay intact and usable instead of the whole app going blank.
import { useEffect } from "react";
import Link from "next/link";

export default function LearnSessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Learn session error:", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <h1 className="font-display font-extrabold text-xl mb-2">This session hit a snag</h1>
      <p className="text-sm text-ink/50 mb-6">
        Your progress on earlier topics is saved — you can retry this session or start a new one.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="btn-3d text-sm"
        >
          Retry
        </button>
        <Link href="/learn" className="px-4 py-2 rounded-card border border-primary/15 text-sm">
          Start a new topic
        </Link>
      </div>
    </div>
  );
}
