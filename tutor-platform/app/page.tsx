import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-8 py-5">
        <span className="font-display font-extrabold text-xl text-primary">Clario</span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-ink/70 hover:text-ink">
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-full bg-primary text-paper font-display font-bold hover:bg-primary-dark"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-secondary mb-4 font-bold">
          For students who want to actually know it
        </p>
        <h1 className="font-display font-extrabold text-5xl md:text-6xl max-w-2xl leading-[1.1] mb-6">
          Most tutors check if you got it right.
          <br />
          <span className="text-primary">This one finds what you missed.</span>
        </h1>
        <p className="text-ink/60 max-w-md mb-8">
          Explain a topic back in your own words. Clario tells you exactly
          which part you're still missing — then closes the gap, not the
          whole lesson again.
        </p>
        <Link href="/signup" className="btn-3d">
          Start learning free
        </Link>
      </main>
    </div>
  );
}
