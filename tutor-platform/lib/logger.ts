// A deliberately small structured logger — no external service wired up yet.
// Every call still goes through console.error/console.log, so Vercel's
// built-in log capture picks it up immediately with zero setup. When you're
// ready for real alerting, swap the body of `logError` for a Sentry (or
// similar) call — every call site in the app already passes structured
// context, so that swap is a one-file change, not a re-plumb of every route.
//
// Deliberately NOT importing @sentry/nextjs here: that package isn't in
// package.json, and importing an uninstalled package would break the build
// for anyone who hasn't run `npm install @sentry/nextjs` yet. See README's
// Monitoring section for the actual setup steps.

interface LogContext {
  route?: string;
  userId?: string;
  [key: string]: unknown;
}

export function logError(message: string, error: unknown, context: LogContext = {}) {
  const errorDetails =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: error };

  console.error(
    JSON.stringify({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...context,
      error: errorDetails,
    })
  );
}

export function logInfo(message: string, context: LogContext = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...context,
    })
  );
}
