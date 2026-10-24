begin;
-- 202610240004_customer_relationships.sql
-- Customer directory and explicit marketing preferences. Independent of checkout migration 003.
create table public.customer_contacts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default '',
  email text not null,
  email_verified boolean not null default false,
  marketing_opt_in boolean not null default false,
  consent_version text,
  consent_updated_at timestamptz,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.marketing_consent_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  opted_in boolean not null,
  notice_version text not null,
  source text not null check(source in ('registration','account','email-change')),
  created_at timestamptz not null default now()
);
alter table public.customer_contacts enable row level security;
alter table public.marketing_consent_events enable row level security;
revoke all on public.customer_contacts,public.marketing_consent_events from anon,authenticated;
grant select on public.customer_contacts,public.marketing_consent_events to authenticated;
create policy read_customer_contacts on public.customer_contacts for select to authenticated
  using ((owner_id=auth.uid() and private.is_customer()) or private.is_admin());
create policy read_marketing_consent on public.marketing_consent_events for select to authenticated
  using ((owner_id=auth.uid() and private.is_customer()) or private.is_admin());

-- Existing customers remain opted out. Never infer consent from registration alone.
insert into public.customer_contacts(owner_id,name,email,email_verified,registered_at)
select p.id,p.name,u.email,u.email_confirmed_at is not null,p.created_at
from public.profiles p join auth.users u on u.id=p.id
where u.email is not null and not coalesce(u.is_anonymous,false);

create function private.sync_customer_contact() returns trigger language plpgsql security definer set search_path='' as $$
declare wants_updates boolean;
begin
  if new.email is null or coalesce(new.is_anonymous,false) then return new; end if;
  if tg_op='INSERT' then
    wants_updates:=coalesce(new.raw_user_meta_data->>'marketing_opt_in','false')='true';
    insert into public.customer_contacts(owner_id,name,email,email_verified,marketing_opt_in,consent_version,consent_updated_at)
    values(new.id,left(coalesce(new.raw_user_meta_data->>'name',''),100),new.email,new.email_confirmed_at is not null,wants_updates,
      case when wants_updates then 'marketing-v1' end,case when wants_updates then now() end);
    if wants_updates then
      insert into public.marketing_consent_events(owner_id,opted_in,notice_version,source) values(new.id,true,'marketing-v1','registration');
    end if;
  else
    update public.customer_contacts set email=new.email,email_verified=new.email_confirmed_at is not null,updated_at=now(),
      marketing_opt_in=case when old.email is distinct from new.email then false else marketing_opt_in end,
      consent_updated_at=case when old.email is distinct from new.email then now() else consent_updated_at end
    where owner_id=new.id;
    if old.email is distinct from new.email then
      insert into public.marketing_consent_events(owner_id,opted_in,notice_version,source) values(new.id,false,'marketing-v1','email-change');
    end if;
  end if;
  return new;
end$$;
-- Trigger name follows the existing create_profile trigger so the FK exists first.
create trigger sync_customer_contact after insert or update of email,email_confirmed_at on auth.users
for each row execute function private.sync_customer_contact();

create function private.sync_contact_name() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.customer_contacts set name=new.name,updated_at=now() where owner_id=new.id;return new;end$$;
create trigger sync_contact_name after update of name on public.profiles for each row execute function private.sync_contact_name();

create function public.set_marketing_preference(p_opt_in boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_customer() then raise exception 'Sign in to manage email preferences' using errcode='42501';end if;
  if p_opt_in is null then raise exception 'Choose an email preference';end if;
  update public.customer_contacts set marketing_opt_in=p_opt_in,consent_version='marketing-v1',consent_updated_at=now(),updated_at=now()
  where owner_id=auth.uid();
  if not found then raise exception 'Customer record unavailable';end if;
  insert into public.marketing_consent_events(owner_id,opted_in,notice_version,source)
  values(auth.uid(),p_opt_in,'marketing-v1','account');
end$$;
revoke all on function private.sync_customer_contact(),private.sync_contact_name(),public.set_marketing_preference(boolean) from public,anon,authenticated;
grant execute on function public.set_marketing_preference(boolean) to authenticated;
-- Campaign delivery must additionally require a confirmed email, an active profile,
-- and marketing_opt_in=true at send time. No campaigns are sent by this migration.

-- 202610240005_recommendation_access.sql
-- Three successful recommendation generations per anonymous Supabase identity.
-- Independent of checkout migration 003 and customer-directory migration 004.
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
