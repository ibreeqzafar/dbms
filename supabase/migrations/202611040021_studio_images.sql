-- Private image jobs are attached to existing recommendation grants. They do not
-- change the three-per-24-hour guest allowance or debit a second credit.
begin;
create table public.studio_image_jobs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users on delete cascade,
 generation_id uuid not null unique references public.recommendation_generations on delete cascade,
 product_slug text not null references public.products(slug),
 source_object text not null,
 source_history text[] not null default '{}',
 input_hash text not null,
 result_object text,
 state text not null default 'queued' check(state in('queued','running','completed','rejected','failed','expired')),
 reason text,
 lease_token uuid,
 lease_until timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 3),
 processing_consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 cleaned_at timestamptz
);
create index studio_image_pending on public.studio_image_jobs(created_at) where state='queued';
create table public.studio_worker_health(id boolean primary key default true check(id),seen_at timestamptz not null);
alter table public.studio_worker_health enable row level security;
revoke all on public.studio_worker_health from public,anon,authenticated;
grant select on public.studio_worker_health to service_role;
create table public.studio_request_limits(owner_id uuid primary key references auth.users on delete cascade,window_start timestamptz not null,requests integer not null check(requests>0));
alter table public.studio_request_limits enable row level security;
revoke all on public.studio_request_limits from public,anon,authenticated;
alter table public.studio_image_jobs enable row level security;
revoke all on public.studio_image_jobs from public,anon,authenticated;
grant select on public.studio_image_jobs to authenticated;
grant select,insert,update,delete on public.studio_image_jobs to service_role;
create policy own_studio_images on public.studio_image_jobs for select to authenticated
 using(owner_id=auth.uid() and expires_at>now() and exists(select 1 from public.profiles where id=auth.uid() and active));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('studio-images','studio-images',false,10485760,array['image/png','image/webp'])
 on conflict(id) do nothing;
create function public.guard_studio_request(p_owner uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not exists(select 1 from public.profiles where id=p_owner and active) then return false;end if;
 insert into public.studio_request_limits(owner_id,window_start,requests) values(p_owner,now(),1)
 on conflict(owner_id) do update set
  window_start=case when studio_request_limits.window_start+interval '24 hours'<=now() then now() else studio_request_limits.window_start end,
  requests=case when studio_request_limits.window_start+interval '24 hours'<=now() then 1 else studio_request_limits.requests+1 end
 where studio_request_limits.window_start+interval '24 hours'<=now() or studio_request_limits.requests<40
 returning requests into n;
 return n is not null;
end$$;
-- Storage has no customer write policy. Authenticated edge functions check ownership.
create function public.queue_studio_image(p_owner uuid,p_generation_key uuid,p_slug text,p_object text,p_hash text)
 returns public.studio_image_jobs language plpgsql security definer set search_path='' as $$
declare g public.recommendation_generations;j public.studio_image_jobs;
begin
 perform 1 from public.profiles where id=p_owner and active for update;
 if not found then raise exception 'ACCOUNT_DISABLED';end if;
 if exists(select 1 from public.settings where id='public' and (value->>'previewsPaused')::boolean) then raise exception 'IMAGE_PAUSED';end if;
 if not exists(select 1 from public.studio_worker_health where seen_at>now()-interval '1 minute') then raise exception 'IMAGE_WORKER_OFFLINE';end if;
 select * into g from public.recommendation_generations where owner_id=p_owner and request_key=p_generation_key and created_at>now()-interval '24 hours';
 if not found then raise exception 'GENERATION_REQUIRED';end if;
 if not exists(select 1 from jsonb_array_elements(g.results) x where x->'product'->>'id'=p_slug)
  or not exists(select 1 from public.products where slug=p_slug and active) then raise exception 'MATCHED_PRODUCT_REQUIRED';end if;
 if p_object not like p_owner::text||'/%' or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SOURCE';end if;
 select * into j from public.studio_image_jobs where generation_id=g.id for update;
 if found then
  if j.state in('completed','queued','running') then
   if j.product_slug<>p_slug or j.input_hash<>p_hash then raise exception 'GENERATION_ALREADY_USED';end if;
   return j;
  end if;
  if j.expires_at<=now() or j.attempts>=3 then raise exception 'IMAGE_RETRY_LIMIT';end if;
  update public.studio_image_jobs set product_slug=p_slug,source_history=array_append(source_history,source_object),source_object=p_object,input_hash=p_hash,state='queued',reason=null,lease_token=null,lease_until=null,processing_consent_at=now()
   where id=j.id returning * into j;return j;
 end if;
 if exists(select 1 from public.studio_image_jobs where owner_id=p_owner and state in('queued','running') and expires_at>now()) then raise exception 'IMAGE_ALREADY_PENDING';end if;
 if (select count(*) from public.studio_image_jobs where owner_id=p_owner and created_at>now()-interval '1 hour')>=6 then raise exception 'IMAGE_RATE_LIMIT';end if;
 insert into public.studio_image_jobs(owner_id,generation_id,product_slug,source_object,input_hash)
  values(p_owner,g.id,p_slug,p_object,p_hash) returning * into j;return j;
end$$;
create function public.lease_studio_image() returns public.studio_image_jobs language plpgsql security definer set search_path='' as $$
declare j public.studio_image_jobs;
begin
 insert into public.studio_worker_health(id,seen_at) values(true,now()) on conflict(id) do update set seen_at=excluded.seen_at;
 if exists(select 1 from public.settings where id='public' and (value->>'previewsPaused')::boolean) then return null;end if;
 -- Never automatically resubmit a timed-out provider request.
 update public.studio_image_jobs set state='failed',reason='The image service timed out. Please try again later.',lease_token=null,lease_until=null
  where state='running' and lease_until<now();
 select q.* into j from public.studio_image_jobs q join public.profiles p on p.id=q.owner_id and p.active
  where q.state='queued' and q.expires_at>now() order by q.created_at for update of q skip locked limit 1;
 if not found then return null;end if;
 update public.studio_image_jobs set state='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '7 minutes'
  where id=j.id returning * into j;return j;
end$$;
revoke all on function public.guard_studio_request(uuid),public.queue_studio_image(uuid,uuid,text,text,text),public.lease_studio_image() from public,anon,authenticated;
grant execute on function public.guard_studio_request(uuid),public.queue_studio_image(uuid,uuid,text,text,text),public.lease_studio_image() to service_role;
commit;
