begin;
-- University-project delivery simulation. Disable before handling real fulfilment.
create table private.demo_delivery_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false
);
insert into private.demo_delivery_settings values(true,true);
alter table private.demo_delivery_settings enable row level security;
revoke all on private.demo_delivery_settings from public,anon,authenticated;

create function private.demo_delivery_due(p_id uuid,p_created timestamptz) returns timestamptz
language plpgsql immutable set search_path=pg_catalog as $$
declare local_start timestamp:=p_created at time zone 'Asia/Karachi'; deadline timestamp;
begin
 if local_start::time < time '10:00' then local_start:=local_start::date+time '10:00';
 elsif local_start::time >= time '18:00' then local_start:=(local_start::date+1)+time '10:00';end if;
 deadline:=local_start+(60+abs(hashtext(p_id::text)::bigint)%420)*interval '1 minute';
 if deadline>local_start::date+time '18:00' then
  deadline:=(local_start::date+1)+time '10:00'+(deadline-(local_start::date+time '18:00'));
 end if;
 return deadline at time zone 'Asia/Karachi';
end $$;
revoke all on function private.demo_delivery_due(uuid,timestamptz) from public,anon,authenticated;

create function private.simulate_due_deliveries(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare changed integer;
begin
 if not exists(select 1 from private.demo_delivery_settings where singleton and enabled) then return 0;end if;
 if (p_now at time zone 'Asia/Karachi')::time < time '10:00'
 or (p_now at time zone 'Asia/Karachi')::time >= time '18:00' then return 0;end if;
 -- Stable per-order delay: 60–479 minutes. Repeated runs cannot change the deadline.
 -- Never reopen cancelled orders or mark COD money as collected.
 with due as (
  select id from public.store_orders
  where order_state in ('received','processing','dispatched') and payment_method='cod'
   and private.demo_delivery_due(id,created_at) <= p_now
  order by created_at for update skip locked limit 100
 ), updated as (
  update public.store_orders o set order_state='delivered',updated_at=p_now
  from due where o.id=due.id returning o.id
 )
 insert into public.audit_logs(actor_id,action,entity_id,metadata)
 select null,'demo-delivery-simulated',id,jsonb_build_object('simulated',true,'maximum_delivery_hours',8,'timezone','Asia/Karachi')
 from updated;
 get diagnostics changed=row_count;
 return changed;
end $$;
revoke all on function private.simulate_due_deliveries(timestamptz) from public,anon,authenticated;
commit;

-- Database-side scheduling keeps delivery state independent of the laptop.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('essyra-demo-delivery','* * * * *','select private.simulate_due_deliveries();');
