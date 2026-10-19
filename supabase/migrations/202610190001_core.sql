-- ESSYRA SRS/SDS v2.0. Prices are integer paisa; reference facts are distinct from demo commerce.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text not null default '',role text not null default 'customer' check(role in('customer','administrator')),active boolean not null default true,created_at timestamptz not null default now());
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',''));return new;end$$;
create trigger create_profile after insert on auth.users for each row execute function private.new_profile();
create function private.is_customer() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true) and exists(select 1 from public.profiles where id=auth.uid() and active)$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select private.is_customer() and auth.jwt()->>'aal'='aal2' and exists(select 1 from public.profiles where id=auth.uid() and role='administrator' and active)$$;
create table public.guest_sessions(id uuid primary key default gen_random_uuid(),auth_user_id uuid not null unique references auth.users on delete cascade,created_at timestamptz not null default now());
create table public.ai_subjects(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,tier text not null check(tier in('guest','customer')),unique(owner_id,tier),created_at timestamptz not null default now());
create table public.categories(id uuid primary key default gen_random_uuid(),slug text unique not null,name text not null,parent_id uuid references public.categories);
create table public.products(id uuid primary key default gen_random_uuid(),slug text unique not null,category_id uuid not null references public.categories,name text not null,brand text not null,reference jsonb not null,source_url text not null,demo_price_paisa bigint not null check(demo_price_paisa>=0),active boolean not null default true,search_document tsvector generated always as(to_tsvector('simple',name||' '||brand||' '||coalesce(reference->>'subcategory',''))) stored,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index products_search on public.products using gin(search_document);
create index products_category_active on public.products(category_id,active,id);
create table public.variants(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products,sku text not null unique,color text not null,materials text[] not null,width_cm numeric check(width_cm>0),depth_cm numeric check(depth_cm>0),height_cm numeric check(height_cm>0),price_paisa bigint not null check(price_paisa>=0),currency text not null default 'PKR' check(currency='PKR'),stock_on_hand integer not null default 0 check(stock_on_hand>=0),stock_reserved integer not null default 0 check(stock_reserved>=0 and stock_reserved<=stock_on_hand),active boolean not null default true,unique(product_id,color));
create table public.product_media(id uuid primary key default gen_random_uuid(),variant_id uuid not null references public.variants,url text not null,alt text not null,source_url text not null,sort_order integer not null default 0);
create table public.styles(id uuid primary key default gen_random_uuid(),name text unique not null);
create table public.product_styles(product_id uuid references public.products,style_id uuid references public.styles,primary key(product_id,style_id));
create table public.carts(id uuid primary key default gen_random_uuid(),owner_id uuid not null unique references auth.users on delete cascade);
create table public.cart_items(id uuid primary key default gen_random_uuid(),cart_id uuid not null references public.carts on delete cascade,variant_id uuid not null references public.variants,quantity integer not null check(quantity>0 and quantity<=100),unique(cart_id,variant_id));
create table public.wishlist_items(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,variant_id uuid not null references public.variants,unique(owner_id,variant_id));
create table public.orders(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,request_key uuid not null,input_hash text not null,total_paisa bigint not null check(total_paisa>=0),delivery_address text not null,order_state text not null default 'demo-confirmed',payment_state text not null default 'not-collected',fulfillment_state text not null default 'not-arranged',snapshot jsonb not null,is_demo boolean not null default true check(is_demo),created_at timestamptz not null default now(),unique(owner_id,request_key));
create index orders_owner_created on public.orders(owner_id,created_at desc);
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders,variant_id uuid not null references public.variants,quantity integer not null check(quantity>0),sku_snapshot text not null,name_snapshot text not null,unit_price_paisa bigint not null check(unit_price_paisa>=0),variant_snapshot jsonb not null);
create table public.inventory_reservations(id uuid primary key default gen_random_uuid(),order_item_id uuid not null unique references public.order_items,variant_id uuid not null references public.variants,quantity integer not null check(quantity>0),state text not null check(state in('held','committed','released')),expires_at timestamptz not null);
create table public.inventory_adjustments(id uuid primary key default gen_random_uuid(),variant_id uuid not null references public.variants,action_key text not null unique,delta integer not null,created_at timestamptz not null default now());
create table public.payments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders,provider_reference text unique,state text not null check(state in('not-collected','pending','verified','failed')),amount_paisa bigint not null check(amount_paisa>=0));
create table public.payment_events(id uuid primary key default gen_random_uuid(),payment_id uuid references public.payments,provider text not null,event_key text not null,verified boolean not null default false,created_at timestamptz not null default now(),unique(provider,event_key));
create table public.room_sessions(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,subject_id uuid references public.ai_subjects,preferences jsonb not null default '{}',budget_scope text not null default 'per-item' check(budget_scope in('per-item','whole-selection')),expires_at timestamptz not null default now()+interval '24 hours',deleted_at timestamptz,created_at timestamptz not null default now());
create table public.room_assets(id uuid primary key default gen_random_uuid(),room_id uuid not null references public.room_sessions,owner_id uuid not null references auth.users on delete cascade,object_key text not null unique,kind text not null check(kind in('source','preview')),mime text not null check(mime in('image/jpeg','image/png','image/webp')),bytes integer not null check(bytes>0 and bytes<=10485760),base_view boolean not null default false,expires_at timestamptz not null default now()+interval '24 hours',deleted_at timestamptz,created_at timestamptz not null default now());
create unique index one_base_view on public.room_assets(room_id) where base_view and deleted_at is null;
create index asset_expiry on public.room_assets(expires_at) where deleted_at is null;
create table public.recommendation_runs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,room_id uuid references public.room_sessions,input jsonb not null,created_at timestamptz not null default now());
create table public.recommendation_items(id uuid primary key default gen_random_uuid(),run_id uuid not null references public.recommendation_runs,variant_id uuid not null references public.variants,rank integer not null check(rank>0),vibe text not null,fit_state text not null check(fit_state in('unknown','fits','no-fit')),fit_note text not null,unique(run_id,rank));
create table public.saved_designs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,room_id uuid references public.room_sessions,name text not null,product_slugs text[] not null,preferences text not null,created_at timestamptz not null default now());
create table public.saved_design_assets(design_id uuid references public.saved_designs on delete cascade,asset_id uuid references public.room_assets,primary key(design_id,asset_id));
create table public.quota_windows(id uuid primary key default gen_random_uuid(),subject_id uuid not null references public.ai_subjects,window_key text not null,starts_at timestamptz not null,ends_at timestamptz,credit_limit integer not null check(credit_limit>=0),reserved integer not null default 0 check(reserved>=0),consumed integer not null default 0 check(consumed>=0),check(reserved+consumed<=credit_limit),unique(subject_id,window_key));
create table public.daily_capacity(day date primary key,credit_limit integer not null check(credit_limit>=0),reserved integer not null default 0 check(reserved>=0),consumed integer not null default 0 check(consumed>=0),check(reserved+consumed<=credit_limit));
create table public.preview_jobs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,subject_id uuid not null references public.ai_subjects,room_id uuid not null references public.room_sessions,asset_id uuid not null references public.room_assets,variant_id uuid not null references public.variants,quota_window_id uuid not null references public.quota_windows,capacity_day date not null references public.daily_capacity,request_key uuid not null,input_hash text not null,mode text not null default 'provider' check(mode='provider'),state text not null default 'queued' check(state in('queued','running','provider-pending','completed','failed','cancelled','expired')),lease_token uuid,lease_until timestamptz,attempts integer not null default 0,provider_id text,provider_request_key uuid not null default gen_random_uuid(),error_code text,expires_at timestamptz not null default now()+interval '24 hours',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(subject_id,request_key));
create index job_queue on public.preview_jobs(state,lease_until,created_at);
create table public.quota_entries(id uuid primary key default gen_random_uuid(),job_id uuid not null unique references public.preview_jobs,window_id uuid not null references public.quota_windows,state text not null check(state in('reserved','consumed','released')),updated_at timestamptz not null default now());
create table public.preview_results(id uuid primary key default gen_random_uuid(),job_id uuid not null unique references public.preview_jobs,asset_id uuid not null references public.room_assets,illustrative boolean not null default true check(illustrative));
create table public.settings(id text primary key,value jsonb not null);
insert into public.settings values('public','{"recommendationsPaused":false,"previewsPaused":false,"supportPaused":false,"realPreviewsEnabled":false,"customerDailyLimit":10,"guestLifetimeLimit":3,"globalDailyCap":100,"policies":[]}');
create table public.policy_versions(id uuid primary key default gen_random_uuid(),policy_key text not null,body text not null,approved_by uuid not null references public.profiles,created_at timestamptz not null default now());
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users,action text not null,entity_id uuid,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.search_update_events(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products,state text not null default 'pending',attempts integer not null default 0,created_at timestamptz not null default now());
create table public.consent_records(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,room_id uuid references public.room_sessions,kind text not null check(kind in('processing','saving','marketing')),granted boolean not null,created_at timestamptz not null default now());
create table public.cleanup_tasks(id uuid primary key default gen_random_uuid(),asset_id uuid not null references public.room_assets,object_key text not null,state text not null default 'pending',attempts integer not null default 0,created_at timestamptz not null default now(),unique(asset_id));

-- RLS is deny-by-default on EVERY data table, including ledgers and outboxes.
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='public' and tablename in ('profiles','guest_sessions','ai_subjects','categories','products','variants','product_media','styles','product_styles','carts','cart_items','wishlist_items','orders','order_items','inventory_reservations','inventory_adjustments','payments','payment_events','room_sessions','room_assets','recommendation_runs','recommendation_items','saved_designs','saved_design_assets','quota_windows','daily_capacity','preview_jobs','quota_entries','preview_results','settings','policy_versions','audit_logs','search_update_events','consent_records','cleanup_tasks') loop execute format('alter table public.%I enable row level security',t);end loop;end$$;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() or private.is_admin());
create policy edit_name on public.profiles for update to authenticated using(id=auth.uid() and active) with check(id=auth.uid());
revoke update on public.profiles from authenticated;grant update(name) on public.profiles to authenticated;
create policy categories_read on public.categories for select using(true);
create policy styles_read on public.styles for select using(true);
create policy product_styles_read on public.product_styles for select using(exists(select 1 from public.products p where p.id=product_id and p.active));
create policy products_read on public.products for select using(active or private.is_admin());
create policy variants_read on public.variants for select using(active and exists(select 1 from public.products p where p.id=product_id and p.active) or private.is_admin());
create policy product_media_read on public.product_media for select using(exists(select 1 from public.variants v where v.id=variant_id and v.active));
create policy settings_read on public.settings for select using(id='public');
create policy policies_read on public.policy_versions for select using(true);
create policy own_carts on public.carts for all to authenticated using(owner_id=auth.uid() and private.is_customer()) with check(owner_id=auth.uid() and private.is_customer());
create policy own_cart_items on public.cart_items for all to authenticated using(exists(select 1 from public.carts c where c.id=cart_id and c.owner_id=auth.uid()) and private.is_customer()) with check(exists(select 1 from public.carts c where c.id=cart_id and c.owner_id=auth.uid()) and private.is_customer());
create policy own_wishlist on public.wishlist_items for all to authenticated using(owner_id=auth.uid() and private.is_customer()) with check(owner_id=auth.uid() and private.is_customer());
create policy own_orders on public.orders for select to authenticated using(owner_id=auth.uid() and private.is_customer() or private.is_admin());
create policy own_order_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.owner_id=auth.uid()) and private.is_customer() or private.is_admin());
create policy own_rooms_read on public.room_sessions for select to authenticated using(owner_id=auth.uid() and deleted_at is null and expires_at>now());
create policy own_rooms_create on public.room_sessions for insert to authenticated with check(owner_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and active) and expires_at<=now()+interval '24 hours');
create policy own_assets on public.room_assets for select to authenticated using(owner_id=auth.uid() and deleted_at is null and expires_at>now() and exists(select 1 from public.room_sessions r where r.id=room_id and r.deleted_at is null));
create policy own_designs on public.saved_designs for all to authenticated using(owner_id=auth.uid() and private.is_customer()) with check(owner_id=auth.uid() and private.is_customer() and (room_id is null or exists(select 1 from public.room_sessions r where r.id=room_id and r.owner_id=auth.uid() and r.deleted_at is null and r.expires_at>now())));
create policy own_design_assets on public.saved_design_assets for select to authenticated using(exists(select 1 from public.saved_designs d where d.id=design_id and d.owner_id=auth.uid()));
create policy own_runs on public.recommendation_runs for select to authenticated using(owner_id=auth.uid());
create policy own_recommendation_items on public.recommendation_items for select to authenticated using(exists(select 1 from public.recommendation_runs r where r.id=run_id and r.owner_id=auth.uid()));
create policy own_subjects on public.ai_subjects for select to authenticated using(owner_id=auth.uid());
create policy own_quota on public.quota_windows for select to authenticated using(exists(select 1 from public.ai_subjects s where s.id=subject_id and s.owner_id=auth.uid()));
create policy own_jobs on public.preview_jobs for select to authenticated using(owner_id=auth.uid() and exists(select 1 from public.room_sessions r where r.id=room_id and r.deleted_at is null and r.expires_at>now()));
create policy own_job_results on public.preview_results for select to authenticated using(exists(select 1 from public.preview_jobs j where j.id=job_id and j.owner_id=auth.uid() and j.state='completed'));
create policy own_consents_read on public.consent_records for select to authenticated using(owner_id=auth.uid());
create policy own_consents_write on public.consent_records for insert to authenticated with check(owner_id=auth.uid() and (room_id is null or exists(select 1 from public.room_sessions r where r.id=room_id and r.owner_id=auth.uid())));
create policy admin_audit on public.audit_logs for select to authenticated using(private.is_admin());
create policy admin_search_events on public.search_update_events for select to authenticated using(private.is_admin());

-- No public URL for a room object. Expiry/soft deletion is checked at access time.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('room-assets','room-assets',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values('product-media','product-media',true) on conflict(id) do nothing;
create policy private_room_read on storage.objects for select to authenticated using(bucket_id='room-assets' and exists(select 1 from public.room_assets a join public.room_sessions r on r.id=a.room_id where a.object_key=name and a.owner_id=auth.uid() and a.deleted_at is null and a.expires_at>now() and r.deleted_at is null and r.expires_at>now()));
-- Uploads pass through a validated Edge Function with a service role. No client INSERT/UPDATE policy.

create function public.demo_checkout(p_request_key uuid,p_lines jsonb,p_address text,p_confirmed_total bigint) returns public.orders language plpgsql security definer set search_path='' as $$
declare result public.orders;v record;line jsonb;snapshot jsonb:='[]';total bigint:=0;oid uuid:=gen_random_uuid();item_id uuid;
begin
 if not private.is_customer() then raise exception 'Customer authentication required' using errcode='42501';end if;
 if length(trim(p_address))<10 or length(p_address)>1000 or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'Invalid checkout input';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_key::text,0));
 select * into result from public.orders where owner_id=auth.uid() and request_key=p_request_key;if found then if result.input_hash<>md5(p_lines::text||p_address||p_confirmed_total::text) then raise exception 'Request key input conflict';end if;return result;end if;
 for line in select value from jsonb_array_elements(p_lines) loop if (line->>'quantity')!~'^[1-9][0-9]?$' then raise exception 'Invalid quantity';end if;end loop;
 -- Stable lock order protects overlapping carts. Aggregation closes duplicate-line overselling.
 for v in select vr.*,p.slug,p.reference,p.name,p.active as product_active,coalesce((select sum((x->>'quantity')::int) from jsonb_array_elements(p_lines) x where x->>'productId'=p.slug and x->>'variant'=vr.color),0)::integer as wanted from public.variants vr join public.products p on p.id=vr.product_id where exists(select 1 from jsonb_array_elements(p_lines) x where x->>'productId'=p.slug and x->>'variant'=vr.color) order by vr.id for update of vr loop
  if not v.active or not v.product_active or v.wanted<=0 or v.wanted>100 or v.stock_on_hand-v.stock_reserved<v.wanted then raise exception 'Stock or variant changed; review your bag' using errcode='P0001';end if;
  total:=total+v.price_paisa*v.wanted;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('product',v.reference||jsonb_build_object('id',v.slug,'demoPricePKR',v.price_paisa/100.0),'quantity',v.wanted,'variant',v.color,'unitPrice',v.price_paisa/100.0,'variantId',v.id,'sku',v.sku));
 end loop;
 if jsonb_array_length(snapshot)<>(select count(*) from(select distinct x->>'productId',x->>'variant' from jsonb_array_elements(p_lines) x) d) then raise exception 'A product or variant is unavailable';end if;
 if total<>p_confirmed_total then raise exception 'Price changed; review your total' using errcode='P0001';end if;
 insert into public.orders(id,owner_id,request_key,input_hash,total_paisa,delivery_address,snapshot) values(oid,auth.uid(),p_request_key,md5(p_lines::text||p_address||p_confirmed_total::text),total,p_address,snapshot) returning * into result;
 for line in select value from jsonb_array_elements(snapshot) loop
  item_id:=gen_random_uuid();insert into public.order_items(id,order_id,variant_id,quantity,sku_snapshot,name_snapshot,unit_price_paisa,variant_snapshot) values(item_id,oid,(line->>'variantId')::uuid,(line->>'quantity')::int,line->>'sku',line->'product'->>'name',round((line->>'unitPrice')::numeric*100),line);
  insert into public.inventory_adjustments(variant_id,action_key,delta) values((line->>'variantId')::uuid,'demo-commit:'||item_id,-(line->>'quantity')::int);
  update public.variants set stock_on_hand=stock_on_hand-(line->>'quantity')::int where id=(line->>'variantId')::uuid;
  insert into public.inventory_reservations(order_item_id,variant_id,quantity,state,expires_at) values(item_id,(line->>'variantId')::uuid,(line->>'quantity')::int,'committed',now());
 end loop;
 insert into public.audit_logs(actor_id,action,entity_id) values(auth.uid(),'demo-order-created',oid);return result;
end$$;

create function private.immutable_order() returns trigger language plpgsql set search_path='' as $$begin if new.snapshot is distinct from old.snapshot or new.total_paisa<>old.total_paisa or new.owner_id<>old.owner_id or new.request_key<>old.request_key or new.input_hash<>old.input_hash then raise exception 'Order purchase snapshots are immutable';end if;return new;end$$;
create trigger immutable_order before update on public.orders for each row execute function private.immutable_order();

create function public.admin_update_product(p_slug text,p_price bigint,p_stock integer,p_active boolean) returns void language plpgsql security definer set search_path='' as $$declare pid uuid;begin
 if not private.is_admin() then raise exception 'Active administrator with MFA required' using errcode='42501';end if;if p_price<0 or p_stock<0 then raise exception 'Invalid price or stock';end if;
 update public.products set demo_price_paisa=p_price,active=p_active,updated_at=now() where slug=p_slug returning id into pid;if pid is null then raise exception 'Unknown product';end if;
 update public.variants set price_paisa=p_price,stock_on_hand=p_stock,active=p_active where product_id=pid;
 insert into public.audit_logs(actor_id,action,entity_id,metadata) values(auth.uid(),'catalogue-updated',pid,jsonb_build_object('price_paisa',p_price,'stock',p_stock,'active',p_active));insert into public.search_update_events(product_id) values(pid);end$$;
create function public.admin_update_settings(p_value jsonb) returns void language plpgsql security definer set search_path='' as $$declare p jsonb;begin
 if not private.is_admin() then raise exception 'Active administrator with MFA required' using errcode='42501';end if;
 if jsonb_typeof(p_value)<>'object' or jsonb_typeof(p_value->'policies')<>'array' then raise exception 'Invalid settings';end if;
 update public.settings set value=value||jsonb_build_object('recommendationsPaused',coalesce((p_value->>'recommendationsPaused')::boolean,false),'previewsPaused',coalesce((p_value->>'previewsPaused')::boolean,false),'supportPaused',coalesce((p_value->>'supportPaused')::boolean,false),'policies',p_value->'policies') where id='public';
 for p in select value from jsonb_array_elements(p_value->'policies') loop if length(p->>'body') not between 1 and 5000 then raise exception 'Invalid policy';end if;insert into public.policy_versions(policy_key,body,approved_by) values(p->>'id',p->>'body',auth.uid());end loop;
 insert into public.audit_logs(actor_id,action) values(auth.uid(),'settings-published');end$$;

-- Atomic real-preview reservation. Local overlays NEVER call this routine.
create function public.reserve_preview(p_room uuid,p_asset uuid,p_variant uuid,p_key uuid) returns public.preview_jobs language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();subject public.ai_subjects;cfg jsonb;win public.quota_windows;job public.preview_jobs;v_day date:=(now() at time zone 'Asia/Karachi')::date;start_time timestamptz;end_time timestamptz;wk text;lim integer;inputhash text;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and active) then raise exception 'Authentication required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_key::text,0));
 inputhash:=encode(extensions.digest(p_room::text||p_asset::text||p_variant::text,'sha256'),'hex');
 select * into job from public.preview_jobs where owner_id=uid and request_key=p_key;if found then if job.input_hash<>inputhash then raise exception 'Request key input conflict';end if;return job;end if;
 select value into cfg from public.settings where id='public';if coalesce((cfg->>'previewsPaused')::boolean,true) or not coalesce((cfg->>'realPreviewsEnabled')::boolean,false) then raise exception 'AI previews paused or unavailable' using errcode='P0001';end if;
 perform 1 from public.room_sessions where id=p_room and owner_id=uid and deleted_at is null and expires_at>now() for update;if not found then raise exception 'Room inaccessible';end if;
 if not coalesce((select granted from public.consent_records where owner_id=uid and room_id=p_room and kind='processing' order by created_at desc,id desc limit 1),false) then raise exception 'Processing consent required';end if;
 if not exists(select 1 from public.room_assets where id=p_asset and room_id=p_room and owner_id=uid and deleted_at is null and expires_at>now()) then raise exception 'Base asset inaccessible';end if;
 if not exists(select 1 from public.variants v join public.products p on p.id=v.product_id where v.id=p_variant and v.active and p.active and v.stock_on_hand-v.stock_reserved>0) then raise exception 'Variant unavailable';end if;
 insert into public.ai_subjects(owner_id,tier) values(uid,case when private.is_customer() then 'customer' else 'guest' end) on conflict(owner_id,tier) do nothing;select * into subject from public.ai_subjects where owner_id=uid and tier=case when private.is_customer() then 'customer' else 'guest' end for update;
 if subject.tier='customer' then start_time:=v_day::timestamp at time zone 'Asia/Karachi';end_time:=(v_day+1)::timestamp at time zone 'Asia/Karachi';wk:=v_day::text;lim:=coalesce((cfg->>'customerDailyLimit')::int,10);else start_time:=subject.created_at;end_time:=null;wk:='lifetime';lim:=coalesce((cfg->>'guestLifetimeLimit')::int,3);end if;
 insert into public.daily_capacity(day,credit_limit) values(v_day,coalesce((cfg->>'globalDailyCap')::int,100)) on conflict do nothing;
 perform 1 from public.daily_capacity where daily_capacity.day=v_day and reserved+consumed<credit_limit for update;if not found then raise exception 'Global preview capacity reached';end if;
 insert into public.quota_windows(subject_id,window_key,starts_at,ends_at,credit_limit) values(subject.id,wk,start_time,end_time,lim) on conflict do nothing;
 select * into win from public.quota_windows where subject_id=subject.id and window_key=wk for update;if win.reserved+win.consumed>=win.credit_limit then raise exception 'Preview allowance exhausted';end if;
 insert into public.preview_jobs(owner_id,subject_id,room_id,asset_id,variant_id,quota_window_id,capacity_day,request_key,input_hash) values(uid,subject.id,p_room,p_asset,p_variant,win.id,v_day,p_key,inputhash) returning * into job;
 insert into public.quota_entries(job_id,window_id,state) values(job.id,win.id,'reserved');update public.quota_windows set reserved=reserved+1 where id=win.id;update public.daily_capacity set reserved=reserved+1 where daily_capacity.day=v_day;return job;
end$$;
create function public.lease_preview() returns public.preview_jobs language plpgsql security definer set search_path='' as $$declare j public.preview_jobs;begin
 select * into j from public.preview_jobs where state='queued' and expires_at>now() and attempts<3 order by created_at for update skip locked limit 1;if not found then return null;end if;
 update public.preview_jobs set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() where id=j.id returning * into j;return j;end$$;
create function public.record_provider(p_job uuid,p_lease uuid,p_provider text) returns void language plpgsql security definer set search_path='' as $$begin update public.preview_jobs set provider_id=p_provider,state='provider-pending',updated_at=now() where id=p_job and lease_token=p_lease and state='running' and lease_until>now();if not found then raise exception 'Lease lost';end if;end$$;
create function public.finalize_preview(p_job uuid,p_success boolean,p_result_asset uuid default null,p_lease uuid default null) returns void language plpgsql security definer set search_path='' as $$declare j public.preview_jobs;e public.quota_entries;valid boolean;begin
 select * into j from public.preview_jobs where id=p_job for update;if not found then raise exception 'Job inaccessible';end if;
 select * into e from public.quota_entries where job_id=j.id for update;if e.state<>'reserved' then return;end if;
 if p_success and (p_lease is null or j.lease_token<>p_lease) then raise exception 'Lease mismatch';end if;
 valid:=p_success and j.expires_at>now() and j.state in('running','provider-pending') and exists(select 1 from public.room_sessions where id=j.room_id and deleted_at is null and expires_at>now()) and exists(select 1 from public.room_assets where id=p_result_asset and room_id=j.room_id and owner_id=j.owner_id and kind='preview' and deleted_at is null and expires_at>now());
 update public.quota_entries set state=case when valid then 'consumed' else 'released' end,updated_at=now() where id=e.id;
 update public.quota_windows set reserved=reserved-1,consumed=consumed+case when valid then 1 else 0 end where id=e.window_id;
 update public.daily_capacity set reserved=reserved-1,consumed=consumed+case when valid then 1 else 0 end where day=j.capacity_day;
 update public.preview_jobs set state=case when valid then 'completed' when j.state in('cancelled','expired') then j.state else 'failed' end,lease_until=null,updated_at=now() where id=j.id;
 if valid then insert into public.preview_results(job_id,asset_id) values(j.id,p_result_asset) on conflict do nothing;elsif p_result_asset is not null then update public.room_assets set deleted_at=now() where id=p_result_asset;insert into public.cleanup_tasks(asset_id,object_key) select id,object_key from public.room_assets where id=p_result_asset on conflict do nothing;end if;
 insert into public.cleanup_tasks(asset_id,object_key) select a.id,a.object_key from public.room_assets a where a.room_id=j.room_id and a.kind='source' and not exists(select 1 from public.saved_design_assets s where s.asset_id=a.id) on conflict do nothing;
 update public.room_assets set deleted_at=now() where room_id=j.room_id and kind='source' and not exists(select 1 from public.saved_design_assets s where s.asset_id=room_assets.id);
end$$;
create function public.delete_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$declare j record;begin
 perform 1 from public.room_sessions where id=p_room and owner_id=auth.uid() for update;if not found then raise exception 'Room inaccessible' using errcode='42501';end if;
 update public.room_sessions set deleted_at=now() where id=p_room;update public.room_assets set deleted_at=now() where room_id=p_room;
 insert into public.cleanup_tasks(asset_id,object_key) select id,object_key from public.room_assets where room_id=p_room on conflict do nothing;
 for j in select id from public.preview_jobs where room_id=p_room and state in('queued','running','provider-pending') loop update public.preview_jobs set state='cancelled' where id=j.id;perform public.finalize_preview(j.id,false);end loop;end$$;

-- Explicit grants prevent privileged functions inheriting default PUBLIC execution.
revoke all on function public.demo_checkout(uuid,jsonb,text,bigint),public.admin_update_product(text,bigint,integer,boolean),public.admin_update_settings(jsonb),public.reserve_preview(uuid,uuid,uuid,uuid),public.delete_room(uuid),public.lease_preview(),public.record_provider(uuid,uuid,text),public.finalize_preview(uuid,boolean,uuid,uuid) from public,anon,authenticated;
grant execute on function public.demo_checkout(uuid,jsonb,text,bigint),public.admin_update_product(text,bigint,integer,boolean),public.admin_update_settings(jsonb),public.reserve_preview(uuid,uuid,uuid,uuid),public.delete_room(uuid) to authenticated;
grant execute on function public.lease_preview(),public.record_provider(uuid,uuid,text),public.finalize_preview(uuid,boolean,uuid,uuid) to service_role;
revoke all on schema private from public;grant usage on schema private to authenticated,anon;grant execute on function private.is_customer(),private.is_admin() to authenticated,anon;
grant select on public.categories,public.products,public.variants,public.product_media,public.styles,public.product_styles,public.settings,public.policy_versions to anon,authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on public.carts,public.cart_items,public.wishlist_items,public.saved_designs to authenticated;
grant insert on public.room_sessions,public.consent_records to authenticated;
