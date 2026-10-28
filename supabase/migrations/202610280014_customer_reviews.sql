begin;
-- Private purchase evidence is separate from the public review text.
create table public.customer_product_reviews (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 order_id uuid not null references public.store_orders(id),
 product_slug text not null references public.products(slug),
 rating integer not null check(rating between 1 and 5),
 headline text not null check(length(headline) between 3 and 120),
 comment text not null check(length(comment) between 10 and 1200),
 author_label text not null,
 created_at timestamptz not null default now(),
 unique(owner_id,product_slug)
);
alter table public.customer_product_reviews enable row level security;
revoke all on public.customer_product_reviews from public,anon,authenticated;
grant select on public.customer_product_reviews to authenticated;
grant all on public.customer_product_reviews to service_role;
create policy own_customer_reviews on public.customer_product_reviews for select to authenticated
 using ((owner_id=auth.uid() and private.is_customer()) or private.is_admin());
create index customer_product_reviews_created on public.customer_product_reviews(created_at desc);

create function public.get_customer_reviews(p_slug text default null)
returns table(id uuid,product_slug text,rating integer,headline text,comment text,author_label text,created_at timestamptz,is_sample boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select r.id,r.product_slug,r.rating,r.headline,r.comment,r.author_label,r.created_at,false
 from public.customer_product_reviews r join public.products p on p.slug=r.product_slug and p.active
 where p_slug is null or r.product_slug=p_slug order by r.created_at desc,r.id limit 1000
$$;
revoke all on function public.get_customer_reviews(text) from public;
grant execute on function public.get_customer_reviews(text) to anon,authenticated;

create function public.reviewable_purchases(p_slug text default null)
returns table(order_id uuid,product_slug text,product_name text)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not private.is_customer() then raise exception 'Sign in to review a delivered purchase';end if;
 return query select distinct on (p.slug) o.id,p.slug,coalesce(line->>'name',p.slug)
 from public.store_orders o cross join lateral jsonb_array_elements(o.snapshot) line
 join public.products p on p.slug=line->>'productId' and p.active
 where o.owner_id=auth.uid() and o.order_state='delivered' and (p_slug is null or p.slug=p_slug)
 and not exists(select 1 from public.customer_product_reviews r where r.owner_id=auth.uid() and r.product_slug=p.slug)
 order by p.slug,o.created_at desc limit 100;
end $$;
revoke all on function public.reviewable_purchases(text) from public,anon;
grant execute on function public.reviewable_purchases(text) to authenticated;

create function public.submit_customer_review(p_order uuid,p_slug text,p_rating integer,p_headline text,p_comment text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare purchase public.store_orders; result uuid; existing public.customer_product_reviews; label text;
begin
 if not private.is_customer() then raise exception 'Sign in to review a delivered purchase';end if;
 if p_rating is null or p_rating not between 1 and 5 or p_headline is null or length(trim(p_headline)) not between 3 and 120
 or p_comment is null or length(trim(p_comment)) not between 10 and 1200 then raise exception 'Choose 1–5 stars and complete the review';end if;
 select * into purchase from public.store_orders where id=p_order and owner_id=auth.uid() and order_state='delivered' for share;
 if not found or not exists(select 1 from jsonb_array_elements(purchase.snapshot) line where line->>'productId'=p_slug)
 or not exists(select 1 from public.products where slug=p_slug and active) then raise exception 'A delivered purchase of this product is required';end if;
 -- Serialize retries and prevent concurrent duplicate reviews.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_slug,0));
 select * into existing from public.customer_product_reviews where owner_id=auth.uid() and product_slug=p_slug;
 if found then
  if existing.rating=p_rating and existing.headline=trim(p_headline) and existing.comment=trim(p_comment) then return existing.id;end if;
  raise exception 'You have already reviewed this product';
 end if;
 label:=left(split_part(trim(purchase.customer_name),' ',1),40);
 if label='' or label like '%@%' then label:='Customer';end if;
 insert into public.customer_product_reviews(owner_id,order_id,product_slug,rating,headline,comment,author_label)
 values(auth.uid(),p_order,p_slug,p_rating,trim(p_headline),trim(p_comment),label) returning id into result;
 return result;
end $$;
revoke all on function public.submit_customer_review(uuid,text,integer,text,text) from public,anon;
grant execute on function public.submit_customer_review(uuid,text,integer,text,text) to authenticated;

-- One service email per delivered order. No historical backfill and no test customers.
create table public.review_email_queue (
 order_id uuid primary key references public.store_orders(id),
 state text not null default 'pending' check(state in ('pending','sending','sent','failed','skipped')),
 created_at timestamptz not null default now(),
 lease_token uuid,lease_until timestamptz,attempts integer not null default 0,
 sent_at timestamptz,provider_id text,last_error text
);
alter table public.review_email_queue enable row level security;
revoke all on public.review_email_queue from public,anon,authenticated;
grant select on public.review_email_queue to authenticated;
create policy admin_review_email_status on public.review_email_queue for select to authenticated using(private.is_admin());
grant all on public.review_email_queue to service_role;
create function private.queue_delivered_review() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.order_state='delivered' and old.order_state is distinct from 'delivered'
 and exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=new.owner_id and p.active and u.email_confirmed_at is not null and u.email is not null)
 then insert into public.review_email_queue(order_id) values(new.id) on conflict do nothing;end if;
 return new;
end $$;
revoke all on function private.queue_delivered_review() from public,anon,authenticated;
create trigger delivered_review_invitation after update of order_state on public.store_orders for each row execute function private.queue_delivered_review();

create function public.lease_review_email() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare q public.review_email_queue; token uuid:=gen_random_uuid(); recipient text; slugs jsonb;
begin
 -- Ambiguous sends older than the provider's short deduplication window need staff review, never a blind retry.
 update public.review_email_queue set state='failed',last_error='DELIVERY_UNCERTAIN',lease_until=null where state='sending' and lease_until<now();
 select * into q from public.review_email_queue where state='pending' order by created_at for update skip locked limit 1;
 if not found then return null;end if;
 select u.email into recipient from public.store_orders o join auth.users u on u.id=o.owner_id join public.profiles p on p.id=o.owner_id
 where o.id=q.order_id and o.order_state='delivered' and p.active and u.email_confirmed_at is not null;
 select jsonb_agg(distinct line->>'productId') into slugs from public.store_orders o cross join lateral jsonb_array_elements(o.snapshot) line
 join public.products p on p.slug=line->>'productId' and p.active
 where o.id=q.order_id and not exists(select 1 from public.customer_product_reviews r where r.owner_id=o.owner_id and r.product_slug=p.slug);
 if recipient is null or slugs is null then update public.review_email_queue set state='skipped' where order_id=q.order_id;return null;end if;
 update public.review_email_queue set state='sending',lease_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where order_id=q.order_id;
 return jsonb_build_object('orderId',q.order_id,'leaseToken',token,'email',recipient,'slugs',slugs);
end $$;
create function public.finish_review_email(p_order uuid,p_lease uuid,p_provider text,p_error text default null) returns boolean
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.review_email_queue set state=case when p_error is null then 'sent' else 'failed' end,
 sent_at=case when p_error is null then now() else null end,provider_id=left(p_provider,200),last_error=left(p_error,100),lease_until=null
 where order_id=p_order and lease_token=p_lease and state='sending' and lease_until>now();return found;
end $$;
revoke all on function public.lease_review_email(),public.finish_review_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.lease_review_email(),public.finish_review_email(uuid,uuid,text,text) to service_role;
commit;
