-- Signed-out visitors get nothing at all; signed-in accounts get only the table rights the app needs.
-- (Row-level security already limits every row to its owner; these grants are a second wall.)
revoke all on public.profiles from anon, authenticated;
revoke all on public.records from anon, authenticated;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.records to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.ai_take(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_refund(uuid) from public, anon, authenticated;
revoke all on function public.ai_used_today(uuid) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer, integer) to service_role;
grant execute on function public.ai_refund(uuid) to service_role;
grant execute on function public.ai_used_today(uuid) to service_role;
revoke all on schema private from public, anon, authenticated;
revoke all on private.accounts from public, anon, authenticated;
