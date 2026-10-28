begin;
-- Public product slugs ranked by delivered, paid units. No order/customer fields.
create function public.get_store_bestsellers() returns table(slug text)
language sql stable security definer set search_path='' as $$
 with sold as (
  select p.slug,o.created_at,
   case when (item->>'quantity')~'^[0-9]{1,2}$' then (item->>'quantity')::int else 0 end quantity
  from public.store_orders o
  cross join lateral jsonb_array_elements(case when jsonb_typeof(o.snapshot)='array' then o.snapshot else '[]'::jsonb end) item
  join public.products p on p.slug=item->>'productId' and p.active
  where o.order_state='delivered' and o.payment_state='paid'
 )
 select sold.slug from sold where quantity>0 group by sold.slug
 order by sum(quantity) desc,max(created_at) desc,sold.slug limit 6
$$;
revoke all on function public.get_store_bestsellers() from public,anon,authenticated;
grant execute on function public.get_store_bestsellers() to anon,authenticated,service_role;
commit;
