begin;
-- Temporary chat jobs. No browser may read the queue or other people's messages.
create table public.support_agent_workers (
 id text primary key check(id='laptop'),last_seen timestamptz not null default now()
);
create table public.support_agent_jobs (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,
 request_key uuid not null,conversation_id uuid not null,session_key text not null,
 question text not null,context_slug text not null default '',
 state text not null default 'queued' check(state in('queued','processing','completed','failed')),
 reply jsonb,lease_token uuid,lease_until timestamptz,attempts int not null default 0,
 error_code text,created_at timestamptz not null default now(),finished_at timestamptz,
 expires_at timestamptz not null default now()+interval '24 hours',unique(owner_id,request_key)
);
create index support_agent_owner_time on public.support_agent_jobs(owner_id,created_at desc);
create index support_agent_pending on public.support_agent_jobs(state,created_at);
alter table public.support_agent_jobs enable row level security;
alter table public.support_agent_workers enable row level security;
revoke all on public.support_agent_jobs,public.support_agent_workers from public,anon,authenticated;
grant all on public.support_agent_jobs,public.support_agent_workers to service_role;

create function public.enqueue_support_chat(p_key uuid,p_conversation uuid,p_question text,p_context text default '')
 returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();job public.support_agent_jobs;ctx text:=coalesce(p_context,'');begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and active) then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if p_key is null or p_conversation is null or p_question is null or length(trim(p_question)) not between 1 and 1000 then raise exception 'INVALID_MESSAGE';end if;
 if length(ctx)>250 or (ctx<>'' and not exists(select 1 from public.products where slug=ctx and active)) then raise exception 'INVALID_PRODUCT';end if;
 perform pg_advisory_xact_lock(hashtextextended('support:'||uid::text,0));
 select * into job from public.support_agent_jobs where owner_id=uid and request_key=p_key;
 if found then
  if job.question<>trim(p_question) or job.conversation_id<>p_conversation or job.context_slug<>ctx then raise exception 'REQUEST_CONFLICT';end if;
  return job.id;
 end if;
 if exists(select 1 from public.settings where id='public' and coalesce((value->>'supportPaused')::boolean,false)) then raise exception 'SUPPORT_PAUSED';end if;
 if not exists(select 1 from public.support_agent_workers where id='laptop' and last_seen>now()-interval '75 seconds') then raise exception 'WORKER_OFFLINE';end if;
 if (select count(*) from public.support_agent_jobs where owner_id=uid and created_at>now()-interval '1 minute')>=5
 or (select count(*) from public.support_agent_jobs where owner_id=uid and created_at>now()-interval '24 hours')>=60 then raise exception 'CHAT_LIMIT';end if;
 insert into public.support_agent_jobs(owner_id,request_key,conversation_id,session_key,question,context_slug)
 values(uid,p_key,p_conversation,encode(extensions.digest(uid::text||':'||p_conversation::text,'sha256'),'hex'),trim(p_question),ctx) returning * into job;
 return job.id;
end$$;

create function public.get_support_chat(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.support_agent_jobs;begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 select * into job from public.support_agent_jobs where id=p_job and owner_id=auth.uid() and expires_at>now();
 if not found then raise exception 'NOT_FOUND' using errcode='42501';end if;
 if job.state in('queued','processing') and job.created_at<now()-interval '2 minutes' then return jsonb_build_object('state','failed','error','TIMEOUT');end if;
 return jsonb_build_object('state',job.state,'reply',job.reply,'error',job.error_code);
end$$;

-- Worker routines are restricted to the server's service role. The laptop never gets that key.
create function public.lease_support_chat() returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.support_agent_jobs;begin
 insert into public.support_agent_workers(id,last_seen) values('laptop',now()) on conflict(id) do update set last_seen=excluded.last_seen;
 delete from public.support_agent_jobs where expires_at<now();
 update public.support_agent_jobs set state='failed',error_code='WORKER_TIMEOUT',finished_at=now() where state='processing' and lease_until<now() and attempts>=2;
 select * into job from public.support_agent_jobs where expires_at>now() and created_at>now()-interval '2 minutes'
 and (state='queued' or (state='processing' and lease_until<now() and attempts<2)) order by created_at,id for update skip locked limit 1;
 if not found then return null;end if;
 update public.support_agent_jobs set state='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1 where id=job.id returning * into job;
 return jsonb_build_object('id',job.id,'leaseToken',job.lease_token,'sessionId',job.session_key,'chatInput',job.question,'contextSlug',job.context_slug);
end$$;

create function public.finish_support_chat(p_job uuid,p_lease uuid,p_reply jsonb,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_error is not null and p_error not in('MODEL_UNAVAILABLE','MODEL_LIMIT','INVALID_REPLY','WORKER_ERROR') then raise exception 'INVALID_ERROR';end if;
 if p_error is null and (p_reply is null or jsonb_typeof(p_reply)<>'object' or length(p_reply::text)>20000) then raise exception 'INVALID_REPLY';end if;
 update public.support_agent_jobs set state=case when p_error is null then 'completed' else 'failed' end,reply=p_reply,error_code=p_error,finished_at=now(),lease_until=null
 where id=p_job and lease_token=p_lease and state='processing' and lease_until>now() and expires_at>now();
 return found;
end$$;
revoke all on function public.enqueue_support_chat(uuid,uuid,text,text),public.get_support_chat(uuid),public.lease_support_chat(),public.finish_support_chat(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.enqueue_support_chat(uuid,uuid,text,text),public.get_support_chat(uuid) to authenticated;
grant execute on function public.lease_support_chat(),public.finish_support_chat(uuid,uuid,jsonb,text) to service_role;
commit;
