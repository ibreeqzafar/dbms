-- Customer directory and explicit marketing preferences. Independent of checkout migration 003.
begin;
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
commit;
