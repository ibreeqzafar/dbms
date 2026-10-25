begin;
update public.settings set value=jsonb_set(value,'{policies}',coalesce((select jsonb_agg(case when policy->>'id'='payment' then jsonb_set(policy,'{body}',to_jsonb('Prices are displayed in PKR. Cash-on-delivery ordering is available to signed-in customers. Online payments will be available after the merchant connection is verified. COD is unpaid until collected. Delivery charges need confirmation before dispatch.'::text)) else policy end) from jsonb_array_elements(coalesce(value->'policies','[]'::jsonb)) policy),'[]'::jsonb)) where id='public';
commit;
