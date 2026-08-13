import Link from "next/link";
import { signUpWithEmail, signInWithOAuth } from "../actions";

const PROVIDERS = [
  { name: "Google", id: "google" as const },
  { name: "GitHub", id: "github" as const },
  { name: "Apple", id: "apple" as const },
  { name: "X", id: "twitter" as const },
];

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; checkEmail?: string };
}) {
  if (searchParams.checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="max-w-sm">
          <h1 className="font-display font-extrabold text-2xl mb-2">Check your email</h1>
          <p className="text-sm text-ink/50">
            We sent you a confirmation link. Click it to activate your account, then log in.
          </p>
          <Link href="/login" className="inline-block mt-5 text-secondary font-medium text-sm">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-extrabold text-2xl text-center mb-1">Create your account</h1>
        <p className="text-sm text-ink/50 text-center mb-6">
          Free to start — no card required.
        </p>

        {searchParams.error && (
          <p className="text-sm text-danger bg-danger/10 rounded-md px-3 py-2 mb-4 text-center">
            {searchParams.error}
          </p>
        )}

        <div className="space-y-2 mb-5">
          {PROVIDERS.map((p) => (
            <form key={p.id} action={signInWithOAuth.bind(null, p.id)}>
              <button
                type="submit"
                className="w-full py-2.5 rounded-card border border-primary/15 text-sm font-medium hover:bg-primary/5"
              >
                Continue with {p.name}
              </button>
            </form>
          ))}
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-primary/10" />
          <span className="text-xs text-ink/40">or</span>
          <div className="flex-1 h-px bg-primary/10" />
        </div>

        <form action={signUpWithEmail} className="space-y-3">
          <input
            name="fullName"
            type="text"
            required
            placeholder="Full name"
            className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password (min. 8 characters)"
            className="w-full px-3 py-2.5 rounded-card border border-primary/15 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
          <button
            type="submit"
            className="w-full btn-3d text-sm py-2.5"
          >
            Create account
          </button>
        </form>

        <p className="text-sm text-center text-ink/50 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-secondary font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
