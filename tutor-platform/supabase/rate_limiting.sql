-- Run this AFTER database-schema.sql. Backs rate limiting for LLM-calling
-- endpoints. A Postgres table (rather than an in-memory counter) is used
-- deliberately: Next.js API routes on Vercel are serverless — an in-memory
-- counter resets on every cold start and isn't shared across instances, so
-- it would silently stop limiting anything under real traffic.

create table if not exists api_rate_limits (
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null,
  request_count int not null default 1,
  primary key (user_id, endpoint)
);

alter table api_rate_limits enable row level security;

-- No direct client access — this table is only touched via the
-- security-definer function below, called from server-side API routes.
create policy "No direct access" on api_rate_limits for all using (false);

create or replace function check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  -- FOR UPDATE locks the row for this transaction, so two concurrent
  -- requests from the same user can't both read count=N and both increment
  -- to N+1 — one waits for the other, keeping the count accurate.
  select window_start, request_count into v_window_start, v_count
  from api_rate_limits
  where user_id = p_user_id and endpoint = p_endpoint
  for update;

  if not found then
    insert into api_rate_limits (user_id, endpoint, window_start, request_count)
    values (p_user_id, p_endpoint, now(), 1);
    return true;
  end if;

  if now() - v_window_start > make_interval(secs => p_window_seconds) then
    update api_rate_limits
    set window_start = now(), request_count = 1
    where user_id = p_user_id and endpoint = p_endpoint;
    return true;
  end if;

  if v_count >= p_max_requests then
    return false;
  end if;

  update api_rate_limits
  set request_count = request_count + 1
  where user_id = p_user_id and endpoint = p_endpoint;
  return true;
end;
$$;
