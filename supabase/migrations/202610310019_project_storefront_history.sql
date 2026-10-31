begin;
-- Public project presentation exposes product-level history only, never private customer records.
create function public.get_project_product_reviews(p_slug text default null)
returns table(id text,product_slug text,rating integer,headline text,comment text,author_label text,created_at timestamptz,is_sample boolean)
language sql stable security definer set search_path=pg_catalog,public as $$
 select 'history-'||r.id,o.product_slug,r.rating,
 case when lower(r.headline) like '%test%' then case when r.rating>=4 then 'My experience with this piece' else 'Thoughts after delivery' end else r.headline end,
 r.comment,left(split_part(c.name,' ',1),40),o.created_at+interval '1 day',true
 from public.project_test_reviews r
 join public.project_test_orders o on o.id=r.order_id
 join public.project_test_customers c on c.id=o.customer_id
 join public.products p on p.slug=o.product_slug and p.active
 where o.state='delivered' and (p_slug is null or o.product_slug=p_slug)
 order by o.created_at desc,r.id;
$$;
revoke all on function public.get_project_product_reviews(text) from public,anon,authenticated;
grant execute on function public.get_project_product_reviews(text) to anon,authenticated,service_role;

create function public.get_homepage_bestsellers() returns table(slug text)
language sql stable security definer set search_path=pg_catalog,public as $$
 with delivered as (
  select product_slug as slug,quantity::bigint as units,created_at from public.project_test_orders where state='delivered'
  union all
  select item->>'productId',case when (item->>'quantity')~'^[0-9]{1,2}$' then (item->>'quantity')::bigint else 0 end,o.created_at
  from public.store_orders o cross join lateral jsonb_array_elements(case when jsonb_typeof(o.snapshot)='array' then o.snapshot else '[]'::jsonb end) item
  where o.order_state='delivered' and o.payment_state='paid'
 )
 select d.slug from delivered d join public.products p on p.slug=d.slug and p.active
 where d.units>0 group by d.slug order by sum(d.units) desc,max(d.created_at) desc,d.slug limit 50;
$$;
revoke all on function public.get_homepage_bestsellers() from public,anon,authenticated;
grant execute on function public.get_homepage_bestsellers() to anon,authenticated,service_role;
commit;
