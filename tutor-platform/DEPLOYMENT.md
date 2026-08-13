# Deployment Guide

This walks through taking the project from "runs on my machine" to a real
production URL. Nothing here can be run from a sandboxed environment without
network access — these are the exact steps to run yourself, in order.

## 1. Production Supabase project

If you've been developing against a Supabase project already, you can reuse
it — otherwise create a new one at [supabase.com](https://supabase.com).

Run these against the **production** project's SQL Editor, in order:
1. `database-schema.sql`
2. `supabase/triggers.sql`
3. `supabase/rate_limiting.sql`
4. `supabase/concept_map_cache.sql`
5. `supabase/seed.sql`

Then, in **Authentication → URL Configuration**, set:
- **Site URL**: your production domain (e.g. `https://clario.app`)
- **Redirect URLs**: add `https://clario.app/auth/callback`

And in **Authentication → Providers**, enable Google/GitHub (or whichever
you're using) and set each provider's redirect URL to the same
`/auth/callback` path — this is a *separate* setting from the Site URL above
and is easy to miss.

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

The `.github/workflows/ci.yml` included here will run lint + type-check +
build on every push automatically once this repo exists on GitHub — no setup
needed beyond the push itself.

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo
2. Vercel auto-detects Next.js — no build command changes needed
3. Add environment variables (**Settings → Environment Variables**), using
   your **production** Supabase project's values:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase → Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API (keep secret — never expose with `NEXT_PUBLIC_`) |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel production URL, e.g. `https://clario.vercel.app` |
   | `GROQ_API_KEY` | from [console.groq.com/keys](https://console.groq.com/keys) — free tier |
   | `ELEVENLABS_API_KEY` | from your ElevenLabs account (optional until voice is wired up) |

4. Deploy. First deploy takes a few minutes.
5. **Go back to Supabase's Auth URL Configuration and update the Site
   URL/redirect URLs to match your actual Vercel URL** if it's different from
   what you set in Step 1 — this is the single most common reason OAuth
   breaks after a first deploy.

## 4. Verify the deployment

In order, once deployed:
1. Visit `/api/health/db` — should return `{"status": "ok", ...}`
2. Sign up with email, confirm the email, log in
3. Generate a concept map on `/learn` and confirm it completes
4. Check Vercel's **Logs** tab for any errors from the above

## 5. Custom domain (optional)

Vercel → your project → **Settings → Domains** → add your domain, follow
their DNS instructions. Remember to update `NEXT_PUBLIC_SITE_URL` and
Supabase's redirect URLs to the new domain afterward — both are hardcoded to
whatever URL you set in Steps 1 and 3.

## Ongoing deploys

Every push to `main` triggers both the CI workflow (lint/typecheck/build
check) and a new Vercel deployment automatically. Pull requests get their own
preview deployment URL from Vercel — useful for testing a change before it's
live.
