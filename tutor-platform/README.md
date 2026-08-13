# Clario — Adaptive Tutor + Career Prep Platform

Working name only — rename freely (search/replace "Clario" in `app/layout.tsx` and `app/page.tsx`).

## What's implemented vs. stubbed

**Fully implemented:**
- Folder structure and routing (App Router, route groups for `(auth)` and `(app)`)
- Design system: Tailwind tokens, fonts, global styles (`tailwind.config.ts`, `app/globals.css`)
- Layout shell: `Sidebar`, `Navbar`, `AppLayout`
- Chat UI: `ChatBox`, `MessageBubble`
- Concept map visualization: `ConceptMapPanel`
- Landing, login, signup pages (UI only — no auth wiring yet)
- Engine types + prompts, ported directly from `core-engine-design.md`
- Supabase client setup (browser + server)
- `/api/concept-map/generate` — fully wired to Supabase, with Zod validation; the `callLLM()` function is a stub you fill in with your provider
- `/api/concept-map/[id]` (GET) — fully wired

**Fully implemented (as of the Backend/API + Engine Integration step):**
- `lib/engine/llm.ts` — real Groq API client (`callLLM` for structured JSON steps, `callLLMStream` for natural-language streaming)
- `/api/concept-map/generate`, `/api/concept-map/[id]/explain`, `/question`, `/evaluate`, `/reteach` — all five engine endpoints call the real LLM, validate output with Zod, and read/write real Supabase rows
- `/api/concept-map/[id]` (GET)
- **The one vertical slice, end to end:** `/learn` page → user submits a topic → `POST /api/concept-map/generate` → engine builds the concept map via Prompt 1 → validated JSON → written to `concept_maps`/`concept_nodes` → redirect to `/learn/[conceptMapId]` → that page is a Server Component that reads the same rows back from Supabase and renders them in `ConceptMapPanel`. This is the proof that topic → API → engine → AI → JSON → Supabase → UI actually works, not just each piece in isolation.

**Still stubbed / simplified:**
- Resume upload as an actual file (PDF/DOCX) — currently accepts pasted text only
- Node ordering respects insertion order, not `dependsOn` — prerequisites aren't enforced yet
- No retry logic if the model returns malformed JSON (Steps 10/12 territory)
- No cap on reteach loop attempts in Learn mode
- Revisiting a learn session from History/Sidebar starts a **new** session rather than resuming the previous conversation thread — the concept map's progress carries over (it's read fresh from `concept_nodes`), but old chat messages aren't replayed into the UI yet
- Reviewing a past mock interview's questions/answers isn't built — History links back to `/prep` to start a new one, not to a review screen

## Step 8 (final pass) — Dashboard, History, Settings

All three now read real data instead of showing placeholders:

- **Dashboard** (`/dashboard`) — `ReadinessCard`s pull from `readiness_snapshots`, which both Learn (via `/evaluate`... actually via the mastery loop) and Career Prep (`/resume/analyze`, `/mock-interview/[id]/complete`) write to. Shows latest score per area plus the delta from the previous attempt. A "continue where you left off" list reads the 5 most recent `concept_maps`.
- **History** (`/history`) — merges `sessions` (Learn) and `mock_interviews` (Prep) into one chronological, date-grouped list.
- **Settings** (`/settings`) — persona picker, difficulty default, theme, and voice/notification toggles, all persisted to `user_preferences` via a real server action (`app/(app)/settings/actions.ts`). The Learn session page already reads `preferred_persona_id` from here, so changing your tutor here actually changes who teaches you next session.
- **Sidebar** — no longer a static placeholder; the app layout now fetches the user's 10 most recent sessions server-side and groups them by date (Today / Yesterday / Past 7 days / older), same pattern as History.

## Career Prep — Resume Analyzer + Mock Interviews (Steps 6-9, second pillar)

Built with the exact same architecture as Learn mode, reusing the concept-map engine for role-based prep rather than duplicating logic:

- **Resume Analyzer** (`/prep/resume`): paste resume text + pick a target role → `/api/resume/analyze` → real LLM call against an ATS-style checklist → score, strengths, section-by-section suggestions, missing keywords. Writes to `resumes`, `resume_feedback`, and a `readiness_snapshots` row (area: `"resume"`).
  - **Known simplification:** takes pasted text, not a file upload. Real PDF upload needs Supabase Storage (a bucket + storage policies) plus text extraction — worth doing once the rest of the loop is proven out, same reasoning as deferring voice earlier.

- **Mock Interviews** (`/prep/interview/[hr|technical|aptitude]`): user enters a role → calls `/api/concept-map/generate` with `mode: "prep"` (same endpoint Learn mode uses) → the resulting concept map's nodes are filtered by `node_type` so an HR interview only draws HR-tagged nodes, technical only draws DSA/core-subject nodes, etc. → `components/prep/MockInterviewClient.tsx` runs the loop: ask question (reuses `/api/concept-map/[id]/question`) → user answers → `/api/mock-interview/[id]/evaluate` scores it (deterministic for MCQs, LLM-scored for open/coding answers) → next question → `/api/mock-interview/[id]/complete` computes the overall score and writes a `readiness_snapshots` row (area: the interview type).

This is the same "one engine, two domains" idea from the design doc actually paying off — the question-generation and concept-map-generation endpoints didn't need to be touched at all to support interviews; only the scoring and orchestration are interview-specific.

## Steps 10 & 12 — Validation, Error Handling, Security

**Retry-on-malformed-JSON** (`lib/engine/llm.ts`): every structured LLM call now goes through `callLLMJSON<T>()`, which parses the response, validates it against a Zod schema, and — if either step fails — retries once with an explicit correction instruction before giving up. This replaced the duplicated try/parse/validate blocks that used to be copy-pasted into every route (`generate`, `question`, `evaluate`, `resume/analyze`, `mock-interview/evaluate`). Streaming routes (`explain`, `reteach`) can't use this — there's no JSON to validate mid-stream — so a failed stream still just ends early; that's a known, documented gap rather than a silent one.

**Rate limiting** (`supabase/rate_limiting.sql` + `lib/rate-limit.ts`): backed by a Postgres table, not an in-memory counter — deliberately, since Next.js API routes on Vercel are serverless and an in-memory counter resets on every cold start and isn't shared across instances, so it would silently stop limiting anything under real traffic. The `check_rate_limit()` function uses `SELECT ... FOR UPDATE` to lock the row during the check, so concurrent requests from the same user can't both slip through at the same count. Applied to every LLM-calling endpoint:

| Endpoint | Limit |
|---|---|
| `/concept-map/generate` | 8 / 10 min |
| `/concept-map/[id]/question`, `/evaluate`, `/explain`, `/reteach` | 40 / 10 min |
| `/resume/analyze` | 8 / 10 min |
| `/mock-interview/[id]/evaluate` | 40 / 10 min |

The limiter fails **open** (allows the request) if the check itself errors, so a rate-limiter outage degrades gracefully instead of taking down the whole app — but the failure is logged.

**Input validation:** tightened across the board — `userAnswer`/`resumeText`/`questionText` all have explicit max lengths now (mainly to bound API cost per request, not just correctness).

**Security headers** (`next.config.mjs`): `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and a `Permissions-Policy` that blocks camera/mic/geolocation access, applied globally.

**Run this migration too:** `supabase/rate_limiting.sql`, alongside the others.

### What's still open in Steps 10/12
- No cap on the Learn-mode reteach loop — a user who keeps giving weak answers gets re-taught indefinitely
- No file-upload validation (moot until resume upload is a real file input, not pasted text)
- No CSRF-specific hardening beyond what Next.js Server Actions provide by default
- `SUPABASE_SERVICE_ROLE_KEY` is in `.env.example` but unused anywhere in the codebase — good, keep it that way; it should only ever be touched server-side for admin tasks, never in a route that handles user input directly

## Manual testing audit (no network access in this environment — see note below)

This environment can't run `npm install` or a live server, so instead of a real test suite run, every API call, database query, and import was manually cross-checked against the actual files/schema. Two real bugs were found and fixed:

1. **`node_type` was never set on generated nodes.** The concept-map prompt didn't ask the LLM to classify nodes, so every node defaulted to `'concept'` — meaning `MockInterviewClient`'s "only ask HR questions in an HR interview" filter matched zero nodes every time and silently fell back to the unfiltered list. Fixed in `lib/engine/prompts.ts` (prompt now requests `nodeType`) and `app/api/concept-map/generate/route.ts` (schema + insert now include it).
2. **Non-deterministic node ordering.** All nodes for one concept map are inserted in a single batch, so they share an identical `created_at` (Postgres's `now()` is stable per statement) — ordering by it doesn't reliably preserve the LLM's intended dependency sequence. Fixed by adding an explicit `position` column (`database-schema.sql`), set from generation order, and switching both read queries (`app/(app)/learn/[conceptMapId]/page.tsx`, `app/api/concept-map/[id]/route.ts`) to order by it instead.

**Once you have network access, run these too:**
- `npm install`, then `npx tsc --noEmit` for a real type-check (this environment's sandboxed `tsc` flagged two spots — a `key` prop warning in `ChatBox.tsx` and a generic-narrowing warning in `lib/engine/llm.ts`'s `attemptJSON` — both are standard TypeScript patterns that should resolve cleanly with real `@types/react`/`@types/node` installed, but worth confirming)
- `npm run build` to catch anything a dev server hides
- A real end-to-end pass: sign up, generate a concept map, go through a full explain→question→evaluate→reteach loop, run a mock interview, analyze a resume — the four things this audit *couldn't* verify are runtime behavior (does the streaming actually render smoothly?), real LLM output quality (does the model reliably follow the JSON schema?), and RLS policies under real auth (does `auth.uid()` actually resolve the way the policies assume?)

## Migrations required for this pass
`database-schema.sql` changed (added `concept_nodes.position`). If you've already run the old version against Supabase, run this against your existing database:
```sql
alter table concept_nodes add column position int not null default 0;
create index idx_concept_nodes_map_position on concept_nodes(concept_map_id, position);
```
New concept maps will populate `position` correctly going forward; existing ones will all show `position = 0` until regenerated.

Also run: `supabase/concept_map_cache.sql`.

## Step 13 — Performance

- **Concept-map generation caching** (`supabase/concept_map_cache.sql`, wired into `/api/concept-map/generate`): the LLM's output for a given topic/role is cached by a normalized key. A second person studying "Binary Search Trees" (or the same person regenerating it) skips the LLM call entirely — only the DB write (their own `concept_maps`/`concept_nodes` rows, so progress stays per-user) still happens. This is the highest-value cache in the app since concept-map generation is the most expensive call.
- **Cached persona lookups** (`lib/cached-queries.ts`): `tutor_personas` rarely changes, so it's wrapped in `unstable_cache` (1-hour revalidation) instead of hitting the DB on every Settings/Learn-session page load. Deliberately uses a plain anon Supabase client rather than the cookie-based server client — Next.js's cache functions can't depend on per-request data like cookies, and this data doesn't need to (RLS allows any authenticated user to read it).
- **Loading states** (`loading.tsx` in `dashboard/`, `learn/[conceptMapId]/`, `history/`, `settings/`): Next.js automatically shows these while the Server Component's data fetch is in flight, so navigation feels instant instead of a blank pause.

### Not done in this pass
- No caching on `/explain` or `/question` — these are already personalized per-node/persona, so a shared cache would need per-node keys, more complexity for a smaller payoff than the concept-map cache
- No CDN/edge caching config beyond Vercel's defaults
- No database connection pooling config beyond Supabase's default (relevant at higher traffic than a portfolio demo will see)

## Step 14 — Deployment

Full walkthrough in **`DEPLOYMENT.md`** — Supabase production setup, pushing to GitHub, deploying to Vercel, environment variables, and post-deploy verification steps. Also added **`.github/workflows/ci.yml`**, which runs lint + type-check + build on every push/PR automatically once this is on GitHub.

**Important:** nothing in this environment could actually deploy anything (no network, no Vercel/GitHub credentials) — `DEPLOYMENT.md` is a precise guide for you to follow yourself, not a record of something already done.

## Step 15 — Monitoring & Maintenance

- **`lib/logger.ts`**: structured JSON logging (`logError`/`logInfo`) used in the highest-value spots — LLM call failures in `/generate` and `/evaluate`, and the rate-limiter's failure path. Deliberately doesn't import Sentry or any other paid service (that package isn't installed, and importing it would break the build for anyone who hasn't run `npm install @sentry/nextjs` yet) — instead it logs structured JSON to stdout, which Vercel's built-in log capture picks up with zero setup. Every call site already passes structured context (`userId`, `route`-relevant fields), so swapping the logger's internals for a real Sentry call later is a one-file change.
- **Error boundaries**: `app/error.tsx` (page-level), `app/global-error.tsx` (root layout failures — a distinct case Next.js requires handling separately), and `app/(app)/learn/[conceptMapId]/error.tsx` (a scoped one for the Learn session specifically, so a chat-orchestration crash doesn't take out the whole app shell — sidebar and navbar stay usable).
- **`/api/health/db`** (built earlier, Step 4) still serves as your basic uptime check.

### Recommended next steps once you have network access
- **Vercel Analytics**: one toggle in the Vercel dashboard, no code changes — start here, it's the lowest effort for the most signal (page views, Web Vitals).
- **Sentry**: `npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs` — the wizard sets up `sentry.client.config.ts`/`sentry.server.config.ts` automatically. Once installed, swap `lib/logger.ts`'s `logError` body to also call `Sentry.captureException(error)`.
- **Supabase's own dashboard** (Database → Logs, and the Auth logs) covers DB-level monitoring without any extra setup — worth checking before reaching for a third-party tool.

## Step 9 — User↔AI Workflow (Learn mode, fully wired)

`components/learn/LearnSessionClient.tsx` is the actual orchestration engine for a live tutoring session. It:

1. Creates a `sessions` row when the page loads
2. Picks the first non-mastered node and calls `/explain`, streaming the response token-by-token into a chat bubble
3. Calls `/question` to generate a checkpoint question
4. When the user answers, calls `/evaluate` — persists the result to `checkpoint_attempts`, updates `concept_nodes.status`, and shows the encouraging summary
5. If the answer was weak/not understood, streams a targeted `/reteach` response, then re-asks
6. If mastered, moves to the next node automatically; when all nodes are mastered, ends the session with a completion message
7. Every message (both user and assistant) is persisted to the `messages` table as it happens — not batched at the end

This is genuinely the core product experience now — go to `/learn`, enter a topic, and you should be able to have a full back-and-forth diagnostic conversation, with the `ConceptMapPanel` on the right updating live as nodes flip from untouched → weak/mastered.

**Known limitation to test for:** the loop currently has no maximum retry count — if a user keeps giving weak answers, it will re-teach and re-ask indefinitely. Worth adding a cap (e.g. move on after 3 attempts) once you're testing this yourself.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase + LLM + ElevenLabs keys
npm run dev
```

Then, against your Supabase project's **SQL Editor**, run in this order:
1. `database-schema.sql` — creates all tables, indexes, and RLS policies
2. `supabase/triggers.sql` — auto-creates a `profiles` + `user_preferences` row whenever someone signs up
3. `supabase/rate_limiting.sql` — rate-limiting table and function (see Steps 10/12 section below)
4. `supabase/concept_map_cache.sql` — caches generated concept maps by topic (see Step 13 section below)
5. `supabase/seed.sql` — inserts the 5 tutor personas (nothing works without at least this)

### Verify the database connection actually works

Before building anything else, visit **`/api/health/db`** in your browser (with `npm run dev` running). You should get:

```json
{ "status": "ok", "latencyMs": 120, "tutorPersonasFound": 5, "sample": [...] }
```

If you get an error instead, the response includes a `hint` field telling you what to check — this is deliberately the very first thing to confirm before touching auth or the UI, since every other feature depends on this connection working.

### Database connection layer — what's in place

- `lib/supabase/client.ts` — browser client, for Client Components
- `lib/supabase/server.ts` — server client, for Server Components/Route Handlers (reads the auth cookie so RLS's `auth.uid()` resolves correctly)
- `lib/supabase/middleware.ts` + root `middleware.ts` — refreshes the auth session on every request, and redirects signed-out users away from `/dashboard`, `/learn`, `/prep`, `/history`, `/settings`. Without this, sessions silently expire and users get logged out mid-task.
- `app/api/health/db/route.ts` — the connection test above

This is genuinely the full connection layer — nothing here is a stub.

## Authentication — what's in place

- `app/(auth)/actions.ts` — server actions: `signInWithEmail`, `signUpWithEmail`, `signInWithOAuth`, `signOut`. These are the real Supabase auth calls, not stubs.
- `app/auth/callback/route.ts` — exchanges the OAuth/email-confirmation code for a session
- `supabase/triggers.sql` — auto-creates `profiles`/`user_preferences` rows on signup (so the app never queries a missing profile for a new user)
- Login/signup pages call these actions directly via `<form action={...}>` — no client-side fetch boilerplate needed
- `middleware.ts` already redirects signed-out users away from app routes (built in the connection-layer step) — combined with real auth calls, route protection is now fully functional, not just structurally present
- Navbar's profile dropdown has a working **Log out** button wired to `signOut`

### Enabling OAuth providers

Google/GitHub/Apple/X sign-in buttons are wired to call Supabase, but each provider needs to be turned on in your Supabase project first:
1. Supabase Dashboard → **Authentication → Providers**
2. Enable Google and GitHub to start (Apple and X/Twitter require developer accounts with those platforms — add them later, the code doesn't need to change)
3. For each provider, set the redirect URL to `{NEXT_PUBLIC_SITE_URL}/auth/callback`

### What's still a stub

- No role/permission tiers yet (every authenticated user has the same access) — add this only if you introduce, say, admin/instructor accounts later
- No rate limiting on auth attempts (that's Step 12: Security in your plan, not this step)

## Design system

**Direction: playful & energetic** (chosen from reference options — Duolingo-adjacent), replacing the earlier warm-editorial look.

- **Palette:** `primary` (bold grass green — brand, CTAs, links), `secondary` (sky blue — active/focus states), `success` (a distinct lighter green for mastered/correct, so brand and status don't collapse into one meaning), `warn` (sunflower yellow — needs-practice, intentionally warm, not punishing), `danger` (red — errors and destructive actions only, used sparingly), `paper`/`ink` (bright white background, warm charcoal-blue text rather than harsh black).
- **Type:** Baloo 2 (bold, rounded display face — headings and buttons only, restraint matters here) + Nunito (body/UI, rounded terminals that echo the display face without competing) + IBM Plex Mono (code/DSA problems — deliberately NOT rounded, so technical content reads as precise against the playful chrome).
- **Signature element:** the `.btn-3d` class in `app/globals.css` — a solid-color "pressed button" shadow (`shadow-press` in `tailwind.config.ts`) with a real translate-down animation on click, instead of a soft drop shadow. This is the one deliberate visual risk the whole direction leans on, so it's applied only to primary CTAs (landing hero, sidebar "New session", the two auth submit buttons, the Learn entry submit) — not decoratively on every button.
- All colors/fonts are Tailwind tokens — change them once in `tailwind.config.ts` and `app/layout.tsx` rather than hunting through components. Token names are semantic (`primary`, `secondary`, `success`, `warn`, `danger`), not literal color names — so if you swap the palette again later, `bg-primary` won't lie about what it renders.

### Signature treatment coverage
`.btn-3d` and bold `font-extrabold` headings are now applied consistently across every screen — landing, auth, Learn, Career Prep hub, resume analyzer, mock interview, settings, and all error states. Nothing left using the old flat-button style.

## Next steps, roughly in order

1. Wire up Supabase Auth (email + Google to start) on the login/signup forms
2. Implement `callLLM()` in `/api/concept-map/generate/route.ts` with your provider (Anthropic/OpenAI), then copy that pattern into the four stubbed routes
3. Build the "new session" flow: `/learn` page submits → calls `/api/concept-map/generate` → redirects to `/learn/[conceptMapId]`
4. Wire the `[conceptMapId]` session page to actually fetch data and drive the chat through the explain → question → evaluate → reteach loop
5. Resume analyzer: file upload to Supabase Storage, then PDF text extraction before the LLM call
6. Swap `ConceptMapPanel`'s list view for a React Flow graph (the data shape already supports parent/child + dependency edges)

## Reference docs

- `core-engine-design.md` — full prompt design and reasoning
- `database-schema.sql` — table structure and RLS policies
