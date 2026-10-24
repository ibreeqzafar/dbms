-- Three successful recommendation generations per anonymous Supabase identity.
-- Independent of checkout migration 003 and customer-directory migration 004.
begin;
create table public.recommendation_generations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users on delete cascade,
 request_key uuid not null,
 input jsonb not null,
 results jsonb not null check(jsonb_typeof(results)='array'),
 created_at timestamptz not null default now(),
 unique(owner_id,request_key)
);
alter table public.recommendation_generations enable row level security;
revoke all on public.recommendation_generations from public,anon,authenticated;
grant select on public.recommendation_generations to authenticated;
create policy own_generations on public.recommendation_generations for select to authenticated using(owner_id=auth.uid());
create function public.recommendation_access() returns jsonb language plpgsql security definer set search_path='' as $$
declare customer boolean;used integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'AUTH_REQUIRED';end if;
 select not coalesce(is_anonymous,false) and email_confirmed_at is not null into customer from auth.users where id=auth.uid();
 select count(*)::integer into used from public.recommendation_generations where owner_id=auth.uid();
 return jsonb_build_object('registered',coalesce(customer,false),'used',used,'remaining',case when customer then null else greatest(0,3-used) end);
end$$;
create function public.record_recommendation_generation(p_owner uuid,p_key uuid,p_input jsonb,p_results jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare customer boolean;anonymous boolean;used integer;previous public.recommendation_generations;
begin
 -- Serialize concurrent requests for the same identity so the fourth cannot slip through.
 perform 1 from public.profiles where id=p_owner and active for update;
 if not found then raise exception 'ACCOUNT_DISABLED';end if;
 select coalesce(is_anonymous,false),email_confirmed_at is not null into anonymous,customer from auth.users where id=p_owner;
 customer:=customer and not anonymous;
 if not anonymous and not customer then raise exception 'VERIFY_EMAIL_REQUIRED';end if;
 if p_key is null or p_input is null or jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)>6 then raise exception 'INVALID_GENERATION';end if;
 select count(*)::integer into used from public.recommendation_generations where owner_id=p_owner;
 select * into previous from public.recommendation_generations where owner_id=p_owner and request_key=p_key;
 if found then
  if previous.input is distinct from p_input then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('results',previous.results,'registered',customer,'remaining',case when customer then null else greatest(0,3-used) end);
 end if;
 if not customer and used>=3 then raise exception 'REGISTRATION_REQUIRED';end if;
 if jsonb_array_length(p_results)>0 then
  insert into public.recommendation_generations(owner_id,request_key,input,results) values(p_owner,p_key,p_input,p_results);
  used:=used+1;
 end if;
 return jsonb_build_object('results',p_results,'registered',customer,'remaining',case when customer then null else greatest(0,3-used) end);
end$$;
revoke all on function public.recommendation_access(),public.record_recommendation_generation(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.recommendation_access() to authenticated;
grant execute on function public.record_recommendation_generation(uuid,uuid,jsonb,jsonb) to service_role;
commit;
