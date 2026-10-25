-- Three guest generations per 24-hour window starting with the first successful generation.
-- Keeps history, ownership, verification and service-role-only recording unchanged.
begin;
create table public.guest_recommendation_windows (
 owner_id uuid primary key references auth.users on delete cascade,
 started_at timestamptz not null
);
alter table public.guest_recommendation_windows enable row level security;
revoke all on public.guest_recommendation_windows from public,anon,authenticated;
create index recommendation_generations_owner_created_idx on public.recommendation_generations(owner_id,created_at);
-- Preserve each existing guest's original first-use time; elapsed windows refill immediately.
insert into public.guest_recommendation_windows(owner_id,started_at)
select g.owner_id,min(g.created_at) from public.recommendation_generations g
join auth.users u on u.id=g.owner_id where coalesce(u.is_anonymous,false) group by g.owner_id;
create or replace function public.recommendation_access() returns jsonb language plpgsql security definer set search_path='' as $$
declare customer boolean;used integer;window_start timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'AUTH_REQUIRED';end if;
 select not coalesce(is_anonymous,false) and email_confirmed_at is not null into customer from auth.users where id=auth.uid();
 select started_at into window_start from public.guest_recommendation_windows where owner_id=auth.uid();
 if window_start + interval '24 hours' <= now() then window_start:=null;end if;
 select count(*)::integer into used from public.recommendation_generations where owner_id=auth.uid() and created_at>=window_start;
 return jsonb_build_object('registered',coalesce(customer,false),'used',used,'remaining',case when customer then null else greatest(0,3-used) end,'resetsAt',case when customer then null else window_start+interval '24 hours' end);
end$$;
create or replace function public.record_recommendation_generation(p_owner uuid,p_key uuid,p_input jsonb,p_results jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare customer boolean;anonymous boolean;used integer;previous public.recommendation_generations;window_start timestamptz;
begin
 -- Serialize concurrent requests for the same identity so the fourth cannot slip through.
 perform 1 from public.profiles where id=p_owner and active for update;
 if not found then raise exception 'ACCOUNT_DISABLED';end if;
 select coalesce(is_anonymous,false),email_confirmed_at is not null into anonymous,customer from auth.users where id=p_owner;
 customer:=customer and not anonymous;
 if not anonymous and not customer then raise exception 'VERIFY_EMAIL_REQUIRED';end if;
 if p_key is null or p_input is null or jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results)>6 then raise exception 'INVALID_GENERATION';end if;
 select started_at into window_start from public.guest_recommendation_windows where owner_id=p_owner;
 if window_start + interval '24 hours' <= now() then window_start:=null;end if;
 select count(*)::integer into used from public.recommendation_generations where owner_id=p_owner and created_at>=window_start;
 select * into previous from public.recommendation_generations where owner_id=p_owner and request_key=p_key;
 if found then
  if previous.input is distinct from p_input then raise exception 'REQUEST_CONFLICT';end if;
  return jsonb_build_object('results',previous.results,'registered',customer,'remaining',case when customer then null else greatest(0,3-used) end,'resetsAt',case when customer then null else window_start+interval '24 hours' end);
 end if;
 if not customer and used>=3 then raise exception 'REGISTRATION_REQUIRED';end if;
 if jsonb_array_length(p_results)>0 then
  if not customer and window_start is null then
   window_start:=now();
   insert into public.guest_recommendation_windows(owner_id,started_at) values(p_owner,window_start) on conflict(owner_id) do update set started_at=excluded.started_at;
  end if;
  insert into public.recommendation_generations(owner_id,request_key,input,results) values(p_owner,p_key,p_input,p_results);
  used:=used+1;
 end if;
 return jsonb_build_object('results',p_results,'registered',customer,'remaining',case when customer then null else greatest(0,3-used) end,'resetsAt',case when customer then null else window_start+interval '24 hours' end);
end$$;
commit;
