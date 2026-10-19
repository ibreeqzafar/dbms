-- Customer orders are separate from the old software-test orders.
-- Browser clients never write prices, payment status or fulfilment status directly.
create table public.store_orders (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users,
 request_key uuid not null,
 input_hash text not null,
 customer_name text not null,
 phone text not null,
 city text not null,
 delivery_address text not null,
 notes text not null default '',
 payment_method text not null check(payment_method in ('cod','online')),
 payment_state text not null default 'unpaid' check(payment_state in ('unpaid','paid')),
 order_state text not null default 'received' check(order_state in ('received','processing','dispatched','delivered','cancelled')),
 total_paisa bigint not null check(total_paisa>0),
 delivery_paisa bigint check(delivery_paisa>=0),
 snapshot jsonb not null,
 carrier text not null default '',
 tracking_number text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,request_key)
);
create index store_orders_owner_created on public.store_orders(owner_id,created_at desc);
alter table public.store_orders enable row level security;
revoke all on public.store_orders from public,anon,authenticated;
grant select on public.store_orders to authenticated;
grant all on public.store_orders to service_role;
create policy store_orders_read on public.store_orders for select to authenticated
 using((owner_id=auth.uid() and private.is_customer()) or private.is_admin());

create table public.store_payment_sessions(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.store_orders,
 tracker text unique,
 state text not null default 'creating' check(state in ('creating','ready','verified','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index one_live_store_payment on public.store_payment_sessions(order_id) where state in ('creating','ready','verified');
alter table public.store_payment_sessions enable row level security;
revoke all on public.store_payment_sessions from public,anon,authenticated;
grant all on public.store_payment_sessions to service_role;

create function public.place_store_order(p_key uuid,p_lines jsonb,p_customer jsonb,p_method text,p_total bigint)
 returns public.store_orders language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result public.store_orders; fingerprint text; cfg jsonb; line jsonb; v record;
 total bigint:=0; snapshot jsonb:='[]'; seen uuid[]:='{}'; qty integer; cname text:=trim(p_customer->>'name');
 phone text:=regexp_replace(coalesce(p_customer->>'phone',''),'[\s()+-]','','g');
 city text:=trim(p_customer->>'city'); address text:=trim(p_customer->>'address'); notes text:=trim(coalesce(p_customer->>'notes',''));
begin
 if not private.is_customer() then raise exception 'Sign in to place your order' using errcode='42501';end if;
 if p_key is null or p_method is null or p_method not in ('cod','online') then raise exception 'Choose a payment method';end if;
 if cname is null or length(cname) not between 2 and 100 or phone !~ '^(03[0-9]{9}|923[0-9]{9})$'
  or city is null or length(city) not between 2 and 100 or address is null or length(address) not between 10 and 600 or length(notes)>500 then raise exception 'Review your name, Pakistani mobile number, city and full address';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Choose 1 to 50 different items';end if;
 fingerprint:=encode(extensions.digest(jsonb_build_object('lines',p_lines,'name',cname,'phone',phone,'city',city,'address',address,'notes',notes,'method',p_method,'total',p_total)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_key::text,0));
 select * into result from public.store_orders where owner_id=uid and request_key=p_key;
 if found then if result.input_hash<>fingerprint then raise exception 'Order request changed; review and submit again';end if;return result;end if;
 select value into cfg from public.settings where id='public';
 if coalesce((cfg->>'checkoutPaused')::boolean,false) then raise exception 'Checkout is temporarily unavailable';end if;
 if p_method='online' and not coalesce((cfg->>'onlinePaymentsEnabled')::boolean,false) then raise exception 'Online payments are being connected. Choose cash on delivery for now';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(line->'quantity') is distinct from 'number' or (line->>'quantity') !~ '^[0-9]{1,2}$' then raise exception 'Invalid quantity';end if;
  qty:=(line->>'quantity')::int;if qty not between 1 and 20 then raise exception 'Choose 1 to 20 units per item';end if;
  select p.slug,p.name,p.reference,p.demo_price_paisa,pv.id,pv.color,pv.sku,pv.price_paisa,pv.stock_on_hand-pv.stock_reserved as available into v
   from public.products p join public.variants pv on pv.product_id=p.id
   where p.slug=line->>'productId' and pv.color=line->>'variant' and p.active and pv.active;
  if not found or qty>v.available or v.price_paisa<=0 then raise exception 'An item or finish is unavailable; review your bag';end if;
  if v.id=any(seen) then raise exception 'Duplicate item; combine its quantities';end if;seen:=array_append(seen,v.id);
  total:=total+v.price_paisa*qty;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('productId',v.slug,'name',v.name,'variant',v.color,'quantity',qty,'unitPricePaisa',v.price_paisa));
 end loop;
 if p_total is null or total<>p_total then raise exception 'A price changed; refresh your bag before ordering';end if;
 insert into public.store_orders(owner_id,request_key,input_hash,customer_name,phone,city,delivery_address,notes,payment_method,total_paisa,snapshot)
 values(uid,p_key,fingerprint,cname,phone,city,address,notes,p_method,total,snapshot) returning * into result;
 -- Receipt records the request, not a stock reservation, payment or courier booking.
 insert into public.audit_logs(actor_id,action,entity_id) values(uid,'store-order-received',result.id);
 return result;
end$$;
revoke all on function public.place_store_order(uuid,jsonb,jsonb,text,bigint) from public,anon,authenticated;
grant execute on function public.place_store_order(uuid,jsonb,jsonb,text,bigint) to authenticated;

create function public.manage_store_order(p_order uuid,p_state text,p_carrier text default '',p_tracking text default '',p_cod_collected boolean default false)
 returns public.store_orders language plpgsql security definer set search_path='' as $$
declare o public.store_orders;begin
 if not private.is_admin() then raise exception 'Administrator with MFA required' using errcode='42501';end if;
 select * into o from public.store_orders where id=p_order for update;if not found then raise exception 'Unknown order';end if;
 if p_state is null or not (p_state=o.order_state or o.order_state='received' and p_state in ('processing','cancelled') or o.order_state='processing' and p_state in ('dispatched','cancelled') or o.order_state='dispatched' and p_state='delivered') then raise exception 'Invalid order transition';end if;
 if length(coalesce(p_carrier,''))>80 or length(coalesce(p_tracking,''))>120 then raise exception 'Tracking details too long';end if;
 if p_cod_collected and (o.payment_method<>'cod' or p_state<>'delivered') then raise exception 'COD collection requires a delivered COD order';end if;
 if p_state in ('processing','dispatched','delivered') and o.payment_method='online' and o.payment_state<>'paid' then raise exception 'Verify online payment before fulfilment';end if;
 update public.store_orders set order_state=p_state,carrier=coalesce(p_carrier,''),tracking_number=coalesce(p_tracking,''),payment_state=case when p_cod_collected then 'paid' else payment_state end,updated_at=now() where id=p_order returning * into o;
 insert into public.audit_logs(actor_id,action,entity_id,metadata) values(auth.uid(),'store-order-updated',p_order,jsonb_build_object('state',p_state,'cod_collected',p_cod_collected));return o;
end$$;
revoke all on function public.manage_store_order(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_store_order(uuid,text,text,text,boolean) to authenticated;

-- Merchant credentials and verified server functions must be configured before this flag is enabled.
update public.settings set value=value||'{"onlinePaymentsEnabled":false,"checkoutPaused":false}'::jsonb where id='public';
