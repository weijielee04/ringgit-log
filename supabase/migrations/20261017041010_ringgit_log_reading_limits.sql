-- Daily limits for automatic reading. These run with the caller's rights (security invoker):
-- ai_usage has row-level security and no policies, so only the server (the read Edge Function,
-- which uses the secret key) can count; a website visitor calling them gets nothing.

-- Takes one reading for an account. Returns the account's count for today, -1 when the account's
-- daily limit is reached, or -2 when the whole site's daily limit is reached.
create function public.ai_take(p_user uuid, p_user_limit integer, p_site_limit integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  d date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  site integer;
  mine integer;
begin
  select coalesce(sum(calls), 0) into site from public.ai_usage where day = d;
  if site >= p_site_limit then return -2; end if;
  insert into public.ai_usage as u (user_id, day, calls) values (p_user, d, 1)
  on conflict (user_id, day) do update set calls = u.calls + 1 where u.calls < p_user_limit
  returning calls into mine;
  if mine is null then return -1; end if;
  return mine;
end;
$$;

-- Gives a reading back when the call to Claude failed before anything was read.
create function public.ai_refund(p_user uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.ai_usage set calls = greatest(calls - 1, 0)
  where user_id = p_user and day = (now() at time zone 'Asia/Kuala_Lumpur')::date;
$$;

create function public.ai_used_today(p_user uuid)
returns integer language sql security invoker stable set search_path = '' as $$
  select coalesce((select calls from public.ai_usage
    where user_id = p_user and day = (now() at time zone 'Asia/Kuala_Lumpur')::date), 0);
$$;
