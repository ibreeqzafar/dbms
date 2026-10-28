begin;
create function public.manage_project_test_order(p_order text,p_state text) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare current_state text;
begin
 if not private.is_admin() then raise exception 'Administrator MFA required' using errcode='42501';end if;
 select state into current_state from public.project_test_orders where id=p_order for update;
 if not found then raise exception 'Test order not found';end if;
 if p_state is null or not (p_state=current_state or current_state='processing' and p_state in ('dispatched','cancelled') or current_state='dispatched' and p_state='delivered') then raise exception 'This order cannot move to that status';end if;
 update public.project_test_orders set state=p_state where id=p_order;
 return p_state;
end $$;
revoke all on function public.manage_project_test_order(text,text) from public,anon;
grant execute on function public.manage_project_test_order(text,text) to authenticated;
commit;
