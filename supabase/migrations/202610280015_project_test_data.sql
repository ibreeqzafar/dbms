begin;
-- DBMS fixtures: isolated tables, never auth.users or real commerce tables.
create table public.project_test_customers (
 id text primary key check(id like 'TEST-C%'),name text not null,email text unique not null check(email like '%@example.invalid'),registered timestamptz not null,
 is_test boolean not null default true check(is_test)
);
create table public.project_test_orders (
 id text primary key check(id like 'TEST-O%'),customer_id text not null references public.project_test_customers(id),
 product_slug text not null references public.products(slug),quantity integer not null check(quantity between 1 and 3),total_pkr numeric not null check(total_pkr>=0),
 state text not null check(state in ('delivered','processing','dispatched','cancelled')),created_at timestamptz not null,
 is_test boolean not null default true check(is_test)
);
create table public.project_test_reviews (
 id text primary key check(id like 'TEST-R%'),order_id text unique not null references public.project_test_orders(id),
 rating integer not null check(rating between 1 and 5),headline text not null,comment text not null,
 is_test boolean not null default true check(is_test)
);
alter table public.project_test_customers enable row level security;
alter table public.project_test_orders enable row level security;
alter table public.project_test_reviews enable row level security;
revoke all on public.project_test_customers,public.project_test_orders,public.project_test_reviews from public,anon,authenticated;
grant select on public.project_test_customers,public.project_test_orders,public.project_test_reviews to authenticated;
grant all on public.project_test_customers,public.project_test_orders,public.project_test_reviews to service_role;
create policy admin_test_customers on public.project_test_customers for select to authenticated using(private.is_admin());
create policy admin_test_orders on public.project_test_orders for select to authenticated using(private.is_admin());
create policy admin_test_reviews on public.project_test_reviews for select to authenticated using(private.is_admin());
insert into public.project_test_customers(id,name,email,registered)
select 'TEST-C'||lpad(n::text,4,'0'),(array['Amina','Zara','Hassan','Sara','Ali','Noor','Hamza','Hira','Usman','Maryam'])[(n-1)%10+1]||' Test '||n,
 'customer'||n||'@example.invalid',timestamptz '2026-01-01 00:00:00+00'+floor((n-1)::numeric/750*290)::int*interval '1 day'
from generate_series(1,750) n;
with ranked as(select slug,demo_price_paisa,row_number() over(order by slug)-1 idx,count(*) over() cnt from public.products where active),
fixtures as(select n,r.* from generate_series(1,600) n join ranked r on r.idx=(((n-1)::bigint*(n-1)+7*(n-1))%r.cnt))
insert into public.project_test_orders(id,customer_id,product_slug,quantity,total_pkr,state,created_at)
select 'TEST-O'||lpad(n::text,4,'0'),'TEST-C'||lpad(n::text,4,'0'),slug,(n-1)%3+1,demo_price_paisa::numeric/100*((n-1)%3+1),
case when n<=520 then 'delivered' when n<=550 then 'processing' when n<=580 then 'dispatched' else 'cancelled' end,
timestamptz '2026-01-02 00:00:00+00'+floor((n-1)::numeric/600*289)::int*interval '1 day' from fixtures;
insert into public.project_test_reviews(id,order_id,rating,headline,comment)
select 'TEST-R'||n,'TEST-O'||lpad(n::text,4,'0'),(array[5,4,5,3,4,5,2,4,5,1])[(n-1)%10+1],'Test purchase feedback',
(array['Comfortable for everyday use.','The finish was different from my expectation.','Useful storage and a practical size.','Delivery took longer than expected.'])[(n-1)%4+1]
from generate_series(1,500) n where exists(select 1 from public.project_test_orders where id='TEST-O'||lpad(n::text,4,'0'));

create function public.get_admin_test_data() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not private.is_admin() then raise exception 'Administrator MFA required';end if;
 return jsonb_build_object('customers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email,'registered',registered) order by id) from public.project_test_customers),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'customerId',o.customer_id,'productId',o.product_slug,'productName',coalesce(p.reference->>'name',o.product_slug),'total',o.total_pkr,'quantity',o.quantity,'state',o.state,'created',o.created_at) order by o.id) from public.project_test_orders o join public.products p on p.slug=o.product_slug),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'customerId',o.customer_id,'productId',o.product_slug,'rating',r.rating,'headline',r.headline,'comment',r.comment) order by r.id) from public.project_test_reviews r join public.project_test_orders o on o.id=r.order_id),'[]'::jsonb),
 'popularity',coalesce((select jsonb_agg(jsonb_build_array(product_slug,units) order by units desc,product_slug) from(select product_slug,sum(quantity) units from public.project_test_orders where state='delivered' group by product_slug) x),'[]'::jsonb));
end $$;
revoke all on function public.get_admin_test_data() from public,anon;
grant execute on function public.get_admin_test_data() to authenticated;
commit;
