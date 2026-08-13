-- Run this AFTER database-schema.sql. Caches the LLM's concept-map JSON
-- output by topic, so a popular topic (e.g. "Binary Search Trees") only
-- pays for one LLM call ever, not one per user who studies it. Each user
-- still gets their own concept_maps/concept_nodes rows (and their own
-- mastery progress) — only the generation step is shared.

create table if not exists concept_map_cache (
  cache_key text primary key,   -- normalized "mode:topicOrRole:companyTier"
  generated_json jsonb not null,
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table concept_map_cache enable row level security;

-- Read-only for any authenticated user (it's not personal data — just a
-- cached curriculum shape); writes only happen server-side via the API route
-- using the anon key under RLS, so INSERT/UPDATE also need a permissive
-- policy scoped to authenticated users.
create policy "Authenticated users can read cache" on concept_map_cache
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can write cache" on concept_map_cache
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update cache hit count" on concept_map_cache
  for update using (auth.role() = 'authenticated');

-- Atomic hit-count increment, same locking pattern as check_rate_limit().
create or replace function bump_cache_hit(p_cache_key text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update concept_map_cache
  set hit_count = hit_count + 1, last_used_at = now()
  where cache_key = p_cache_key;
end;
$$;
